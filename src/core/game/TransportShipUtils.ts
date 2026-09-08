import { SpatialQuery } from "../pathfinding/spatial/SpatialQuery";
import { Game, Player, UnitType } from "./Game";
import { TileRef } from "./GameMap";
import {
  dockTypeForTile,
  findDockOnWaterComponent,
  playerTransportCount,
  transportTypeForTile,
} from "./NavalDomain";

export function canBuildTransportShip(
  game: Game,
  player: Player,
  tile: TileRef,
  unitType?: UnitType,
): TileRef | false {
  if (playerTransportCount(player) >= game.config().boatMaxNumber()) {
    return false;
  }

  const dst = targetTransportTile(game, player, tile);
  if (dst === null) {
    return false;
  }

  if (
    unitType !== undefined &&
    transportTypeForTile(game, dst) !== unitType
  ) {
    return false;
  }

  const other = game.owner(tile);
  if (other === player) {
    return false;
  }
  if (other.isPlayer() && !player.canAttackPlayer(other)) {
    return false;
  }

  const dockType = dockTypeForTile(game, dst);
  const dock = findDockOnWaterComponent(
    game,
    player.units(dockType),
    dst,
  );
  if (dock == null) {
    return false;
  }

  const spatial = new SpatialQuery(game);
  return spatial.closestShoreByWater(player, dst) ?? false;
}

export function targetTransportTile(
  gm: Game,
  attacker: Player,
  tile: TileRef,
): TileRef | null {
  const spatial = new SpatialQuery(gm);
  // Only consider landing shores the attacker can actually reach by water, so a
  // shore facing a disconnected inland lake is never chosen as the target.
  return spatial.closestReachableShore(gm.owner(tile), attacker, tile);
}

export function bestShoreDeploymentSource(
  gm: Game,
  player: Player,
  dst: TileRef,
): TileRef | null {
  const spatial = new SpatialQuery(gm);
  return spatial.closestShoreByWater(player, dst);
}
