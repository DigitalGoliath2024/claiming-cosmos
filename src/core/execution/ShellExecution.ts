import { Execution, Game, Player, Unit, UnitType } from "../game/Game";
import { TileRef } from "../game/GameMap";
import { warshipShellDamagePercent } from "../game/Veterancy";
import { PathFinding } from "../pathfinding/PathFinder";
import { PathStatus, SteppingPathFinder } from "../pathfinding/types";
import { PseudoRandom } from "../PseudoRandom";

export class ShellExecution implements Execution {
  private active = true;
  private pathFinder: SteppingPathFinder<TileRef>;
  private shell: Unit | undefined;
  private mg: Game;
  private destroyAtTick: number = -1;
  private random: PseudoRandom;

  constructor(
    private spawn: TileRef,
    private _owner: Player,
    private ownerUnit: Unit,
    private target: Unit,
  ) {}

  init(mg: Game, ticks: number): void {
    this.pathFinder = PathFinding.Air(mg);
    this.mg = mg;
    this.random = new PseudoRandom(mg.ticks());
  }

  tick(ticks: number): void {
    this.shell ??= this._owner.buildUnit(UnitType.Shell, this.spawn, {});
    if (!this.shell.isActive()) {
      this.active = false;
      return;
    }
    if (this.destroyAtTick === -1) {
      if (this.isNavyShell()) {
        // Fuse from spawn so navy shells cannot home forever.
        this.destroyAtTick =
          this.mg.ticks() +
          this.mg.config().combatShipShellLifetime(this.ownerUnit.type());
      } else if (!this.ownerUnit.isActive()) {
        this.destroyAtTick = this.mg.ticks() + this.mg.config().shellLifetime();
      }
    }

    if (
      !this.target.isActive() ||
      this.target.owner() === this.shell.owner() ||
      (this.destroyAtTick !== -1 && this.mg.ticks() >= this.destroyAtTick)
    ) {
      this.shell.delete(false);
      this.active = false;
      return;
    }

    for (let i = 0; i < 3; i++) {
      const result = this.pathFinder.next(
        this.shell.tile(),
        this.target.tile(),
      );
      if (result.status === PathStatus.COMPLETE) {
        this.active = false;
        const targetType = this.target.type();
        const targetWasActive = this.target.isActive();
        this.target.modifyHealth(-this.effectOnTarget(), this._owner);
        // Award veterancy to the firing warship when this shell lands the
        // killing blow on an enemy warship or transport ship.
        if (
          targetWasActive &&
          !this.target.isActive() &&
          this.ownerUnit.isActive() &&
          (this.ownerUnit.type() === UnitType.Warship ||
            this.ownerUnit.type() === UnitType.Voidship ||
            this.ownerUnit.type() === UnitType.Marauder ||
            this.ownerUnit.type() === UnitType.Corsair)
        ) {
          this.ownerUnit.recordKill(targetType);
        }
        this.shell.setReachedTarget();
        this.shell.delete(false);
        return;
      } else if (result.status === PathStatus.NEXT) {
        this.shell.move(result.node);
      }
    }
  }

  /** Warship, marauder, and transport deck-gun shells. Port guns are not. */
  private isNavyShell(): boolean {
    const type = this.ownerUnit.type();
    return (
      type === UnitType.Warship ||
      type === UnitType.Voidship ||
      type === UnitType.Marauder ||
      type === UnitType.Corsair ||
      type === UnitType.TransportShip ||
      type === UnitType.Lander
    );
  }

  private effectOnTarget(): number {
    const { damage } = this.mg.config().unitInfo(UnitType.Shell);
    const baseDamage = damage ?? 250;

    const roll = this.random.nextInt(1, 6);
    let damageMultiplier = (roll - 1) * 25 + 200;

    // Veteran Warships fire a heavy round from rank 1 onward (+50%, not stacked).
    // Marauders keep the old +20% per stripe. Integer percent math, no floats.
    const ownerType = this.ownerUnit.type();
    const veterancy = this.ownerUnit.veterancy();
    if (
      (ownerType === UnitType.Warship || ownerType === UnitType.Voidship) &&
      veterancy > 0
    ) {
      const bonusPercent = this.mg.config().warshipVeterancyShellDamageBonus();
      damageMultiplier = Math.floor(
        (damageMultiplier *
          warshipShellDamagePercent(veterancy, bonusPercent)) /
          100,
      );
    } else if (
      (ownerType === UnitType.Marauder || ownerType === UnitType.Corsair) &&
      veterancy > 0
    ) {
      const bonusPercent = this.mg.config().marauderVeterancyShellDamageBonus();
      damageMultiplier = Math.floor(
        (damageMultiplier * (100 + veterancy * bonusPercent)) / 100,
      );
    }

    if (this.ownerUnit.type() === UnitType.PortGun) {
      const bonusPercent = this.mg
        .config()
        .portGunDamageBonusForLevel(this.ownerUnit.level());
      damageMultiplier = Math.floor(
        (damageMultiplier * (100 + bonusPercent)) / 100,
      );
    }

    if (
      this.ownerUnit.type() === UnitType.TransportShip ||
      this.ownerUnit.type() === UnitType.Lander
    ) {
      damageMultiplier = Math.floor(damageMultiplier / 2);
    }

    if (this.target.type() === UnitType.PortGun) {
      const armorPercent = this.mg
        .config()
        .portGunArmorPercent(this.target.level());
      damageMultiplier = Math.floor(
        (damageMultiplier * (100 - armorPercent)) / 100,
      );
    }

    return Math.round((baseDamage / 250) * damageMultiplier);
  }

  public getEffectOnTargetForTesting(): number {
    return this.effectOnTarget();
  }

  public getTargetForTesting(): Unit {
    return this.target;
  }

  isActive(): boolean {
    return this.active;
  }
  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
