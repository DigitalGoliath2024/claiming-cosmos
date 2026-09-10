import version from "resources/version.txt?raw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AGPL_LICENSE_URL,
  ASSET_CREDITS_URL,
  FLYING_V_STUDIOS_URL,
  OPENFRONT_IO_URL,
  SOURCE_REPO_URL,
} from "../../../src/client/Attribution";
import { Footer } from "../../../src/client/components/Footer";

// version.txt is the shipped game version shown next to the GitHub icon.
const gameVersion = `v${version.trim().replace(/^v/, "")}`;

describe("page-footer version line", () => {
  let footer: Footer;

  beforeEach(() => {
    if (!customElements.get("page-footer")) {
      customElements.define("page-footer", Footer);
    }
  });

  afterEach(() => {
    footer?.remove();
    window.openfrontDesktop = undefined;
  });

  async function mount(): Promise<Footer> {
    footer = document.createElement("page-footer") as Footer;
    document.body.appendChild(footer);
    await footer.updateComplete;
    return footer;
  }

  it("renders the game version on the web, with no Steam subtext", async () => {
    window.openfrontDesktop = undefined;
    await mount();

    const line = footer.querySelector(".footer-version");
    expect(line?.textContent?.trim()).toBe(gameVersion);
    const github = footer.querySelector('a[href="' + SOURCE_REPO_URL + '"] img');
    expect(github).toBeTruthy();
    expect(github?.parentElement?.nextElementSibling).toBe(line);
    const bar = footer.querySelector("footer");
    expect(bar?.className).toContain("py-1");
    expect(bar?.className).not.toContain("py-2");
  });

  it("appends the shell version inside the desktop shell", async () => {
    window.openfrontDesktop = {
      version: () => Promise.resolve("0.2.0"),
    };
    await mount();

    await vi.waitFor(async () => {
      await footer.updateComplete;
      const line = footer.querySelector(".footer-version");
      expect(line?.textContent?.trim()).toBe(`${gameVersion} (Steam v0.2.0)`);
    });
  });

  // The bridge lives in a separate private repo, so the footer must degrade to
  // the game version alone rather than render a broken label.
  it("keeps OpenFront copyright and source, license, and credits links", async () => {
    await mount();

    expect(footer.querySelector('[data-i18n="main.copyright"]')).toBeTruthy();
    expect(
      footer.querySelector('[data-i18n="main.footer_product_prefix"]'),
    ).toBeTruthy();
    expect(
      footer.querySelector('[data-i18n="main.modification_notice"]'),
    ).toBeTruthy();
    expect(footer.querySelector('[data-i18n="main.openfront_site"]')).toBeTruthy();
    expect(footer.querySelector('[data-i18n="main.not_affiliated"]')).toBeTruthy();
    expect(footer.querySelector("[data-attribution]")?.className).toContain(
      "hidden",
    );
    expect(footer.querySelector("[data-attribution]")?.className).toContain(
      "lg:inline",
    );

    const hrefs = [...footer.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toContain(FLYING_V_STUDIOS_URL);
    expect(hrefs).toContain(OPENFRONT_IO_URL);
    expect(hrefs).toContain(SOURCE_REPO_URL);
    expect(hrefs).toContain(AGPL_LICENSE_URL);
    expect(hrefs).toContain(ASSET_CREDITS_URL);
  });

  it("falls back to the game version when the bridge rejects", async () => {
    window.openfrontDesktop = {
      version: () => Promise.reject(new Error("boom")),
    };
    await mount();

    await vi.waitFor(async () => {
      await footer.updateComplete;
      const line = footer.querySelector(".footer-version");
      expect(line?.textContent?.trim()).toBe(gameVersion);
    });
  });
});
