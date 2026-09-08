import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const indexHtml = readFileSync(resolve("index.html"), "utf8");
const robots = readFileSync(resolve("resources/robots.txt"), "utf8");
const sitemap = readFileSync(resolve("resources/sitemap.xml"), "utf8");

describe("site SEO", () => {
  it("canonical and Open Graph point at maraudersea.com, not GitHub", () => {
    expect(indexHtml).toContain(
      '<link rel="canonical" href="https://maraudersea.com/" />',
    );
    expect(indexHtml).toContain(
      '<meta property="og:url" content="https://maraudersea.com/" />',
    );
    expect(indexHtml).not.toContain(
      "https://github.com/DigitalGoliath2024/Ancientfront",
    );
  });

  it("has a description, Twitter card, and VideoGame JSON-LD", () => {
    expect(indexHtml).toMatch(/<meta\s+name="description"/);
    expect(indexHtml).toContain('name="twitter:card"');
    expect(indexHtml).toContain('type="application/ld+json"');
    expect(indexHtml).toContain('"@type": "VideoGame"');
    expect(indexHtml).toContain("https://openfront.io/");
  });

  it("exposes crawlable homepage copy", () => {
    expect(indexHtml).toContain('id="about-claiming-cosmos"');
    expect(indexHtml).toContain("data-i18n=\"main.seo_blurb\"");
    expect(indexHtml).toContain('data-i18n="main.seo_read_more"');
    expect(indexHtml).toContain('id="home-about-more"');
  });

  it("lists the sitemap from robots.txt", () => {
    expect(robots).toContain("Sitemap: https://maraudersea.com/sitemap.xml");
    expect(sitemap).toContain("<loc>https://maraudersea.com/</loc>");
    expect(sitemap).toContain(
      "<loc>https://maraudersea.com/terms-of-service.html</loc>",
    );
    expect(sitemap).toContain(
      "<loc>https://maraudersea.com/privacy-policy.html</loc>",
    );
    expect(sitemap).toContain("<loc>https://maraudersea.com/wiki/</loc>");
    expect(sitemap).toContain(
      "<loc>https://maraudersea.com/wiki/maps/tarryn-fjords.html</loc>",
    );
    expect(sitemap).toContain(
      "<loc>https://maraudersea.com/wiki/maps/central-south-florida.html</loc>",
    );
    expect(sitemap).toContain(
      "<loc>https://maraudersea.com/wiki/maps/old-world-miami.html</loc>",
    );
    expect(sitemap).toContain(
      "<loc>https://maraudersea.com/wiki/maps/k-island.html</loc>",
    );
    expect(sitemap).toContain(
      "<loc>https://maraudersea.com/wiki/maps/crackamack-isles.html</loc>",
    );
    expect(sitemap).toContain(
      "<loc>https://maraudersea.com/wiki/buildings/inland-battery.html</loc>",
    );
    expect(sitemap).toContain(
      "<loc>https://maraudersea.com/wiki/buildings/trader-ship.html</loc>",
    );
  });

  it("serves an indexable wiki hub", () => {
    const wiki = readFileSync(resolve("resources/wiki/index.html"), "utf8");
    expect(wiki).toContain('<meta name="robots" content="index, follow" />');
    expect(wiki).toContain(
      '<link rel="canonical" href="https://maraudersea.com/wiki/" />',
    );
    expect(wiki).toContain("Marauder's Sea wiki");
    expect(indexHtml).toContain('href="/wiki/"');
  });
});
