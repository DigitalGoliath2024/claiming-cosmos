import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const COPY: Record<string, string> = {
  "beta_welcome.title": "WELCOME, COMMANDER",
  "beta_welcome.close": "Close",
  "beta_welcome.lede": "The cosmos is open for conquest.",
  "beta_welcome.beta": "Claiming Cosmos is currently in Early Beta.",
  "beta_welcome.origin": "Built from OpenFront.io foundations.",
  "beta_welcome.cta_body": "Jump in and claim your territory.",
  "beta_welcome.bug_prefix": "If you run into a bug, use the ",
  "beta_welcome.contact_form": "Contact Form",
  "beta_welcome.bug_suffix": ".",
  "beta_welcome.closing": "Good luck, Commander.",
  "beta_welcome.enter": "Enter the Cosmos",
};

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string) => COPY[key] ?? key,
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

  it("shows on first visit once translations resolve", async () => {
    expect(await shown()).toBe(true);
    expect(el.querySelector("#beta-welcome-title")?.textContent?.trim()).toBe(
      "WELCOME, COMMANDER",
    );
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
      'button[aria-label="Close"]',
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
    expect(link.textContent?.trim()).toBe("Contact Form");
  });
});
