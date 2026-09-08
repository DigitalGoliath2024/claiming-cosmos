import { ConstructionExecution } from "../src/core/execution/ConstructionExecution";
import { applyNavalMineDamage } from "../src/core/game/NavalMine";
import { WarshipExecution } from "../src/core/execution/WarshipExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../src/core/game/Game";
import { setup } from "./util/Setup";
import { executeTicks } from "./util/utils";

const coastX = 7;
let game: Game;
let player1: Player;
let player2: Player;

describe("Tender", () => {
  beforeEach(async () => {
    game = await setup(
      "half_land_half_ocean",
      { infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("navy", PlayerType.Human, null, "player_1_id"),
        new PlayerInfo("foe", PlayerType.Human, null, "player_2_id"),
      ],
    );
    player1 = game.player("player_1_id");
    player2 = game.player("player_2_id");
    player1.conquer(game.ref(coastX, 10));
    executeTicks(game, 50);
  });

  test("lists a one million gold price", async () => {
    game = await setup(
      "half_land_half_ocean",
      { instantBuild: true },
      [new PlayerInfo("navy", PlayerType.Human, null, "player_1_id")],
    );
    player1 = game.player("player_1_id");
    player1.addGold(5_000_000n);
    const cost = game.config().unitInfo(UnitType.Tender).cost(game, player1);
    expect(cost).toBe(1_000_000n);
    player1.buildUnit(UnitType.Tender, game.ref(coastX + 1, 10), {
      patrolTile: game.ref(coastX + 1, 10),
    });
    expect(game.config().unitInfo(UnitType.Tender).cost(game, player1)).toBe(
      1_000_000n,
    );
  });

  test("has 1200 hit points", () => {
    const tender = player1.buildUnit(
      UnitType.Tender,
      game.ref(coastX + 1, 10),
      { patrolTile: game.ref(coastX + 1, 10) },
    );
    expect(tender.health()).toBe(1200);
    expect(game.config().unitInfo(UnitType.Tender).maxHealth).toBe(1200);
  });

  test("spawns from a port onto water", () => {
    const water = game.ref(coastX + 1, 10);
    expect(game.isWater(water)).toBe(true);
    player1.buildUnit(UnitType.Port, game.ref(coastX, 10), {});
    game.clearOcean(water);
    expect(player1.canBuild(UnitType.Tender, water)).not.toBe(false);
    game.addExecution(
      new ConstructionExecution(player1, UnitType.Tender, water),
    );
    executeTicks(game, 4);
    expect(player1.units(UnitType.Tender)).toHaveLength(1);
  });

  test("parks on its patrol tile instead of wandering", () => {
    const start = game.ref(coastX + 1, 10);
    const park = game.ref(coastX + 1, 14);
    expect(game.isWater(start)).toBe(true);
    expect(game.isWater(park)).toBe(true);
    const tender = player1.buildUnit(UnitType.Tender, start, {
      patrolTile: park,
    });
    game.addExecution(new WarshipExecution(tender));
    executeTicks(game, 8);
    expect(tender.tile()).toBe(park);
    executeTicks(game, 40);
    expect(tender.tile()).toBe(park);
  });

  test("does not fire shells at an enemy warship", () => {
    const tenderTile = game.ref(coastX + 1, 10);
    const enemyTile = game.ref(coastX + 1, 12);
    const tender = player1.buildUnit(UnitType.Tender, tenderTile, {
      patrolTile: tenderTile,
    });
    player2.buildUnit(UnitType.Warship, enemyTile, {
      patrolTile: enemyTile,
    });
    game.addExecution(new WarshipExecution(tender));
    executeTicks(game, 20);
    expect(game.units(UnitType.Shell)).toHaveLength(0);
  });

  test("heals a damaged friendly warship 1 HP per tick away from a port", () => {
    const shipTile = game.ref(coastX + 1, 10);
    const tenderTile = game.ref(coastX + 1, 11);
    const warship = player1.buildUnit(UnitType.Warship, shipTile, {
      patrolTile: shipTile,
    });
    player1.buildUnit(UnitType.Tender, tenderTile, {
      patrolTile: tenderTile,
    });
    const maxHealth = warship.maxHealth();
    game.addExecution(new WarshipExecution(warship));
    game.executeNextTick();
    warship.modifyHealth(-10);
    expect(warship.health()).toBe(maxHealth - 10);
    game.executeNextTick();
    expect(warship.health()).toBe(maxHealth - 9);
  });

  test("another tender heals a tender slowly, not 1 HP per tick", () => {
    const hurt = player1.buildUnit(UnitType.Tender, game.ref(coastX + 1, 10), {
      patrolTile: game.ref(coastX + 1, 10),
    });
    player1.buildUnit(UnitType.Tender, game.ref(coastX + 1, 11), {
      patrolTile: game.ref(coastX + 1, 11),
    });
    game.addExecution(new WarshipExecution(hurt));
    game.executeNextTick();
    hurt.modifyHealth(-10);
    const damaged = hurt.health();
    game.executeNextTick();
    expect(hurt.health()).toBe(damaged);
    executeTicks(game, 6);
    expect(hurt.health()).toBe(damaged + 1);
  });

  test("a lone tender does not patch its own hull", () => {
    const tender = player1.buildUnit(
      UnitType.Tender,
      game.ref(coastX + 1, 10),
      { patrolTile: game.ref(coastX + 1, 10) },
    );
    game.addExecution(new WarshipExecution(tender));
    game.executeNextTick();
    tender.modifyHealth(-10);
    const damaged = tender.health();
    executeTicks(game, 20);
    expect(tender.health()).toBe(damaged);
  });

  test("does not stack heal with port proximity heal", () => {
    const portTile = game.ref(coastX, 10);
    const shipTile = game.ref(coastX + 1, 10);
    player1.buildUnit(UnitType.Port, portTile, {});
    const warship = player1.buildUnit(UnitType.Warship, shipTile, {
      patrolTile: shipTile,
    });
    player1.buildUnit(UnitType.Tender, game.ref(coastX + 1, 11), {
      patrolTile: game.ref(coastX + 1, 11),
    });
    const maxHealth = warship.maxHealth();
    game.addExecution(new WarshipExecution(warship));
    game.executeNextTick();
    warship.modifyHealth(-10);
    game.executeNextTick();
    expect(warship.health()).toBe(maxHealth - 9);
  });

  test("a mine chips the hull like a warship instead of sinking it", () => {
    const tender = player1.buildUnit(
      UnitType.Tender,
      game.ref(coastX + 1, 10),
      { patrolTile: game.ref(coastX + 1, 10) },
    );
    applyNavalMineDamage(game, tender);
    expect(tender.isActive()).toBe(true);
    expect(tender.health()).toBe(1200 - Math.floor((1200 * 70) / 100));
  });

  test("a wounded warship in a tender bubble does not run to port", () => {
    const shipTile = game.ref(coastX + 1, 10);
    const warship = player1.buildUnit(UnitType.Warship, shipTile, {
      patrolTile: shipTile,
    });
    player1.buildUnit(UnitType.Tender, game.ref(coastX + 1, 11), {
      patrolTile: game.ref(coastX + 1, 11),
    });
    game.addExecution(new WarshipExecution(warship));
    game.executeNextTick();
    warship.modifyHealth(-(warship.maxHealth() - 500));
    executeTicks(game, 8);
    expect(warship.warshipState().state).toBe("patrolling");
    expect(warship.health()).toBeGreaterThan(500);
  });

  test("a wounded warship steams to a tender when no port is closer", () => {
    game.config().tenderHealRange = () => 2;
    const shipTile = game.ref(coastX + 1, 10);
    const tenderTile = game.ref(coastX + 1, 14);
    expect(game.isWater(tenderTile)).toBe(true);
    const warship = player1.buildUnit(UnitType.Warship, shipTile, {
      patrolTile: shipTile,
    });
    const tender = player1.buildUnit(UnitType.Tender, tenderTile, {
      patrolTile: tenderTile,
    });
    game.addExecution(new WarshipExecution(warship));
    game.executeNextTick();
    warship.modifyHealth(-(warship.maxHealth() - 500));
    executeTicks(game, 12);
    expect(warship.warshipState().state).toBe("retreating");
    expect(warship.warshipState().retreatPort).toBeUndefined();
    const distAfter = game.manhattanDist(warship.tile(), tender.tile());
    const distStart = game.manhattanDist(shipTile, tender.tile());
    expect(distAfter).toBeLessThan(distStart);
  });

  test("a wounded warship still docks at port when the port is already healing it", () => {
    player1.buildUnit(UnitType.Port, game.ref(coastX, 10), {});
    const shipTile = game.ref(coastX + 1, 10);
    const warship = player1.buildUnit(UnitType.Warship, shipTile, {
      patrolTile: shipTile,
    });
    player1.buildUnit(UnitType.Tender, game.ref(coastX + 1, 11), {
      patrolTile: game.ref(coastX + 1, 11),
    });
    game.addExecution(new WarshipExecution(warship));
    game.executeNextTick();
    warship.modifyHealth(-(warship.maxHealth() - 50));
    executeTicks(game, 10);
    expect(warship.warshipState().state).not.toBe("patrolling");
    expect(warship.warshipState().retreatPort).toBe(game.ref(coastX, 10));
  });
});
