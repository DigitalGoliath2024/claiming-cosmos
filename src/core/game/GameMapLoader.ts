import { GameMapType } from "./Game";
import { MapManifest } from "./TerrainMapLoader";

export interface GameMapLoader {
  getMapData(map: GameMapType): MapData;
}

export interface MapData {
  mapBin: () => Promise<Uint8Array>;
  map4xBin: () => Promise<Uint8Array>;
  map16xBin: () => Promise<Uint8Array>;
  /**
   * Optional visual biome overlay (same size as the matching map.bin).
   * Missing files / 404 return null. 0 rocky, 1 terrestrial, 2 ice, 3 volcanic,
   * 255 inherit look from magnitude (legacy maps).
   */
  biomeBin: () => Promise<Uint8Array | null>;
  biome4xBin: () => Promise<Uint8Array | null>;
  biome16xBin: () => Promise<Uint8Array | null>;
  manifest: () => Promise<MapManifest>;
  webpPath: string;
  /** Load a map layer PNG by layer id. Returns an ImageBitmap. */
  layerPng: (layerId: string) => Promise<ImageBitmap>;
}
