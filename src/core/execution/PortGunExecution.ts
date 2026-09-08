import {
  CombatShips,
  Execution,
  Game,
  RepairHulls,
  Unit,
  UnitType,
} from "../game/Game";
import { isTransportHull } from "../game/NavalDomain";
import { ShellExecution } from "./ShellExecution";

const PORT_GUN_TARGETS: readonly UnitType[] = [
  ...CombatShips.types,
  ...RepairHulls.types,
  UnitType.TransportShip,
  UnitType.Lander,
];

export class PortGunExecution implements Execution {
  private mg: Game;
  private active = true;
  private lastShellAttack = 0;
  private lastRepairTick = 0;
  private alreadySentShell = new Set<Unit>();

  constructor(private post: Unit) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
  }

  private shoot(targets: Unit[]) {
    if (targets.length === 0) {
      return;
    }
    const shellAttackRate = this.mg.config().portGunShellAttackRate();
    if (this.mg.ticks() - this.lastShellAttack <= shellAttackRate) {
      return;
    }
    this.lastShellAttack = this.mg.ticks();
    const salvo = this.mg.config().portGunShellCount(this.post.level());
    for (let i = 0; i < salvo; i++) {
      const target = targets[i % targets.length];
      this.mg.addExecution(
        new ShellExecution(
          this.post.tile(),
          this.post.owner(),
          this.post,
          target,
        ),
      );
      if (!target.hasHealth()) {
        this.alreadySentShell.add(target);
      }
    }
  }

  tick(ticks: number): void {
    if (!this.post.isActive()) {
      this.active = false;
      return;
    }

    if (this.post.isUnderConstruction()) {
      return;
    }

    this.applyRepairman();

    const shellAttackRate = this.mg.config().portGunShellAttackRate();
    if (this.mg.ticks() - this.lastShellAttack <= shellAttackRate) {
      return;
    }

    const range = this.mg.config().portGunRange(this.post.level());
    const ships = this.mg
      .nearbyUnits(this.post.tile(), range, PORT_GUN_TARGETS)
      .filter(
        ({ unit }) =>
          unit.isActive() &&
          unit.owner() !== this.post.owner() &&
          !unit.owner().isFriendly(this.post.owner()) &&
          !this.alreadySentShell.has(unit),
      );

    ships.sort((a, b) => {
      const { unit: unitA, distSquared: distA } = a;
      const { unit: unitB, distSquared: distB } = b;

      if (isTransportHull(unitA.type()) && !isTransportHull(unitB.type())) {
        return -1;
      }
      if (!isTransportHull(unitA.type()) && isTransportHull(unitB.type())) {
        return 1;
      }

      return distA - distB;
    });

    this.shoot(ships.map(({ unit }) => unit));
  }

  private applyRepairman(): void {
    const interval = this.mg.config().portGunRepairmanInterval(this.post.level());
    if (interval <= 0) {
      return;
    }
    if (!this.post.hasHealth()) {
      return;
    }
    if (!this.post.structureNeedsRepair()) {
      this.lastRepairTick = 0;
      return;
    }
    if (this.lastRepairTick === 0) {
      this.lastRepairTick = this.mg.ticks();
      return;
    }
    if (this.mg.ticks() - this.lastRepairTick < interval) {
      return;
    }
    this.lastRepairTick = this.mg.ticks();
    this.post.modifyHealth(
      this.mg.config().portGunRepairmanHealPerPulse(this.post.level()),
    );
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
