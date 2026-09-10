import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAYABLE_MAP,
  GameMapType,
  isPlayableMapType,
  playableMapTypes,
  playableMaps,
} from "../../../src/core/game/Game";

describe("playable maps", () => {
  it("only includes cosmic maps", () => {
    const types = playableMapTypes();
    expect(types.length).toBeGreaterThan(0);
    expect(types).toContain(GameMapType.Sol);
    expect(types).toContain(GameMapType.Shatterwake);
    expect(types).toContain(GameMapType.VernersSystem);
    expect(types).toContain(GameMapType.CometsPass);
    expect(types).toContain(GameMapType.Collision);
    expect(types).toContain(GameMapType.HollowWorld);
    expect(types).toContain(GameMapType.SolSystem);
    expect(types).toContain(GameMapType.Shattered);
    expect(types).toContain(GameMapType.FourForWar);
    expect(types).toContain(GameMapType.EventHorizon);
    expect(types).toContain(GameMapType.OneBigWorld);
    expect(types).not.toContain(GameMapType.World);
    expect(types).not.toContain(GameMapType.Europe);
    expect(types).not.toContain(GameMapType.CrackamackIsles);
    for (const map of playableMaps()) {
      expect(map.categories).toContain("cosmic");
    }
  });

  it("defaults new games to Sol", () => {
    expect(DEFAULT_PLAYABLE_MAP).toBe(GameMapType.Sol);
    expect(isPlayableMapType(GameMapType.Sol)).toBe(true);
    expect(isPlayableMapType(GameMapType.World)).toBe(false);
  });
});
