import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string) => key,
}));

import {
  BETA_WELCOME_STORAGE_KEY,
  BETA_WELCOME_VERSION,
  BetaWelcomeModal,
} from "../../src/client/components/BetaWelcomeModal";

describe("beta-welcome-modal", () => {
  let el: BetaWelcomeModal;

  beforeEach(async () => {
    localStorage.clear();
    if (!customElements.get("beta-welcome-modal")) {
      customElements.define("beta-welcome-modal", BetaWelcomeModal);
    }
    el = document.createElement("beta-welcome-modal") as BetaWelcomeModal;
    document.body.appendChild(el);
    await el.updateComplete;
  });

  afterEach(() => {
    el.remove();
  });

  async function shown(): Promise<boolean> {
    await el.updateComplete;
    return el.querySelector('[role="dialog"]') !== null;
  }

  it("shows on first visit", async () => {
    expect(await shown()).toBe(true);
  });

  it("stays hidden after it was dismissed", async () => {
    localStorage.setItem(BETA_WELCOME_STORAGE_KEY, BETA_WELCOME_VERSION);
    el.remove();
    el = document.createElement("beta-welcome-modal") as BetaWelcomeModal;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(await shown()).toBe(false);
  });

  it("dismiss records the welcome version and hides the dialog", async () => {
    expect(await shown()).toBe(true);
    const button = el.querySelector(
      'button[aria-label="beta_welcome.close"]',
    ) as HTMLButtonElement;
    button.click();
    await el.updateComplete;
    expect(await shown()).toBe(false);
    expect(localStorage.getItem(BETA_WELCOME_STORAGE_KEY)).toBe(
      BETA_WELCOME_VERSION,
    );
  });

  it("links Contact Form to the studio contact URL", async () => {
    const link = el.querySelector(
      'a[href="mailto:help@claimingcosmos.com"]',
    ) as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.textContent?.trim()).toBe("beta_welcome.contact_form");
  });
});
