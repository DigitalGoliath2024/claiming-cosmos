import { describe, expect, it } from "vitest";
import { SpawnExecution } from "../src/core/execution/SpawnExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../src/core/game/Game";
import { TileRef } from "../src/core/game/GameMap";
import { canBuildTransportShip } from "../src/core/game/TransportShipUtils";
import { createGame, L, W } from "./core/pathfinding/_fixtures";

function addPlayer(game: Game, tile: TileRef, id: string = "test"): Player {
  const info = new PlayerInfo(id, PlayerType.Human, null, `${id}_id`);
  game.addPlayer(info);
  game.addExecution(new SpawnExecution("game_id", info, tile));
  game.executeNextTick();
  game.executeNextTick();
  return game.player(info.id);
}

function buildLakeMap(): Game {
  const width = 26;
  const height = 18;
  const grid: string[] = new Array(width * height).fill(W);
  const set = (x: number, y: number, v: string) => (grid[y * width + x] = v);
  const inBox = (
    x: number,
    y: number,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
  ) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (inBox(x, y, 1, 5, 6, 11)) set(x, y, L);
      if (inBox(x, y, 10, 24, 1, 16)) set(x, y, L);
      if (inBox(x, y, 15, 20, 6, 11)) set(x, y, W);
    }
  }
  return createGame({ width, height, grid });
}

function ownIsland(
  player: Player,
  game: Game,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = game.ref(x, y);
      if (game.isLand(t)) player.conquer(t);
    }
  }
}

function markInlandLake(game: Game) {
  for (let y = 6; y <= 11; y++) {
    for (let x = 15; x <= 20; x++) {
      const t = game.ref(x, y);
      if (game.isWater(t)) game.clearOcean(t);
    }
  }
}

describe("Harbor vs Starport", () => {
  it("places Starport on void shore and Harbor on a lake shore", () => {
    const game = buildLakeMap();
    // Spawn cities would otherwise occupy the whole tiny island (min dist 15).
    game.config().structureMinDist = () => 1;
    markInlandLake(game);
    const attacker = addPlayer(game, game.ref(3, 8), "attacker");
    attacker.addGold(10_000_000n);
    ownIsland(attacker, game, 1, 5, 6, 11);
    const voidShore = attacker.canBuild(UnitType.Starport, game.ref(1, 8));
    expect(voidShore).not.toBe(false);
    expect(game.isShore(voidShore as TileRef)).toBe(true);

    expect(attacker.canBuild(UnitType.Port, game.ref(1, 8))).toBe(false);

    const target = addPlayer(game, game.ref(12, 8), "target");
    target.addGold(10_000_000n);
    ownIsland(target, game, 10, 24, 1, 16);
    const harbor = target.canBuild(UnitType.Port, game.ref(14, 8));
    expect(harbor).not.toBe(false);
    expect(target.canBuild(UnitType.Starport, game.ref(14, 8))).toBe(false);
  });

  it("requires a Starport before a lander can cross the void", () => {
    const game = buildLakeMap();
    game.config().structureMinDist = () => 1;
    const attacker = addPlayer(game, game.ref(3, 8), "attacker");
    attacker.addGold(10_000_000n);
    ownIsland(attacker, game, 1, 5, 6, 11);
    const clickNearLake = game.ref(14, 8);

    expect(canBuildTransportShip(game, attacker, clickNearLake, UnitType.Lander)).toBe(
      false,
    );

    const spawn = attacker.canBuild(UnitType.Starport, game.ref(1, 8));
    expect(spawn).not.toBe(false);
    attacker.buildUnit(UnitType.Starport, spawn as TileRef, {});

    const src = canBuildTransportShip(
      game,
      attacker,
      clickNearLake,
      UnitType.Lander,
    );
    expect(src).not.toBe(false);
    expect(game.isShore(src as TileRef)).toBe(true);
  });

  it("spawns a Voidship from a Starport into the void, not a lake", () => {
    const game = buildLakeMap();
    game.config().structureMinDist = () => 1;
    const attacker = addPlayer(game, game.ref(3, 8), "attacker");
    attacker.addGold(10_000_000n);
    ownIsland(attacker, game, 1, 5, 6, 11);
    const spawn = attacker.canBuild(UnitType.Starport, game.ref(1, 8));
    expect(spawn).not.toBe(false);
    attacker.buildUnit(UnitType.Starport, spawn as TileRef, {});

    const voidWater = game.ref(0, 8);
    expect(game.isOcean(voidWater)).toBe(true);
    const voidshipTile = attacker.canBuild(UnitType.Voidship, voidWater);
    expect(voidshipTile).not.toBe(false);

    expect(attacker.canBuild(UnitType.Warship, voidWater)).toBe(false);
  });

  it("spawns a Corsair and Vestal from a Starport, not a Harbor", () => {
    const game = buildLakeMap();
    game.config().structureMinDist = () => 1;
    const attacker = addPlayer(game, game.ref(3, 8), "attacker");
    attacker.addGold(10_000_000n);
    ownIsland(attacker, game, 1, 5, 6, 11);
    const spawn = attacker.canBuild(UnitType.Starport, game.ref(1, 8));
    expect(spawn).not.toBe(false);
    attacker.buildUnit(UnitType.Starport, spawn as TileRef, {});

    const voidWater = game.ref(0, 8);
    expect(attacker.canBuild(UnitType.Corsair, voidWater)).not.toBe(false);
    expect(attacker.canBuild(UnitType.Vestal, voidWater)).not.toBe(false);
    expect(attacker.canBuild(UnitType.Marauder, voidWater)).toBe(false);
    expect(attacker.canBuild(UnitType.Tender, voidWater)).toBe(false);
  });
});
