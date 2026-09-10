import {
  applyInlandBatteryBlast,
  inlandBatteryBuildingShots,
  inlandBatteryScatterDest,
  pickInlandBatteryDests,
} from "../src/core/execution/InlandBatteryBlast";
import { PlayerExecution } from "../src/core/execution/PlayerExecution";
import { InlandBatteryExecution } from "../src/core/execution/InlandBatteryExecution";
import {
  FireInlandBatteryExecution,
  SetInlandBatteryAutoExecution,
} from "../src/core/execution/FireInlandBatteryExecution";
import { NationStructureBehavior } from "../src/core/execution/nation/NationStructureBehavior";
import { InlandBatteryShellExecution } from "../src/core/execution/InlandBatteryShellExecution";
import {
  Difficulty,
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../src/core/game/Game";
import { PseudoRandom } from "../src/core/PseudoRandom";
import { setup } from "./util/Setup";
import { executeTicks } from "./util/utils";

let game: Game;
let player1: Player;
let player2: Player;

describe("Inland Battery", () => {
  beforeEach(async () => {
    game = await setup(
      "half_land_half_ocean",
      { instantBuild: true },
      [
        new PlayerInfo("gunner", PlayerType.Human, null, "player_1_id"),
        new PlayerInfo("target", PlayerType.Human, null, "player_2_id"),
      ],
    );
    player1 = game.player("player_1_id");
    player2 = game.player("player_2_id");
    player1.addGold(20_000_000n);
    player2.addGold(20_000_000n);
    executeTicks(game, 10);
  });

  test("is in the land build menu and costs 1.5 million", () => {
    expect(game.config().unitInfo(UnitType.InlandBattery).upgradable).toBe(
      true,
    );
    expect(game.config().unitInfo(UnitType.InlandBattery).maxLevel).toBe(10);
    expect(game.config().unitInfo(UnitType.InlandBattery).cost(game, player1)).toBe(
      1_500_000n,
    );
  });

  test("range grows from 100 to 210 and shell count equals level", () => {
    expect(game.config().inlandBatteryRange(1)).toBe(100);
    expect(game.config().inlandBatteryRange(10)).toBe(210);
    expect(game.config().inlandBatteryRange(50)).toBe(210);
    expect(game.config().inlandBatteryShellCount(1)).toBe(1);
    expect(game.config().inlandBatteryShellCount(10)).toBe(10);
  });

  test("places on owned land and not on water", () => {
    const land = game.ref(5, 10);
    player1.conquer(land);
    expect(player1.canBuild(UnitType.InlandBattery, land)).not.toBe(false);

    const water = game.ref(15, 10);
    expect(game.isWater(water)).toBe(true);
    expect(player1.canBuild(UnitType.InlandBattery, water)).toBe(false);
  });

  test("water impact is a dud", () => {
    const land = game.ref(5, 10);
    player1.conquer(land);
    const battery = player1.buildUnit(UnitType.InlandBattery, land, {});
    const water = game.ref(15, 10);
    expect(game.isWater(water)).toBe(true);
    const owner = game.owner(water);
    const beforeFallout = game.numTilesWithFallout();
    const shell = new InlandBatteryShellExecution(
      land,
      player1,
      battery,
      water,
    );
    game.addExecution(shell);
    executeTicks(game, 80);
    expect(game.numTilesWithFallout()).toBe(beforeFallout);
    expect(game.owner(water)).toBe(owner);
    expect(battery.isActive()).toBe(true);
  });

  test("land blast unowns enemy tiles and scorches them", () => {
    const center = game.ref(5, 10);
    player2.conquer(center);
    for (let x = 4; x <= 6; x++) {
      for (let y = 9; y <= 11; y++) {
        const tile = game.ref(x, y);
        if (game.isLand(tile)) {
          player2.conquer(tile);
        }
      }
    }
    expect(game.owner(center)).toBe(player2);
    applyInlandBatteryBlast(game, center, player1, null);
    expect(game.owner(center).isPlayer()).toBe(false);
    expect(game.hasFallout(center)).toBe(true);
  });

  test("does not scorch the shooter's land or delete their battery", () => {
    const gunTile = game.ref(5, 10);
    const near = game.ref(6, 10);
    player1.conquer(gunTile);
    player1.conquer(near);
    const battery = player1.buildUnit(UnitType.InlandBattery, gunTile, {});
    applyInlandBatteryBlast(game, gunTile, player1, battery);
    expect(battery.isActive()).toBe(true);
    expect(game.owner(gunTile)).toBe(player1);
    expect(game.hasFallout(gunTile)).toBe(false);
  });

  test("blast radius is a small patch, not a 10-tile crater", () => {
    expect(game.config().inlandBatteryBlastRadius()).toBe(4);
    const center = game.ref(2, 8);
    const far = game.ref(2, 2);
    player2.conquer(center);
    player2.conquer(far);
    applyInlandBatteryBlast(game, center, player1, null);
    expect(game.hasFallout(center)).toBe(true);
    expect(game.owner(far)).toBe(player2);
    expect(game.hasFallout(far)).toBe(false);
  });

  test("destroys an enemy city in the impact circle immediately", () => {
    const center = game.ref(5, 10);
    player2.conquer(center);
    for (let x = 4; x <= 6; x++) {
      for (let y = 9; y <= 11; y++) {
        const tile = game.ref(x, y);
        if (game.isLand(tile)) {
          player2.conquer(tile);
        }
      }
    }
    const city = player2.buildUnit(UnitType.City, center, {});
    expect(city.isActive()).toBe(true);
    applyInlandBatteryBlast(game, center, player1, null);
    expect(city.isActive()).toBe(false);
    expect(player2.units(UnitType.City)).toHaveLength(0);
  });

  test("destroys an enemy city on the rim of the impact circle", () => {
    const center = game.ref(5, 10);
    const rim = game.ref(5, 14);
    player2.conquer(center);
    player2.conquer(rim);
    const city = player2.buildUnit(UnitType.City, rim, {});
    applyInlandBatteryBlast(game, center, player1, null);
    expect(city.isActive()).toBe(false);
  });

  test("aims shells at enemy buildings so the blast can reach them", () => {
    const from = game.ref(1, 10);
    const cityTile = game.ref(6, 10);
    player1.conquer(from);
    for (let x = 2; x <= 8; x++) {
      const tile = game.ref(x, 10);
      if (game.isLand(tile)) {
        player2.conquer(tile);
      }
    }
    player2.buildUnit(UnitType.City, cityTile, {});
    const dests = pickInlandBatteryDests(
      game,
      from,
      player1,
      1,
      100,
      5,
      game.config().inlandBatterySpreadRadius(1),
    );
    expect(dests.length).toBeGreaterThan(0);
    const blast2 = game.config().inlandBatteryBlastRadius() ** 2;
    expect(
      dests.some((dest) => game.euclideanDistSquared(dest, cityTile) <= blast2),
    ).toBe(true);
  });

  test("fires a shell at nearby enemy land", () => {
    const gunTile = game.ref(1, 10);
    const enemyTile = game.ref(6, 10);
    player1.conquer(gunTile);
    player2.conquer(enemyTile);
    const battery = player1.buildUnit(UnitType.InlandBattery, gunTile, {});
    game.addExecution(new InlandBatteryExecution(battery));
    executeTicks(game, 40);
    const shells = player1.units(UnitType.Shell).filter((u) => u.isActive());
    const fallout = game.numTilesWithFallout();
    expect(shells.length + fallout).toBeGreaterThan(0);
    expect(battery.isActive()).toBe(true);
  });

  test("spread disk grows from 12 to 28 and scatters shells inside, not on a ring", () => {
    expect(game.config().inlandBatterySpreadRadius(1)).toBe(12);
    expect(game.config().inlandBatterySpreadRadius(10)).toBe(28);
    expect(game.config().inlandBatteryReloadTicks()).toBe(150);
    expect(inlandBatteryBuildingShots(1, 1)).toBe(1);
    expect(inlandBatteryBuildingShots(10, 3)).toBe(3);
    expect(inlandBatteryBuildingShots(10, 5)).toBe(5);
    expect(inlandBatteryBuildingShots(10, 0)).toBe(0);
    const aim = game.ref(6, 8);
    const dests = new Set<number>();
    const dist2: number[] = [];
    for (let i = 0; i < 10; i++) {
      const dest = inlandBatteryScatterDest(game, aim, i, 10, 28);
      dests.add(dest);
      dist2.push(game.euclideanDistSquared(aim, dest));
    }
    expect(dests.size).toBeGreaterThan(3);
    const minD = Math.min(...dist2);
    const maxD = Math.max(...dist2);
    expect(maxD).toBeGreaterThan(minD);
    expect(maxD).toBeLessThanOrEqual(28 * 28);
  });

  test("spreads building shots across every structure inside the disk", () => {
    const from = game.ref(1, 10);
    const aim = game.ref(7, 10);
    player1.conquer(from);
    const cityTiles = [
      game.ref(6, 10),
      game.ref(7, 10),
      game.ref(8, 10),
      game.ref(6, 9),
      game.ref(7, 9),
    ];
    for (const tile of cityTiles) {
      if (game.isLand(tile)) {
        player2.conquer(tile);
      }
    }
    for (const tile of cityTiles) {
      if (game.isLand(tile) && game.owner(tile) === player2) {
        player2.buildUnit(UnitType.City, tile, {});
      }
    }
    const dests = pickInlandBatteryDests(
      game,
      from,
      player1,
      10,
      100,
      5,
      12,
      aim,
    );
    const cities = player2.units(UnitType.City);
    expect(cities.length).toBeGreaterThan(1);
    const citySet = new Set(cities.map((c) => c.tile()));
    const hitCities = new Set(dests.filter((d) => citySet.has(d)));
    expect(hitCities.size).toBe(citySet.size);
    const buildingHits = dests.filter((d) => citySet.has(d)).length;
    expect(buildingHits).toBe(citySet.size);
  });

  test("starts on auto-fire and waits in manual until an aimed volley", () => {
    const gunTile = game.ref(1, 10);
    const enemyTile = game.ref(6, 10);
    player1.conquer(gunTile);
    player2.conquer(enemyTile);
    const battery = player1.buildUnit(UnitType.InlandBattery, gunTile, {});
    expect(battery.autoFire()).toBe(true);
    game.addExecution(new SetInlandBatteryAutoExecution(player1, battery.id(), false));
    executeTicks(game, 1);
    expect(battery.autoFire()).toBe(false);
    game.addExecution(new InlandBatteryExecution(battery));
    executeTicks(game, 40);
    expect(player1.units(UnitType.Shell).filter((u) => u.isActive())).toHaveLength(
      0,
    );
    expect(game.numTilesWithFallout()).toBe(0);
    game.addExecution(
      new FireInlandBatteryExecution(player1, battery.id(), enemyTile),
    );
    executeTicks(game, 40);
    const shells = player1.units(UnitType.Shell).filter((u) => u.isActive());
    expect(shells.length + game.numTilesWithFallout()).toBeGreaterThan(0);
  });

  test("aimed fire outside range does not start the reload", () => {
    const gunTile = game.ref(1, 10);
    player1.conquer(gunTile);
    const battery = player1.buildUnit(UnitType.InlandBattery, gunTile, {});
    battery.setAutoFire(false);
    const far = game.ref(1, 10);
    // Same tile as the gun — inside min-fire.
    game.addExecution(
      new FireInlandBatteryExecution(player1, battery.id(), far),
    );
    executeTicks(game, 2);
    expect(battery.lastVolleyTick()).toBe(0);
  });

  test("is destroyed when the tile is captured, not transferred", () => {
    const tile = game.ref(5, 10);
    player1.conquer(tile);
    const battery = player1.buildUnit(UnitType.InlandBattery, tile, {});
    game.addExecution(new PlayerExecution(player1));
    game.addExecution(new PlayerExecution(player2));
    player2.conquer(tile);
    executeTicks(game, 2);
    expect(battery.isActive()).toBe(false);
    expect(player2.units(UnitType.InlandBattery)).toHaveLength(0);
  });
});

describe("Nation inland batteries", () => {
  test("Easy nations wait for more cities before the first battery", async () => {
    const game = await setup(
      "big_plains",
      {
        instantBuild: true,
        difficulty: Difficulty.Easy,
        disabledUnits: [UnitType.Armory, UnitType.City],
      },
      [new PlayerInfo("nation", PlayerType.Nation, null, "nation_id")],
    );
    const nation = game.player("nation_id");
    for (let x = 10; x <= 50; x++) {
      for (let y = 10; y <= 50; y++) {
        nation.conquer(game.ref(x, y));
      }
    }
    nation.addGold(20_000_000n);

    const behavior = new NationStructureBehavior(
      new PseudoRandom(1),
      game,
      nation,
    );
    for (let i = 0; i < 16; i++) {
      behavior.handleStructures();
      executeTicks(game, 4);
    }
    expect(nation.units(UnitType.InlandBattery)).toHaveLength(0);
  });

  test("Medium nations cap inland batteries instead of spamming them", async () => {
    const game = await setup(
      "big_plains",
      {
        instantBuild: true,
        disabledUnits: [
          UnitType.Armory,
          UnitType.Port,
          UnitType.Starport,
          UnitType.Factory,
        ],
      },
      [new PlayerInfo("nation", PlayerType.Nation, null, "nation_id")],
    );
    const nation = game.player("nation_id");
    for (let x = 5; x <= 55; x++) {
      for (let y = 5; y <= 55; y++) {
        nation.conquer(game.ref(x, y));
      }
    }
    for (let i = 0; i < 12; i++) {
      nation.buildUnit(UnitType.City, game.ref(8 + i * 3, 8), {});
    }
    nation.addGold(80_000_000n);

    const behavior = new NationStructureBehavior(
      new PseudoRandom(1),
      game,
      nation,
    );
    for (let i = 0; i < 40; i++) {
      behavior.handleStructures();
      executeTicks(game, 4);
    }
    expect(nation.units(UnitType.InlandBattery).length).toBeGreaterThan(0);
    expect(nation.units(UnitType.InlandBattery).length).toBeLessThanOrEqual(3);
  });

  test("nations place an inland battery once they have a city and gold", async () => {
    const game = await setup(
      "big_plains",
      {
        instantBuild: true,
        disabledUnits: [UnitType.Armory],
      },
      [new PlayerInfo("nation", PlayerType.Nation, null, "nation_id")],
    );
    const nation = game.player("nation_id");
    for (let x = 10; x <= 50; x++) {
      for (let y = 10; y <= 50; y++) {
        nation.conquer(game.ref(x, y));
      }
    }
    nation.buildUnit(UnitType.City, game.ref(20, 20), {});
    nation.addGold(20_000_000n);

    const behavior = new NationStructureBehavior(
      new PseudoRandom(1),
      game,
      nation,
    );
    for (let i = 0; i < 16; i++) {
      behavior.handleStructures();
      executeTicks(game, 4);
      if (nation.units(UnitType.InlandBattery).length > 0) {
        break;
      }
    }
    expect(nation.units(UnitType.InlandBattery).length).toBeGreaterThan(0);
  });
});
