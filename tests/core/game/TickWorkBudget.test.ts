import { describe, expect, it } from "vitest";
import {
  clusterCalcClaimedThisTick,
  tryClaimClusterCalcSlot,
} from "../../../src/core/game/TickWorkBudget";

describe("TickWorkBudget", () => {
  it("allows one cluster calc per tick and resets on the next tick", () => {
    expect(tryClaimClusterCalcSlot(9001)).toBe(true);
    expect(clusterCalcClaimedThisTick(9001)).toBe(true);
    expect(tryClaimClusterCalcSlot(9001)).toBe(false);
    expect(tryClaimClusterCalcSlot(9002)).toBe(true);
    expect(tryClaimClusterCalcSlot(9002)).toBe(false);
  });
});
