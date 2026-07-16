import { CELL_SIZE, mergeRowRuns, rowToWorldY, colToWorldX, groundRow } from './levelFormat.js';

const LEVELS_MANIFEST_KEY = 'levels';
const LEVELS_MANIFEST_PATH = 'assets/levels/levels.json';
const SECTIONS_BASE_PATH = 'assets/levels/sections/';

function sectionCacheKey(id) {
  return `section:${id}`;
}

/**
 * Assembles a level (assets/levels/levels.json) from its pre-made sections
 * (assets/levels/sections/*.json), strung together left-to-right. Adding a level is a
 * manifest edit + section JSON files (hand-written or exported from the grid editor,
 * see editor.html) — no code change.
 */
export default class LevelLoader {
  /** Call from an early scene's preload() to fetch the manifest itself. */
  static queueManifestLoad(scene) {
    scene.load.json(LEVELS_MANIFEST_KEY, LEVELS_MANIFEST_PATH);
  }

  /**
   * Call from a later scene's preload() (after the manifest has finished loading) to
   * queue every section referenced by `levelKey`, or by every level if omitted.
   */
  static queueSectionLoads(scene, levelKey) {
    const levels = scene.cache.json.get(LEVELS_MANIFEST_KEY) || {};
    const levelKeys = levelKey ? [levelKey] : Object.keys(levels);
    const sectionIds = new Set();
    for (const lk of levelKeys) {
      for (const sectionId of (levels[lk] && levels[lk].sections) || []) {
        sectionIds.add(sectionId);
      }
    }
    for (const id of sectionIds) {
      const key = sectionCacheKey(id);
      if (!scene.cache.json.has(key)) {
        scene.load.json(key, `${SECTIONS_BASE_PATH}${id}.json`);
      }
    }
  }

  /**
   * Assemble `levelKey`'s (already-preloaded) sections into world-space geometry.
   * `groundTopY` anchors every section's ground row to the same baseline, so sections
   * authored independently still line up when strung together end to end.
   *
   * Returns { parallax, cellSize, levelWidth, levelHeight, tiles, entities }, where
   * tiles/entities are already in world pixel coordinates — GameScene turns those into
   * actual Phaser game objects (that's the only part that needs physics/collider wiring).
   */
  static build(scene, levelKey, groundTopY) {
    const levels = scene.cache.json.get(LEVELS_MANIFEST_KEY) || {};
    const levelDef = levels[levelKey];
    if (!levelDef) {
      throw new Error(`LevelLoader: no level "${levelKey}" in ${LEVELS_MANIFEST_PATH}`);
    }

    const cellSize = levelDef.cellSize || CELL_SIZE;
    const tiles = [];
    const entities = [];
    let offsetX = 0;
    let maxRows = 0;

    for (const sectionId of levelDef.sections) {
      const section = scene.cache.json.get(sectionCacheKey(sectionId));
      if (!section) {
        console.warn(`LevelLoader: section "${sectionId}" not loaded, skipping`);
        continue;
      }

      const { cols, rows, grid, entities: sectionEntities = [] } = section;
      maxRows = Math.max(maxRows, rows);
      const lastRow = groundRow(rows);

      grid.forEach((rowStr, row) => {
        const y = rowToWorldY(row, rows, groundTopY, cellSize);
        for (const run of mergeRowRuns(rowStr)) {
          tiles.push({
            type: run.type,
            x: colToWorldX(run.startCol, offsetX, cellSize),
            y,
            w: run.colSpan * cellSize,
            h: cellSize,
            isGroundRow: row === lastRow,
          });
        }
      });

      for (const entity of sectionEntities) {
        const yTop = rowToWorldY(entity.row, rows, groundTopY, cellSize);
        entities.push({
          ...entity,
          x: colToWorldX(entity.col, offsetX, cellSize) + cellSize / 2,
          y: yTop + cellSize / 2,
          yTop,
        });
      }

      offsetX += cols * cellSize;
    }

    return {
      parallax: levelDef.parallax,
      cellSize,
      levelWidth: offsetX,
      levelHeight: maxRows * cellSize,
      tiles,
      entities,
    };
  }
}
