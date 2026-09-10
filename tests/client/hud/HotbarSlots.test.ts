import { UnitType } from "../../../src/core/game/Game";
import {
  hotbarUnitForDigit,
  visibleHotbarSlots,
} from "../../../src/client/hud/HotbarSlots";

describe("HotbarSlots", () => {
  const noneDisabled = () => false;

  test("buildings start at City as slot 1", () => {
    expect(hotbarUnitForDigit("buildings", 1, noneDisabled)).toBe(
      UnitType.City,
    );
    expect(hotbarUnitForDigit("buildings", 5, noneDisabled)).toBe(
      UnitType.Starport,
    );
    expect(hotbarUnitForDigit("buildings", 8, noneDisabled)).toBe(
      UnitType.InlandBattery,
    );
    expect(hotbarUnitForDigit("buildings", 9, noneDisabled)).toBeNull();
  });

  test("ships start at Warship as slot 1", () => {
    expect(hotbarUnitForDigit("ships", 1, noneDisabled)).toBe(UnitType.Warship);
    expect(hotbarUnitForDigit("ships", 2, noneDisabled)).toBe(
      UnitType.Voidship,
    );
  });

  test("disabled units are skipped so the first visible item is still 1", () => {
    const disabled = (unit: UnitType) =>
      unit === UnitType.City ||
      unit === UnitType.Factory ||
      unit === UnitType.Armory;
    expect(hotbarUnitForDigit("buildings", 1, disabled)).toBe(UnitType.Port);
    expect(visibleHotbarSlots("buildings", disabled)[0]).toBe(UnitType.Port);
  });

  test("naval mines append to ships when unlocked", () => {
    const slots = visibleHotbarSlots("ships", noneDisabled, true);
    expect(slots[slots.length - 1]).toBe(UnitType.NavalMine);
    expect(hotbarUnitForDigit("ships", slots.length, noneDisabled, true)).toBe(
      UnitType.NavalMine,
    );
  });
});
