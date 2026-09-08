import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import newsItems from "../../../resources/news.json";
import {
  getVisibleNewsItems,
  NewsBox,
  NewsItem,
} from "../../../src/client/components/NewsBox";

const getNews = vi.fn<() => Promise<NewsItem[]>>();
vi.mock("../../../src/client/Api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Api")>()),
  getNews: () => getNews(),
}));

const DISMISSED_NEWS_KEY = "dismissedNewsItems";
const allItems = newsItems as NewsItem[];

function createMockLocalStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

describe("NewsBox", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMockLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("getVisibleNewsItems", () => {
    it("returns all items when none are dismissed", () => {
      const items = getVisibleNewsItems(allItems);
      expect(items.length).toBe(newsItems.length);
    });

    it("filters out dismissed items", () => {
      const items = getVisibleNewsItems(allItems);
      const firstId = items[0].id;
      localStorage.setItem(DISMISSED_NEWS_KEY, JSON.stringify([firstId]));
      const filtered = getVisibleNewsItems(allItems);
      expect(filtered.find((i) => i.id === firstId)).toBeUndefined();
      expect(filtered.length).toBe(items.length - 1);
    });

    it("returns empty when all items are dismissed", () => {
      const allIds = allItems.map((i) => i.id);
      localStorage.setItem(DISMISSED_NEWS_KEY, JSON.stringify(allIds));
      const items = getVisibleNewsItems(allItems);
      expect(items.length).toBe(0);
    });
  });

  describe("news items structure", () => {
    it("each item has required fields", () => {
      const items = getVisibleNewsItems(allItems);
      for (const item of items) {
        expect(item.id).toBeDefined();
        expect(typeof item.id).toBe("string");
        expect(item.title).toBeDefined();
        expect(typeof item.title).toBe("string");
        const hasDescription =
          item.description !== undefined ||
          item.descriptionTranslationKey !== undefined;
        expect(hasDescription).toBe(true);
        expect(item.type).toBeDefined();
        expect(["tournament", "tutorial", "announcement", "warning"]).toContain(
          item.type,
        );
      }
    });

    it("each item has a unique id", () => {
      const items = getVisibleNewsItems(allItems);
      const ids = items.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("contains a warning entry", () => {
      const items = getVisibleNewsItems(allItems);
      expect(items.some((i) => i.type === "warning")).toBe(true);
    });

    it("starts with the Claiming Cosmos announcement", () => {
      expect(allItems[0]?.id).toBe("claiming-cosmos-placeholder");
      expect(allItems[0]?.type).toBe("announcement");
    });
  });

  describe("welcome line", () => {
    async function mountBox(): Promise<NewsBox> {
      const el = document.createElement("news-box") as NewsBox;
      document.body.appendChild(el);
      await el.updateComplete;
      await vi.waitFor(() => {
        expect(el.querySelector("[data-news-welcome]")).toBeTruthy();
      });
      return el;
    }

    beforeEach(() => {
      getNews.mockResolvedValue(allItems);
    });

    afterEach(() => {
      document.body.replaceChildren();
    });

    it("renders the gold welcome line above the local 0.1.4 announcement", async () => {
      const el = await mountBox();
      await vi.waitFor(() => {
        expect(el.textContent).toContain("Claiming Cosmos");
      });
      const welcome = el.querySelector("[data-news-welcome]");
      expect(welcome).toBeTruthy();
      expect(welcome?.className).toContain("text-gold");
      expect(welcome?.className).toContain("hidden");
      expect(welcome?.className).toContain("sm:block");
      expect(welcome?.textContent).toContain("news_box.welcome");
      expect(welcome?.querySelector(".text-ember")?.textContent).toContain(
        "news_box.welcome_strategy",
      );

      const announcement = el.querySelector("span.text-sm.font-medium");
      expect(announcement?.textContent).toContain("Claiming Cosmos");
      expect(el.textContent).toContain("news_box.claiming_cosmos");
      expect(el.querySelector(".line-clamp-1")).toBeTruthy();

      const box = welcome!.parentElement;
      expect(box?.firstElementChild).toBe(welcome);
      expect(
        welcome!.compareDocumentPosition(announcement!),
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it("keeps the welcome line when there are no news items", async () => {
      getNews.mockResolvedValue([]);
      const el = await mountBox();
      expect(el.querySelector("[data-news-welcome]")).toBeTruthy();
      expect(el.textContent).not.toContain("Firefox Performance Issues");
    });
  });
});
