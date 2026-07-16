/**
 * Shared grid/section data format, used by both the runtime (LevelLoader.js) and the
 * standalone editor (src/editor/) so the two never drift apart on cell semantics.
 *
 * A "section" is a fixed-size grid of single-character cells (rows top-to-bottom,
 * cols left-to-right) plus a list of point "entities" (spawn, goal, moving platforms,
 * enemies) that need richer parameters than a single character can hold. The grid's last row
 * is always the ground baseline — every section anchors to it, which is what lets
 * sections be strung together left-to-right and still line up vertically.
 *
 * A section carries two parallel grids of the same cols/rows: `grid` (foreground —
 * interactable Ground/Hazard tiles, collidable) and the optional `bgGrid` (background —
 * purely decorative, limited to CELL.BACKGROUND, never collides with anything). They
 * share cell coordinates so a background tile can sit "behind" any foreground cell,
 * painted or empty. Older section files predate `bgGrid` — its absence means "no
 * background tiles" (see LevelLoader.build / editor import, which both default it in).
 *
 * Appearance (color or sprite texture, see assets/images/platform-textures.json) is kept
 * out of the grid/entities' geometry: a moving platform entity may carry its own
 * `{ color, texture }`, while ground/hazard/background tiles are styled per-section via
 * that section's own optional `tileStyles: { G: {...}, H: {...}, B: {...} }` (see
 * LevelLoader.build) — each section defines its own floor/wall/backdrop tileset rather
 * than sharing one level-wide look, so a hand-built section stays fully self-contained
 * and reusable across levels. A `texture` key always wins over `color` when both are
 * present; neither falls back to the game's built-in default color.
 *
 * A grid isn't limited to the literal characters G/H/B: a section can define extra
 * "variant" characters in tileStyles (anything but `.`) — e.g. a second ground look
 * painted as its own brush in the editor — each with its own `{ color, texture }` and,
 * for foreground variants, an explicit `kind: 'ground' | 'hazard'` (see tileStyleKind)
 * since the literal character no longer implies it. Because runs are merged by exact
 * character match (see mergeRowRuns), two adjacent variants never blend into one tile —
 * each keeps its own appearance without any extra bookkeeping.
 */

export const CELL_SIZE = 40;
export const DEFAULT_COLS = 20;
export const DEFAULT_ROWS = 12;

export const CELL = {
  EMPTY: '.',
  GROUND: 'G',
  HAZARD: 'H',
  // Background layer's only paintable tile — the decorative equivalent of Ground.
  BACKGROUND: 'B',
};

export const ENTITY_TYPES = {
  PLAYER_SPAWN: 'playerSpawn',
  GOAL: 'goal',
  MOVING_PLATFORM: 'movingPlatform',
  ENEMY_FALSE_FRIEND: 'enemyFalseFriend',
  ENEMY_CRAWLER: 'enemyCrawler',
  ENEMY_VOMIT_SEAGULL: 'enemyVomitSeagull',
};

/** Enemy entity types that patrol a bounded range around their spawn point (col ± rangeCols). */
export const PATROLLING_ENEMY_TYPES = [ENTITY_TYPES.ENEMY_CRAWLER, ENTITY_TYPES.ENEMY_VOMIT_SEAGULL];

export const DEFAULT_ENEMY_RANGE_COLS = 4;

/** Fallback cell-span for anything sizeable (currently just moving platforms) that omits
 * width/height entirely — see normalizeCellSpan. */
export const DEFAULT_PLATFORM_SPAN_CELLS = 1;

/**
 * Normalizes a cell-span field (a moving platform's widthCells/heightCells) to a positive
 * number, falling back to DEFAULT_PLATFORM_SPAN_CELLS when unset, non-numeric, or
 * non-positive — old data and hand-edited JSON stay safe to load either way.
 */
export function normalizeCellSpan(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PLATFORM_SPAN_CELLS;
}

/**
 * Whether foreground character `type` behaves as solid ground or a lethal hazard. The two
 * built-in literals (CELL.GROUND/CELL.HAZARD) imply their kind on their own, so every
 * section written before per-tile variants existed keeps working unmodified. Any other
 * character (a variant painted with its own sprite/color — see the editor's Tileset
 * panel) must carry an explicit `kind` on its tileStyles entry; a missing/malformed one
 * safely defaults to 'ground' rather than accidentally becoming lethal.
 */
export function tileStyleKind(type, tileStyles = {}) {
  if (type === CELL.HAZARD) return 'hazard';
  if (type === CELL.GROUND) return 'ground';
  if (type === CELL.BACKGROUND) return 'background';
  const style = tileStyles[type];
  return (style && style.kind) || 'ground';
}

export function groundRow(rows) {
  return rows - 1;
}

export function emptyGrid(cols = DEFAULT_COLS, rows = DEFAULT_ROWS) {
  return Array.from({ length: rows }, () => CELL.EMPTY.repeat(cols));
}

/**
 * World-space Y of the top of grid `row`, anchored so the ground row's top always
 * lands on `groundTopY` — independent of how many rows a given section defines above it.
 */
export function rowToWorldY(row, rows, groundTopY, cellSize = CELL_SIZE) {
  return groundTopY - (groundRow(rows) - row) * cellSize;
}

export function colToWorldX(col, sectionOffsetX, cellSize = CELL_SIZE) {
  return sectionOffsetX + col * cellSize;
}

/** Collapse a grid row string into contiguous runs of the same non-empty character. */
export function mergeRowRuns(rowStr) {
  const runs = [];
  let i = 0;
  while (i < rowStr.length) {
    const ch = rowStr[i];
    if (ch === CELL.EMPTY) {
      i++;
      continue;
    }
    let j = i + 1;
    while (j < rowStr.length && rowStr[j] === ch) j++;
    runs.push({ type: ch, startCol: i, colSpan: j - i });
    i = j;
  }
  return runs;
}

/** Basic shape check used by both the editor (on import) and the game (defensive). */
export function isValidSection(section) {
  if (!section || typeof section !== 'object') return false;
  if (!Number.isInteger(section.cols) || !Number.isInteger(section.rows)) return false;
  if (!Array.isArray(section.grid) || section.grid.length !== section.rows) return false;
  if (!section.grid.every((row) => typeof row === 'string' && row.length === section.cols)) return false;
  if (section.bgGrid !== undefined) {
    if (!Array.isArray(section.bgGrid) || section.bgGrid.length !== section.rows) return false;
    if (!section.bgGrid.every((row) => typeof row === 'string' && row.length === section.cols)) return false;
  }
  if (section.entities && !Array.isArray(section.entities)) return false;
  return true;
}
