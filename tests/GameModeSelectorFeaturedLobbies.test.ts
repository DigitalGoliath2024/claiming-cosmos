import { describe, expect, it } from "vitest";
import { selectFeaturedLobbies } from "../src/client/GameModeSelector";
import { GameMapType, GameMode } from "../src/core/game/Game";
import type {
  GameConfig,
  PublicGameInfo,
  PublicGames,
} from "../src/core/Schemas";

function lobby(
  gameID: string,
  type: PublicGameInfo["publicGameType"],
  startsAt?: number,
  gameMap: GameMapType = GameMapType.Sol,
): PublicGameInfo {
  return {
    gameID,
    numClients: 3,
    publicGameType: type,
    startsAt,
    gameConfig: {
      gameMap,
      gameMode: type === "team" ? GameMode.Team : GameMode.FFA,
      maxPlayers: 8,
    } as unknown as GameConfig,
  };
}

function ids(picks: ReturnType<typeof selectFeaturedLobbies>): string[] {
  return picks.map((p) => p.lobby.gameID);
}

function flags(picks: ReturnType<typeof selectFeaturedLobbies>): boolean[] {
  return picks.map((p) => p.upNext);
}

describe("selectFeaturedLobbies", () => {
  it("returns nothing when there is no public list", () => {
    expect(selectFeaturedLobbies(undefined)).toEqual([]);
    expect(selectFeaturedLobbies(null)).toEqual([]);
    expect(selectFeaturedLobbies({})).toEqual([]);
  });

  it("takes the live lobby per scheduled type, soonest startsAt first, then three queued", () => {
    const games: PublicGames["games"] = {
      ffa: [
        lobby("ffa-live", "ffa", 3000),
        lobby("ffa-next", "ffa"),
        lobby("ffa-later", "ffa"),
      ],
      team: [lobby("team-live", "team", 1000), lobby("team-next", "team")],
      special: [
        lobby("special-live", "special", 2000),
        lobby("special-next", "special"),
      ],
    };

    const picks = selectFeaturedLobbies(games);
    expect(ids(picks)).toEqual([
      "team-live",
      "special-live",
      "ffa-live",
      "ffa-next",
      "team-next",
      "special-next",
    ]);
    expect(flags(picks)).toEqual([false, false, false, true, true, true]);
  });

  it("interleaves up-next by type instead of dumping one queue", () => {
    const games: PublicGames["games"] = {
      ffa: [
        lobby("ffa-0", "ffa", 1),
        lobby("ffa-1", "ffa"),
        lobby("ffa-2", "ffa"),
        lobby("ffa-3", "ffa"),
      ],
      team: [lobby("team-0", "team", 2), lobby("team-1", "team")],
      special: [
        lobby("special-0", "special", 3),
        lobby("special-1", "special"),
      ],
    };

    expect(ids(selectFeaturedLobbies(games)).slice(3)).toEqual([
      "ffa-1",
      "team-1",
      "special-1",
    ]);
  });

  it("ignores hosted listings", () => {
    const games: PublicGames["games"] = {
      ffa: [lobby("ffa-0", "ffa", 1), lobby("ffa-1", "ffa")],
      hosted: [lobby("hosted-0", "hosted")],
    };

    expect(ids(selectFeaturedLobbies(games))).toEqual(["ffa-0", "ffa-1"]);
    expect(
      selectFeaturedLobbies(games).every(
        (p) => p.lobby.publicGameType !== "hosted",
      ),
    ).toBe(true);
  });

  it("treats the front of a type as filling when no startsAt has landed yet", () => {
    const games: PublicGames["games"] = {
      ffa: [lobby("ffa-0", "ffa"), lobby("ffa-1", "ffa")],
      team: [lobby("team-0", "team")],
    };

    const picks = selectFeaturedLobbies(games);
    expect(ids(picks)).toEqual(["ffa-0", "team-0", "ffa-1"]);
    expect(flags(picks)).toEqual([false, false, true]);
  });

  it("does not duplicate a lobby across filling and up-next", () => {
    const games: PublicGames["games"] = {
      ffa: [lobby("only-ffa", "ffa", 1)],
      team: [lobby("only-team", "team", 2)],
      special: [lobby("only-special", "special", 3)],
    };
    const picks = selectFeaturedLobbies(games);
    expect(ids(picks)).toEqual(["only-ffa", "only-team", "only-special"]);
    expect(new Set(ids(picks)).size).toBe(picks.length);
    expect(picks.every((p) => !p.upNext)).toBe(true);
  });

  it("caps each row at three even when every type has a long queue", () => {
    const games: PublicGames["games"] = {
      ffa: Array.from({ length: 6 }, (_, i) =>
        lobby(`ffa-${i}`, "ffa", i === 0 ? 1 : undefined),
      ),
      team: Array.from({ length: 6 }, (_, i) =>
        lobby(`team-${i}`, "team", i === 0 ? 2 : undefined),
      ),
      special: Array.from({ length: 6 }, (_, i) =>
        lobby(`special-${i}`, "special", i === 0 ? 3 : undefined),
      ),
    };

    const picks = selectFeaturedLobbies(games);
    expect(picks).toHaveLength(6);
    expect(picks.filter((p) => !p.upNext)).toHaveLength(3);
    expect(picks.filter((p) => p.upNext)).toHaveLength(3);
  });

  it("skips earth maps and promotes the next space map in that queue", () => {
    const games: PublicGames["games"] = {
      ffa: [
        lobby("world-live", "ffa", 1, GameMapType.World),
        lobby("sol-live", "ffa", 2, GameMapType.Sol),
        lobby("mena-next", "ffa", undefined, GameMapType.Mena),
        lobby("mars-next", "ffa", undefined, GameMapType.Mars),
      ],
      team: [lobby("sf-live", "team", 3, GameMapType.SanFrancisco)],
      special: [
        lobby("pluto-live", "special", 4, GameMapType.Pluto),
        lobby("box-next", "special", undefined, GameMapType.TheBox),
      ],
    };

    const picks = selectFeaturedLobbies(games);
    expect(ids(picks)).toEqual(["sol-live", "pluto-live", "mars-next"]);
    expect(
      picks.every((p) =>
        [GameMapType.Sol, GameMapType.Mars, GameMapType.Pluto].includes(
          p.lobby.gameConfig!.gameMap,
        ),
      ),
    ).toBe(true);
  });
});
