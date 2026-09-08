/**
 * BuildPreviewController — build-ghost state machine + click-to-build flow.
 *
 * All rendering for the build ghost (outline, range circle, rail snap,
 * crosshair) lives in the WebGL renderer. This controller owns the state:
 * it queries buildables for the cursor tile, tracks whether the placement
 * is valid, and pushes preview data straight to the WebGL view.
 */

import { EventBus } from "../../core/EventBus";
import { listNukeBreakAlliance } from "../../core/execution/Util";
import {
  BuildableUnit,
  bulkCost,
  PlayerBuildableUnitType,
  UnitType,
} from "../../core/game/Game";
import { TileRef } from "../../core/game/GameMap";
import { UserSettings } from "../../core/game/UserSettings";
import { Controller } from "../Controller";
import {
  ConfirmGhostStructureEvent,
  MouseMoveEvent,
  MouseUpEvent,
} from "../InputHandler";
import { buildNukeTrajectory, MapRenderer } from "../render/gl";
import type { SAMInfo } from "../render/gl/utils/NukeTrajectory";
import type { GhostPreviewData } from "../render/types";
import { TransformHandler } from "../TransformHandler";
import {
  BuildUnitIntentEvent,
  FireInlandBatteryIntentEvent,
  SendUpgradeStructureIntentEvent,
} from "../Transport";
import { UIState } from "../UIState";
import { GameView } from "../view";

/** True for nuke types (AtomBomb, HydrogenBomb): ghost is preserved after placement so user can place multiple or keep selection (Enter/key confirm). */
export function shouldPreserveGhostAfterBuild(unitType: UnitType): boolean {
  return unitType === UnitType.AtomBomb || unitType === UnitType.HydrogenBomb;
}

// tSamIntercept value used to flag an untargetable (impassable) destination:
// draws the red X marker essentially at the destination while leaving the
// visible line unchanged (1.0 would mean "no marker").
const T_BLOCKED_DST = 0.9999;

/**
 * Whether a SAM belongs in the nuke trajectory preview's threat set.
 * Mirrors SAMLauncherExecution: a SAM ignores a nuke whose owner it's
 * friendly with (same team OR allied).
 * Teammates are excluded unconditionally — a strike can break an alliance
 * but never a team relationship, so a teammate's SAM never engages.
 * Allied SAMs are excluded unless the strike would betray that ally — the
 * alliance breaks at launch, so their SAMs will engage the nuke.
 * (Own SAMs never threaten; the caller filters those out first.)
 */
export function samThreatensNukePreview(
  samOwnerSmallId: number,
  teammateSmallIds: ReadonlySet<number>,
  allySmallIds: ReadonlySet<number>,
  betrayedSmallIds: ReadonlySet<number>,
): boolean {
  if (teammateSmallIds.has(samOwnerSmallId)) return false;
  return (
    !allySmallIds.has(samOwnerSmallId) || betrayedSmallIds.has(samOwnerSmallId)
  );
}

export class BuildPreviewController implements Controller {
  /** Current ghost (null when no build type is active). */
  private ghostUnit: { buildableUnit: BuildableUnit } | null = null;
  private readonly usedSafetyAllies: Set<number> = new Set();
  private readonly mousePos = { x: 0, y: 0 };
  private lastGhostQueryAt: number = 0;
  private pendingConfirm: MouseUpEvent | null = null;

  // Buildable validation runs on the snapped tile under the cursor, but the
  // rendered icon follows the cursor at sub-tile precision so motion is
  // continuous instead of stepping tile-to-tile. cursorLoop re-emits each
  // frame with the current cursor world position.
  private lastGhostData: GhostPreviewData | null = null;

  // Static inputs for the nuke trajectory preview (source silo + threatening
  // SAMs). Recomputed in the throttled renderGhost path; cursorLoop rebuilds
  // the Bezier each frame with the live cursor position as the destination so
  // the arc tracks the cursor smoothly instead of snapping tile-to-tile.
  private nukeTrajectoryStatic: {
    srcX: number;
    srcY: number;
    directionUp: boolean;
    sams: SAMInfo[];
  } | null = null;

  constructor(
    private game: GameView,
    private eventBus: EventBus,
    public uiState: UIState,
    private transformHandler: TransformHandler,
    private view: MapRenderer,
    private userSettings: UserSettings,
  ) {}

  init() {
    this.eventBus.on(MouseMoveEvent, (e) => this.moveGhost(e));
    this.eventBus.on(MouseUpEvent, (e) => this.requestConfirmStructure(e));
    this.eventBus.on(ConfirmGhostStructureEvent, () =>
      this.requestConfirmStructure(
        new MouseUpEvent(this.mousePos.x, this.mousePos.y),
      ),
    );

    // Re-emit the ghost each render frame at the cursor's current world
    // position (sub-tile). Buildable validation still runs on the snapped
    // tile in renderGhost(); this loop just keeps the icon under the cursor
    // so motion is continuous instead of stepping tile-to-tile.
    // The shader treats (tileX + 0.5, tileY + 0.5) as the icon center (so an
    // integer tile coord centers on that tile), so we subtract 0.5 here to
    // place the icon exactly under the cursor.
    const cursorLoop = () => {
      if (this.uiState.inlandBatteryAimUnitId != null) {
        this.emitInlandBatteryAimPreview();
      } else if (this.lastGhostData?.ghostType === "Inland Battery Aim") {
        this.lastGhostData = null;
        this.view.updateGhostPreview(null);
      }
      const ghost = this.lastGhostData;
      const traj = this.nukeTrajectoryStatic;
      if (ghost !== null || traj !== null) {
        const w = this.transformHandler.screenToWorldCoordinatesFloat(
          this.mousePos.x,
          this.mousePos.y,
        );
        if (ghost !== null) {
          // The range circle (defense post / SAM / nuke radius) normally
          // follows the cursor, so smooth it the same way as the icon. When
          // upgrading, the circle is anchored to the existing structure's tile
          // (stationary, correctly snapped) — leave it alone in that case.
          // Naval mine range is the coastal placement zone, anchored to shore.
          const radiusFollowsCursor =
            !(ghost.canUpgrade && ghost.upgradeTargetTile !== null) &&
            ghost.ghostType !== UnitType.NavalMine;
          this.view.updateGhostPreview({
            ...ghost,
            tileX: w.x - 0.5,
            tileY: w.y - 0.5,
            ...(radiusFollowsCursor
              ? { radiusTileX: w.x - 0.5, radiusTileY: w.y - 0.5 }
              : {}),
          });
        }
        if (traj !== null) {
          // Rebuild the arc with the live cursor as the destination (same
          // tile-center convention as the icon: shader adds +0.5).
          const data = buildNukeTrajectory(
            traj.srcX,
            traj.srcY,
            w.x - 0.5,
            w.y - 0.5,
            this.game.height(),
            traj.directionUp,
            traj.sams,
          );
          // Impassable terrain can't be targeted (nukeSpawn rejects it)
          // even though nukes fly over it — mark the destination with the
          // blocked X. Checked per frame so the X tracks the live cursor.
          const tx = Math.floor(w.x);
          const ty = Math.floor(w.y);
          if (
            this.game.isValidCoord(tx, ty) &&
            this.game.isImpassable(this.game.ref(tx, ty))
          ) {
            data.tSamIntercept = Math.min(data.tSamIntercept, T_BLOCKED_DST);
          }
          this.view.updateNukeTrajectory(data);
        }
      }
      requestAnimationFrame(cursorLoop);
    };
    requestAnimationFrame(cursorLoop);
  }

  tick() {
    if (this.uiState.inlandBatteryAimUnitId != null) {
      if (this.ghostUnit !== null || this.uiState.ghostStructure !== null) {
        this.removeGhostStructure();
      }
      this.emitInlandBatteryAimPreview();
      return;
    }
    // Re-query buildables periodically (world state can change — tiles may
    // become buildable as troops/territory move).
    this.syncGhostState();
    this.renderGhost();
  }

  /**
   * Reconcile our internal ghost state with uiState.ghostStructure. Other
   * UI bits (build menu, key bindings) toggle uiState; we mirror it here.
   */
  private syncGhostState(): void {
    const target = this.uiState.ghostStructure;
    if (this.ghostUnit) {
      if (target === null) {
        this.removeGhostStructure();
      } else if (target !== this.ghostUnit.buildableUnit.type) {
        this.clearGhostStructure();
        this.createGhostStructure(target);
      }
    } else if (target !== null) {
      this.createGhostStructure(target);
    }
  }

  renderGhost() {
    if (!this.ghostUnit) return;

    const now = performance.now();
    if (now - this.lastGhostQueryAt < 50) return;
    this.lastGhostQueryAt = now;
    let tileRef: TileRef | undefined;
    let trajectoryTileRef: TileRef | undefined;
    const tile = this.transformHandler.screenToWorldCoordinates(
      this.mousePos.x,
      this.mousePos.y,
    );
    if (this.game.isValidCoord(tile.x, tile.y)) {
      tileRef = this.game.ref(tile.x, tile.y);
      trajectoryTileRef = tileRef;
      // Impassable terrain is a void — treat hovering over it the same as
      // hovering outside the map (no ghost, no blast circle). The nuke
      // trajectory preview is the exception: nukes fly over impassable
      // terrain, so the arc still renders (with a blocked X at the
      // untargetable destination — see cursorLoop).
      if (this.game.isImpassable(tileRef)) {
        tileRef = undefined;
      }
    }

    // Check if targeting an ally (for nuke warning visual). Nukes are not
    // player-buildable in this era, so this stays false.
    let targetingAlly = false;
    const myPlayer = this.game.myPlayer();

    this.game
      ?.myPlayer()
      ?.buildables(tileRef, [this.ghostUnit?.buildableUnit.type])
      .then((buildables) => {
        if (!this.ghostUnit) {
          this.pendingConfirm = null;
          this.emitGhostPreview(tileRef, targetingAlly, trajectoryTileRef);
          return;
        }

        const unit = buildables.find(
          (u) => u.type === this.ghostUnit!.buildableUnit.type,
        );
        if (!unit) {
          Object.assign(this.ghostUnit.buildableUnit, {
            canBuild: false,
            canUpgrade: false,
          });
          this.pendingConfirm = null;
          this.emitGhostPreview(tileRef, targetingAlly, trajectoryTileRef);
          return;
        }

        this.ghostUnit.buildableUnit = unit;

        if (this.pendingConfirm !== null) {
          const ev = this.pendingConfirm;
          this.pendingConfirm = null;
          if (this.isGhostReadyForConfirm()) {
            this.createStructure(ev);
          }
        }

        this.emitGhostPreview(tileRef, targetingAlly, trajectoryTileRef);
      });
  }

  /**
   * Push a GhostPreviewData snapshot to the WebGL view (StructurePass /
   * RangeCirclePass / RailroadPass / CrosshairPass all read it). null when
   * the ghost can't be placed. smoothLoop interpolates displayed position
   * toward the target tile each frame.
   */
  private emitGhostPreview(
    tileRef: TileRef | undefined,
    targetingAlly: boolean,
    trajectoryTileRef: TileRef | undefined,
  ): void {
    const data = this.buildGhostPreviewData(tileRef, targetingAlly);
    if (data === null) {
      this.lastGhostData = null;
      this.view.updateGhostPreview(null);
    } else {
      this.lastGhostData = data;
    }
    // The trajectory target is tracked separately from the ghost tile:
    // impassable terrain voids the ghost but still gets a trajectory arc.
    this.updateNukeTrajectoryPreview(trajectoryTileRef);
  }

  /**
   * For AtomBomb / HydrogenBomb ghosts, push the Bezier trajectory preview
   * (closest player-owned silo → target, accounting for non-allied SAMs).
   * Cleared whenever the ghost isn't a nuke, has no target, or the player
   * has no silos. Unlike the ghost icon, the trajectory also renders when
   * hovering impassable terrain (cursorLoop adds the blocked X there).
   */
  private updateNukeTrajectoryPreview(_tileRef: TileRef | undefined): void {
    this.clearNukeTrajectory();
  }

  private clearNukeTrajectory(): void {
    this.nukeTrajectoryStatic = null;
    this.view.updateNukeTrajectory(null);
  }

  private buildGhostPreviewData(
    tileRef: TileRef | undefined,
    targetingAlly: boolean,
  ): GhostPreviewData | null {
    if (!this.ghostUnit) return null;
    if (tileRef === undefined) return null;
    const myPlayer = this.game.myPlayer();
    if (!myPlayer) return null;

    const u = this.ghostUnit.buildableUnit;

    // Upgrade-target tile — only when upgrading an existing unit.
    let upgradeTargetTile: number | null = null;
    if (u.canUpgrade !== false) {
      upgradeTargetTile = this.game.unit(u.canUpgrade)?.tile() ?? null;
    }

    // Range circle: SAM placement preview shows targetable radius; nuke
    // previews show the outer blast radius at the target tile.
    let rangeRadius = 0;
    let radiusTileX = this.game.x(tileRef);
    let radiusTileY = this.game.y(tileRef);
    switch (u.type as UnitType) {
      case UnitType.SAMLauncher: {
        const level = this.resolveGhostRangeLevel(u) ?? 1;
        rangeRadius = this.game.config().samRange(level);
        break;
      }
      case UnitType.AtomBomb:
      case UnitType.HydrogenBomb:
        rangeRadius = this.game.config().nukeMagnitudes(u.type).outer;
        break;
      case UnitType.Factory:
        rangeRadius = this.game.config().trainStationMaxRange();
        break;
      case UnitType.DefensePost:
        rangeRadius = this.game.config().defensePostRange();
        break;
      case UnitType.Tender:
      case UnitType.Vestal:
        rangeRadius = this.game.config().tenderHealRange();
        break;
      case UnitType.PortGun: {
        const level = this.resolveGhostRangeLevel(u) ?? 1;
        rangeRadius = this.game.config().portGunRange(level);
        break;
      }
      case UnitType.InlandBattery: {
        const level = this.resolveGhostRangeLevel(u) ?? 1;
        rangeRadius = this.game.config().inlandBatteryRange(level);
        break;
      }
      case UnitType.NavalMine: {
        rangeRadius = this.game.config().navalMineRange();
        const shore = nearestOwnedLandTileView(
          this.game,
          myPlayer.smallID(),
          tileRef,
        );
        if (shore !== null) {
          radiusTileX = this.game.x(shore);
          radiusTileY = this.game.y(shore);
        }
        break;
      }
    }
    if (
      rangeRadius > 0 &&
      u.canUpgrade !== false &&
      upgradeTargetTile !== null
    ) {
      radiusTileX = this.game.x(upgradeTargetTile);
      radiusTileY = this.game.y(upgradeTargetTile);
    }

    const multiplier =
      u.canUpgrade !== false ? (this.uiState.upgradeMultiplier ?? 1) : 1;
    const cost = bulkCost(u, multiplier);
    const canAfford = myPlayer.gold() >= cost;
    return {
      ghostType: u.type,
      tileX: this.game.x(tileRef),
      tileY: this.game.y(tileRef),
      radiusTileX,
      radiusTileY,
      canBuild: u.canBuild !== false,
      canUpgrade: u.canUpgrade !== false,
      cost: Number(cost),
      multiplier: multiplier,
      showCost: this.userSettings.cursorCostLabel(),
      canAfford,
      ghostRailPaths: u.ghostRailPaths,
      overlappingRailroads: u.overlappingRailroads,
      ownerID: myPlayer.smallID(),
      upgradeTargetTile,
      rangeRadius,
      rangeWarning: targetingAlly,
    };
  }

  private tryFireInlandBatteryAim(e: MouseUpEvent): boolean {
    const unitId = this.uiState.inlandBatteryAimUnitId;
    if (unitId == null) {
      return false;
    }
    const gun = this.game.unit(unitId);
    if (
      gun === undefined ||
      !gun.isActive() ||
      gun.type() !== UnitType.InlandBattery
    ) {
      this.uiState.inlandBatteryAimUnitId = null;
      this.lastGhostData = null;
      this.view.updateGhostPreview(null);
      return true;
    }
    const tile = this.transformHandler.screenToWorldCoordinates(e.x, e.y);
    if (!this.game.isValidCoord(tile.x, tile.y)) {
      return true;
    }
    const aim = this.game.ref(tile.x, tile.y);
    if (!this.inlandBatteryAimInRange(gun, aim)) {
      return true;
    }
    this.eventBus.emit(new FireInlandBatteryIntentEvent(unitId, aim));
    // Leave aim mode set until after this click is fully dispatched so
    // ClientGameRunner does not also send a troop attack on the same tile.
    queueMicrotask(() => {
      if (this.uiState.inlandBatteryAimUnitId === unitId) {
        this.uiState.inlandBatteryAimUnitId = null;
        this.lastGhostData = null;
        this.view.updateGhostPreview(null);
      }
    });
    return true;
  }

  private inlandBatteryAimInRange(
    gun: { tile(): number; level(): number },
    aim: TileRef,
  ): boolean {
    const cfg = this.game.config();
    const range = cfg.inlandBatteryRange(gun.level());
    const minFire = cfg.inlandBatteryMinFireRange();
    const d2 = this.game.euclideanDistSquared(gun.tile(), aim);
    return d2 >= minFire * minFire && d2 <= range * range;
  }

  private emitInlandBatteryAimPreview(): void {
    const unitId = this.uiState.inlandBatteryAimUnitId;
    const myPlayer = this.game.myPlayer();
    if (unitId == null || myPlayer === null) {
      this.lastGhostData = null;
      this.view.updateGhostPreview(null);
      return;
    }
    const gun = this.game.unit(unitId);
    if (
      gun === undefined ||
      !gun.isActive() ||
      gun.type() !== UnitType.InlandBattery
    ) {
      this.uiState.inlandBatteryAimUnitId = null;
      this.lastGhostData = null;
      this.view.updateGhostPreview(null);
      return;
    }
    const tile = this.transformHandler.screenToWorldCoordinates(
      this.mousePos.x,
      this.mousePos.y,
    );
    if (!this.game.isValidCoord(tile.x, tile.y)) {
      this.lastGhostData = null;
      this.view.updateGhostPreview(null);
      return;
    }
    const aim = this.game.ref(tile.x, tile.y);
    const inRange = this.inlandBatteryAimInRange(gun, aim);
    const spread = this.game.config().inlandBatterySpreadRadius(gun.level());
    this.lastGhostData = {
      ghostType: "Inland Battery Aim",
      tileX: this.game.x(aim),
      tileY: this.game.y(aim),
      radiusTileX: this.game.x(aim),
      radiusTileY: this.game.y(aim),
      canBuild: false,
      canUpgrade: false,
      cost: 0,
      showCost: false,
      canAfford: true,
      ghostRailPaths: [],
      overlappingRailroads: [],
      ownerID: myPlayer.smallID(),
      upgradeTargetTile: null,
      rangeRadius: spread,
      rangeWarning: !inRange,
      rangeTint: inRange ? "valid" : "invalid",
    };
  }

  private isGhostReadyForConfirm(): boolean {
    if (!this.ghostUnit) return false;
    const bu = this.ghostUnit.buildableUnit;
    return bu.canBuild !== false || bu.canUpgrade !== false;
  }

  private requestConfirmStructure(e: MouseUpEvent): void {
    if (this.tryFireInlandBatteryAim(e)) {
      return;
    }
    if (!this.ghostUnit && !this.uiState.ghostStructure) return;
    if (this.isGhostReadyForConfirm()) {
      this.createStructure(e);
    } else {
      this.pendingConfirm = e;
    }
  }

  private createStructure(e: MouseUpEvent) {
    if (!this.ghostUnit) return;
    if (
      this.ghostUnit.buildableUnit.canBuild === false &&
      this.ghostUnit.buildableUnit.canUpgrade === false
    ) {
      this.removeGhostStructure();
      return;
    }
    const tile = this.transformHandler.screenToWorldCoordinates(e.x, e.y);
    if (this.ghostUnit.buildableUnit.canUpgrade !== false) {
      this.eventBus.emit(
        new SendUpgradeStructureIntentEvent(
          this.ghostUnit.buildableUnit.canUpgrade,
          this.ghostUnit.buildableUnit.type,
          this.uiState.upgradeMultiplier || 1,
        ),
      );
      this.removeGhostStructure();
    } else if (this.ghostUnit.buildableUnit.canBuild) {
      const unitType: UnitType = this.ghostUnit.buildableUnit.type;
      const targetTile = this.game.ref(tile.x, tile.y);

      if (this.shouldBlockRecentAllyNuke(targetTile, unitType)) {
        return;
      }

      this.eventBus.emit(
        new BuildUnitIntentEvent(unitType, targetTile),
      );
      if (!shouldPreserveGhostAfterBuild(unitType)) {
        this.removeGhostStructure();
      }
    } else {
      this.removeGhostStructure();
    }
  }

  private shouldBlockRecentAllyNuke(
    tile: TileRef,
    unitType: UnitType,
  ): boolean {
    const duration = this.userSettings.nukeAllianceSafetyDuration();
    if (
      duration <= 0 ||
      (unitType !== UnitType.AtomBomb &&
        unitType !== UnitType.HydrogenBomb &&
        unitType !== UnitType.MIRV)
    ) {
      return false;
    }

    const alliances = this.game.myPlayer()?.alliances();
    if (!alliances?.length) return false;

    const currentTick = this.game.ticks();
    const freshAllies = new Map<number, number>();
    for (const a of alliances) {
      if (
        !this.usedSafetyAllies.has(a.id) &&
        currentTick - a.createdAt <= duration
      ) {
        freshAllies.set(this.game.player(a.other).smallID(), a.id);
      }
    }
    if (freshAllies.size === 0) return false;

    const broken =
      unitType === UnitType.MIRV
        ? [this.game.ownerID(tile)]
        : listNukeBreakAlliance({
            game: this.game,
            targetTile: tile,
            magnitude: this.game.config().nukeMagnitudes(unitType),
            threshold: this.game.config().nukeAllianceBreakThreshold(),
          });

    let blocked = false;
    for (const smallId of broken) {
      const allianceId = freshAllies.get(smallId);
      if (allianceId !== undefined) {
        this.usedSafetyAllies.add(allianceId);
        blocked = true;
      }
    }

    if (blocked) {
      this.view.triggerBlockedFlash(
        this.game.x(tile) + 0.5,
        this.game.y(tile) + 0.5,
      );
    }
    return blocked;
  }

  private moveGhost(e: MouseMoveEvent) {
    this.mousePos.x = e.x;
    this.mousePos.y = e.y;
  }

  private createGhostStructure(type: PlayerBuildableUnitType | null) {
    if (type === null) return;
    if (this.game.myPlayer() === null) return;
    this.ghostUnit = {
      buildableUnit: {
        type,
        canBuild: false,
        canUpgrade: false,
        cost: 0n,
        overlappingRailroads: [],
        ghostRailPaths: [],
      },
    };
  }

  private clearGhostStructure() {
    this.pendingConfirm = null;
    this.ghostUnit = null;
    this.lastGhostData = null;
    this.view.updateGhostPreview(null);
    this.clearNukeTrajectory();
  }

  private removeGhostStructure() {
    this.clearGhostStructure();
    this.uiState.ghostStructure = null;
  }

  private resolveGhostRangeLevel(
    buildableUnit: BuildableUnit,
  ): number | undefined {
    if (
      (buildableUnit.type as UnitType) !== UnitType.SAMLauncher &&
      buildableUnit.type !== UnitType.PortGun &&
      buildableUnit.type !== UnitType.InlandBattery
    ) {
      return undefined;
    }
    if (buildableUnit.canUpgrade !== false) {
      const existing = this.game.unit(buildableUnit.canUpgrade);
      if (existing) {
        return existing.level() + 1;
      } else {
        console.error("Failed to find existing SAMLauncher for upgrade");
      }
    }
    return 1;
  }
}

function nearestOwnedLandTileView(
  game: GameView,
  ownerSmallID: number,
  from: TileRef,
): TileRef | null {
  const seen = new Set<TileRef>([from]);
  let frontier: TileRef[] = [from];
  let dist = 0;
  const maxDist = game.config().navalMineRange() + 5;
  while (frontier.length > 0 && dist <= maxDist) {
    const next: TileRef[] = [];
    for (const cur of frontier) {
      if (
        game.isLand(cur) &&
        !game.isImpassable(cur) &&
        game.ownerID(cur) === ownerSmallID
      ) {
        return cur;
      }
      for (const n of game.neighbors(cur)) {
        if (!seen.has(n)) {
          seen.add(n);
          next.push(n);
        }
      }
    }
    frontier = next;
    dist++;
  }
  return null;
}
