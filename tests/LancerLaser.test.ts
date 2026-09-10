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

describe("Lancer laser", () => {
  let game: Game;
  let player1: Player;
  let player2: Player;

  beforeEach(async () => {
    game = await setup(
      "big_plains",
      { infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("laser", PlayerType.Human, null, "player_1_id"),
        new PlayerInfo("mark", PlayerType.Human, null, "player_2_id"),
      ],
    );
    player1 = game.player("player_1_id");
    player2 = game.player("player_2_id");
    executeTicks(game, 1);
  });

  test("range is 120, lock is 20 ticks, reload is 50 ticks", () => {
    expect(game.config().lancerTargettingRange()).toBe(120);
    expect(game.config().lancerLaserDuration()).toBe(20);
    expect(game.config().lancerLaserAttackRate()).toBe(50);
    expect(game.config().combatShipTargettingRange(UnitType.Lancer)).toBe(120);
    expect(game.config().unitInfo(UnitType.Lancer).maxHealth).toBe(500);
  });

  test("acquires a ship at 120 tiles and ignores 130", () => {
    const nearSpawn = game.ref(20, 10);
    const farSpawn = game.ref(60, 10);
    const near = player1.buildUnit(UnitType.Lancer, nearSpawn, {
      patrolTile: nearSpawn,
    });
    const far = player1.buildUnit(UnitType.Lancer, farSpawn, {
      patrolTile: farSpawn,
    });
    const inRange = player2.buildUnit(UnitType.Voidship, game.ref(20, 130), {
      patrolTile: game.ref(20, 130),
    });
    player2.buildUnit(UnitType.Voidship, game.ref(60, 140), {
      patrolTile: game.ref(60, 140),
    });
    game.addExecution(new WarshipExecution(near));
    game.addExecution(new WarshipExecution(far));
    executeTicks(game, 2);
    expect(near.targetUnit()).toBe(inRange);
    expect(far.targetUnit()).toBeUndefined();
  });

  test("locks a beam, deals half-shell damage, and does not spawn shells", () => {
    const spawn = game.ref(20, 10);
    const enemyTile = game.ref(20, 40);
    const lancer = player1.buildUnit(UnitType.Lancer, spawn, {
      patrolTile: spawn,
    });
    const enemy = player2.buildUnit(UnitType.Corsair, enemyTile, {
      patrolTile: enemyTile,
    });
    const startingHealth = enemy.health();
    game.addExecution(new WarshipExecution(lancer));
    executeTicks(game, game.config().lancerLaserAttackRate());
    expect(lancer.targetUnit()).toBe(enemy);
    expect(lancer.lastVolleyTick()).toBeGreaterThan(0);
    expect(enemy.health()).toBeLessThan(startingHealth);
    expect(enemy.health()).toBeGreaterThan(startingHealth - 450);
    expect(player1.units(UnitType.Shell).length).toBe(0);

    const lockedTick = lancer.lastVolleyTick();
    enemy.move(game.ref(20, 80));
    executeTicks(game, 5);
    expect(lancer.targetUnit()).toBe(enemy);
    expect(lancer.lastVolleyTick()).toBe(lockedTick);
  });

  test("does not fire again until five seconds have passed", () => {
    const spawn = game.ref(20, 10);
    const lancer = player1.buildUnit(UnitType.Lancer, spawn, {
      patrolTile: spawn,
    });
    const enemy = player2.buildUnit(UnitType.Corsair, game.ref(20, 30), {
      patrolTile: game.ref(20, 30),
    });
    game.addExecution(new WarshipExecution(lancer));
    executeTicks(game, game.config().lancerLaserAttackRate());
    const firstVolley = lancer.lastVolleyTick();
    const healthAfterFirst = enemy.health();
    executeTicks(game, game.config().lancerLaserDuration());
    expect(enemy.health()).toBe(healthAfterFirst);
    executeTicks(game, 25);
    expect(lancer.lastVolleyTick()).toBe(firstVolley);
    executeTicks(game, 10);
    expect(lancer.lastVolleyTick()).toBeGreaterThan(firstVolley);
    expect(enemy.health()).toBeLessThan(healthAfterFirst);
  });
});
