import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAccountApi } from "../../src/client/accountApiFetch";
import { getNews, getUserMe, invalidateUserMe } from "../../src/client/Api";
import { setOpenFrontAccountApiEnabled } from "../../src/core/OpenFrontAccountApi";

describe("account API gating", () => {
  afterEach(() => {
    setOpenFrontAccountApiEnabled(true);
    vi.unstubAllGlobals();
  });

  it("does not call fetch when the kill switch is off", async () => {
    setOpenFrontAccountApiEnabled(false);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchAccountApi(
      "https://api.openfront.io/users/@me",
    );
    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("getUserMe returns false without fetching", async () => {
    setOpenFrontAccountApiEnabled(false);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    invalidateUserMe();

    expect(await getUserMe()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("getNews uses the bundled fallback without fetching", async () => {
    setOpenFrontAccountApiEnabled(false);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const news = await getNews();
    expect(Array.isArray(news)).toBe(true);
    expect(news.some((item) => item.id === "claiming-cosmos-0.1.0")).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("getNews stays on the local changelog even if the account API is enabled", async () => {
    setOpenFrontAccountApiEnabled(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const news = await getNews();
    expect(news[0]?.id).toBe("claiming-cosmos-0.1.0");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
