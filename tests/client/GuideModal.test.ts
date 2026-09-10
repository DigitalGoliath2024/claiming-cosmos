import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../resources/lang/en.json";
import { GuideModal } from "../../src/client/GuideModal";

vi.mock("../../src/client/Utils", () => ({
  translateText: (key: string) => {
    const parts = key.split(".");
    let cur: unknown = en;
    for (const part of parts) {
      if (cur === null || typeof cur !== "object" || !(part in cur)) {
        return key;
      }
      cur = (cur as Record<string, unknown>)[part];
    }
    return typeof cur === "string" ? cur : key;
  },
}));

const SECTION_IDS = [
  "navy",
  "battleship",
  "marauder",
  "tender",
  "void",
  "voidship",
  "corsair",
  "lancer",
  "vestal",
  "buildings",
  "starport",
  "port-guns",
  "inland-battery",
  "armory",
  "mines",
  "play",
] as const;

const FORBIDDEN_MINE_COPY = /search|sweep|blast radius/i;

const TITLE_ICONS: Record<(typeof SECTION_IDS)[number], string> = {
  navy: "FleetBadge",
  battleship: "WarshipIconWhite",
  marauder: "MarauderIconWhite",
  tender: "TenderIconWhite",
  void: "FleetBadge",
  voidship: "VoidshipIconWhite",
  corsair: "CorsairIconWhite",
  lancer: "LancerIconWhite",
  vestal: "VestalIconWhite",
  "port-guns": "PortGunIconWhite",
  "inland-battery": "InlandBatteryIconWhite",
  armory: "ArmoryIconWhite",
  mines: "NavalMineIconWhite",
  buildings: "CityIconWhite",
  starport: "StarportIconWhite",
  play: "PlayIconWhite",
};

afterEach(() => document.body.replaceChildren());

async function mountGuide(): Promise<GuideModal> {
  if (!customElements.get("guide-modal")) {
    customElements.define("guide-modal", GuideModal);
  }
  const modal = document.createElement("guide-modal") as GuideModal;
  modal.setAttribute("inline", "");
  document.body.appendChild(modal);
  await modal.updateComplete;
  return modal;
}

describe("Guide modal", () => {
  it("uses the approved Guide title and a jumpable card per topic", async () => {
    expect(en.main.guide).toBe("Guide");

    const modal = await mountGuide();
    const text = modal.textContent ?? "";

    expect(text).toContain("Guide");
    expect(modal.querySelector("[data-guide-fleet-badge]")).toBeTruthy();
    expect(text).toContain("Planetary craft");
    expect(text).toContain("Spacecraft");
    expect(text).toContain("Warship");
    expect(text).toContain("Marauder");
    expect(text).toContain("Tender");
    expect(text).toContain("Voidship");
    expect(text).toContain("Corsair");
    expect(text).toContain("Vestal");
    expect(text).toContain("Anti-ship battery");
    expect(text).toContain("Planetary battery");
    expect(text).toContain("Armory");
    expect(text).toContain("Mines");
    expect(text).toContain("Buildings");
    expect(text).toContain("Harbor / Starport");
    expect(text).toContain("Play");

    const nav = modal.querySelector("[data-guide-nav]");
    expect(nav).toBeTruthy();
    expect(
      [...modal.querySelectorAll("[data-guide-nav-group]")].map((el) =>
        el.getAttribute("data-guide-nav-group"),
      ),
    ).toEqual(["planetary", "spacecraft", "buildings", "play"]);
    const navItems = [
      ...modal.querySelectorAll("[data-guide-nav-item]"),
    ].map((el) => el.getAttribute("data-guide-nav-item"));
    expect(navItems).toEqual([...SECTION_IDS]);

    expect(modal.querySelector('[data-guide-section="navy"]')).toBeTruthy();
    expect(text).toContain("cannot enter the void");
    expect(text).toContain("shell coastal buildings");
    expect(modal.querySelector('[data-guide-section="mines"]')).toBeNull();
  });

  it("switches to one card at a time from the section nav", async () => {
    const modal = await mountGuide();

    modal.setActiveTab("battleship");
    await modal.updateComplete;
    expect(modal.querySelector('[data-guide-section="battleship"]')).toBeTruthy();
    expect(modal.textContent).toContain("Gold stripes are rank");
    expect(modal.textContent).toContain("Rank 3 three");
    expect(modal.textContent).toContain("slow hull repair");
    expect(modal.textContent).toContain("85-tile");
    expect(modal.querySelector('[data-guide-section="navy"]')).toBeNull();

    const minesButton = modal.querySelector(
      '[data-guide-nav-item="mines"]',
    ) as HTMLButtonElement;
    minesButton.click();
    await modal.updateComplete;
    expect(modal.querySelector('[data-guide-section="mines"]')).toBeTruthy();
    expect(modal.querySelector('[data-guide-section="battleship"]')).toBeNull();
  });

  it("covers play-relevant facts on their cards", async () => {
    const modal = await mountGuide();

    modal.setActiveTab("marauder");
    await modal.updateComplete;
    expect(modal.textContent).toContain("Half a Warship");
    expect(modal.textContent).toContain("One shot");

    modal.setActiveTab("tender");
    await modal.updateComplete;
    expect(modal.textContent).toContain("Unarmed repair");
    expect(modal.textContent).toContain("$1,000,000");
    expect(modal.textContent).toContain("1,200");
    expect(modal.textContent).toContain("30-tile");
    expect(modal.textContent).toContain("15%");
    expect(modal.textContent).toContain("does not heal herself");

    modal.setActiveTab("void");
    await modal.updateComplete;
    expect(modal.textContent).toContain("Void hulls");
    expect(modal.textContent).toContain("cannot enter planet lakes");

    modal.setActiveTab("port-guns");
    await modal.updateComplete;
    expect(modal.textContent).toContain("Shore gun");
    expect(modal.textContent).toContain("Fires slower than a Warship");
    expect(modal.textContent).toContain("Level 1");
    expect(modal.textContent).toContain("1,000 HP");
    expect(modal.textContent).toContain("Level 4");
    expect(modal.textContent).toContain("Repairman");
    expect(modal.textContent).toContain("Level 7");
    expect(modal.textContent).toContain("three shells");
    expect(modal.textContent).toContain("Level 10");
    expect(modal.textContent).toContain("113");

    modal.setActiveTab("inland-battery");
    await modal.updateComplete;
    expect(modal.textContent).toContain("Land gun");
    expect(modal.textContent).toContain("$1,500,000");
    expect(modal.textContent).toContain("15 seconds");
    expect(modal.textContent).toContain("100 tiles");
    expect(modal.textContent).toContain("210");
    expect(modal.textContent).toContain("dud");
    expect(modal.textContent).toContain("80%");
    expect(modal.textContent).toContain("20%");
    expect(modal.textContent).toContain("Auto-fires");
    expect(modal.textContent).toContain("destroyed, not stolen");

    modal.setActiveTab("armory");
    await modal.updateComplete;
    expect(modal.textContent).toContain("stronger weapon age");
    expect(modal.textContent).toContain("Level 0 — Ballistic");
    expect(modal.textContent).toContain("Level 1 — Electromagnetic");
    expect(modal.textContent).toContain("Level 2 — Nuclear");
    expect(modal.textContent).toContain("Level 3 — Energy");
    expect(modal.textContent).toContain("Level 4 — Plasma");
    expect(modal.textContent).toContain("unlocks mines");

    modal.setActiveTab("buildings");
    await modal.updateComplete;
    expect(modal.textContent).toContain("target and destroy buildings");
    expect(modal.textContent).toContain(
      "anti-ship battery is the only building that heals",
    );
    expect(modal.textContent).toContain("do not regenerate");
    expect(modal.textContent).toContain("rebuild");

    modal.setActiveTab("play");
    await modal.updateComplete;
    expect(modal.textContent).toContain("You fight a whole system");
    expect(modal.textContent).toContain("Collision");
    expect(modal.textContent).toContain("coming soon");
    expect(modal.textContent).not.toContain("lobby cards");
    expect(modal.textContent).not.toContain("OpenFront account");
    expect(modal.textContent).not.toContain("store");
  });

  it("mines card explains unlock, place, cost, and hits without design-doc negatives", async () => {
    const modal = await mountGuide();
    modal.setActiveTab("mines");
    await modal.updateComplete;

    const card = modal.querySelector('[data-guide-section="mines"]');
    expect(card).toBeTruthy();
    const text = card?.textContent ?? "";

    expect(text).toContain("Armory 4");
    expect(text).toContain("$2,000,000");
    expect(text).toContain("void radial");
    expect(text).toContain("land menu");
    expect(text).toContain("$250k");
    expect(text).toContain("$500k");
    expect(text).toContain("3");
    expect(text).toContain("Enemies cannot see them");
    expect(text).toContain("hurt badly");
    expect(text).toContain("sink");
    expect(text).toContain("Trade ships ignore");
    expect(text).not.toMatch(FORBIDDEN_MINE_COPY);

    const mineCopy = Object.entries(en.guide_modal)
      .filter(([key]) => key.startsWith("mines_"))
      .map(([, value]) => value)
      .join("\n");
    expect(mineCopy).not.toMatch(FORBIDDEN_MINE_COPY);
  });

  it("puts the matching in-game icon before each title and uses bullets", async () => {
    const modal = await mountGuide();

    const tabIcons = [
      ...modal.querySelectorAll("[data-guide-nav-item] [data-guide-tab-icon]"),
    ] as HTMLImageElement[];
    expect(tabIcons.map((img) => img.getAttribute("src") ?? "")).toEqual(
      SECTION_IDS.map((id) => expect.stringContaining(TITLE_ICONS[id])),
    );

    for (const id of SECTION_IDS) {
      modal.setActiveTab(id);
      await modal.updateComplete;

      const card = modal.querySelector(`[data-guide-section="${id}"]`);
      expect(card).toBeTruthy();

      const icon = card?.querySelector(
        "[data-guide-title-icon]",
      ) as HTMLImageElement | null;
      expect(icon).toBeTruthy();
      expect(icon?.getAttribute("src") ?? "").toContain(TITLE_ICONS[id]);

      const items = card?.querySelectorAll("ul > li") ?? [];
      expect(items.length).toBeGreaterThan(0);
      expect(card?.querySelector("p")).toBeNull();
    }

    expect(modal.querySelector("[data-guide-nav]")).toBeTruthy();
  });
});
