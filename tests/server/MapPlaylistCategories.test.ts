import { describe, expect, it, vi } from "vitest";
import { GameMapType, maps } from "../../src/core/game/Game";
import { SCHEDULED_PUBLIC_GAME_TYPES } from "../../src/core/Schemas";
import {
  buildPublicPlaylistMaps,
  isExcludedFromPublicPlaylist,
  MapPlaylist,
} from "../../src/server/MapPlaylist";

vi.mock("../../src/server/MapLandTiles", () => ({
  getMapLandTiles: async () => 1_000_000,
}));

const TOURNAMENT = maps.filter((m) => m.categories.includes("tournament"));
const COSMIC = maps.filter((m) => m.categories.includes("cosmic"));

describe("MapPlaylist public rotation", () => {
  it("excludes tournament maps and includes cosmic maps", () => {
    expect(TOURNAMENT.length).toBeGreaterThan(0);
    expect(COSMIC.length).toBeGreaterThan(0);
    for (const mapInfo of TOURNAMENT) {
      expect(isExcludedFromPublicPlaylist(mapInfo)).toBe(true);
    }
    for (const mapInfo of COSMIC) {
      expect(isExcludedFromPublicPlaylist(mapInfo)).toBe(false);
    }
    const world = maps.find((m) => m.type === GameMapType.World);
    expect(world).toBeDefined();
    expect(isExcludedFromPublicPlaylist(world!)).toBe(false);
  });

  it("omits tournament maps from FFA, team, and special weighted lists", () => {
    const excludedTypes = new Set(TOURNAMENT.map((m) => m.type));
    for (const type of SCHEDULED_PUBLIC_GAME_TYPES) {
      const playlist = buildPublicPlaylistMaps(type);
      expect(playlist.length).toBeGreaterThan(0);
      for (const map of playlist) {
        expect(excludedTypes.has(map)).toBe(false);
      }
      expect(playlist).toContain(GameMapType.World);
    }
  });

  it("puts Sol in special from its multiplayer frequency, not FFA or team", () => {
    expect(GameMapType.Sol).toBeDefined();
    const sol = maps.find((m) => m.type === GameMapType.Sol);
    expect(sol?.categories).toContain("cosmic");
    expect(sol?.ffaFrequency).toBe(0);
    expect(sol?.teamFrequency).toBe(0);
    expect(sol?.specialFrequency).toBe(-1);
    expect(sol!.multiplayerFrequency).toBeGreaterThan(0);
    expect(buildPublicPlaylistMaps("special")).toContain(GameMapType.Sol);
    expect(buildPublicPlaylistMaps("ffa")).not.toContain(GameMapType.Sol);
    expect(buildPublicPlaylistMaps("team")).not.toContain(GameMapType.Sol);
  });

  it("never schedules a tournament map on rolled public configs", async () => {
    const excludedTypes = new Set(TOURNAMENT.map((m) => m.type));
    const playlist = new MapPlaylist();
    for (const type of SCHEDULED_PUBLIC_GAME_TYPES) {
      for (let i = 0; i < 40; i++) {
        const config = await playlist.gameConfig(type);
        expect(excludedTypes.has(config.gameMap)).toBe(false);
      }
    }
  });
});
