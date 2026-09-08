import { assetUrl } from "../../../core/AssetUrls";
import { Config } from "../../../core/configuration/Config";
import {
  AllPlayers,
  BuildableAttacks,
  BuildMenus,
  bulkCost,
  CombatShips,
  maxBulkAmount,
  PlayerActions,
  PlayerBuildableUnitType,
  STRUCTURE_BULK_STEPS,
  Structures,
  UnitType,
} from "../../../core/game/Game";
import { TileRef } from "../../../core/game/GameMap";
import { Emoji, findClosestBy, flattenedEmojiTable } from "../../../core/Util";
import { UIState } from "../../UIState";
import { renderNumber, translateText } from "../../Utils";
import { GameView, PlayerView } from "../../view";
import { BuildItemDisplay, BuildMenu, flattenedBuildTable } from "./BuildMenu";
import { ChatIntegration } from "./ChatIntegration";
import { EmojiTable } from "./EmojiTable";
import { PlayerActionHandler } from "./PlayerActionHandler";
import { PlayerPanel } from "./PlayerPanel";
import { TooltipItem } from "./RadialMenu";

import {
  NAVAL_MINE_MAX_ACTIVE,
  navalMinesUnlocked,
} from "../../../core/game/NavalMine";
import { EventBus } from "../../../core/EventBus";
import {
  BuildUnitIntentEvent,
  SendUpgradeStructureIntentEvent,
} from "../../Transport";
const inlandBatteryIcon = assetUrl("images/InlandBatteryIconWhite.png");
const allianceIcon = assetUrl("images/AllianceIconWhite.svg");
const boatIcon = assetUrl("images/BoatIconWhite.svg");
const buildIcon = assetUrl("images/BuildIconWhite.svg");
const chatIcon = assetUrl("images/ChatIconWhite.svg");
const donateGoldIcon = assetUrl("images/DonateGoldIconWhite.svg");
const donateTroopIcon = assetUrl("images/DonateTroopIconWhite.svg");
const emojiIcon = assetUrl("images/EmojiIconWhite.svg");
const infoIcon = assetUrl("images/InfoIcon.svg");
const swordIcon = assetUrl("images/SwordIconWhite.svg");
const targetIcon = assetUrl("images/TargetIconWhite.svg");
const traitorIcon = assetUrl("images/TraitorIconWhite.svg");
const xIcon = assetUrl("images/XIcon.svg");

export interface MenuElementParams {
  myPlayer: PlayerView;
  selected: PlayerView | null;
  tile: TileRef;
  playerActions: PlayerActions;
  game: GameView;
  buildMenu: BuildMenu;
  emojiTable: EmojiTable;
  playerActionHandler: PlayerActionHandler;
  playerPanel: PlayerPanel;
  chatIntegration: ChatIntegration;
  eventBus: EventBus;
  uiState?: UIState;
  closeMenu: () => void;
}

export interface MenuElement {
  id: string;
  name: string;
  displayed?: boolean | ((params: MenuElementParams) => boolean);
  color?: string | ((params: MenuElementParams) => string);
  icon?: string;
  text?: string;
  fontSize?: string;
  tooltipItems?: TooltipItem[];
  tooltipKeys?: TooltipKey[];

  cooldown?: (params: MenuElementParams) => number;
  disabled: (params: MenuElementParams) => boolean;
  action?: (params: MenuElementParams) => void; // For leaf items that perform actions
  subMenu?: (params: MenuElementParams) => MenuElement[]; // For non-leaf items that open submenus

  renderType?: string;

  timerFraction?: (params: MenuElementParams) => number; // 0..1, for arc timer overlay
}

export interface TooltipKey {
  key: string;
  className: string;
  params?: Record<string, string | number>;
}

export interface CenterButtonElement {
  disabled: (params: MenuElementParams) => boolean;
  action: (params: MenuElementParams) => void;
}

export const COLORS = {
  build: "#e6c74a",
  building: "#1e3a5f",
  boat: "#2a82c9",
  disabled: "#94a3b8",
  ally: "#4ade80",
  breakAlly: "#dc2626",
  breakAllyNoDebuff: "#d97706",
  delete: "#ef4444",
  info: "#475569",
  target: "#ef4444",
  attack: "#ef4444",
  infoDetails: "#7f8c8d",
  infoEmoji: "#fbbf24",
  trade: "#0891b2",
  embargo: "#7c3aed",
  tooltip: {
    cost: "#f59e0b",
    count: "#94a3b8",
  },
  chat: {
    default: "#6366f1",
    help: "#22c55e",
    attack: "#ef4444",
    defend: "#3b82f6",
    greet: "#f97316",
    misc: "#a855f7",
    warnings: "#fbbf24",
  },
};

export enum Slot {
  Info = "info",
  Boat = "boat",
  Build = "build",
  Attack = "attack",
  Ally = "ally",
  Back = "back",
  Delete = "delete",
}

function isFriendlyTarget(params: MenuElementParams): boolean {
  const selectedPlayer = params.selected;
  if (selectedPlayer === null) return false;
  const isFriendly = (selectedPlayer as PlayerView).isFriendly;
  if (typeof isFriendly !== "function") return false;
  return isFriendly.call(selectedPlayer, params.myPlayer);
}

function isDisconnectedTarget(params: MenuElementParams): boolean {
  const selectedPlayer = params.selected;
  if (selectedPlayer === null) return false;
  const isDisconnected = (selectedPlayer as PlayerView).isDisconnected;
  if (typeof isDisconnected !== "function") return false;
  return isDisconnected.call(selectedPlayer);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const infoChatElement: MenuElement = {
  id: "info_chat",
  name: "chat",
  disabled: () => false,
  color: COLORS.chat.default,
  icon: chatIcon,
  subMenu: (params: MenuElementParams) =>
    params.chatIntegration
      .createQuickChatMenu(params.selected!)
      .map((item) => ({
        ...item,
        action: item.action
          ? (_params: MenuElementParams) => item.action!(params)
          : undefined,
      })),
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const allyTargetElement: MenuElement = {
  id: "ally_target",
  name: "target",
  disabled: (params: MenuElementParams): boolean => {
    if (params.selected === null) return true;
    return !params.playerActions.interaction?.canTarget;
  },
  color: COLORS.target,
  icon: targetIcon,
  action: (params: MenuElementParams) => {
    params.playerActionHandler.handleTargetPlayer(params.selected!.id());
    params.closeMenu();
  },
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const allyTradeElement: MenuElement = {
  id: "ally_trade",
  name: "trade",
  disabled: (params: MenuElementParams) =>
    !!params.playerActions?.interaction?.canEmbargo,
  displayed: (params: MenuElementParams) =>
    !params.playerActions?.interaction?.canEmbargo,
  color: COLORS.trade,
  text: translateText("player_panel.start_trade"),
  action: (params: MenuElementParams) => {
    params.playerActionHandler.handleEmbargo(params.selected!, "stop");
    params.closeMenu();
  },
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const allyEmbargoElement: MenuElement = {
  id: "ally_embargo",
  name: "embargo",
  disabled: (params: MenuElementParams) =>
    !params.playerActions?.interaction?.canEmbargo,
  displayed: (params: MenuElementParams) =>
    !!params.playerActions?.interaction?.canEmbargo,
  color: COLORS.embargo,
  text: translateText("player_panel.stop_trade"),
  action: (params: MenuElementParams) => {
    params.playerActionHandler.handleEmbargo(params.selected!, "start");
    params.closeMenu();
  },
};

const allyRequestElement: MenuElement = {
  id: "ally_request",
  name: "request",
  disabled: (params: MenuElementParams) =>
    !params.playerActions?.interaction?.canSendAllianceRequest,
  displayed: (params: MenuElementParams) =>
    !params.playerActions?.interaction?.canBreakAlliance,
  color: COLORS.ally,
  icon: allianceIcon,
  action: (params: MenuElementParams) => {
    params.playerActionHandler.handleAllianceRequest(
      params.myPlayer,
      params.selected!,
    );
    params.closeMenu();
  },
};

const allyExtendElement: MenuElement = {
  id: "ally_extend",
  name: "extend",
  displayed: (params: MenuElementParams) =>
    !!params.playerActions?.interaction?.allianceInfo?.inExtensionWindow,
  disabled: (params: MenuElementParams) =>
    !params.playerActions?.interaction?.allianceInfo?.canExtend,
  color: COLORS.ally,
  icon: allianceIcon,
  action: (params: MenuElementParams) => {
    if (!params.playerActions?.interaction?.allianceInfo?.canExtend) return;
    params.playerActionHandler.handleExtendAlliance(params.selected!);
    params.closeMenu();
  },
  timerFraction: (params: MenuElementParams): number => {
    const interaction = params.playerActions?.interaction;
    if (!interaction?.allianceInfo) return 1;
    const remaining = Math.max(
      0,
      interaction.allianceInfo.expiresAt - params.game.ticks(),
    );
    const extensionWindow = Math.max(
      1,
      params.game.config().allianceExtensionPromptOffset(),
    );
    return Math.max(0, Math.min(1, remaining / extensionWindow));
  },
  renderType: "allyExtend",
};

const allyBreakElement: MenuElement = {
  id: "ally_break",
  name: "break",
  disabled: (params: MenuElementParams) =>
    !params.playerActions?.interaction?.canBreakAlliance,
  displayed: (params: MenuElementParams) =>
    !!params.playerActions?.interaction?.canBreakAlliance,
  color: (params: MenuElementParams) =>
    params.selected?.isTraitor() || params.selected?.isDisconnected()
      ? COLORS.breakAllyNoDebuff
      : COLORS.breakAlly,
  icon: traitorIcon,
  action: (params: MenuElementParams) => {
    params.playerActionHandler.handleBreakAlliance(
      params.myPlayer,
      params.selected!,
    );
    params.closeMenu();
  },
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const allyDonateGoldElement: MenuElement = {
  id: "ally_donate_gold",
  name: "donate gold",
  disabled: (params: MenuElementParams) =>
    !params.playerActions?.interaction?.canDonateGold,
  color: COLORS.ally,
  icon: donateGoldIcon,
  action: (params: MenuElementParams) => {
    params.playerActionHandler.handleDonateGold(params.selected!);
    params.closeMenu();
  },
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const allyDonateTroopsElement: MenuElement = {
  id: "ally_donate_troops",
  name: "donate troops",
  disabled: (params: MenuElementParams) =>
    !params.playerActions?.interaction?.canDonateTroops,
  color: COLORS.ally,
  icon: donateTroopIcon,
  action: (params: MenuElementParams) => {
    params.playerActionHandler.handleDonateTroops(params.selected!);
    params.closeMenu();
  },
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const infoPlayerElement: MenuElement = {
  id: "info_player",
  name: "player",
  disabled: () => false,
  color: COLORS.info,
  icon: infoIcon,
  action: (params: MenuElementParams) => {
    params.playerPanel.show(params.playerActions, params.tile);
  },
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const infoEmojiElement: MenuElement = {
  id: "info_emoji",
  name: "emoji",
  disabled: () => false,
  color: COLORS.infoEmoji,
  icon: emojiIcon,
  subMenu: (params: MenuElementParams) => {
    const emojiElements: MenuElement[] = [
      {
        id: "emoji_more",
        name: "more",
        disabled: () => false,
        color: COLORS.infoEmoji,
        icon: emojiIcon,
        action: (params: MenuElementParams) => {
          params.emojiTable.showTable((emoji) => {
            const targetPlayer =
              params.selected === params.game.myPlayer()
                ? AllPlayers
                : params.selected;
            params.playerActionHandler.handleEmoji(
              targetPlayer!,
              flattenedEmojiTable.indexOf(emoji as Emoji),
            );
            params.emojiTable.hideTable();
          });
        },
      },
    ];

    const emojiCount = 8;
    for (let i = 0; i < emojiCount; i++) {
      emojiElements.push({
        id: `emoji_${i}`,
        name: flattenedEmojiTable[i],
        text: flattenedEmojiTable[i],
        disabled: () => false,
        fontSize: "25px",
        action: (params: MenuElementParams) => {
          const targetPlayer =
            params.selected === params.game.myPlayer()
              ? AllPlayers
              : params.selected;
          params.playerActionHandler.handleEmoji(targetPlayer!, i);
          params.closeMenu();
        },
      });
    }

    return emojiElements;
  },
};

export const infoMenuElement: MenuElement = {
  id: Slot.Info,
  name: "info",
  disabled: (params: MenuElementParams) =>
    !params.selected || params.game.inSpawnPhase(),
  icon: infoIcon,
  color: COLORS.info,
  action: (params: MenuElementParams) => {
    params.playerPanel.show(params.playerActions, params.tile);
  },
};

function getAllEnabledUnits(
  myPlayer: boolean,
  config: Config,
  player?: PlayerView | null,
): Set<PlayerBuildableUnitType> {
  const units: Set<PlayerBuildableUnitType> =
    new Set<PlayerBuildableUnitType>();

  const addIfEnabled = (unitType: PlayerBuildableUnitType) => {
    if (!config.isUnitDisabled(unitType)) {
      units.add(unitType);
    }
  };

  if (myPlayer) {
    BuildMenus.types.forEach(addIfEnabled);
  } else {
    BuildableAttacks.types.forEach((unitType) => {
      if (
        unitType === UnitType.NavalMine &&
        !(player && navalMinesUnlocked(player))
      ) {
        return;
      }
      addIfEnabled(unitType);
    });
  }

  return units;
}

/** Tile-independent: unlocked, under cap, and (if cost is known) affordable. */
function canEnterNavalMineGhost(params: MenuElementParams): boolean {
  if (!navalMinesUnlocked(params.myPlayer)) {
    return false;
  }
  const bu = params.playerActions.buildableUnits.find(
    (u) => u.type === UnitType.NavalMine,
  );
  if (bu !== undefined && params.myPlayer.gold() < bu.cost) {
    return false;
  }
  const active = params.myPlayer
    .units(UnitType.NavalMine)
    .filter((u) => u.isActive()).length;
  return active < NAVAL_MINE_MAX_ACTIVE;
}

function createMenuElements(
  params: MenuElementParams,
  filterType: "attack" | "build",
  elementIdPrefix: string,
): MenuElement[] {
  const unitTypes: Set<PlayerBuildableUnitType> = getAllEnabledUnits(
    params.selected === params.myPlayer,
    params.game.config(),
    params.myPlayer,
  );

  return flattenedBuildTable
    .filter(
      (item) =>
        unitTypes.has(item.unitType) &&
        (filterType === "attack"
          ? BuildableAttacks.has(item.unitType)
          : !BuildableAttacks.has(item.unitType)),
    )
    .map((item: BuildItemDisplay) => {
      return {
        id: `${elementIdPrefix}_${item.unitType}`,
        name: item.key
          ? item.key.replace("unit_type.", "")
          : item.unitType.toString(),
        disabled: (p: MenuElementParams) =>
          item.unitType === UnitType.NavalMine
            ? !canEnterNavalMineGhost(p)
            : !p.buildMenu.canBuildOrUpgrade(item),
        color: (p: MenuElementParams) =>
          (
            item.unitType === UnitType.NavalMine
              ? canEnterNavalMineGhost(p)
              : p.buildMenu.canBuildOrUpgrade(item)
          )
            ? filterType === "attack"
              ? COLORS.attack
              : COLORS.building
            : COLORS.building,
        icon: item.icon,
        tooltipItems: [
          { text: translateText(item.key ?? ""), className: "title" },
          {
            text: translateText(item.description ?? ""),
            className: "description",
          },
          {
            text: `${renderNumber(params.buildMenu.cost(item))} ${translateText("player_panel.gold")}`,
            className: "cost",
          },
          item.countable
            ? { text: `${params.buildMenu.count(item)}x`, className: "count" }
            : null,
        ].filter(
          (tooltipItem): tooltipItem is TooltipItem => tooltipItem !== null,
        ),
        subMenu: (params: MenuElementParams) => {
          const buildableUnit = params.playerActions.buildableUnits.find(
            (bu) => bu.type === item.unitType,
          );
          if (!buildableUnit) {
            return [];
          }
          const isUpgradeBulk = buildableUnit.canUpgrade !== false;
          const isShipBulk =
            CombatShips.has(item.unitType) && buildableUnit.canBuild !== false;
          if (
            (!isUpgradeBulk && !isShipBulk) ||
            !params.buildMenu.canBuildOrUpgrade(item)
          ) {
            return [];
          }
          // Always four slots in fixed positions for muscle memory — laid
          // out clockwise from the top: x1, the two fixed steps, then the
          // largest amount the player can execute right now. max is capped
          // by gold; slots beyond it render disabled.
          const myPlayer = params.game.myPlayer();
          const maxAmount = maxBulkAmount(
            buildableUnit,
            myPlayer?.gold() ?? 0n,
          );
          if (maxAmount <= 1) {
            return [];
          }
          const steps = STRUCTURE_BULK_STEPS;
          const slots = [1, ...steps, maxAmount];
          const idPrefix = isUpgradeBulk ? "upgrade" : "build";
          const tooltipKey = isUpgradeBulk
            ? "radial_menu.upgrade_x"
            : "radial_menu.build_x";
          const slotColor = filterType === "attack" ? COLORS.attack : COLORS.building;
          return slots.map((amount, i) => {
            const isMaxSlot = i === slots.length - 1;
            const executable = amount <= maxAmount;
            const cost = bulkCost(buildableUnit, amount);
            return {
              id: isMaxSlot
                ? `${idPrefix}_${item.unitType}_max`
                : `${idPrefix}_${item.unitType}_${amount}`,
              name: translateText("build_menu.upgrade_amount", {
                amount: amount.toString(),
              }),
              text: translateText("build_menu.upgrade_amount", {
                amount: amount.toString(),
              }),
              fontSize: "20px",
              color: (p: MenuElementParams) =>
                executable && (p.game.myPlayer()?.gold() ?? 0n) >= cost
                  ? slotColor
                  : COLORS.disabled,
              icon: "",
              tooltipItems: [
                {
                  text: translateText(tooltipKey, {
                    amount: amount.toString(),
                  }),
                  className: "title",
                },
                {
                  text: `${renderNumber(cost)} ${translateText("player_panel.gold")}`,
                  className: "cost",
                },
              ],
              disabled: (p: MenuElementParams) =>
                !executable || (p.game.myPlayer()?.gold() ?? 0n) < cost,
              action: (p: MenuElementParams) => {
                if (isUpgradeBulk) {
                  p.eventBus.emit(
                    new SendUpgradeStructureIntentEvent(
                      buildableUnit.canUpgrade as number,
                      buildableUnit.type,
                      amount,
                    ),
                  );
                } else {
                  p.eventBus.emit(
                    new BuildUnitIntentEvent(
                      buildableUnit.type,
                      p.tile,
                      undefined,
                      amount,
                    ),
                  );
                }
                p.closeMenu();
              },
            };
          });
        },
        action: (params: MenuElementParams) => {
          if (item.unitType === UnitType.NavalMine) {
            if (params.uiState) {
              params.uiState.upgradeMultiplier = 1;
              params.uiState.ghostStructure = UnitType.NavalMine;
            }
            params.closeMenu();
            return;
          }
          const buildableUnit = params.playerActions.buildableUnits.find(
            (bu) => bu.type === item.unitType,
          );
          if (buildableUnit === undefined) {
            return;
          }
          if (params.buildMenu.canBuildOrUpgrade(item)) {
            if (buildableUnit.canUpgrade !== false) {
              params.eventBus.emit(
                new SendUpgradeStructureIntentEvent(
                  buildableUnit.canUpgrade,
                  buildableUnit.type,
                ),
              );
            } else if (buildableUnit.canBuild !== false) {
              params.eventBus.emit(
                new BuildUnitIntentEvent(buildableUnit.type, params.tile),
              );
            }
          }
          params.closeMenu();
        },
      };
    });
}

export const attackMenuElement: MenuElement = {
  id: Slot.Attack,
  name: "radial_attack",
  disabled: (params: MenuElementParams) => params.game.inSpawnPhase(),
  icon: swordIcon,
  color: COLORS.attack,

  subMenu: (params: MenuElementParams) => {
    if (params === undefined) return [];
    return createMenuElements(params, "attack", "attack");
  },
};

const donateGoldRadialElement: MenuElement = {
  id: Slot.Attack,
  name: "radial_donate_gold",
  disabled: (params: MenuElementParams) =>
    params.game.inSpawnPhase() ||
    !params.playerActions?.interaction?.canDonateGold,
  icon: donateGoldIcon,
  color: "#f59e0b",
  action: (params: MenuElementParams) => {
    if (!params.selected) return;
    params.playerPanel.openSendGoldModal(
      params.playerActions,
      params.tile,
      params.selected,
    );
  },
};

const BATTERY_SELECT_RADIUS = 8;

function closestOwnInlandBattery(params: MenuElementParams) {
  const tileOwner = params.game.owner(params.tile);
  if (!tileOwner.isPlayer() || tileOwner.id() !== params.myPlayer.id()) {
    return null;
  }
  const myUnits = params.myPlayer.units().filter(
    (unit) =>
      unit.type() === UnitType.InlandBattery &&
      !unit.isUnderConstruction() &&
      unit.markedForDeletion() === false &&
      params.game.manhattanDist(unit.tile(), params.tile) <=
        BATTERY_SELECT_RADIUS,
  );
  return findClosestBy(myUnits, (unit) =>
    params.game.manhattanDist(unit.tile(), params.tile),
  );
}

function inlandBatteryVolleyReady(
  params: MenuElementParams,
  unit: { lastVolleyTick(): number },
): boolean {
  const last = unit.lastVolleyTick();
  if (last <= 0) {
    return true;
  }
  return (
    params.game.ticks() - last >=
    params.game.config().inlandBatteryReloadTicks()
  );
}

export const inlandBatteryElement: MenuElement = {
  id: "inland_battery",
  name: "inland_battery",
  disabled: (params: MenuElementParams) =>
    closestOwnInlandBattery(params) === null,
  icon: inlandBatteryIcon,
  color: COLORS.building,
  tooltipKeys: [
    {
      key: "radial_menu.inland_battery_title",
      className: "title",
    },
    {
      key: "radial_menu.inland_battery_description",
      className: "description",
    },
  ],
  subMenu: (params: MenuElementParams) => {
    const battery = closestOwnInlandBattery(params);
    if (battery === null) {
      return [];
    }
    const auto = battery.autoFire();
    const ready = inlandBatteryVolleyReady(params, battery);
    return [
      {
        id: "inland_battery_auto",
        name: "inland_battery_auto",
        disabled: () => false,
        icon: inlandBatteryIcon,
        color: auto ? COLORS.ally : COLORS.disabled,
        tooltipKeys: [
          {
            key: auto
              ? "radial_menu.inland_battery_set_manual"
              : "radial_menu.inland_battery_set_auto",
            className: "title",
          },
        ],
        action: (p: MenuElementParams) => {
          p.playerActionHandler.handleInlandBatteryAuto(
            battery.id(),
            !auto,
          );
          p.closeMenu();
        },
      },
      {
        id: "inland_battery_fire",
        name: "inland_battery_fire",
        disabled: () => auto || !ready,
        icon: swordIcon,
        color: auto || !ready ? COLORS.disabled : COLORS.attack,
        tooltipKeys: [
          {
            key: "radial_menu.inland_battery_fire_title",
            className: "title",
          },
          {
            key: "radial_menu.inland_battery_fire_description",
            className: "description",
          },
        ],
        action: (p: MenuElementParams) => {
          if (auto || !ready) {
            return;
          }
          p.playerActionHandler.startInlandBatteryAim(battery.id());
          p.closeMenu();
        },
      },
    ];
  },
};

export const deleteUnitElement: MenuElement = {
  id: Slot.Delete,
  name: "delete",
  cooldown: (params: MenuElementParams) => params.myPlayer.deleteUnitCooldown(),
  disabled: (params: MenuElementParams) => {
    const tileOwner = params.game.owner(params.tile);
    const isLand = params.game.isLand(params.tile);

    if (!tileOwner.isPlayer() || tileOwner.id() !== params.myPlayer.id()) {
      return true;
    }

    if (!isLand) {
      return true;
    }

    if (params.game.inSpawnPhase()) {
      return true;
    }

    if (params.myPlayer.deleteUnitCooldown() > 0) {
      return true;
    }

    const DELETE_SELECTION_RADIUS = 5;
    const myUnits = params.myPlayer
      .units()
      .filter(
        (unit) =>
          !unit.isUnderConstruction() &&
          unit.markedForDeletion() === false &&
          Structures.has(unit.type()) &&
          params.game.manhattanDist(unit.tile(), params.tile) <=
            DELETE_SELECTION_RADIUS,
      );

    return myUnits.length === 0;
  },
  icon: xIcon,
  color: COLORS.delete,
  tooltipKeys: [
    {
      key: "radial_menu.delete_unit_title",
      className: "title",
    },
    {
      key: "radial_menu.delete_unit_description",
      className: "description",
    },
  ],
  action: (params: MenuElementParams) => {
    const DELETE_SELECTION_RADIUS = 5;
    const myUnits = params.myPlayer
      .units()
      .filter(
        (unit) =>
          !unit.isUnderConstruction() &&
          unit.markedForDeletion() === false &&
          Structures.has(unit.type()) &&
          params.game.manhattanDist(unit.tile(), params.tile) <=
            DELETE_SELECTION_RADIUS,
      );

    const closestUnit = findClosestBy(myUnits, (unit) =>
      params.game.manhattanDist(unit.tile(), params.tile),
    );
    if (closestUnit) {
      params.playerActionHandler.handleDeleteUnit(closestUnit.id());
    }

    params.closeMenu();
  },
};

export const buildMenuElement: MenuElement = {
  id: Slot.Build,
  name: "build",
  disabled: (params: MenuElementParams) => params.game.inSpawnPhase(),
  icon: buildIcon,
  color: COLORS.build,

  subMenu: (params: MenuElementParams) => {
    if (params === undefined) return [];
    return createMenuElements(params, "build", "build");
  },
};

export const boatMenuElement: MenuElement = {
  id: Slot.Boat,
  name: "boat",
  disabled: (params: MenuElementParams) =>
    !params.playerActions.buildableUnits.some(
      (unit) =>
        (unit.type === UnitType.TransportShip ||
          unit.type === UnitType.Lander) &&
        unit.canBuild,
    ),
  icon: boatIcon,
  color: COLORS.boat,

  action: async (params: MenuElementParams) => {
    params.playerActionHandler.handleBoatAttack(params.myPlayer, params.tile);

    params.closeMenu();
  },
};

export const centerButtonElement: CenterButtonElement = {
  disabled: (params: MenuElementParams): boolean => {
    const tileOwner = params.game.owner(params.tile);
    const isLand = params.game.isLand(params.tile);
    if (!isLand) {
      return true;
    }
    if (params.game.inSpawnPhase()) {
      if (params.game.config().isRandomSpawn()) {
        return true;
      }
      if (tileOwner.isPlayer()) {
        return true;
      }
      return false;
    }

    if (isFriendlyTarget(params) && !isDisconnectedTarget(params)) {
      return !params.playerActions.interaction?.canDonateTroops;
    }

    return !params.playerActions.canAttack;
  },
  action: (params: MenuElementParams) => {
    if (params.game.inSpawnPhase()) {
      params.playerActionHandler.handleSpawn(params.tile);
    } else {
      if (isFriendlyTarget(params) && !isDisconnectedTarget(params)) {
        const selectedPlayer = params.selected as PlayerView;
        const ratio = params.uiState?.attackRatio ?? 1;
        const troopsToDonate = Math.floor(ratio * params.myPlayer.troops());
        if (troopsToDonate > 0) {
          params.playerActionHandler.handleDonateTroops(
            selectedPlayer,
            troopsToDonate,
          );
        }
      } else {
        params.playerActionHandler.handleAttack(
          params.myPlayer,
          params.selected?.id() ?? null,
        );
      }
    }
    params.closeMenu();
  },
};

export const rootMenuElement: MenuElement = {
  id: "root",
  name: "root",
  disabled: () => false,
  icon: infoIcon,
  color: COLORS.info,
  subMenu: (params: MenuElementParams) => {
    const isAllied = params.selected?.isAlliedWith(params.myPlayer);
    const isDisconnected = isDisconnectedTarget(params);

    const tileOwner = params.game.owner(params.tile);
    const isOwnTerritory =
      tileOwner.isPlayer() &&
      (tileOwner as PlayerView).id() === params.myPlayer.id();

    const inExtensionWindow =
      params.playerActions.interaction?.allianceInfo?.inExtensionWindow;

    // After game-over, nukes can target teammates (nukeSpawn allows it).
    // Show the attack submenu so mobile users can access nukes in the aftergame.
    const hasBuildableAttacks =
      params.playerActions.buildableUnits?.some(
        (bu) => BuildableAttacks.has(bu.type) && bu.canBuild !== false,
      ) ?? false;

    const showDonateInsteadOfAttack =
      isFriendlyTarget(params) && !isDisconnected && !hasBuildableAttacks;

    const menuItems: (MenuElement | null)[] = [
      infoMenuElement,
      ...(isOwnTerritory
        ? [
            deleteUnitElement,
            ...(closestOwnInlandBattery(params)
              ? [inlandBatteryElement]
              : []),
            allyRequestElement,
            buildMenuElement,
          ]
        : [
            isAllied && !isDisconnected ? allyBreakElement : boatMenuElement,
            inExtensionWindow ? allyExtendElement : allyRequestElement,
            showDonateInsteadOfAttack
              ? donateGoldRadialElement
              : attackMenuElement,
          ]),
    ];

    return menuItems.filter((item): item is MenuElement => item !== null);
  },
};
