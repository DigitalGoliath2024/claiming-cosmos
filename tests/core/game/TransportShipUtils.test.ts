import { describe, expect, it } from "vitest";
import { SpawnExecution } from "../../../src/core/execution/SpawnExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../../src/core/game/Game";
import { TileRef } from "../../../src/core/game/GameMap";
import { canBuildTransportShip } from "../../../src/core/game/TransportShipUtils";
import { createGame, L, W } from "../pathfinding/_fixtures";

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

describe("canBuildTransportShip", () => {
  it("allows a lander toward a reachable void shore once a Starport exists", () => {
    const game = buildLakeMap();
    game.config().structureMinDist = () => 1;
    const attacker = addPlayer(game, game.ref(3, 8), "attacker");
    attacker.addGold(10_000_000n);
    for (let y = 6; y <= 11; y++) {
      for (let x = 1; x <= 5; x++) {
        const t = game.ref(x, y);
        if (game.isLand(t)) attacker.conquer(t);
      }
    }
    const spawn = attacker.canBuild(UnitType.Starport, game.ref(1, 8));
    expect(spawn).not.toBe(false);
    attacker.buildUnit(UnitType.Starport, spawn as TileRef, {});

    const clickNearLake = game.ref(14, 8);
    const src = canBuildTransportShip(
      game,
      attacker,
      clickNearLake,
      UnitType.Lander,
    );

    expect(src).not.toBe(false);
    expect(game.isShore(src as TileRef)).toBe(true);
    expect((attacker as Player).smallID()).toBe(game.ownerID(src as TileRef));
  });
});
