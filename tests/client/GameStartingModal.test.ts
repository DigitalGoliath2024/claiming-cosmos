import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ASSET_CREDITS_URL,
  FLYING_V_STUDIOS_URL,
} from "../../src/client/Attribution";
import { GameStartingModal } from "../../src/client/GameStartingModal";

describe("game-starting-modal attribution", () => {
  let modal: GameStartingModal;

  beforeEach(() => {
    if (!customElements.get("game-starting-modal")) {
      customElements.define("game-starting-modal", GameStartingModal);
    }
  });

  afterEach(() => {
    modal?.remove();
  });

  async function mount(): Promise<GameStartingModal> {
    modal = document.createElement("game-starting-modal") as GameStartingModal;
    document.body.appendChild(modal);
    await modal.updateComplete;
    return modal;
  }

  it("keeps OpenFront copyright and adds Claiming Cosmos / Flying Vee notices", async () => {
    await mount();
    modal.show();
    await modal.updateComplete;

    expect(
      modal.querySelector("[data-starting-title]")?.textContent?.trim(),
    ).toBe("main.title");
    expect(
      modal.querySelector("[data-starting-copyright]")?.textContent?.trim(),
    ).toBe("main.copyright");
    expect(modal.textContent).toContain("main.independent_modified");
    expect(modal.textContent).toContain("main.modified_by_prefix");
    expect(modal.textContent).toContain("main.studio_name");
    expect(modal.textContent).toContain("main.not_affiliated");
    expect(
      modal.querySelector(`a[href="${FLYING_V_STUDIOS_URL}"]`),
    ).toBeTruthy();
    expect(modal.querySelector(`a[href="${ASSET_CREDITS_URL}"]`)).toBeTruthy();
  });
});
