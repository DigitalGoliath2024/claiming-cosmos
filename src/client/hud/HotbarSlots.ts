import {
  PlayerBuildableUnitType,
  UnitType,
} from "../../core/game/Game";

export type HotbarTab = "buildings" | "ships";

export const HOTBAR_BUILDINGS: readonly PlayerBuildableUnitType[] = [
  UnitType.City,
  UnitType.Factory,
  UnitType.Armory,
  UnitType.Port,
  UnitType.Starport,
  UnitType.DefensePost,
  UnitType.PortGun,
  UnitType.InlandBattery,
];

export const HOTBAR_SHIPS: readonly PlayerBuildableUnitType[] = [
  UnitType.Warship,
  UnitType.Voidship,
  UnitType.Marauder,
  UnitType.Corsair,
  UnitType.Lancer,
  UnitType.Tender,
  UnitType.Vestal,
];

export function visibleHotbarSlots(
  tab: HotbarTab,
  isUnitDisabled: (unit: UnitType) => boolean,
  minesUnlocked = false,
): PlayerBuildableUnitType[] {
  const base = tab === "ships" ? HOTBAR_SHIPS : HOTBAR_BUILDINGS;
  const slots = base.filter((unit) => !isUnitDisabled(unit));
  if (tab === "ships" && minesUnlocked && !isUnitDisabled(UnitType.NavalMine)) {
    slots.push(UnitType.NavalMine);
  }
  return slots;
}

export function hotbarUnitForDigit(
  tab: HotbarTab,
  digit: number,
  isUnitDisabled: (unit: UnitType) => boolean,
  minesUnlocked = false,
): PlayerBuildableUnitType | null {
  if (!Number.isInteger(digit) || digit < 1 || digit > 9) {
    return null;
  }
  return (
    visibleHotbarSlots(tab, isUnitDisabled, minesUnlocked)[digit - 1] ?? null
  );
}
