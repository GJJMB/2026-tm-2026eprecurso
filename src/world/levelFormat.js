/**
 * Shared grid/section data format, used by both the runtime (LevelLoader.js) and the
 * standalone editor (src/editor/) so the two never drift apart on cell semantics.
 *
 * A "section" is a fixed-size grid of single-character cells (rows top-to-bottom,
 * cols left-to-right) plus a list of point "entities" (spawn, goal, moving platforms)
 * that need richer parameters than a single character can hold. The grid's last row
 * is always the ground baseline — every section anchors to it, which is what lets
 * sections be strung together left-to-right and still line up vertically.
 */

export const CELL_SIZE = 40;
export const DEFAULT_COLS = 20;
export const DEFAULT_ROWS = 12;

export const CELL = {
  EMPTY: '.',
  GROUND: 'G',
  HAZARD: 'H',
};

export const ENTITY_TYPES = {
  PLAYER_SPAWN: 'playerSpawn',
  GOAL: 'goal',
  MOVING_PLATFORM: 'movingPlatform',
};

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
  if (section.entities && !Array.isArray(section.entities)) return false;
  return true;
}
