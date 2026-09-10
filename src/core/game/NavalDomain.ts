import { Game, isVoidFleetHull, Unit, UnitType } from "./Game";
import { TileRef } from "./GameMap";
import { findClosestBy } from "../Util";

export function isLakeWater(game: Game, tile: TileRef): boolean {
  return game.isWater(tile) && !game.isOcean(tile);
}

export function isVoidWater(game: Game, tile: TileRef): boolean {
  return game.isOcean(tile);
}

export function shoreTouchesLake(game: Game, shore: TileRef): boolean {
  let found = false;
  game.forEachNeighbor(shore, (n) => {
    if (!found && isLakeWater(game, n)) found = true;
  });
  return found;
}

export function shoreTouchesVoid(game: Game, shore: TileRef): boolean {
  let found = false;
  game.forEachNeighbor(shore, (n) => {
    if (!found && isVoidWater(game, n)) found = true;
  });
  return found;
}

/** Void wins if a tile (water or shore) touches ocean. */
export function isVoidApproach(game: Game, tile: TileRef): boolean {
  if (game.isWater(tile)) return game.isOcean(tile);
  return shoreTouchesVoid(game, tile);
}

export function transportTypeForTile(
  game: Game,
  tile: TileRef,
): UnitType.Lander | UnitType.TransportShip {
  return isVoidApproach(game, tile)
    ? UnitType.Lander
    : UnitType.TransportShip;
}

export function dockTypeForTile(
  game: Game,
  tile: TileRef,
): UnitType.Starport | UnitType.Port {
  return isVoidApproach(game, tile) ? UnitType.Starport : UnitType.Port;
}

export function isTransportHull(type: UnitType): boolean {
  return type === UnitType.TransportShip || type === UnitType.Lander;
}

export function playerDocks(player: {
  units(type: UnitType): Unit[];
}): Unit[] {
  return [
    ...player.units(UnitType.Port),
    ...player.units(UnitType.Starport),
  ];
}

export function playerTransportCount(player: {
  unitCount(type: UnitType): number;
}): number {
  return (
    player.unitCount(UnitType.TransportShip) +
    player.unitCount(UnitType.Lander)
  );
}

export function docksForCombatHull(
  player: { units(type: UnitType): Unit[] },
  hull: UnitType,
): Unit[] {
  return isVoidFleetHull(hull)
    ? player.units(UnitType.Starport)
    : player.units(UnitType.Port);
}

export function findDockOnWaterComponent(
  game: Game,
  docks: Unit[],
  tile: TileRef,
): Unit | null {
  const tileComponent = game.getWaterComponent(tile);
  return findClosestBy(
    docks,
    (dock) => game.manhattanDist(dock.tile(), tile),
    (dock) =>
      dock.isActive() &&
      !dock.isUnderConstruction() &&
      tileComponent !== null &&
      game.hasWaterComponent(dock.tile(), tileComponent),
  );
}
