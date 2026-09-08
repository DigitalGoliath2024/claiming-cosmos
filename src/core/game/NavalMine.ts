import { Game, Player, Unit, UnitType } from "./Game";
import { TileRef } from "./GameMap";

/** 10 seconds at 10 ticks/s. */
export const NAVAL_MINE_ARMING_TICKS = 100;
export const NAVAL_MINE_RANGE = 30;
export const NAVAL_MINE_SPACING = 15;
export const NAVAL_MINE_MAX_ACTIVE = 3;
export const NAVAL_MINE_FIRST_COST = 250_000;
export const NAVAL_MINE_ADDITIONAL_COST = 500_000;
export const NAVAL_MINE_WARSHIP_DAMAGE_PERCENT = 70;
export const NAVAL_MINE_UNLOCK_ARMORY_LEVEL = 4;

const MINE_BLOCKING_SHIPS: readonly UnitType[] = [
  UnitType.Warship,
  UnitType.Voidship,
  UnitType.Marauder,
  UnitType.Corsair,
  UnitType.Tender,
  UnitType.Vestal,
  UnitType.TransportShip,
  UnitType.Lander,
  UnitType.TradeShip,
];

const MINE_TRIGGER_SHIPS: readonly UnitType[] = [
  UnitType.Warship,
  UnitType.Voidship,
  UnitType.Marauder,
  UnitType.Corsair,
  UnitType.Tender,
  UnitType.Vestal,
  UnitType.TransportShip,
  UnitType.Lander,
];

/**
 * Inclusive chebyshev half-extents matching unit.vert.glsl:
 * halfSize = uUnitSize * 0.5 * sizeScale (uUnitSize = 13).
 * Tile centers overlap the sprite AABB when chebyshev ≤ floor(halfSize).
 */
export const WARSHIP_SPRITE_HALF = 6;
export const MARAUDER_SPRITE_HALF = 4;
export const TRANSPORT_SPRITE_HALF = 3;

/** nearbyUnits is Euclidean; a 13×13 AABB corner is 6 tiles on both axes. */
const MINE_TRIGGER_SEARCH_RANGE = 9;

function mineTriggerHullHalf(type: UnitType): number {
  switch (type) {
    case UnitType.Marauder:
    case UnitType.Corsair:
      return MARAUDER_SPRITE_HALF;
    case UnitType.TransportShip:
    case UnitType.Lander:
      return TRANSPORT_SPRITE_HALF;
    default:
      return WARSHIP_SPRITE_HALF;
  }
}

export function shipSpriteOverlapsMine(
  mg: Game,
  shipTile: TileRef,
  mineTile: TileRef,
  shipType: UnitType,
): boolean {
  const half = mineTriggerHullHalf(shipType);
  const dx = mg.x(shipTile) - mg.x(mineTile);
  const dy = mg.y(shipTile) - mg.y(mineTile);
  return dx >= -half && dx <= half && dy >= -half && dy <= half;
}

type ArmoryOwner = {
  units?(type: UnitType): {
    isActive(): boolean;
    isUnderConstruction(): boolean;
    level(): number;
  }[];
};

export function navalMinesUnlocked(player: ArmoryOwner): boolean {
  const armories = player.units?.(UnitType.Armory);
  if (armories === undefined) {
    return false;
  }
  for (const unit of armories) {
    if (
      unit.isActive() &&
      !unit.isUnderConstruction() &&
      unit.level() >= NAVAL_MINE_UNLOCK_ARMORY_LEVEL
    ) {
      return true;
    }
  }
  return false;
}

export function activeNavalMineCount(player: Player): number {
  let n = 0;
  for (const unit of player.units(UnitType.NavalMine)) {
    if (unit.isActive()) {
      n++;
    }
  }
  return n;
}

export function navalMineGoldCost(activeCount: number): number {
  return activeCount <= 0
    ? NAVAL_MINE_FIRST_COST
    : NAVAL_MINE_ADDITIONAL_COST;
}

export function canSeeNavalMine(viewer: Player, mineOwner: Player): boolean {
  return viewer === mineOwner || viewer.isOnSameTeam(mineOwner);
}

export function isPassableWater(mg: Game, tile: TileRef): boolean {
  return mg.isWater(tile) && !mg.isImpassable(tile);
}

export function tileHasShip(mg: Game, tile: TileRef): boolean {
  return mg.anyUnitNearby(tile, 1, MINE_BLOCKING_SHIPS, (unit) => {
    return unit.isActive() && unit.tile() === tile;
  });
}

/**
 * Water-only BFS distance from `tile` to land owned by `player`.
 * The start tile is distance 0; a neighbor that is owned land counts as in range
 * at the current depth. Returns false if no owned land is reached within `maxDist`.
 */
export function waterDistToOwnedLand(
  mg: Game,
  player: Player,
  tile: TileRef,
  maxDist: number = NAVAL_MINE_RANGE,
): number | false {
  if (!isPassableWater(mg, tile)) {
    return false;
  }
  if (touchesOwnedLand(mg, player, tile)) {
    return 0;
  }

  const seen = new Set<TileRef>([tile]);
  let frontier: TileRef[] = [tile];
  let dist = 0;

  while (frontier.length > 0 && dist < maxDist) {
    dist++;
    const next: TileRef[] = [];
    for (const cur of frontier) {
      for (const n of mg.neighbors(cur)) {
        if (seen.has(n)) {
          continue;
        }
        if (!isPassableWater(mg, n)) {
          continue;
        }
        if (touchesOwnedLand(mg, player, n)) {
          return dist;
        }
        seen.add(n);
        next.push(n);
      }
    }
    frontier = next;
  }
  return false;
}

function touchesOwnedLand(mg: Game, player: Player, waterTile: TileRef): boolean {
  for (const n of mg.neighbors(waterTile)) {
    if (mg.isLand(n) && !mg.isImpassable(n) && mg.owner(n) === player) {
      return true;
    }
  }
  return false;
}

export function mineSpacingOk(mg: Game, tile: TileRef): boolean {
  return !mg.anyUnitNearby(
    tile,
    NAVAL_MINE_SPACING,
    [UnitType.NavalMine],
    (unit) =>
      unit.isActive() && mg.manhattanDist(unit.tile(), tile) < NAVAL_MINE_SPACING,
  );
}

export function canPlaceNavalMine(
  mg: Game,
  player: Player,
  tile: TileRef,
): boolean {
  if (!navalMinesUnlocked(player)) {
    return false;
  }
  if (activeNavalMineCount(player) >= NAVAL_MINE_MAX_ACTIVE) {
    return false;
  }
  if (!isPassableWater(mg, tile)) {
    return false;
  }
  if (tileHasShip(mg, tile)) {
    return false;
  }
  if (waterDistToOwnedLand(mg, player, tile) === false) {
    return false;
  }
  if (!mineSpacingOk(mg, tile)) {
    return false;
  }
  return true;
}

export function triggeringShipOnTile(
  mg: Game,
  mine: Unit,
): Unit | undefined {
  const owner = mine.owner();
  const mineTile = mine.tile();
  const hits = mg.nearbyUnits(
    mineTile,
    MINE_TRIGGER_SEARCH_RANGE,
    MINE_TRIGGER_SHIPS,
    ({ unit }) => {
      if (!shipSpriteOverlapsMine(mg, unit.tile(), mineTile, unit.type())) {
        return false;
      }
      const shipOwner = unit.owner();
      if (shipOwner === owner) {
        return false;
      }
      const team = owner.team();
      if (team !== null && team === shipOwner.team()) {
        return false;
      }
      return true;
    },
  );
  return hits[0]?.unit;
}

export function applyNavalMineDamage(mg: Game, ship: Unit): void {
  const type = ship.type();
  if (type === UnitType.Warship || type === UnitType.Voidship || type === UnitType.Tender || type === UnitType.Vestal) {
    const damage = Math.floor(
      (ship.maxHealth() * NAVAL_MINE_WARSHIP_DAMAGE_PERCENT) / 100,
    );
    ship.modifyHealth(-damage);
    return;
  }
  if (type === UnitType.Marauder || type === UnitType.Corsair || type === UnitType.TransportShip) {
    ship.delete(false);
  }
}

export function nearestOwnedLandTile(
  mg: Game,
  player: Player,
  from: TileRef,
): TileRef | null {
  let best: TileRef | null = null;
  let bestDist = Number.MAX_SAFE_INTEGER;
  for (const tile of player.borderTiles()) {
    if (!mg.isLand(tile) || mg.isImpassable(tile)) {
      continue;
    }
    const d = mg.manhattanDist(from, tile);
    if (d < bestDist) {
      bestDist = d;
      best = tile;
    }
  }
  return best;
}
