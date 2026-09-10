import { ShellExecution } from "../src/core/execution/ShellExecution";
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

describe("Ship gun range and fuse", () => {
  let game: Game;
  let player1: Player;
  let player2: Player;

  beforeEach(async () => {
    game = await setup(
      "big_plains",
      { infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("navy", PlayerType.Human, null, "player_1_id"),
        new PlayerInfo("shore", PlayerType.Human, null, "player_2_id"),
      ],
    );
    player1 = game.player("player_1_id");
    player2 = game.player("player_2_id");
    executeTicks(game, 1);
  });

  test("acquisition is 85 tiles; navy fuse is 34 ticks", () => {
    expect(game.config().warshipTargettingRange()).toBe(85);
    expect(game.config().warshipShellLifetime()).toBe(34);
    expect(game.config().transportTargettingRange()).toBe(42);
    expect(game.config().voidshipTargettingRange()).toBe(115);
    expect(game.config().voidshipShellLifetime()).toBe(39);
    expect(
      game.config().combatShipTargettingRange(UnitType.Voidship),
    ).toBe(115);
    expect(
      game.config().combatShipTargettingRange(UnitType.Corsair),
    ).toBe(115);
    expect(
      game.config().combatShipTargettingRange(UnitType.Warship),
    ).toBe(85);
    expect(game.config().combatShipShellLifetime(UnitType.Voidship)).toBe(39);
    expect(game.config().combatShipShellLifetime(UnitType.Warship)).toBe(34);
  });

  test("warship does not acquire a ship 100 tiles away", () => {
    const spawn = game.ref(10, 10);
    const warship = player1.buildUnit(UnitType.Warship, spawn, {
      patrolTile: spawn,
    });
    player2.buildUnit(UnitType.Warship, game.ref(10, 110), {
      patrolTile: game.ref(10, 110),
    });
    game.addExecution(new WarshipExecution(warship));
    executeTicks(game, 2);
    expect(warship.targetUnit()).toBeUndefined();
  });

  test("warship acquires a ship at 85 tiles", () => {
    const spawn = game.ref(20, 10);
    const warship = player1.buildUnit(UnitType.Warship, spawn, {
      patrolTile: spawn,
    });
    const enemy = player2.buildUnit(UnitType.Warship, game.ref(20, 95), {
      patrolTile: game.ref(20, 95),
    });
    game.addExecution(new WarshipExecution(warship));
    executeTicks(game, 2);
    expect(warship.targetUnit()).toBe(enemy);
  });

  test("marauder acquires at 85 and ignores 100", () => {
    const nearSpawn = game.ref(30, 10);
    const farSpawn = game.ref(50, 10);
    const near = player1.buildUnit(UnitType.Marauder, nearSpawn, {
      patrolTile: nearSpawn,
    });
    const far = player1.buildUnit(UnitType.Marauder, farSpawn, {
      patrolTile: farSpawn,
    });
    const inRange = player2.buildUnit(UnitType.Warship, game.ref(30, 95), {
      patrolTile: game.ref(30, 95),
    });
    player2.buildUnit(UnitType.Warship, game.ref(50, 110), {
      patrolTile: game.ref(50, 110),
    });
    game.addExecution(new WarshipExecution(near));
    game.addExecution(new WarshipExecution(far));
    executeTicks(game, 2);
    expect(near.targetUnit()).toBe(inRange);
    expect(far.targetUnit()).toBeUndefined();
  });

  test("voidship acquires at 115 and ignores 130", () => {
    const nearSpawn = game.ref(20, 10);
    const farSpawn = game.ref(60, 10);
    const near = player1.buildUnit(UnitType.Voidship, nearSpawn, {
      patrolTile: nearSpawn,
    });
    const far = player1.buildUnit(UnitType.Voidship, farSpawn, {
      patrolTile: farSpawn,
    });
    const inRange = player2.buildUnit(UnitType.Voidship, game.ref(20, 125), {
      patrolTile: game.ref(20, 125),
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

  test("corsair acquires at 115", () => {
    const spawn = game.ref(20, 10);
    const corsair = player1.buildUnit(UnitType.Corsair, spawn, {
      patrolTile: spawn,
    });
    const enemy = player2.buildUnit(UnitType.Corsair, game.ref(20, 125), {
      patrolTile: game.ref(20, 125),
    });
    game.addExecution(new WarshipExecution(corsair));
    executeTicks(game, 2);
    expect(corsair.targetUnit()).toBe(enemy);
  });

  test("voidship shell fuse is 39 ticks", () => {
    const spawn = game.ref(10, 20);
    const close = game.ref(10, 40);
    const fled = game.ref(10, 190);
    const voidship = player1.buildUnit(UnitType.Voidship, spawn, {
      patrolTile: spawn,
    });
    const target = player2.buildUnit(UnitType.Voidship, close, {
      patrolTile: close,
    });
    const startingHealth = target.health();
    const shell = new ShellExecution(spawn, player1, voidship, target);
    game.addExecution(shell);
    executeTicks(game, 2);
    expect(shell.isActive()).toBe(true);
    target.move(fled);
    executeTicks(game, game.config().voidshipShellLifetime());
    expect(shell.isActive()).toBe(false);
    expect(target.isActive()).toBe(true);
    expect(target.health()).toBe(startingHealth);
  });

  test("shell despawns after the travel cap if the target flees", () => {
    const spawn = game.ref(10, 20);
    const close = game.ref(10, 40);
    const fled = game.ref(10, 190);
    const warship = player1.buildUnit(UnitType.Warship, spawn, {
      patrolTile: spawn,
    });
    const target = player2.buildUnit(UnitType.Warship, close, {
      patrolTile: close,
    });
    const startingHealth = target.health();
    const shell = new ShellExecution(spawn, player1, warship, target);
    game.addExecution(shell);
    executeTicks(game, 2); // init, then first flight tick (fuse armed)
    expect(shell.isActive()).toBe(true);
    target.move(fled);
    executeTicks(game, game.config().warshipShellLifetime());
    expect(shell.isActive()).toBe(false);
    expect(target.isActive()).toBe(true);
    expect(target.health()).toBe(startingHealth);
  });

  test("shell still hits if the target stays inside the fuse range", () => {
    const spawn = game.ref(70, 20);
    const stay = game.ref(70, 50);
    const warship = player1.buildUnit(UnitType.Warship, spawn, {
      patrolTile: spawn,
    });
    const target = player2.buildUnit(UnitType.Warship, stay, {
      patrolTile: stay,
    });
    const startingHealth = target.health();
    const shell = new ShellExecution(spawn, player1, warship, target);
    game.addExecution(shell);
    executeTicks(game, game.config().warshipShellLifetime());
    expect(shell.isActive()).toBe(false);
    expect(target.health()).toBeLessThan(startingHealth);
  });
});

describe("Ship shore bombardment and building hulls", () => {
  const coastX = 7;
  let game: Game;
  let player1: Player;
  let player2: Player;

  beforeEach(async () => {
    game = await setup(
      "half_land_half_ocean",
      { infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("navy", PlayerType.Human, null, "player_1_id"),
        new PlayerInfo("shore", PlayerType.Human, null, "player_2_id"),
      ],
    );
    player1 = game.player("player_1_id");
    player2 = game.player("player_2_id");
    executeTicks(game, 50);
  });

  test("warship fires on a city in range and chips HP", () => {
    const city = player2.buildUnit(UnitType.City, game.ref(5, 10), {});
    const spawn = game.ref(coastX + 1, 10);
    const warship = player1.buildUnit(UnitType.Warship, spawn, {
      patrolTile: spawn,
    });
    const startingHealth = city.health();
    expect(startingHealth).toBe(game.config().cityMaxHealth());
    game.addExecution(new WarshipExecution(warship));
    executeTicks(game, 50);
    expect(city.isActive()).toBe(true);
    expect(city.health()).toBeLessThan(startingHealth);
  });

  test("city is deleted at 0 HP and must be rebuilt", () => {
    const city = player2.buildUnit(UnitType.City, game.ref(5, 10), {});
    city.modifyHealth(-city.health(), player1);
    expect(city.isActive()).toBe(false);
    expect(player2.units(UnitType.City)).toHaveLength(0);
  });

  test("city HP does not regenerate over ticks", () => {
    const city = player2.buildUnit(UnitType.City, game.ref(5, 10), {});
    city.modifyHealth(-400);
    const damaged = city.health();
    executeTicks(game, 80);
    expect(city.isActive()).toBe(true);
    expect(city.health()).toBe(damaged);
  });

  test("an upgraded city takes extra HP and dies at 0 without dropping levels", () => {
    const city = player2.buildUnit(UnitType.City, game.ref(5, 10), {});
    city.increaseLevel();
    city.increaseLevel();
    expect(city.level()).toBe(3);
    const hull = city.maxHealth();
    expect(hull).toBe(
      game.config().cityMaxHealth() + 2 * game.config().cityHealthPerLevel(),
    );
    city.modifyHealth(-400, player1);
    expect(city.isActive()).toBe(true);
    expect(city.level()).toBe(3);
    expect(city.health()).toBe(hull - 400);
    city.modifyHealth(-(hull - 400), player1);
    expect(city.isActive()).toBe(false);
  });

  test("combat ships out-prioritize buildings so a city does not steal focus", () => {
    const city = player2.buildUnit(UnitType.City, game.ref(5, 10), {});
    const enemy = player2.buildUnit(
      UnitType.Warship,
      game.ref(coastX + 2, 10),
      { patrolTile: game.ref(coastX + 2, 10) },
    );
    const spawn = game.ref(coastX + 1, 10);
    const warship = player1.buildUnit(UnitType.Warship, spawn, {
      patrolTile: spawn,
    });
    game.addExecution(new WarshipExecution(warship));
    executeTicks(game, 2);
    expect(warship.targetUnit()).toBe(enemy);
    expect(warship.targetUnit()).not.toBe(city);
  });

  test("buildings other than ports have the configured hulls", () => {
    const factory = player2.buildUnit(UnitType.Factory, game.ref(4, 10), {});
    const silo = player2.buildUnit(UnitType.MissileSilo, game.ref(3, 10), {});
    const sam = player2.buildUnit(UnitType.SAMLauncher, game.ref(2, 10), {});
    const post = player2.buildUnit(UnitType.DefensePost, game.ref(1, 10), {});
    const armory = player2.buildUnit(UnitType.Armory, game.ref(5, 12), {});
    expect(factory.health()).toBe(game.config().factoryMaxHealth());
    expect(silo.health()).toBe(game.config().missileSiloMaxHealth());
    expect(sam.health()).toBe(game.config().samLauncherMaxHealth());
    expect(post.health()).toBe(game.config().defensePostMaxHealth());
    expect(armory.health()).toBe(game.config().armoryMaxHealth());
  });

  test("warship fires on a factory in range", () => {
    const factory = player2.buildUnit(UnitType.Factory, game.ref(5, 10), {});
    const spawn = game.ref(coastX + 1, 10);
    const warship = player1.buildUnit(UnitType.Warship, spawn, {
      patrolTile: spawn,
    });
    const startingHealth = factory.health();
    game.addExecution(new WarshipExecution(warship));
    executeTicks(game, 50);
    expect(factory.health()).toBeLessThan(startingHealth);
  });
});
