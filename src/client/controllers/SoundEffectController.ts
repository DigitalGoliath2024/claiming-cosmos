import { EventBus } from "../../core/EventBus";
import { UnitType } from "../../core/game/Game";
import { GameUpdateType } from "../../core/game/GameUpdates";
import { Controller } from "../Controller";
import {
  AnnouncerLine,
  PlayAnnouncerEvent,
  PlaySoundEffectEvent,
  SoundEffect,
} from "../sound/Sounds";
import { GameView, UnitView } from "../view";

// A MIRV rains hundreds of warheads over a few seconds; playing a boom per
// warhead churns the audio pipeline. Play at most one warhead boom per interval.
const MIRV_HIT_SOUND_INTERVAL_TICKS = 5;

const DESTROY_ANNOUNCER: Partial<Record<UnitType, AnnouncerLine>> = {
  [UnitType.Warship]: "warship-destroyed",
  [UnitType.Voidship]: "warship-destroyed",
  [UnitType.Marauder]: "marauder-destroyed",
  [UnitType.Corsair]: "marauder-destroyed",
  [UnitType.Tender]: "warship-destroyed",
  [UnitType.Vestal]: "warship-destroyed",
  [UnitType.City]: "city-destroyed",
  [UnitType.Port]: "port-destroyed",
  [UnitType.Starport]: "port-destroyed",
  [UnitType.PortGun]: "port-gun-destroyed",
  [UnitType.Factory]: "factory-destroyed",
};

export class SoundEffectController implements Controller {
  private lastMirvHitSoundTick = -Infinity;
  private previouslyActive = new Set<number>();
  private announcedGameOver = false;

  constructor(
    private readonly game: GameView,
    private readonly eventBus: EventBus,
  ) {}

  tick(): void {
    this.maybeAnnounceGameOver();
    const updates = this.game.updatesSinceLastTick();
    if (!updates) return;

    for (const u of updates[GameUpdateType.Unit] ?? []) {
      const unit = this.game.unit(u.id);
      if (unit === undefined) continue;
      this.handleUnit(unit);
    }

    const myPlayer = this.game.myPlayer();
    if (myPlayer === null) return;
    for (const c of updates[GameUpdateType.ConquestEvent] ?? []) {
      if (c.conquerorId === myPlayer.id()) {
        this.emit("ka-ching");
      }
    }
  }

  private handleUnit(unit: UnitView): void {
    const id = unit.id();
    if (unit.isActive()) {
      this.previouslyActive.add(id);
      if (unit.createdAt() === this.game.ticks()) {
        this.onCreated(unit);
      }
    } else if (this.previouslyActive.delete(id)) {
      this.onDestroyed(unit);
    }
    switch (unit.type()) {
      case UnitType.AtomBomb:
        this.onNukeDetonation(unit, "atom-hit");
        break;
      case UnitType.MIRVWarhead:
        this.onMirvWarheadDetonation(unit);
        break;
      case UnitType.HydrogenBomb:
        this.onNukeDetonation(unit, "hydrogen-hit");
        break;
    }
  }

  private onDestroyed(unit: UnitView): void {
    const myPlayer = this.game.myPlayer();
    if (myPlayer === null || unit.owner() !== myPlayer) return;
    const line = DESTROY_ANNOUNCER[unit.type()];
    if (line !== undefined) {
      this.emitAnnouncer(line);
    }
  }

  private onMirvWarheadDetonation(unit: UnitView): void {
    if (unit.isActive()) return;
    if (!unit.reachedTarget()) return;
    const tick = this.game.ticks();
    if (tick - this.lastMirvHitSoundTick < MIRV_HIT_SOUND_INTERVAL_TICKS) {
      return;
    }
    this.lastMirvHitSoundTick = tick;
    this.emit("atom-hit");
  }

  private onCreated(unit: UnitView): void {
    const myPlayer = this.game.myPlayer();
    switch (unit.type()) {
      case UnitType.AtomBomb:
        this.emit("atom-launch");
        break;
      case UnitType.HydrogenBomb:
        this.emit("hydrogen-launch");
        break;
      case UnitType.MIRV:
        this.emit("mirv-launch");
        break;
      case UnitType.Warship:
      case UnitType.Voidship:
      case UnitType.Marauder:
      case UnitType.Corsair:
      case UnitType.Tender:
      case UnitType.Vestal:
        if (unit.owner() === myPlayer) this.emit("build-warship");
        break;
      case UnitType.City:
        if (unit.owner() === myPlayer) this.emit("build-city");
        break;
      case UnitType.Port:
      case UnitType.Starport:
        if (unit.owner() === myPlayer) this.emit("build-port");
        break;
      case UnitType.DefensePost:
        if (unit.owner() === myPlayer) this.emit("build-defense-post");
        break;
      case UnitType.PortGun:
        if (unit.owner() === myPlayer) this.emit("build-defense-post");
        break;
      case UnitType.InlandBattery:
        if (unit.owner() === myPlayer) this.emit("build-defense-post");
        break;
      case UnitType.Armory:
        if (unit.owner() === myPlayer) this.emit("build-city");
        break;
      case UnitType.NavalMine:
        if (unit.owner() === myPlayer) this.emit("build-defense-post");
        break;
      case UnitType.SAMLauncher:
        if (unit.owner() === myPlayer) this.emit("sam-built");
        break;
      case UnitType.MissileSilo:
        if (unit.owner() === myPlayer) this.emit("silo-built");
        break;
    }
  }

  private onNukeDetonation(unit: UnitView, sound: SoundEffect): void {
    if (unit.isActive()) return;
    if (!unit.reachedTarget()) return;
    this.emit(sound);
  }

  private maybeAnnounceGameOver(): void {
    if (this.announcedGameOver) return;
    const myPlayer = this.game.myPlayer();
    if (
      myPlayer === null ||
      myPlayer.isAlive() ||
      this.game.inSpawnPhase() ||
      !myPlayer.hasSpawned()
    ) {
      return;
    }
    this.announcedGameOver = true;
    this.emitAnnouncer("game-over");
  }

  private emit(sound: SoundEffect): void {
    this.eventBus.emit(new PlaySoundEffectEvent(sound));
  }

  private emitAnnouncer(line: AnnouncerLine): void {
    this.eventBus.emit(new PlayAnnouncerEvent(line));
  }
}
