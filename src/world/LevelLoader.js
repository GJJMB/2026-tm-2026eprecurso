import {
  CELL_SIZE,
  ENTITY_TYPES,
  mergeRowRuns,
  rowToWorldY,
  colToWorldX,
  groundRow,
  tileStyleKind,
  decomposeMaximizedRegions,
} from './levelFormat.js';

/**
 * World-space tiles for one grid (a section's `grid` or `bgGrid`). Characters whose
 * tileStyles opted into 'maximise' tiling (see levelFormat.js's decomposeMaximizedRegions)
 * are pulled out of the normal per-row run merge and rendered as the fewest largest
 * rectangles spanning their whole connected same-tile area instead; every other character
 * keeps the simple, cheaper per-row merge (mergeRowRuns) — both feed the same tile shape,
 * they just disagree on how many world-space cells one tile object covers.
 */
function buildLayerTiles(grid, { rows, groundTopY, cellSize, offsetX, tileStyles, lastRow, includeGroundRow, includeKind }) {
  const out = [];
  const maximiseChars = new Set(
    Object.keys(tileStyles).filter((char) => {
      const style = tileStyles[char];
      return style && style.texture && style.tileMode === 'maximise';
    })
  );

  const pushRect = (type, startRow, startCol, rowSpan, colSpan) => {
    const tile = {
      type,
      x: colToWorldX(startCol, offsetX, cellSize),
      y: rowToWorldY(startRow, rows, groundTopY, cellSize),
      w: colSpan * cellSize,
      h: rowSpan * cellSize,
      style: tileStyles[type] || null,
    };
    if (includeGroundRow) tile.isGroundRow = startRow + rowSpan - 1 === lastRow;
    if (includeKind) tile.kind = tileStyleKind(type, tileStyles);
    out.push(tile);
  };

  for (const rect of decomposeMaximizedRegions(grid, maximiseChars)) {
    pushRect(rect.type, rect.startRow, rect.startCol, rect.rowSpan, rect.colSpan);
  }

  grid.forEach((rowStr, row) => {
    for (const run of mergeRowRuns(rowStr)) {
      if (maximiseChars.has(run.type)) continue; // already covered by the maximise pass above
      pushRect(run.type, row, run.startCol, 1, run.colSpan);
    }
  });

  return out;
}

const LEVELS_SEQUENCE_KEY = 'levels';
const LEVELS_SEQUENCE_PATH = 'assets/levels/levels.json';
const LEVEL_DEFS_BASE_PATH = 'assets/levels/levels/';
const SECTIONS_BASE_PATH = 'assets/levels/sections/';

// `campaignId` namespaces these keys so a user-authored campaign (see src/data/db.js,
// seeded directly into this cache by MenuScene via cache.json.add — no network load
// involved) can define level/section ids that collide with the built-in game's without
// clobbering it, and so two different campaigns can't collide with each other either.
// Omitted (undefined) keeps today's exact keys, so every existing call site (BootScene,
// PreloadScene, GameScene's default/no-campaign path) is unaffected.
export function levelDefCacheKey(id, campaignId) {
  return campaignId ? `levelDef:${campaignId}:${id}` : `levelDef:${id}`;
}

export function sectionCacheKey(id, campaignId) {
  return campaignId ? `section:${campaignId}:${id}` : `section:${id}`;
}

/** Cache key for a campaign's own ordered level-id sequence (the campaign-scoped
 * equivalent of LEVELS_SEQUENCE_KEY) — seeded by MenuScene when a campaign is selected. */
export function campaignManifestCacheKey(campaignId) {
  return `campaignLevels:${campaignId}`;
}

/**
 * Assembles a level from its own definition file (assets/levels/levels/<id>.json — hand-written
 * or exported from the grid editor, see editor.html) plus that definition's pre-made sections
 * (assets/levels/sections/*.json), strung together left-to-right. assets/levels/levels.json holds
 * only the ordered list of level ids to play, not level content, so it stays readable as levels
 * are added. Adding a level is a sequence-array edit + a definition file + section files — no
 * code change.
 */
export default class LevelLoader {
  /** Call from an early scene's preload() to fetch the level sequence itself. */
  static queueManifestLoad(scene) {
    scene.load.json(LEVELS_SEQUENCE_KEY, LEVELS_SEQUENCE_PATH);
  }

  /**
   * Call from that same scene's create() (after the sequence has finished loading) to queue
   * every level's definition file, or just `levelKey`'s if given. This load pass must finish
   * before queueSectionLoads runs, since that reads section ids out of these definitions.
   */
  static queueLevelDefLoads(scene, levelKey) {
    const sequence = scene.cache.json.get(LEVELS_SEQUENCE_KEY) || [];
    const levelKeys = levelKey ? [levelKey] : sequence;
    for (const id of levelKeys) {
      const key = levelDefCacheKey(id);
      if (!scene.cache.json.has(key)) {
        scene.load.json(key, `${LEVEL_DEFS_BASE_PATH}${id}.json`);
      }
    }
  }

  /**
   * Call from a later scene's preload() (after queueLevelDefLoads' pass has finished) to
   * queue every section referenced by `levelKey`'s definition, or by every sequenced level's
   * definition if omitted.
   */
  static queueSectionLoads(scene, levelKey) {
    const sequence = scene.cache.json.get(LEVELS_SEQUENCE_KEY) || [];
    const levelKeys = levelKey ? [levelKey] : sequence;
    const sectionIds = new Set();
    for (const lk of levelKeys) {
      const def = scene.cache.json.get(levelDefCacheKey(lk));
      for (const sectionId of (def && def.sections) || []) {
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

  /** The level id that follows `levelKey` in assets/levels/levels.json's sequence (or, when
   * `campaignId` is given, in that campaign's own level sequence — seeded by MenuScene under
   * campaignManifestCacheKey), or null if `levelKey` is last (or not found). Used to offer a
   * "Next Level" action on a win. */
  static getNextLevelKey(scene, levelKey, campaignId) {
    const sequenceKey = campaignId ? campaignManifestCacheKey(campaignId) : LEVELS_SEQUENCE_KEY;
    const sequence = scene.cache.json.get(sequenceKey) || [];
    const idx = sequence.indexOf(levelKey);
    if (idx === -1 || idx === sequence.length - 1) return null;
    return sequence[idx + 1];
  }

  /**
   * Assemble `levelKey`'s (already-preloaded) sections into world-space geometry.
   * `groundTopY` anchors every section's ground row to the same baseline, so sections
   * authored independently still line up when strung together end to end.
   *
   * Returns { parallax, cellSize, levelWidth, levelHeight, tiles, bgTiles, entities },
   * where tiles/bgTiles/entities are already in world pixel coordinates — GameScene turns
   * those into actual Phaser game objects (that's the only part that needs
   * physics/collider wiring). `tiles` is the interactable foreground layer (unchanged
   * shape/semantics); `bgTiles` is the purely decorative background layer (see
   * levelFormat.js's `bgGrid` docs) — same shape minus `isGroundRow`, since background
   * tiles never collide and have no "ground baseline" concept. Each tile also carries its
   * owning section's `style` (that section's tileStyles entry for the tile's character, or
   * null), so differently-styled sections never bleed into each other even when strung
   * into the same level.
   */
  static build(scene, levelKey, groundTopY, campaignId) {
    const levelDef = scene.cache.json.get(levelDefCacheKey(levelKey, campaignId));
    if (!levelDef) {
      throw new Error(`LevelLoader: no level definition loaded for "${levelKey}" (expected ${LEVEL_DEFS_BASE_PATH}${levelKey}.json)`);
    }

    const cellSize = levelDef.cellSize || CELL_SIZE;
    const tiles = [];
    const bgTiles = [];
    const entities = [];
    let offsetX = 0;
    let maxRows = 0;

    for (const sectionId of levelDef.sections) {
      const section = scene.cache.json.get(sectionCacheKey(sectionId, campaignId));
      if (!section) {
        console.warn(`LevelLoader: section "${sectionId}" not loaded, skipping`);
        continue;
      }

      const { cols, rows, grid, bgGrid = [], entities: sectionEntities = [], tileStyles = {} } = section;
      maxRows = Math.max(maxRows, rows);
      const lastRow = groundRow(rows);

      const layerOpts = { rows, groundTopY, cellSize, offsetX, tileStyles, lastRow };
      // 'ground'/'hazard' — see tileStyleKind's docs on why the literal character alone
      // isn't enough once a section defines its own variants.
      tiles.push(...buildLayerTiles(grid, { ...layerOpts, includeGroundRow: true, includeKind: true }));
      // Background layer: same row/col → world-space mapping as the foreground grid, but
      // no ground-baseline concept and no collision — purely a stacked decorative image.
      bgTiles.push(...buildLayerTiles(bgGrid, { ...layerOpts, includeGroundRow: false, includeKind: false }));

      for (const entity of sectionEntities) {
        if (entity.type === ENTITY_TYPES.MOVING_PLATFORM) {
          // Multi-waypoint path: each {col,row} stop becomes a world-space {x,y} point,
          // anchored to this section the same way single-position entities are.
          const waypoints = entity.waypoints.map((wp) => ({
            x: colToWorldX(wp.col, offsetX, cellSize) + cellSize / 2,
            y: rowToWorldY(wp.row, rows, groundTopY, cellSize) + cellSize / 2,
          }));
          entities.push({ ...entity, waypoints, x: waypoints[0].x, y: waypoints[0].y });
          continue;
        }

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
      bgTiles,
      entities,
    };
  }
}
