import { describe, expect, test } from "vitest";
import { NationEmojiBehavior } from "../src/core/execution/nation/NationEmojiBehavior";
import {
  NationWarshipBehavior,
  nationFleetPlan,
} from "../src/core/execution/nation/NationWarshipBehavior";
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

function markAllWaterAsLake(game: Game) {
  for (let y = 0; y < game.height(); y++) {
    for (let x = 0; x < game.width(); x++) {
      const tile = game.ref(x, y);
      if (game.isWater(tile)) game.clearOcean(tile);
    }
  }
}

function ownCoastAndBuild(
  game: Game,
  nation: Player,
  dock: UnitType.Port | UnitType.Starport,
) {
  for (let x = 0; x < 7; x++) {
    for (let y = 0; y < 8; y++) {
      const tile = game.ref(x, y);
      if (game.map().isLand(tile) && !game.map().hasOwner(tile)) {
        nation.conquer(tile);
      }
    }
  }
  nation.buildUnit(dock, game.ref(6, 4), {});
  nation.addGold(50_000_000n);
}

async function nationOnOcean(difficulty: Difficulty) {
  const game = await setup(
    "half_land_half_ocean",
    {
      infiniteGold: true,
      instantBuild: true,
      difficulty,
    },
    [new PlayerInfo("navy", PlayerType.Nation, null, "nation_id")],
  );
  const nation = game.player("nation_id");
  return { game, nation };
}

function behavior(game: Game, nation: Player) {
  return new NationWarshipBehavior(
    new PseudoRandom(1),
    game,
    nation,
    new NationEmojiBehavior(new PseudoRandom(2), game, nation),
  );
}

function spawnUntil(game: Game, navy: NationWarshipBehavior, ticks = 80) {
  for (let i = 0; i < ticks; i++) {
    navy.maybeSpawnWarship();
    navy.maybeSpawnTender();
    navy.maybeSpawnVestal();
    executeTicks(game, 2);
  }
}

describe("nationFleetPlan", () => {
  test("scales hull caps from Easy to Impossible", () => {
    const easy = nationFleetPlan(Difficulty.Easy);
    const medium = nationFleetPlan(Difficulty.Medium);
    const hard = nationFleetPlan(Difficulty.Hard);
    const impossible = nationFleetPlan(Difficulty.Impossible);

    expect(easy.maxWarships).toBe(1);
    expect(easy.maxMarauders).toBe(0);
    expect(easy.maxLancers).toBe(0);
    expect(easy.maxTenders).toBe(0);

    expect(medium.maxWarships).toBeGreaterThan(easy.maxWarships);
    expect(medium.maxMarauders).toBeGreaterThan(easy.maxMarauders);
    expect(medium.maxTenders).toBe(1);

    expect(hard.maxWarships).toBeGreaterThan(medium.maxWarships);
    expect(hard.maxLancers).toBeGreaterThan(0);
    expect(hard.extraCombatSpawns).toBe(1);

    expect(impossible.maxWarships).toBeGreaterThan(hard.maxWarships);
    expect(impossible.maxLancers).toBeGreaterThan(hard.maxLancers);
    expect(impossible.combatSpawnPercent).toBeGreaterThan(
      hard.combatSpawnPercent,
    );
  });
});

describe("NationWarshipBehavior hull mix", () => {
  test("Easy lake nations only field a single warship", async () => {
    const { game, nation } = await nationOnOcean(Difficulty.Easy);
    markAllWaterAsLake(game);
    ownCoastAndBuild(game, nation, UnitType.Port);

    spawnUntil(game, behavior(game, nation), 200);

    expect(nation.units(UnitType.Warship).length).toBe(1);
    expect(nation.units(UnitType.Marauder)).toHaveLength(0);
    expect(nation.units(UnitType.Tender)).toHaveLength(0);
  });

  test("Hard lake nations add marauders after a warship capital", async () => {
    const { game, nation } = await nationOnOcean(Difficulty.Hard);
    markAllWaterAsLake(game);
    ownCoastAndBuild(game, nation, UnitType.Port);

    spawnUntil(game, behavior(game, nation), 120);

    expect(nation.units(UnitType.Warship).length).toBeGreaterThanOrEqual(1);
    expect(nation.units(UnitType.Marauder).length).toBeGreaterThanOrEqual(1);
    expect(nation.units(UnitType.Warship).length).toBeLessThanOrEqual(4);
    expect(nation.units(UnitType.Marauder).length).toBeLessThanOrEqual(3);
  });

  test("Hard void nations mix voidships, corsairs, and lancers", async () => {
    const { game, nation } = await nationOnOcean(Difficulty.Hard);
    ownCoastAndBuild(game, nation, UnitType.Starport);

    spawnUntil(game, behavior(game, nation), 140);

    expect(nation.units(UnitType.Voidship).length).toBeGreaterThanOrEqual(2);
    expect(nation.units(UnitType.Corsair).length).toBeGreaterThanOrEqual(1);
    expect(nation.units(UnitType.Lancer).length).toBeGreaterThanOrEqual(1);
    expect(nation.units(UnitType.Voidship).length).toBeLessThanOrEqual(4);
    expect(nation.units(UnitType.Lancer).length).toBeLessThanOrEqual(2);
  });

  test("Easy nations do not spawn vestals", async () => {
    const { game, nation } = await nationOnOcean(Difficulty.Easy);
    ownCoastAndBuild(game, nation, UnitType.Starport);
    const navy = behavior(game, nation);
    spawnUntil(game, navy);
    expect(nation.units(UnitType.Vestal)).toHaveLength(0);
  });
});
