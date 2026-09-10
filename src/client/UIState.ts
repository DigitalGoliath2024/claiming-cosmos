import { PlayerBuildableUnitType } from "../core/game/Game";
import { HotbarTab } from "./hud/HotbarSlots";

export interface UIState {
  attackRatio: number;
  ghostStructure: PlayerBuildableUnitType | null;
  rocketDirectionUp: boolean;
  upgradeMultiplier: number;
  /** Bottom bar: buildings or ships. Number keys 1–9 pick the nth visible slot. */
  hotbarTab: HotbarTab;
  /** Own inland battery being aimed for a manual volley; null when not aiming. */
  inlandBatteryAimUnitId?: number | null;
}
