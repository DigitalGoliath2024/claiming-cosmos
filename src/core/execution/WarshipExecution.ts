import {
  CombatShips,
  Execution,
  Game,
  isCombatShip,
  isRepairHull,
  isUnit,
  OwnerComp,
  RepairHulls,
  Structures,
  Unit,
  UnitParams,
  UnitType,
} from "../game/Game";
import { playerDocks } from "../game/NavalDomain";
import { TileRef } from "../game/GameMap";
import { assignWarshipVolleyTargets } from "../game/Veterancy";
import { WaterPathFinder } from "../pathfinding/PathFinder";
import { PathStatus } from "../pathfinding/types";
import { PseudoRandom } from "../PseudoRandom";
import { findMinimumBy } from "../Util";
import { ShellExecution } from "./ShellExecution";

/** Shore structures warships and marauders will shell. */
const WARSHIP_SHORE_TARGETS: readonly UnitType[] = Structures.types;

export class WarshipExecution implements Execution {
  private random: PseudoRandom;
  private warship: Unit;
  private mg: Game;
  private pathfinder: WaterPathFinder;
  private lastShellAttack = 0;
  private alreadySentShell = new Set<Unit>();
  private lastManualMoveTickRetreatDisabled = 0;
  private lastObservedPatrolTile: TileRef | undefined;
  private activeHealingRemainder = 0;
  private tenderOnTenderRemainder = 0;
  private lastEmittedCombat = false;
  private currentTick = 0;
  /** Set while steaming to / holding on a Tender instead of a Port. */
  private retreatTender: Unit | undefined;

  constructor(
    private input:
      | (UnitParams<UnitType.Warship> &
          OwnerComp & {
            shipType?:
              | UnitType.Warship
              | UnitType.Voidship
              | UnitType.Marauder
              | UnitType.Corsair
              | UnitType.Tender
              | UnitType.Vestal;
          })
      | Unit,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.pathfinder = new WaterPathFinder(mg);
    this.random = new PseudoRandom(mg.ticks());
    if (isUnit(this.input)) {
      this.warship = this.input;
    } else {
      const shipType = this.input.shipType ?? UnitType.Warship;
      const cost = this.mg.unitInfo(shipType).cost(this.mg, this.input.owner);
      if (this.input.owner.gold() < cost) {
        return;
      }
      const spawn = this.input.owner.canBuild(shipType, this.input.patrolTile);
      if (spawn === false) {
        console.warn(
          `Failed to spawn ${shipType} for ${this.input.owner.name()} at ${this.input.patrolTile}`,
        );
        return;
      }
      this.warship = this.input.owner.buildUnit(shipType, spawn, this.input);
    }
    this.lastObservedPatrolTile = this.warship.warshipState().patrolTile;
  }

  tick(ticks: number): void {
    this.currentTick = ticks;
    if (this.warship.health() <= 0) {
      this.warship.delete();
      return;
    }
    const isInCombat = this.warship.warshipState().isInCombat ?? false;
    if (this.lastEmittedCombat && !isInCombat) {
      this.warship.touch();
    }
    this.lastEmittedCombat = isInCombat;
    const healthBeforeHealing = this.warship.health();

    this.healWarship();
    this.handleManualPatrolOverride();

    // A doomed side cannot repair its navy (see healWarship), so retreating to
    // a port only pulls a warship out of the fight to idle there forever. Undock
    // or abort any retreat and keep patrolling until the side recovers.
    if (
      this.warship.owner().inDoomsdayClock() &&
      this.warship.warshipState().state !== "patrolling"
    ) {
      this.cancelRepairRetreat();
    }

    if (this.warship.warshipState().state === "docked") {
      if (this.currentRetreatPort() === undefined) {
        this.cancelRepairRetreat();
      }
      if (this.isFullyHealed()) {
        this.cancelRepairRetreat();
      }
      if (this.warship.warshipState().state === "docked") {
        return;
      }
    }

    if (this.handleRepairRetreat()) {
      return;
    }

    // Priority 1: Check if need to heal before doing anything else
    if (this.shouldStartRepairRetreat(healthBeforeHealing)) {
      this.startRepairRetreat();
      if (this.handleRepairRetreat()) {
        return;
      }
    }

    this.warship.setTargetUnit(this.findTargetUnit());

    const target = this.warship.targetUnit();
    if (target?.type() === UnitType.TradeShip) {
      this.huntDownTradeShip();
      return;
    }
    if (target !== undefined) {
      this.shootTarget();
    }

    this.patrol();
  }

  private healWarship(): void {
    const owner = this.warship.owner();
    // A doomed side (below the Doomsday Clock bar) cannot repair its navy, so the
    // decay in DoomsdayClockExecution actually sinks warships instead of being
    // out-healed at a port. Inert when the mode is off: the mark is never set.
    if (owner.inDoomsdayClock()) return;
    const passiveHealing = this.mg.config().warshipPassiveHealing();

    if (this.isNearPortHeal()) {
      this.warship.modifyHealth(passiveHealing);
    } else {
      this.applyTenderHeal();
    }

    if (this.warship.warshipState().state === "docked") {
      this.applyActiveDockedHealing();
    }

    this.applyMaxRankHullRepair();
  }

  /** Unarmed Tender: 1 HP/tick in a 30-tile bubble, not stacked with Port heal.
   *  Another Tender only gets 15% of that (accumulated, integer HP). */
  private applyTenderHeal(): void {
    if (this.friendlyTenderInRange() === undefined) {
      return;
    }
    const amount = this.tenderHealHpThisTick();
    if (amount <= 0) {
      return;
    }
    this.warship.modifyHealth(amount);
  }

  private tenderHealHpThisTick(): number {
    const amount = this.mg.config().tenderHealAmount();
    if (amount <= 0) {
      return 0;
    }
    if (!isRepairHull(this.warship.type())) {
      return amount;
    }
    const percent = this.mg.config().tenderHealTenderPercent();
    this.tenderOnTenderRemainder += amount * percent;
    const hp = Math.floor(this.tenderOnTenderRemainder / 100);
    this.tenderOnTenderRemainder -= hp * 100;
    return hp;
  }

  /**
   * Rank-3 Warships carry a repairman who patches the hull anywhere.
   * Marauders never get this, even at the same max rank. Skipped when
   * doomed (healWarship returns before this) or already dead (tick
   * deletes first). modifyHealth clamps to max HP.
   */
  private applyMaxRankHullRepair(): void {
    if (this.warship.type() !== UnitType.Warship && this.warship.type() !== UnitType.Voidship) {
      return;
    }
    const hp = this.mg
      .config()
      .warshipMaxRankRepairHp(this.warship.veterancy(), this.currentTick);
    if (hp > 0) {
      this.warship.modifyHealth(hp);
    }
  }

  private isFullyHealed(): boolean {
    if (!this.warship.hasHealth()) {
      return true;
    }
    return this.warship.health() >= this.warship.maxHealth();
  }

  private shouldStartRepairRetreat(
    healthBeforeHealing = this.warship.health(),
  ): boolean {
    if (this.warship.warshipState().state !== "patrolling") {
      return false;
    }
    // A doomed side cannot repair (see healWarship), so there is nothing to
    // retreat for; stay on patrol instead of idling at a port.
    if (this.warship.owner().inDoomsdayClock()) {
      return false;
    }
    const manualMoveRetreatDisabledDuration = 50;
    if (
      this.mg.ticks() - this.lastManualMoveTickRetreatDisabled <
      manualMoveRetreatDisabledDuration
    ) {
      return false;
    }
    // Percentage of (veterancy-adjusted) max health, so a tougher veteran ship
    // retreats at the same relative health as a fresh one. Integer math.
    const retreatThreshold = Math.floor(
      (this.warship.maxHealth() *
        this.mg.config().warshipRetreatHealthPercent()) /
        100,
    );
    if (healthBeforeHealing >= retreatThreshold) {
      return false;
    }
    // Tenders do not park on other Tenders; they still run to a Port.
    if (isRepairHull(this.warship.type())) {
      return playerDocks(this.warship.owner()).length > 0;
    }
    // Already getting Port proximity heal — keep the old dock-at-Port path.
    if (this.isNearPortHeal()) {
      return playerDocks(this.warship.owner()).length > 0;
    }
    // Already in a Tender bubble: stay on station and top up in place.
    if (this.friendlyTenderInRange() !== undefined) {
      return false;
    }
    if (this.findNearestFriendlyTender() !== undefined) {
      return true;
    }
    return playerDocks(this.warship.owner()).length > 0;
  }

  private isNearPortHeal(): boolean {
    const range = this.mg.config().warshipPassiveHealingRange();
    const rangeSquared = range * range;
    const tile = this.warship.tile();
    for (const port of playerDocks(this.warship.owner())) {
      if (!port.isActive() || port.isUnderConstruction()) {
        continue;
      }
      if (this.mg.euclideanDistSquared(tile, port.tile()) <= rangeSquared) {
        return true;
      }
    }
    return false;
  }

  private isFriendlyTender(unit: Unit): boolean {
    if (
      unit === this.warship ||
      !isRepairHull(unit.type()) ||
      !unit.isActive() ||
      unit.isUnderConstruction()
    ) {
      return false;
    }
    const owner = this.warship.owner();
    const tenderOwner = unit.owner();
    return tenderOwner === owner || tenderOwner.isFriendly(owner);
  }

  private friendlyTenderInRange(): Unit | undefined {
    const nearby = this.mg.nearbyUnits(
      this.warship.tile(),
      this.mg.config().tenderHealRange(),
      RepairHulls.types,
    );
    for (const { unit } of nearby) {
      if (this.isFriendlyTender(unit)) {
        return unit;
      }
    }
    return undefined;
  }

  private findNearestFriendlyTender(): Unit | undefined {
    const shipTile = this.warship.tile();
    const shipComponent = this.mg.getWaterComponent(shipTile);
    if (shipComponent === null) {
      return undefined;
    }
    const owner = this.warship.owner();
    let best: Unit | undefined;
    let bestDist = Infinity;
    const consider = (tender: Unit) => {
      if (!this.isFriendlyTender(tender)) {
        return;
      }
      const tenderComponent = this.mg.getWaterComponent(tender.tile());
      if (tenderComponent !== shipComponent) {
        return;
      }
      const dist = this.mg.euclideanDistSquared(shipTile, tender.tile());
      if (dist < bestDist) {
        bestDist = dist;
        best = tender;
      }
    };
    for (const type of RepairHulls.types) {
      for (const tender of owner.units(type)) {
        consider(tender);
      }
    }
    for (const player of this.mg.players()) {
      if (player === owner || !owner.isFriendly(player)) {
        continue;
      }
      for (const type of RepairHulls.types) {
        for (const tender of player.units(type)) {
          consider(tender);
        }
      }
    }
    return best;
  }

  private findNearestPort(): TileRef | undefined {
    const ports = playerDocks(this.warship.owner());
    if (ports.length === 0) {
      return undefined;
    }

    const warshipTile = this.warship.tile();
    const warshipComponent = this.mg.getWaterComponent(warshipTile);
    if (warshipComponent === null) {
      throw new Error(`Warship at tile ${warshipTile} has no water component`);
    }

    const nearest = findMinimumBy(
      ports,
      (port) => this.mg.euclideanDistSquared(warshipTile, port.tile()),
      (port) => {
        const portComponent = this.mg.getWaterComponent(port.tile());
        if (portComponent === null) {
          throw new Error(`Port at tile ${port.tile()} has no water component`);
        }
        return portComponent === warshipComponent;
      },
    );

    return nearest?.tile();
  }

  private findRetreatAggroTarget(): Unit | undefined {
    if (isRepairHull(this.warship.type())) {
      return undefined;
    }
    return this.findBestTarget([
      ...CombatShips.types,
      RepairHulls.types,
      UnitType.TransportShip,
      UnitType.Lander,
      ...WARSHIP_SHORE_TARGETS,
    ]);
  }

  private findTargetUnit(): Unit | undefined {
    if (isRepairHull(this.warship.type())) {
      return undefined;
    }
    return this.findBestTarget(
      [
        UnitType.TransportShip,
      UnitType.Lander,
        ...CombatShips.types,
        RepairHulls.types,
        ...WARSHIP_SHORE_TARGETS,
        UnitType.TradeShip,
      ],
      true,
    );
  }

  /**
   * Shared target selection: searches nearby units of given types,
   * filters common exclusions (self, friendly, docked, already-shelled),
   * picks best by type priority (lower index = higher priority) then distance.
   *
   * When `includeTradeShips` is true, applies trade-ship-specific filters
   * (safe from pirates, patrol range, water component, allied destination).
   */
  private findBestTarget(
    types: UnitType[],
    includeTradeShips = false,
  ): Unit | undefined {
    const mg = this.mg;
    const config = mg.config();
    const owner = this.warship.owner();

    const ships = mg.nearbyUnits(
      this.warship.tile(),
      config.warshipTargettingRange(),
      types,
    );

    // Trade-ship-specific state, lazily computed.
    let hasReachablePort: boolean | undefined;
    let patrolTile: number | undefined;
    let patrolRangeSquared: number | undefined;
    let warshipComponent: number | null | undefined = undefined;

    let bestUnit: Unit | undefined = undefined;
    let bestTypePriority = 0;
    let bestDistSquared = 0;

    for (const { unit, distSquared } of ships) {
      if (!this.isValidHostileTarget(unit)) {
        continue;
      }

      const type = unit.type();

      if (includeTradeShips && type === UnitType.TradeShip) {
        if (warshipComponent === undefined) {
          warshipComponent = mg.getWaterComponent(this.warship.tile());
          hasReachablePort =
            warshipComponent !== null &&
            playerDocks(owner)
              .some(
                (port) =>
                  port.isActive() &&
                  !port.isMarkedForDeletion() &&
                  !port.isUnderConstruction() &&
                  mg.hasWaterComponent(port.tile(), warshipComponent!),
              );
          patrolTile = this.warship.warshipState().patrolTile;
          patrolRangeSquared = config.warshipPatrolRange() ** 2;
        }
        if (
          !hasReachablePort ||
          patrolTile === undefined ||
          unit.isSafeFromPirates() ||
          unit.targetUnit()?.owner() === owner ||
          unit.targetUnit()?.owner().isFriendly(owner)
        ) {
          continue;
        }
        if (
          mg.euclideanDistSquared(patrolTile, unit.tile()) > patrolRangeSquared!
        ) {
          continue;
        }
      }

      let typePriority: number;
      if (type === UnitType.TransportShip || type === UnitType.Lander) {
        typePriority = 0;
      } else if (
        isCombatShip(type) ||
        type === UnitType.PortGun ||
        isRepairHull(type)
      ) {
        typePriority = 1;
      } else if (type === UnitType.TradeShip) {
        typePriority = 2;
      } else {
        // Buildings after combat/piracy so a city does not steal shots from
        // a warship in the face or a trade ship worth capturing.
        typePriority = 3;
      }

      if (
        bestUnit === undefined ||
        typePriority < bestTypePriority ||
        (typePriority === bestTypePriority && distSquared < bestDistSquared)
      ) {
        bestUnit = unit;
        bestTypePriority = typePriority;
        bestDistSquared = distSquared;
      }
    }

    return bestUnit;
  }

  private isValidHostileTarget(unit: Unit): boolean {
    const owner = this.warship.owner();
    return (
      unit !== this.warship &&
      unit.owner() !== owner &&
      owner.canAttackPlayer(unit.owner(), true) &&
      !this.alreadySentShell.has(unit) &&
      !unit.isUnderConstruction() &&
      !(isCombatShip(unit.type()) && unit.warshipState().state === "docked")
    );
  }

  private startRepairRetreat(): void {
    this.retreatTender = undefined;
    if (!isRepairHull(this.warship.type()) && !this.isNearPortHeal()) {
      const tender = this.findNearestFriendlyTender();
      if (tender !== undefined) {
        const portTile = this.findNearestPort();
        const tenderDist = this.mg.euclideanDistSquared(
          this.warship.tile(),
          tender.tile(),
        );
        if (
          portTile === undefined ||
          tenderDist <
            this.mg.euclideanDistSquared(this.warship.tile(), portTile)
        ) {
          this.retreatTender = tender;
          this.warship.updateWarshipState({
            retreatPort: undefined,
            state: "retreating",
          });
          this.activeHealingRemainder = 0;
          this.warship.setTargetUnit(undefined);
          return;
        }
      }
    }
    const portTile = this.findNearestPort();
    if (portTile === undefined) {
      return;
    }
    this.warship.updateWarshipState({
      retreatPort: portTile,
      state: "retreating",
    });
    this.activeHealingRemainder = 0;
    this.warship.setTargetUnit(undefined);
  }

  private cancelRepairRetreat(clearTargetTile = true): void {
    this.retreatTender = undefined;
    this.activeHealingRemainder = 0;
    this.warship.updateWarshipState({
      state: "patrolling",
      retreatPort: undefined,
    });
    if (clearTargetTile) {
      this.warship.setTargetTile(undefined);
    }
  }

  private handleManualPatrolOverride(): void {
    const patrolTile = this.warship.warshipState().patrolTile;
    if (
      this.lastObservedPatrolTile !== undefined &&
      patrolTile !== this.lastObservedPatrolTile
    ) {
      this.lastManualMoveTickRetreatDisabled = this.mg.ticks();
      if (this.warship.warshipState().state !== "patrolling") {
        this.cancelRepairRetreat(false);
      }
    }
    this.lastObservedPatrolTile = patrolTile;
  }

  private switchRetreatToPort(): boolean {
    this.retreatTender = undefined;
    const portTile = this.findNearestPort();
    if (portTile === undefined) {
      this.cancelRepairRetreat();
      return false;
    }
    this.warship.updateWarshipState({
      retreatPort: portTile,
      state: "retreating",
    });
    return this.handleRepairRetreat();
  }

  private handleTenderRetreat(): boolean {
    const tender = this.retreatTender;
    if (tender === undefined || !this.isFriendlyTender(tender)) {
      return this.switchRetreatToPort();
    }
    if (this.isNearPortHeal()) {
      return this.switchRetreatToPort();
    }
    if (this.isFullyHealed()) {
      this.cancelRepairRetreat();
      return false;
    }

    const retreatAggroTarget = this.findRetreatAggroTarget();
    if (retreatAggroTarget) {
      this.warship.setTargetUnit(retreatAggroTarget);
      this.shootTarget();
    } else {
      this.warship.setTargetUnit(undefined);
    }

    const range = this.mg.config().tenderHealRange();
    const inBubble =
      this.mg.euclideanDistSquared(this.warship.tile(), tender.tile()) <=
      range * range;
    if (inBubble) {
      this.warship.setTargetTile(undefined);
      return true;
    }

    const dest = tender.tile();
    this.warship.setTargetTile(dest);
    for (let i = 0; i < this.patrolSteps(); i++) {
      const result = this.pathfinder.next(this.warship.tile(), dest);
      switch (result.status) {
        case PathStatus.COMPLETE:
          this.warship.move(result.node);
          if (result.node === dest) {
            this.warship.setTargetTile(undefined);
          }
          return true;
        case PathStatus.NEXT:
          this.warship.move(result.node);
          break;
        case PathStatus.NOT_FOUND:
          return this.switchRetreatToPort();
      }
    }
    return true;
  }

  private handleRepairRetreat(): boolean {
    if (this.warship.warshipState().state === "patrolling") {
      return false;
    }

    if (this.retreatTender !== undefined) {
      return this.handleTenderRetreat();
    }

    const retreatAggroTarget = this.findRetreatAggroTarget();
    if (retreatAggroTarget) {
      this.warship.setTargetUnit(retreatAggroTarget);
      this.shootTarget();
      // Fall through — continue retreating toward port even while firing back.
    }

    if (!this.refreshRetreatPortTile()) {
      this.cancelRepairRetreat();
      return false;
    }

    // Only clear the target when there's no active aggro target this tick.
    if (!retreatAggroTarget) {
      this.warship.setTargetUnit(undefined);
    }

    const retreatPortTile = this.warship.warshipState().retreatPort;
    if (retreatPortTile === undefined) {
      return false;
    }

    const dockingRadius = this.mg.config().warshipDockingRange();
    const dockingRadiusSq = dockingRadius * dockingRadius;
    const distToPort = this.mg.euclideanDistSquared(
      this.warship.tile(),
      retreatPortTile,
    );

    if (distToPort <= dockingRadiusSq) {
      // Check if the port has capacity available (excluding this warship from capacity check)
      const port = playerDocks(this.warship.owner()).find(
        (p) => p.tile() === retreatPortTile,
      );
      if (port && !this.isPortFullOfHealing(port, this.warship)) {
        // Port has capacity - dock here
        this.warship.setTargetTile(undefined);
        this.warship.updateWarshipState({
          state: "docked",
        });
        return true;
      } else {
        // Port is full - wait near port, but leave if already fully healed
        if (this.isFullyHealed()) {
          this.cancelRepairRetreat();
          return false;
        }
        return true;
      }
    }

    this.warship.setTargetTile(retreatPortTile);
    for (let i = 0; i < this.patrolSteps(); i++) {
      const result = this.pathfinder.next(this.warship.tile(), retreatPortTile);
      switch (result.status) {
        case PathStatus.COMPLETE:
          this.warship.move(result.node);
          if (result.node === retreatPortTile) {
            this.warship.setTargetTile(undefined);
          }
          return true;
        case PathStatus.NEXT:
          this.warship.move(result.node);
          break;
        case PathStatus.NOT_FOUND: {
          const newPort = this.findNearestAvailablePortTile();
          this.warship.updateWarshipState({
            retreatPort: newPort,
          });
          if (newPort === undefined) {
            this.cancelRepairRetreat();
          }
          return true;
        }
      }
    }

    return true;
  }

  private refreshRetreatPortTile(): boolean {
    const ports = playerDocks(this.warship.owner());
    if (ports.length === 0) {
      return false;
    }

    const currentRetreatPort = this.warship.warshipState().retreatPort;

    // Check if current retreat port still exists
    const currentPortExists =
      currentRetreatPort !== undefined &&
      ports.some((port) => port.tile() === currentRetreatPort);

    if (!currentPortExists) {
      const newPort = this.findNearestAvailablePortTile();
      this.warship.updateWarshipState({
        retreatPort: newPort,
      });
      return newPort !== undefined;
    }

    // Check if current port is now full of healing (not counting arrived warships)
    const currentPort = ports.find((p) => p.tile() === currentRetreatPort);
    if (currentPort && this.isPortFullOfHealing(currentPort)) {
      // Current port is at healing capacity, look for alternatives
      const alternativePort = this.findNearestAvailablePort();
      if (alternativePort) {
        this.warship.updateWarshipState({
          retreatPort: alternativePort,
        });
      }
      return this.warship.warshipState().retreatPort !== undefined;
    }

    // Check if a significantly closer port is available
    const closerPort = this.findBetterPortTile();
    if (closerPort && closerPort !== currentRetreatPort) {
      this.warship.updateWarshipState({
        retreatPort: closerPort,
      });
      return true;
    }

    return true;
  }

  private isPortFullOfHealing(port: Unit, excludeShip?: Unit): boolean {
    const maxShipsHealing = port.level();
    return this.dockedShipsAtPort(port, excludeShip).length >= maxShipsHealing;
  }

  private dockedShipsAtPort(port: Unit, excludeShip?: Unit): Unit[] {
    const dockingRadius = this.mg.config().warshipDockingRange();
    const owner = this.warship.owner();

    return this.mg
      .nearbyUnits(port.tile(), dockingRadius, CombatShips.types)
      .filter(({ unit: ship }) => {
        if (excludeShip && ship === excludeShip) return false;
        if (ship.owner() !== owner) return false;
        if (ship.warshipState().state === "patrolling") return false;
        if (ship.targetTile() !== undefined) return false;
        return true;
      })
      .map(({ unit }) => unit);
  }

  private applyActiveDockedHealing(): void {
    const dockedPort = this.currentRetreatPort();
    if (!dockedPort) {
      return;
    }

    const dockedShips = this.dockedShipsAtPort(dockedPort);
    if (!dockedShips.some((ship) => ship === this.warship)) {
      return;
    }

    const healingPool =
      dockedPort.level() * this.mg.config().warshipPortHealingBonusPerLevel();
    if (healingPool <= 0 || dockedShips.length === 0) {
      return;
    }

    // Preserve fractional split healing over time with a per-ship remainder.
    const activeHealing = healingPool / dockedShips.length;
    this.activeHealingRemainder += activeHealing;
    const integerHealing = Math.floor(this.activeHealingRemainder);
    if (integerHealing <= 0) {
      return;
    }

    this.activeHealingRemainder -= integerHealing;
    this.warship.modifyHealth(integerHealing);
  }

  private currentRetreatPort(): Unit | undefined {
    const retreatPort = this.warship.warshipState().retreatPort;
    if (retreatPort === undefined) {
      return undefined;
    }

    return playerDocks(this.warship.owner()).find(
      (port) => port.tile() === retreatPort,
    );
  }

  private nearestAvailablePortTile(
    excludeShip?: Unit,
  ): { tile: TileRef; distSquared: number } | undefined {
    const ports = playerDocks(this.warship.owner());
    const warshipTile = this.warship.tile();
    const warshipComponent = this.mg.getWaterComponent(warshipTile);
    if (warshipComponent === null) {
      throw new Error(`Warship at tile ${warshipTile} has no water component`);
    }

    let bestTile: TileRef | undefined = undefined;
    let bestDistance = Infinity;

    for (const port of ports) {
      if (this.isPortFullOfHealing(port, excludeShip)) {
        continue;
      }

      const portTile = port.tile();
      if (!this.mg.hasWaterComponent(portTile, warshipComponent)) {
        continue;
      }

      const distance = this.mg.euclideanDistSquared(warshipTile, portTile);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestTile = portTile;
      }
    }

    return bestTile !== undefined
      ? { tile: bestTile, distSquared: bestDistance }
      : undefined;
  }

  private findNearestAvailablePort(): TileRef | undefined {
    return this.nearestAvailablePortTile()?.tile;
  }

  private findBetterPortTile(): TileRef | undefined {
    const result = this.nearestAvailablePortTile();
    if (!result) return undefined;

    let currentDistance = Infinity;
    const currentRetreatPort = this.warship.warshipState().retreatPort;
    if (currentRetreatPort !== undefined) {
      currentDistance = this.mg.euclideanDistSquared(
        this.warship.tile(),
        currentRetreatPort,
      );
    }

    if (
      result.distSquared <
      currentDistance * this.mg.config().warshipPortSwitchThreshold()
    ) {
      return result.tile;
    }
    return undefined;
  }

  private findNearestAvailablePortTile(): TileRef | undefined {
    return this.nearestAvailablePortTile(this.warship)?.tile;
  }

  private shootTarget() {
    this.warship.updateWarshipState({ isInCombat: true });
    const shellAttackRate = this.mg.config().warshipShellAttackRate();
    if (this.mg.ticks() - this.lastShellAttack > shellAttackRate) {
      const primary = this.warship.targetUnit()!;
      if (
        primary.type() !== UnitType.TransportShip &&
        primary.type() !== UnitType.Lander
      ) {
        // Warships don't need to reload when attacking transport ships.
        this.lastShellAttack = this.mg.ticks();
      }
      const shotCount = this.shellsThisVolley(primary);
      const targets = this.volleyTargets(primary, shotCount);
      for (const target of targets) {
        this.mg.addExecution(
          new ShellExecution(
            this.warship.tile(),
            this.warship.owner(),
            this.warship,
            target,
          ),
        );
        if (!target.hasHealth()) {
          // Don't send multiple shells to a target that can be oneshotted.
          this.alreadySentShell.add(target);
        }
      }
      if (!primary.hasHealth()) {
        this.warship.setTargetUnit(undefined);
      }
    }
  }

  /** Warships gain extra shells at rank 2–3. Marauders and oneshots stay at 1. */
  private shellsThisVolley(primary: Unit): number {
    if (this.warship.type() !== UnitType.Warship || !primary.hasHealth()) {
      return 1;
    }
    return this.mg
      .config()
      .warshipVeterancyShellCount(this.warship.veterancy());
  }

  /**
   * Primary target first; extra rounds split onto other ships in range,
   * sorted by distance then unit id. Leftover shots stack back on the primary.
   */
  private volleyTargets(primary: Unit, shotCount: number): Unit[] {
    if (shotCount <= 1) {
      return [primary];
    }
    const nearby = this.mg.nearbyUnits(
      this.warship.tile(),
      this.mg.config().warshipTargettingRange(),
      [UnitType.TransportShip, UnitType.Lander, ...CombatShips.types, ...RepairHulls.types, ...WARSHIP_SHORE_TARGETS],
    );
    const extras = nearby
      .filter(({ unit }) => unit !== primary && this.isValidHostileTarget(unit))
      .sort((a, b) => {
        if (a.distSquared !== b.distSquared) {
          return a.distSquared - b.distSquared;
        }
        return a.unit.id() - b.unit.id();
      })
      .map(({ unit }) => unit);
    return assignWarshipVolleyTargets([primary, ...extras], shotCount);
  }

  private huntDownTradeShip() {
    this.warship.updateWarshipState({ isInCombat: true });
    for (let i = 0; i < this.huntSteps(); i++) {
      const target = this.warship.targetUnit()!;
      const targetTile = target.tile();
      const dist = this.mg.manhattanDist(this.warship.tile(), targetTile);

      if (dist <= 5) {
        this.warship.owner().captureUnit(target);
        this.warship.recordTradeCapture();
        this.warship.setTargetUnit(undefined);
        this.warship.touch();
        return;
      }

      // When close, the minimap (2x scale) produces diagonal upscaled paths that
      // make it hard to converge. Use direct greedy movement instead.
      if (dist <= 20) {
        const nextTile = this.bestNeighborToward(targetTile);
        if (nextTile !== undefined) {
          this.warship.move(nextTile);
          continue;
        }
      }

      const result = this.pathfinder.next(this.warship.tile(), targetTile, 5);
      switch (result.status) {
        case PathStatus.COMPLETE:
          this.warship.owner().captureUnit(target);
          this.warship.recordTradeCapture();
          this.warship.setTargetUnit(undefined);
          this.warship.touch();
          return;
        case PathStatus.NEXT:
          this.warship.move(result.node);
          break;
        case PathStatus.NOT_FOUND:
          console.log(`path not found to target`);
          break;
      }
    }
  }

  private bestNeighborToward(targetTile: TileRef): TileRef | undefined {
    const warshipTile = this.warship.tile();
    let best: TileRef | undefined;
    let bestDist = this.mg.manhattanDist(warshipTile, targetTile);
    this.mg.forEachNeighbor(warshipTile, (neighbor) => {
      if (!this.mg.isWater(neighbor)) return;
      const d = this.mg.manhattanDist(neighbor, targetTile);
      if (d < bestDist) {
        bestDist = d;
        best = neighbor;
      }
    });
    return best;
  }

  private patrol() {
    if (isRepairHull(this.warship.type())) {
      this.holdTenderStation();
      return;
    }
    for (let i = 0; i < this.patrolSteps(); i++) {
      if (this.warship.targetTile() === undefined) {
        this.warship.setTargetTile(this.randomTile());
        if (this.warship.targetTile() === undefined) {
          return;
        }
      }

      const result = this.pathfinder.next(
        this.warship.tile(),
        this.warship.targetTile()!,
      );
      switch (result.status) {
        case PathStatus.COMPLETE:
          this.warship.setTargetTile(undefined);
          this.warship.move(result.node);
          break;
        case PathStatus.NEXT:
          this.warship.move(result.node);
          break;
        case PathStatus.NOT_FOUND: {
          console.log(`path not found to target`);
          this.warship.setTargetTile(undefined);
          break;
        }
      }
    }
  }

  /** Tenders park on the assigned water tile instead of wandering the warship box. */
  private holdTenderStation(): void {
    const dest = this.warship.warshipState().patrolTile;
    if (dest === undefined || !this.mg.isValidRef(dest) || !this.mg.isWater(dest)) {
      this.warship.setTargetTile(undefined);
      return;
    }
    if (this.warship.tile() === dest) {
      this.warship.setTargetTile(undefined);
      return;
    }
    this.warship.setTargetTile(dest);
    for (let i = 0; i < this.patrolSteps(); i++) {
      if (this.warship.tile() === dest) {
        this.warship.setTargetTile(undefined);
        return;
      }
      const result = this.pathfinder.next(this.warship.tile(), dest);
      switch (result.status) {
        case PathStatus.COMPLETE:
          this.warship.setTargetTile(undefined);
          this.warship.move(result.node);
          break;
        case PathStatus.NEXT:
          this.warship.move(result.node);
          break;
        case PathStatus.NOT_FOUND:
          this.warship.setTargetTile(undefined);
          return;
      }
    }
  }

  /** Marauders average 1.5 tiles per tick; warships stay at 1. */
  private patrolSteps(): number {
    if (
      this.warship.type() !== UnitType.Marauder &&
      this.warship.type() !== UnitType.Corsair
    ) {
      return 1;
    }
    return this.currentTick % 2 === 0 ? 2 : 1;
  }

  /** Warships hunt at 2 steps/tick; marauders keep the same 1.5× bonus (3). */
  private huntSteps(): number {
    return this.warship.type() === UnitType.Marauder ||
      this.warship.type() === UnitType.Corsair
      ? 3
      : 2;
  }

  isActive(): boolean {
    return this.warship?.isActive();
  }

  isDocked(): boolean {
    return (this.warship?.warshipState().state ?? "patrolling") === "docked";
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  randomTile(allowShoreline: boolean = false): TileRef | undefined {
    let warshipPatrolRange = this.mg.config().warshipPatrolRange();
    const maxAttemptBeforeExpand: number = 500;
    let attempts: number = 0;
    let expandCount: number = 0;

    // Get warship's water component for connectivity check
    const warshipComponent = this.mg.getWaterComponent(this.warship.tile());

    const patrolTile = this.warship.warshipState().patrolTile;
    // A non-integer or out-of-range patrolTile makes mg.x()/mg.y() return
    // undefined, so every candidate coordinate below is NaN, isValidCoord is
    // always false, and the loop's out-of-bounds `continue` (which does not
    // advance expandCount) spins forever, hanging the whole synchronous sim.
    // Bail out instead of trusting patrolTile is a valid tile.
    if (patrolTile === undefined || !this.mg.isValidRef(patrolTile)) {
      return undefined;
    }

    while (expandCount < 3) {
      const x =
        this.mg.x(patrolTile) +
        this.random.nextInt(-warshipPatrolRange / 2, warshipPatrolRange / 2);
      const y =
        this.mg.y(patrolTile) +
        this.random.nextInt(-warshipPatrolRange / 2, warshipPatrolRange / 2);
      if (!this.mg.isValidCoord(x, y)) {
        continue;
      }
      const tile = this.mg.ref(x, y);
      if (
        !this.mg.isWater(tile) ||
        (!allowShoreline && this.mg.isShoreline(tile))
      ) {
        attempts++;
        if (attempts === maxAttemptBeforeExpand) {
          expandCount++;
          attempts = 0;
          warshipPatrolRange =
            warshipPatrolRange + Math.floor(warshipPatrolRange / 2);
        }
        continue;
      }
      // Check water component connectivity
      if (
        warshipComponent !== null &&
        !this.mg.hasWaterComponent(tile, warshipComponent)
      ) {
        attempts++;
        if (attempts === maxAttemptBeforeExpand) {
          expandCount++;
          attempts = 0;
          warshipPatrolRange =
            warshipPatrolRange + Math.floor(warshipPatrolRange / 2);
        }
        continue;
      }
      return tile;
    }
    console.warn(
      `Failed to find random tile for warship for ${this.warship.owner().name()}`,
    );
    if (!allowShoreline) {
      // If we failed to find a tile on the ocean, try again but allow shoreline
      return this.randomTile(true);
    }
    return undefined;
  }
}
