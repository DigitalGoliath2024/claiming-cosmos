import { html, TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { translateText } from "../client/Utils";
import { assetUrl } from "../core/AssetUrls";
import { BaseModal } from "./components/BaseModal";
import { modalHeader } from "./components/ui/ModalHeader";
import {
  armoryIcon,
  cityIcon,
  corsairIcon,
  lancerIcon,
  inlandBatteryIcon,
  marauderIcon,
  navalMineIcon,
  fleetBadge,
  portGunIcon,
  starportIcon,
  tenderIcon,
  vestalIcon,
  voidshipIcon,
  warshipIcon,
} from "./hud/HotbarIcons";

type GuideSection = {
  id: string;
  tabKey: string;
  titleKey: string;
  icon: string;
  bodyKeys: readonly string[];
};

const SECTIONS: readonly GuideSection[] = [
  {
    id: "navy",
    tabKey: "guide_modal.navy_tab",
    titleKey: "guide_modal.navy_title",
    icon: fleetBadge,
    bodyKeys: [
      "guide_modal.navy_what",
      "guide_modal.navy_do",
      "guide_modal.navy_buildings",
    ],
  },
  {
    id: "battleship",
    tabKey: "guide_modal.battleship_tab",
    titleKey: "guide_modal.battleship_title",
    icon: warshipIcon,
    bodyKeys: [
      "guide_modal.battleship_what",
      "guide_modal.battleship_rank",
      "guide_modal.battleship_fuse",
    ],
  },
  {
    id: "marauder",
    tabKey: "guide_modal.marauder_tab",
    titleKey: "guide_modal.marauder_title",
    icon: marauderIcon,
    bodyKeys: ["guide_modal.marauder_cheap"],
  },
  {
    id: "tender",
    tabKey: "guide_modal.tender_tab",
    titleKey: "guide_modal.tender_title",
    icon: tenderIcon,
    bodyKeys: [
      "guide_modal.tender_what",
      "guide_modal.tender_heal",
      "guide_modal.tender_wounded",
    ],
  },
  {
    id: "void",
    tabKey: "guide_modal.void_tab",
    titleKey: "guide_modal.void_title",
    icon: fleetBadge,
    bodyKeys: ["guide_modal.void_what", "guide_modal.void_do"],
  },
  {
    id: "voidship",
    tabKey: "guide_modal.voidship_tab",
    titleKey: "guide_modal.voidship_title",
    icon: voidshipIcon,
    bodyKeys: [
      "guide_modal.voidship_same",
      "guide_modal.battleship_rank",
      "guide_modal.battleship_fuse",
    ],
  },
  {
    id: "corsair",
    tabKey: "guide_modal.corsair_tab",
    titleKey: "guide_modal.corsair_title",
    icon: corsairIcon,
    bodyKeys: ["guide_modal.corsair_cheap"],
  },
  {
    id: "lancer",
    tabKey: "guide_modal.lancer_tab",
    titleKey: "guide_modal.lancer_title",
    icon: lancerIcon,
    bodyKeys: ["guide_modal.lancer_cheap", "guide_modal.lancer_beam"],
  },
  {
    id: "vestal",
    tabKey: "guide_modal.vestal_tab",
    titleKey: "guide_modal.vestal_title",
    icon: vestalIcon,
    bodyKeys: [
      "guide_modal.vestal_what",
      "guide_modal.vestal_heal",
      "guide_modal.vestal_wounded",
    ],
  },
  {
    id: "buildings",
    tabKey: "guide_modal.buildings_tab",
    titleKey: "guide_modal.buildings_title",
    icon: cityIcon,
    bodyKeys: [
      "guide_modal.buildings_smash",
      "guide_modal.buildings_ports",
    ],
  },
  {
    id: "starport",
    tabKey: "guide_modal.starport_tab",
    titleKey: "guide_modal.starport_title",
    icon: starportIcon,
    bodyKeys: [
      "guide_modal.starport_what",
      "guide_modal.starport_harbor",
    ],
  },
  {
    id: "port-guns",
    tabKey: "guide_modal.port_guns_tab",
    titleKey: "guide_modal.port_guns_title",
    icon: portGunIcon,
    bodyKeys: [
      "guide_modal.port_guns_what",
      "guide_modal.port_guns_l1",
      "guide_modal.port_guns_l4",
      "guide_modal.port_guns_l7",
      "guide_modal.port_guns_l10",
    ],
  },
  {
    id: "inland-battery",
    tabKey: "guide_modal.inland_battery_tab",
    titleKey: "guide_modal.inland_battery_title",
    icon: inlandBatteryIcon,
    bodyKeys: [
      "guide_modal.inland_battery_what",
      "guide_modal.inland_battery_aim",
      "guide_modal.inland_battery_capture",
    ],
  },
  {
    id: "armory",
    tabKey: "guide_modal.armory_tab",
    titleKey: "guide_modal.armory_title",
    icon: armoryIcon,
    bodyKeys: [
      "guide_modal.armory_what",
      "guide_modal.armory_l0",
      "guide_modal.armory_l1",
      "guide_modal.armory_l2",
      "guide_modal.armory_l3",
      "guide_modal.armory_l4",
    ],
  },
  {
    id: "mines",
    tabKey: "guide_modal.mines_tab",
    titleKey: "guide_modal.mines_title",
    icon: navalMineIcon,
    bodyKeys: ["guide_modal.mines_unlock", "guide_modal.mines_hidden"],
  },
  {
    id: "play",
    tabKey: "guide_modal.play_tab",
    titleKey: "guide_modal.play_title",
    icon: assetUrl("images/PlayIconWhite.svg"),
    bodyKeys: [
      "guide_modal.play_maps",
      "guide_modal.play_ranked",
    ],
  },
];

type GuideGroup = {
  id: string;
  labelKey: string;
  sectionIds: readonly string[];
};

const GROUPS: readonly GuideGroup[] = [
  {
    id: "planetary",
    labelKey: "guide_modal.group_planetary",
    sectionIds: ["navy", "battleship", "marauder", "tender"],
  },
  {
    id: "spacecraft",
    labelKey: "guide_modal.group_spacecraft",
    sectionIds: ["void", "voidship", "corsair", "lancer", "vestal"],
  },
  {
    id: "buildings",
    labelKey: "guide_modal.group_buildings",
    sectionIds: [
      "buildings",
      "starport",
      "port-guns",
      "inland-battery",
      "armory",
      "mines",
    ],
  },
  {
    id: "play",
    labelKey: "guide_modal.group_play",
    sectionIds: ["play"],
  },
];

@customElement("guide-modal")
export class GuideModal extends BaseModal {
  protected routerName = "guide";

  protected modalConfig() {
    return {
      hideTabs: true,
      tabs: GROUPS.flatMap((group) =>
        group.sectionIds.map((id) => {
          const section = SECTIONS.find((entry) => entry.id === id)!;
          return {
            key: section.id,
            label: translateText(section.tabKey),
          };
        }),
      ),
    };
  }

  protected renderHeaderSlot() {
    return modalHeader({
      titleContent: html`
        <span class="flex items-center gap-3 min-w-0">
          <img
            src=${fleetBadge}
            alt=""
            class="w-10 h-10 lg:w-12 lg:h-12 shrink-0 rounded-full object-cover"
            data-guide-fleet-badge
          />
          <span
            class="text-white text-xl lg:text-2xl font-bold uppercase tracking-widest font-map"
          >
            ${translateText("main.guide")}
          </span>
        </span>
      `,
      onBack: () => this.close(),
      ariaLabel: translateText("common.back"),
    });
  }

  private renderNav(activeId: string): TemplateResult {
    const byId = new Map(SECTIONS.map((section) => [section.id, section]));
    return html`
      <nav
        class="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto shrink-0 lg:w-56 pb-1 lg:pb-0"
        role="tablist"
        aria-label=${translateText("guide_modal.nav_label")}
        data-guide-nav
      >
        ${GROUPS.map((group) => {
          return html`
            <div
              class="flex lg:flex-col gap-1 shrink-0 min-w-max lg:min-w-0"
              data-guide-nav-group=${group.id}
            >
              <p
                class="px-3 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35"
              >
                ${translateText(group.labelKey)}
              </p>
              ${group.sectionIds.map((id) => {
                const section = byId.get(id);
                if (section === undefined) {
                  return html``;
                }
                const active = section.id === activeId;
                return html`
                  <button
                    type="button"
                    role="tab"
                    data-guide-nav-item=${section.id}
                    aria-selected=${active}
                    class="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm font-bold uppercase tracking-wider transition-all cursor-pointer ${active
                      ? "bg-malibu-blue/20 text-aquarius border border-malibu-blue/50"
                      : "text-white/50 border border-transparent hover:text-white/80 hover:bg-white/5"}"
                    @click=${() => this.setActiveTab(section.id)}
                  >
                    <img
                      src=${section.icon}
                      alt=""
                      aria-hidden="true"
                      class="w-5 h-5 shrink-0 object-contain rounded-full opacity-90"
                      data-guide-tab-icon
                    />
                    ${translateText(section.tabKey)}
                  </button>
                `;
              })}
            </div>
          `;
        })}
      </nav>
    `;
  }

  private renderCard(section: GuideSection): TemplateResult {
    return html`
      <article
        class="rounded-xl border border-white/10 bg-white/5 p-5 lg:p-6
          [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:space-y-2
          [&_li]:text-gray-300 [&_li]:leading-relaxed
          [&_strong]:text-white [&_strong]:font-bold"
        data-guide-section=${section.id}
      >
        <div class="flex items-center gap-3 mb-4">
          <h3
            class="flex items-center gap-2 font-map text-lg lg:text-xl font-bold uppercase tracking-widest text-malibu-blue"
          >
            <img
              src=${section.icon}
              alt=""
              aria-hidden="true"
              class="w-8 h-8 lg:w-9 lg:h-9 shrink-0 object-contain rounded-full"
              data-guide-title-icon
            />
            ${translateText(section.titleKey)}
          </h3>
          <div
            class="flex-1 h-px bg-gradient-to-r from-[rgba(231,165,40,0.45)] to-transparent"
          ></div>
        </div>
        <ul>
          ${section.bodyKeys.map((key) => html`<li>${translateText(key)}</li>`)}
        </ul>
      </article>
    `;
  }

  protected renderBody(tab: string) {
    const activeId = SECTIONS.some((section) => section.id === tab)
      ? tab
      : SECTIONS[0].id;
    const section =
      SECTIONS.find((entry) => entry.id === activeId) ?? SECTIONS[0];

    return html`
      <div
        class="flex flex-col lg:flex-row gap-4 px-4 lg:px-6 py-3 lg:py-4 min-h-0"
      >
        ${this.renderNav(activeId)}
        <div class="flex-1 min-w-0">${this.renderCard(section)}</div>
      </div>
    `;
  }
}
