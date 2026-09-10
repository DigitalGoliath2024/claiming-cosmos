/**
 * Deterministic per-tick budget for expensive sim work that can hitch large maps.
 * Wall-clock must never gate game logic (desync); slot counts are fine.
 */
let budgetTick = -1;
let clusterCalcsThisTick = 0;

const MAX_CLUSTER_CALCS_PER_TICK = 1;

function syncBudgetTick(ticks: number): void {
  if (budgetTick !== ticks) {
    budgetTick = ticks;
    clusterCalcsThisTick = 0;
  }
}

/** Returns true if this player may run a full border-cluster pass this tick. */
export function tryClaimClusterCalcSlot(ticks: number): boolean {
  syncBudgetTick(ticks);
  if (clusterCalcsThisTick >= MAX_CLUSTER_CALCS_PER_TICK) {
    return false;
  }
  clusterCalcsThisTick++;
  return true;
}

/** True after any successful cluster claim on this tick (for deferring other heavy work). */
export function clusterCalcClaimedThisTick(ticks: number): boolean {
  syncBudgetTick(ticks);
  return clusterCalcsThisTick > 0;
}
