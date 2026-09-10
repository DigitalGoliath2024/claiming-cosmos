import { html, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { EventBus } from "../../../core/EventBus";
import {
  BuildableUnit,
  BuildMenus,
  Gold,
  PlayerBuildableUnitType,
  UnitType,
} from "../../../core/game/Game";
import {
  NAVAL_MINE_MAX_ACTIVE,
  navalMinesUnlocked,
} from "../../../core/game/NavalMine";
import { Controller } from "../../Controller";
import { ToggleStructureEvent } from "../../InputHandler";
import { UIState } from "../../UIState";
import { renderNumber, translateText } from "../../Utils";
import { GameView } from "../../view";
import { HotbarTab, visibleHotbarSlots } from "../HotbarSlots";
import {
  cityIcon,
  defensePostIcon,
  factoryIcon,
  goldCoinIcon,
  portIcon,
  portGunIcon,
  inlandBatteryIcon,
  marauderIcon,
  tenderIcon,
  navalMineIcon,
  warshipIcon,
  voidshipIcon,
  corsairIcon,
  lancerIcon,
  vestalIcon,
  starportIcon,
  armoryIcon,
  fleetBadge,
} from "../HotbarIcons";

@customElement("unit-display")
export class UnitDisplay extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  public uiState: UIState;
  private playerBuildables: BuildableUnit[] | null = null;
  private _cities = 0;
  private _warships = 0;
  private _voidships = 0;
  private _marauders = 0;
  private _corsairs = 0;
  private _lancers = 0;
  private _tenders = 0;
  private _vestals = 0;
  private _navalMines = 0;
  private _factories = 0;
  private _armory = 0;
  private _port = 0;
  private _starport = 0;
  private _defensePost = 0;
  private _portGun = 0;
  private _inlandBattery = 0;
  private allDisabled = false;
  private _hoveredUnit: PlayerBuildableUnitType | null = null;

  createRenderRoot() {
    return this;
  }

  init() {
    const config = this.game.config();
    this.allDisabled = BuildMenus.types.every((u) => config.isUnitDisabled(u));
    this.requestUpdate();
  }

  private cost(item: UnitType): Gold {
    for (const bu of this.playerBuildables ?? []) {
      if (bu.type === item) {
        return bu.cost;
      }
    }
    return 0n;
  }

  private canBuild(item: UnitType): boolean {
    if (this.game?.config().isUnitDisabled(item)) return false;
    const player = this.game?.myPlayer();
    switch (item) {
      case UnitType.Warship:
      case UnitType.Marauder:
      case UnitType.Tender:
        return (
          this.cost(item) <= (player?.gold() ?? 0n) &&
          (player?.units(UnitType.Port).length ?? 0) > 0
        );
      case UnitType.Voidship:
      case UnitType.Corsair:
      case UnitType.Lancer:
      case UnitType.Vestal:
        return (
          this.cost(item) <= (player?.gold() ?? 0n) &&
          (player?.units(UnitType.Starport).length ?? 0) > 0
        );
      case UnitType.NavalMine:
        return (
          player !== undefined &&
          player !== null &&
          navalMinesUnlocked(player) &&
          this.cost(item) <= player.gold() &&
          player.units(UnitType.NavalMine).filter((u) => u.isActive()).length <
            NAVAL_MINE_MAX_ACTIVE
        );
      default:
        return this.cost(item) <= (player?.gold() ?? 0n);
    }
  }

  tick() {
    const player = this.game?.myPlayer();
    if (!player) return;
    player.buildables(undefined, BuildMenus.types).then((buildables) => {
      this.playerBuildables = buildables;
    });
    this._cities = player.totalUnitLevels(UnitType.City);
    this._port = player.totalUnitLevels(UnitType.Port);
    this._starport = player.totalUnitLevels(UnitType.Starport);
    this._defensePost = player.totalUnitLevels(UnitType.DefensePost);
    this._portGun = player.totalUnitLevels(UnitType.PortGun);
    this._inlandBattery = player.totalUnitLevels(UnitType.InlandBattery);
    this._factories = player.totalUnitLevels(UnitType.Factory);
    this._armory = player.totalUnitLevels(UnitType.Armory);
    this._warships = player.totalUnitLevels(UnitType.Warship);
    this._voidships = player.totalUnitLevels(UnitType.Voidship);
    this._marauders = player.totalUnitLevels(UnitType.Marauder);
    this._corsairs = player.totalUnitLevels(UnitType.Corsair);
    this._lancers = player.totalUnitLevels(UnitType.Lancer);
    this._tenders = player.totalUnitLevels(UnitType.Tender);
    this._vestals = player.totalUnitLevels(UnitType.Vestal);
    this._navalMines = player
      .units(UnitType.NavalMine)
      .filter((u) => u.isActive()).length;
    this.requestUpdate();
  }

  render() {
    const myPlayer = this.game?.myPlayer();
    if (
      !this.game ||
      !myPlayer ||
      this.game.inSpawnPhase() ||
      !myPlayer.isAlive()
    ) {
      return null;
    }
    if (this.allDisabled) {
      return null;
    }

    const tab = this.uiState.hotbarTab ?? "buildings";
    const slots = visibleHotbarSlots(
      tab,
      (unit) => this.game.config().isUnitDisabled(unit),
      navalMinesUnlocked(myPlayer),
    );

    return html`
      <div class="border-t border-white/10 px-2 py-1 w-full">
        <div
          class="flex flex-nowrap items-end justify-center gap-1.5 w-full max-w-6xl mx-auto"
        >
          ${this.renderTabToggle(tab)}
          <div
            class="flex flex-nowrap items-end gap-1.5 min-w-0 overflow-x-auto"
          >
            ${slots.map((unitType, index) =>
              this.renderSlot(unitType, index + 1),
            )}
          </div>
        </div>
      </div>
    `;
  }

  private setHotbarTab(tab: HotbarTab) {
    if (this.uiState.hotbarTab === tab) return;
    this.uiState.hotbarTab = tab;
    this.requestUpdate();
  }

  private renderTabToggle(tab: HotbarTab) {
    const tabButton = (id: HotbarTab, labelKey: string) => {
      const active = tab === id;
      return html`
        <button
          type="button"
          class="inline-flex items-center justify-center gap-1 px-1 py-0.5 rounded-sm text-[9px] leading-tight font-semibold tracking-wide uppercase ${active
            ? "bg-slate-400/30 text-white border border-white/35"
            : "bg-transparent text-gray-400 border border-slate-600 hover:text-gray-200 hover:border-slate-400"}"
          aria-pressed=${active}
          @click=${() => this.setHotbarTab(id)}
        >
          ${id === "ships"
            ? html`<img
                src=${fleetBadge}
                alt=""
                class="w-3.5 h-3.5 rounded-full object-cover shrink-0"
              />`
            : null}
          ${translateText(labelKey)}
        </button>
      `;
    };

    return html`
      <div
        class="flex flex-col justify-end gap-0.5 shrink-0 self-stretch pb-0.5"
      >
        ${tabButton("buildings", "unit_display.buildings")}
        ${tabButton("ships", "unit_display.ships")}
      </div>
    `;
  }

  private renderSlot(unitType: UnitType, slotNumber: number) {
    switch (unitType) {
      case UnitType.City:
        return this.renderUnitItem(
          cityIcon,
          this._cities,
          UnitType.City,
          "city",
          slotNumber,
        );
      case UnitType.Factory:
        return this.renderUnitItem(
          factoryIcon,
          this._factories,
          UnitType.Factory,
          "factory",
          slotNumber,
        );
      case UnitType.Armory:
        return this.renderUnitItem(
          armoryIcon,
          this._armory,
          UnitType.Armory,
          "armory",
          slotNumber,
        );
      case UnitType.Port:
        return this.renderUnitItem(
          portIcon,
          this._port,
          UnitType.Port,
          "port",
          slotNumber,
        );
      case UnitType.Starport:
        return this.renderUnitItem(
          starportIcon,
          this._starport,
          UnitType.Starport,
          "starport",
          slotNumber,
        );
      case UnitType.DefensePost:
        return this.renderUnitItem(
          defensePostIcon,
          this._defensePost,
          UnitType.DefensePost,
          "defense_post",
          slotNumber,
        );
      case UnitType.PortGun:
        return this.renderUnitItem(
          portGunIcon,
          this._portGun,
          UnitType.PortGun,
          "port_gun",
          slotNumber,
        );
      case UnitType.InlandBattery:
        return this.renderUnitItem(
          inlandBatteryIcon,
          this._inlandBattery,
          UnitType.InlandBattery,
          "inland_battery",
          slotNumber,
        );
      case UnitType.Warship:
        return this.renderUnitItem(
          warshipIcon,
          this._warships,
          UnitType.Warship,
          "warship",
          slotNumber,
        );
      case UnitType.Voidship:
        return this.renderUnitItem(
          voidshipIcon,
          this._voidships,
          UnitType.Voidship,
          "voidship",
          slotNumber,
        );
      case UnitType.Marauder:
        return this.renderUnitItem(
          marauderIcon,
          this._marauders,
          UnitType.Marauder,
          "marauder",
          slotNumber,
        );
      case UnitType.Corsair:
        return this.renderUnitItem(
          corsairIcon,
          this._corsairs,
          UnitType.Corsair,
          "corsair",
          slotNumber,
        );
      case UnitType.Lancer:
        return this.renderUnitItem(
          lancerIcon,
          this._lancers,
          UnitType.Lancer,
          "lancer",
          slotNumber,
        );
      case UnitType.Tender:
        return this.renderUnitItem(
          tenderIcon,
          this._tenders,
          UnitType.Tender,
          "tender",
          slotNumber,
        );
      case UnitType.Vestal:
        return this.renderUnitItem(
          vestalIcon,
          this._vestals,
          UnitType.Vestal,
          "vestal",
          slotNumber,
        );
      case UnitType.NavalMine:
        return this.renderUnitItem(
          navalMineIcon,
          this._navalMines,
          UnitType.NavalMine,
          "naval_mine",
          slotNumber,
        );
      default:
        return html``;
    }
  }

  private renderUnitItem(
    icon: string,
    number: number | null,
    unitType: PlayerBuildableUnitType,
    structureKey: string,
    slotNumber: number,
  ) {
    const selected = this.uiState.ghostStructure === unitType;
    const hovered = this._hoveredUnit === unitType;
    const displayHotkey = String(slotNumber);

    return html`
      <div
        class="flex flex-col items-center relative min-w-12"
        @mouseenter=${() => {
          this._hoveredUnit = unitType;
          this.requestUpdate();
        }}
        @mouseleave=${() => {
          this._hoveredUnit = null;
          this.requestUpdate();
        }}
      >
        ${hovered
          ? html`
              <div
                class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-gray-200 text-center w-max max-w-64 text-xs bg-gray-800/90 backdrop-blur-xs rounded-sm p-1 z-[100] shadow-lg pointer-events-none"
              >
                <div class="font-bold text-sm mb-1">
                  ${translateText("unit_type." + structureKey)}${displayHotkey
                    ? ` [${displayHotkey}]`
                    : ""}
                </div>
                <div class="p-2">
                  ${translateText("build_menu.desc." + structureKey)}
                </div>
                ${unitType === UnitType.Warship
                  ? html`<div
                      class="mt-1 px-2 py-1 text-[10px] text-cyan-300 border-t border-white/10"
                    >
                      ⇧ ${translateText("build_menu.warship_shift_hint")}
                    </div>`
                  : null}
                <div class="flex items-center justify-center gap-1">
                  <img src=${goldCoinIcon} width="13" height="13" />
                  <span class="text-yellow-300"
                    >${renderNumber(this.cost(unitType))}</span
                  >
                </div>
              </div>
            `
          : null}
        <div
          class="${this.canBuild(unitType)
            ? ""
            : "opacity-40"} border border-slate-500 rounded-sm px-1.5 py-1 flex flex-col items-center gap-0.5 cursor-pointer w-full
             ${selected ? "hover:bg-gray-400/10" : "hover:bg-gray-800"}
             text-white ${selected ? "bg-slate-400/20" : ""}"
          @click=${() => {
            if (selected) {
              this.uiState.ghostStructure = null;
            } else if (this.canBuild(unitType)) {
              this.uiState.ghostStructure = unitType;
            }
            this.requestUpdate();
          }}
          @mouseenter=${() => {
            switch (unitType) {
              case UnitType.Warship:
              case UnitType.Marauder:
              case UnitType.Tender:
                this.eventBus?.emit(new ToggleStructureEvent([UnitType.Port]));
                break;
              case UnitType.Voidship:
              case UnitType.Corsair:
              case UnitType.Lancer:
              case UnitType.Vestal:
                this.eventBus?.emit(
                  new ToggleStructureEvent([UnitType.Starport]),
                );
                break;
              default:
                this.eventBus?.emit(new ToggleStructureEvent([unitType]));
            }
          }}
          @mouseleave=${() =>
            this.eventBus?.emit(new ToggleStructureEvent(null))}
        >
          ${displayHotkey
            ? html`<div class="text-[11px] leading-none text-gray-300">
                ${displayHotkey}
              </div>`
            : html`<div class="h-[11px]"></div>`}
          <div class="flex items-center justify-center gap-1">
            <img src=${icon} alt=${structureKey} class="align-middle size-7" />
            ${number !== null
              ? html`<span class="text-sm tabular-nums"
                  >${renderNumber(number)}</span
                >`
              : null}
          </div>
        </div>
      </div>
    `;
  }
}
