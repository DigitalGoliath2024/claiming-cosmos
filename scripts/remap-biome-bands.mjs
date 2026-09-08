/**
 * UNSAFE: remapping map.bin magnitude changes combat (plains/highland/mountain).
 * Visual biomes belong in biome.bin — use scripts/write-cosmic-biome.mjs instead.
 */
console.error(
  "Do not remap map.bin magnitude for biomes. Use: node scripts/write-cosmic-biome.mjs",
);
process.exit(1);
