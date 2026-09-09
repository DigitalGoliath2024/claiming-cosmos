import { GameMapType, MapInfo, maps } from "./Maps.gen";

/**
 * Claiming Cosmos only ships maps tagged cosmic. Add `cosmic` in the map's
 * info.json (then `npm run gen-maps`) and it shows up in the picker.
 */
export const PLAYABLE_MAP_CATEGORY = "cosmic" as const;

export function isPlayableMap(map: MapInfo): boolean {
  return map.categories.includes(PLAYABLE_MAP_CATEGORY);
}

export function isPlayableMapType(type: GameMapType): boolean {
  const info = maps.find((m) => m.type === type);
  return info !== undefined && isPlayableMap(info);
}

export function playableMaps(): MapInfo[] {
  return maps.filter(isPlayableMap);
}

export function playableMapTypes(): GameMapType[] {
  return playableMaps().map((m) => m.type);
}

export const DEFAULT_PLAYABLE_MAP: GameMapType = GameMapType.Sol;

export function getRandomPlayableMapType(): GameMapType {
  const types = playableMapTypes();
  if (types.length === 0) return DEFAULT_PLAYABLE_MAP;
  return types[Math.floor(Math.random() * types.length)]!;
}
