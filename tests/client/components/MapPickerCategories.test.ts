import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/core/AssetUrls", () => ({
  assetUrl: (path: string) => path,
}));
vi.mock("../../../src/client/Utils", () => ({
  translateText: (key: string) => key,
}));

vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

import { MapPicker } from "../../../src/client/components/map/MapPicker";

describe("map-picker category chips", () => {
  let picker: MapPicker;

  async function mount() {
    if (!customElements.get("map-picker")) {
      customElements.define("map-picker", MapPicker);
    }
    picker = document.createElement("map-picker") as MapPicker;
    document.body.appendChild(picker);
    await picker.updateComplete;
  }

  afterEach(() => {
    picker?.remove();
  });

  it("shows Cosmic on the All tab and hides Tournament", async () => {
    await mount();

    const allTab = Array.from(picker.querySelectorAll('[role="tab"]')).find(
      (el) => el.textContent?.trim() === "map.all",
    ) as HTMLButtonElement;
    expect(allTab).toBeTruthy();
    allTab.click();
    await picker.updateComplete;

    const labels = Array.from(picker.querySelectorAll("button")).map((el) =>
      el.textContent?.replace(/\s+/g, " ").trim(),
    );

    expect(
      labels.some((label) => label?.includes("map_categories.cosmic")),
    ).toBe(true);
    expect(
      labels.some((label) => label?.includes("map_categories.tournament")),
    ).toBe(false);

    for (const category of [
      "new",
      "world",
      "continental",
      "fictional",
      "arcade",
    ]) {
      expect(
        labels.some((label) => label?.includes(`map_categories.${category}`)),
      ).toBe(true);
    }
  });
});
