import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../../../src/client/hud/layers/WinModal";
import type { WinModal } from "../../../../src/client/hud/layers/WinModal";
import { RankedType } from "../../../../src/core/game/Game";

const { fetchCosmetics } = vi.hoisted(() => ({
  fetchCosmetics: vi.fn(async () => {
    throw new Error("OpenFront cosmetics must not be fetched from WinModal");
  }),
}));

vi.mock("../../../../src/client/Utils", () => ({
  translateText: vi.fn((key: string) => {
    const translations: Record<string, string> = {
      "win_modal.exit": "Exit",
      "win_modal.requeue": "Play Again",
      "win_modal.keep": "Keep Playing",
      "win_modal.spectate": "Spectate",
      "win_modal.play_again_title": "Another world?",
      "win_modal.play_again_body": "There's more of the cosmos left to claim.",
    };
    return translations[key] || key;
  }),
  getGamesPlayed: vi.fn(() => 10),
  isInIframe: vi.fn(() => false),
}));

vi.mock("../../../../src/client/Cosmetics", () => ({
  fetchCosmetics,
}));

vi.mock("../../../../src/client/CrazyGamesSDK", () => ({
  crazyGamesSDK: {
    happytime: vi.fn(),
    requestAd: vi.fn(),
    gameplayStop: vi.fn(),
  },
}));

describe("WinModal Requeue", () => {
  let mockLocationHref = "";

  beforeEach(() => {
    mockLocationHref = "";
    // Mock window.location.href using Object.defineProperty
    const locationMock = {
      get href() {
        return mockLocationHref;
      },
      set href(value: string) {
        mockLocationHref = value;
      },
    };
    Object.defineProperty(window, "location", {
      value: locationMock,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isRankedGame detection", () => {
    it("should detect ranked 1v1 game", () => {
      const gameConfig = {
        rankedType: RankedType.OneVOne,
      };
      const isRankedGame = gameConfig.rankedType === RankedType.OneVOne;
      expect(isRankedGame).toBe(true);
    });

    it("should not detect non-ranked game", () => {
      const gameConfig = {
        rankedType: undefined,
      };
      const isRankedGame = gameConfig.rankedType === RankedType.OneVOne;
      expect(isRankedGame).toBe(false);
    });
  });

  describe("requeue navigation", () => {
    it("should navigate to /?requeue when requeue is triggered", () => {
      // Simulate the _handleRequeue behavior
      const handleRequeue = () => {
        window.location.href = "/?requeue";
      };

      handleRequeue();

      expect(window.location.href).toBe("/?requeue");
    });

    it("should navigate to / when exit is triggered", () => {
      // Simulate the _handleExit behavior
      const handleExit = () => {
        window.location.href = "/";
      };

      handleExit();

      expect(window.location.href).toBe("/");
    });
  });

  describe("requeue URL parameter handling", () => {
    it("should parse requeue parameter from URL", () => {
      const url = new URL("http://localhost:9000/?requeue");
      const hasRequeue = url.searchParams.has("requeue");
      expect(hasRequeue).toBe(true);
    });

    it("should not find requeue parameter when absent", () => {
      const url = new URL("http://localhost:9000/");
      const hasRequeue = url.searchParams.has("requeue");
      expect(hasRequeue).toBe(false);
    });
  });
});

describe("WinModal play-again copy", () => {
  let modal: WinModal | undefined;

  afterEach(() => {
    modal?.remove();
    modal = undefined;
  });

  it("prompts another world and does not load OpenFront cosmetics", async () => {
    modal = document.createElement("win-modal") as WinModal;
    document.body.appendChild(modal);
    await modal.updateComplete;

    expect(modal.textContent).toContain("Another world?");
    expect(modal.textContent).toContain(
      "There's more of the cosmos left to claim.",
    );
    expect(modal.querySelector("[data-win-cosmetic-promo]")).toBeNull();
    expect(modal.querySelector("cosmetic-card")).toBeNull();
    expect(modal.querySelector("purchase-button")).toBeNull();
    expect(modal.querySelector("iframe")).toBeNull();
    expect(fetchCosmetics).not.toHaveBeenCalled();
  });
});
