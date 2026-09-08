import { Execution, Game, isPatrolShip, Player, Tick, Unit, UnitType } from "../game/Game";
import { TileRef } from "../game/GameMap";
import { ArmoryExecution } from "./ArmoryExecution";
import { CityExecution } from "./CityExecution";
import { DefensePostExecution } from "./DefensePostExecution";
import { FactoryExecution } from "./FactoryExecution";
import { MirvExecution } from "./MIRVExecution";
import { MissileSiloExecution } from "./MissileSiloExecution";
import { NukeExecution } from "./NukeExecution";
import { PortExecution } from "./PortExecution";
import { PortGunExecution } from "./PortGunExecution";
import { InlandBatteryExecution } from "./InlandBatteryExecution";
import { SAMLauncherExecution } from "./SAMLauncherExecution";
import { NavalMineExecution } from "./NavalMineExecution";
import { WarshipExecution } from "./WarshipExecution";

export class ConstructionExecution implements Execution {
  private structure: Unit | null = null;
  private active: boolean = true;
  private mg: Game;

  private ticksUntilComplete: Tick;
  private shipsRemaining = 0;
  private nextShipTick = 0;
  private shipBatchStarted = false;

  constructor(
    private player: Player,
    private constructionType: UnitType,
    private tile: TileRef,
    private rocketDirectionUp?: boolean,
    private amount?: number,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;

    if (this.mg.config().isUnitDisabled(this.constructionType)) {
      console.warn(
        `cannot build construction ${this.constructionType} because it is disabled`,
      );
      this.active = false;
      return;
    }

    if (!this.mg.isValidRef(this.tile)) {
      console.warn(`cannot build construction invalid tile ${this.tile}`);
      this.active = false;
      return;
    }
  }

  tick(ticks: number): void {
    if (this.structure === null) {
      const info = this.mg.unitInfo(this.constructionType);
      // For non-structure units (nukes/warship), charge once and delegate to specialized executions.
      const isStructure = this.isStructure(this.constructionType);
      if (!isStructure) {
        if (this.isCombatShip(this.constructionType)) {
          this.tickCombatShipBatch(ticks);
          return;
        }
        // Defer validation and gold deduction to the specific execution
        this.completeConstruction();
        this.active = false;
        return;
      }

      // Structures: build real unit and mark under construction
      const spawnTile = this.player.canBuild(this.constructionType, this.tile);
      if (spawnTile === false) {
        console.warn(`cannot build ${this.constructionType}`);
        this.active = false;
        return;
      }
      this.structure = this.player.buildUnit(
        this.constructionType,
        spawnTile,
        {},
      );
      const duration = info.constructionDuration ?? 0;
      if (duration > 0) {
        this.structure.setUnderConstruction(true);
        this.ticksUntilComplete = duration;
        return;
      }
      // No construction time
      this.completeConstruction();
      this.active = false;
      return;
    }

    if (!this.structure.isActive()) {
      this.active = false;
      return;
    }

    if (this.player !== this.structure.owner()) {
      this.player = this.structure.owner();
    }

    if (this.ticksUntilComplete === 0) {
      this.player = this.structure.owner();
      this.completeConstruction();
      this.active = false;
      return;
    }
    this.ticksUntilComplete--;
  }

  private completeConstruction() {
    if (this.structure) {
      this.structure.setUnderConstruction(false);
    }
    const player = this.player;
    switch (this.constructionType) {
      case UnitType.AtomBomb:
      case UnitType.HydrogenBomb: {
        const count = this.amount ?? 1;
        for (let i = 0; i < count; i++) {
          // NukeExecution staggers same-tick launches per silo itself.
          this.mg.addExecution(
            new NukeExecution(
              this.constructionType,
              player,
              this.tile,
              null,
              -1,
              0,
              this.rocketDirectionUp,
            ),
          );
        }
        break;
      }
      case UnitType.MIRV:
        this.mg.addExecution(new MirvExecution(player, this.tile));
        break;
      case UnitType.Warship:
      case UnitType.Voidship:
      case UnitType.Marauder:
      case UnitType.Corsair:
      case UnitType.Tender:
      case UnitType.Vestal:
        this.spawnCombatShip();
        break;
      case UnitType.Port:
      case UnitType.Starport:
        this.mg.addExecution(new PortExecution(this.structure!));
        break;
      case UnitType.MissileSilo:
        this.mg.addExecution(new MissileSiloExecution(this.structure!));
        break;
      case UnitType.DefensePost:
        this.mg.addExecution(new DefensePostExecution(this.structure!));
        break;
      case UnitType.SAMLauncher:
        this.mg.addExecution(
          new SAMLauncherExecution(player, null, this.structure!),
        );
        break;
      case UnitType.City:
        this.mg.addExecution(new CityExecution(this.structure!));
        break;
      case UnitType.Factory:
        this.mg.addExecution(new FactoryExecution(this.structure!));
        break;
      case UnitType.PortGun:
        this.mg.addExecution(new PortGunExecution(this.structure!));
        break;
      case UnitType.InlandBattery:
        this.mg.addExecution(new InlandBatteryExecution(this.structure!));
        break;
      case UnitType.Armory:
        this.mg.addExecution(new ArmoryExecution(this.structure!));
        break;
      case UnitType.NavalMine:
        this.mg.addExecution(new NavalMineExecution(player, this.tile));
        break;
      default:
        console.warn(
          `unit type ${this.constructionType} cannot be constructed`,
        );
        break;
    }
  }

  private isCombatShip(type: UnitType): boolean {
    return isPatrolShip(type);
  }

  private spawnCombatShip(): void {
    this.mg.addExecution(
      new WarshipExecution({
        owner: this.player,
        patrolTile: this.tile,
        shipType: this.constructionType as
          | UnitType.Warship
          | UnitType.Voidship
          | UnitType.Marauder
          | UnitType.Corsair
          | UnitType.Tender
          | UnitType.Vestal,
      }),
    );
  }

  private tickCombatShipBatch(ticks: Tick): void {
    if (!this.shipBatchStarted) {
      this.shipBatchStarted = true;
      this.shipsRemaining = this.amount ?? 1;
      this.spawnCombatShip();
      this.shipsRemaining--;
      if (this.shipsRemaining <= 0) {
        this.active = false;
        return;
      }
      this.nextShipTick =
        ticks + this.mg.config().combatShipBulkSpawnDelayTicks();
      return;
    }

    if (ticks < this.nextShipTick) {
      return;
    }

    this.spawnCombatShip();
    this.shipsRemaining--;
    if (this.shipsRemaining <= 0) {
      this.active = false;
      return;
    }
    this.nextShipTick =
      ticks + this.mg.config().combatShipBulkSpawnDelayTicks();
  }

  private isStructure(type: UnitType): boolean {
    switch (type) {
      case UnitType.Port:
      case UnitType.Starport:
      case UnitType.MissileSilo:
      case UnitType.DefensePost:
      case UnitType.SAMLauncher:
      case UnitType.City:
      case UnitType.Factory:
      case UnitType.PortGun:
      case UnitType.Armory:
      case UnitType.InlandBattery:
        return true;
      default:
        return false;
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
