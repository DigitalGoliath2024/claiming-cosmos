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
import { UserSettings } from "../../../core/game/UserSettings";
import { Controller } from "../../Controller";
import { ToggleStructureEvent } from "../../InputHandler";
import { UIState } from "../../UIState";
import { renderNumber, translateText } from "../../Utils";
import { GameView } from "../../view";
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
  armoryIcon,
} from "../HotbarIcons";

@customElement("unit-display")
export class UnitDisplay extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  public uiState: UIState;
  private playerBuildables: BuildableUnit[] | null = null;
  private keybinds: Record<string, { value: string; key: string }> = {};
  private _cities = 0;
  private _warships = 0;
  private _voidships = 0;
  private _marauders = 0;
  private _corsairs = 0;
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
    const userSettings = new UserSettings();

    this.keybinds = userSettings.parsedUserKeybinds();

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

    return html`
      <div class="border-t border-white/10 p-0.5 w-full">
        <div class="grid grid-rows-1 grid-flow-col gap-0.5 w-fit mx-auto">
          ${this.renderUnitItem(
            cityIcon,
            this._cities,
            UnitType.City,
            "city",
            this.keybinds["buildCity"]?.key ?? "1",
          )}
          ${this.renderUnitItem(
            factoryIcon,
            this._factories,
            UnitType.Factory,
            "factory",
            this.keybinds["buildFactory"]?.key ?? "2",
          )}
          ${this.renderUnitItem(
            armoryIcon,
            this._armory,
            UnitType.Armory,
            "armory",
            this.keybinds["buildArmory"]?.key ?? "7",
          )}
          ${this.renderUnitItem(
            portIcon,
            this._port,
            UnitType.Port,
            "port",
            this.keybinds["buildPort"]?.key ?? "3",
          )}
          ${this.renderUnitItem(
            portIcon,
            this._starport,
            UnitType.Starport,
            "starport",
            "",
          )}
          ${this.renderUnitItem(
            defensePostIcon,
            this._defensePost,
            UnitType.DefensePost,
            "defense_post",
            this.keybinds["buildDefensePost"]?.key ?? "4",
          )}
          ${this.renderUnitItem(
            portGunIcon,
            this._portGun,
            UnitType.PortGun,
            "port_gun",
            this.keybinds["buildPortGun"]?.key ?? "5",
          )}
          ${this.renderUnitItem(
            inlandBatteryIcon,
            this._inlandBattery,
            UnitType.InlandBattery,
            "inland_battery",
            this.keybinds["buildInlandBattery"]?.key ?? "8",
          )}
          ${this.renderUnitItem(
            warshipIcon,
            this._warships,
            UnitType.Warship,
            "warship",
            this.keybinds["buildWarship"]?.key ?? "6",
          )}
          ${this.renderUnitItem(
            warshipIcon,
            this._voidships,
            UnitType.Voidship,
            "voidship",
            "",
          )}
          ${this.renderUnitItem(
            marauderIcon,
            this._marauders,
            UnitType.Marauder,
            "marauder",
            "",
          )}
          ${this.renderUnitItem(
            marauderIcon,
            this._corsairs,
            UnitType.Corsair,
            "corsair",
            "",
          )}
          ${this.renderUnitItem(
            tenderIcon,
            this._tenders,
            UnitType.Tender,
            "tender",
            "",
          )}
          ${this.renderUnitItem(
            tenderIcon,
            this._vestals,
            UnitType.Vestal,
            "vestal",
            "",
          )}
          ${navalMinesUnlocked(myPlayer)
            ? this.renderUnitItem(
                navalMineIcon,
                this._navalMines,
                UnitType.NavalMine,
                "naval_mine",
                "",
              )
            : ""}
        </div>
      </div>
    `;
  }

  private renderUnitItem(
    icon: string,
    number: number | null,
    unitType: PlayerBuildableUnitType,
    structureKey: string,
    hotkey: string,
  ) {
    if (this.game.config().isUnitDisabled(unitType)) {
      return html``;
    }
    const selected = this.uiState.ghostStructure === unitType;
    const hovered = this._hoveredUnit === unitType;
    const displayHotkey = hotkey
      .replace("Digit", "")
      .replace("Key", "")
      .toUpperCase();

    return html`
      <div
        class="flex flex-col items-center relative"
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
                class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-gray-200 text-center w-max text-xs bg-gray-800/90 backdrop-blur-xs rounded-sm p-1 z-[100] shadow-lg pointer-events-none"
              >
                <div class="font-bold text-sm mb-1">
                  ${translateText(
                    "unit_type." + structureKey,
                  )}${` [${displayHotkey}]`}
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
            : "opacity-40"} border border-slate-500 rounded-sm px-0.5 pb-0.5 flex items-center gap-0.5 cursor-pointer
             ${selected ? "hover:bg-gray-400/10" : "hover:bg-gray-800"}
             rounded-sm text-white ${selected ? "bg-slate-400/20" : ""}"
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
          ${html`<div class="ml-0.5 text-[10px] relative -top-1 text-gray-400">
            ${displayHotkey}
          </div>`}
          <div class="flex items-center gap-0.5 pt-0.5">
            <img src=${icon} alt=${structureKey} class="align-middle size-5" />
            ${number !== null
              ? html`<span class="text-xs">${renderNumber(number)}</span>`
              : null}
          </div>
        </div>
      </div>
    `;
  }
}
