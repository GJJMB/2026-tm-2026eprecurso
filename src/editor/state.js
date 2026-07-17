import {
  CELL,
  DEFAULT_COLS,
  DEFAULT_ENEMY_RANGE_COLS,
  DEFAULT_ROWS,
  ENTITY_TYPES,
  PATROLLING_ENEMY_TYPES,
  emptyGrid,
} from '../world/levelFormat.js';
import { t } from '../i18n.js';
import {
  DEFAULT_SEGMENT_SPEED,
  DEFAULT_MOVING_PLATFORM_WIDTH_CELLS,
  DEFAULT_MOVING_PLATFORM_HEIGHT_CELLS,
  DEFAULT_MOVING_PLATFORM_COLOR,
  DEFAULT_GROUND_COLOR,
  DEFAULT_HAZARD_COLOR,
  DEFAULT_BACKGROUND_COLOR,
  ENTITY_LABEL_KEYS,
} from './constants.js';

export function entityLabel(type) {
  const key = ENTITY_LABEL_KEYS[type];
  return key ? t(key) : type;
}

export function makeBlankState(id, cols, rows) {
  return {
    id,
    cols,
    rows,
    grid: emptyGrid(cols, rows).map((row) => row.split('')),
    // Decorative layer, same dimensions as `grid`: see levelFormat.js's bgGrid docs.
    bgGrid: emptyGrid(cols, rows).map((row) => row.split('')),
    entities: [],
    // This section's own floor/wall/backdrop tileset (see levelFormat.js's tileStyles
    // docs): each section keeps its own, rather than sharing one level-wide look.
    tileStyles: {
      [CELL.GROUND]: { color: DEFAULT_GROUND_COLOR },
      [CELL.HAZARD]: { color: DEFAULT_HAZARD_COLOR },
      [CELL.BACKGROUND]: { color: DEFAULT_BACKGROUND_COLOR },
    },
  };
}

// Central mutable editor state, shared across every module below. Its properties are
// mutated in place (e.g. `editor.section = next`) rather than the `editor` binding itself
// ever being reassigned, so `import { editor } from './state.js'` stays live everywhere
// it's imported, without needing per-field getter/setter boilerplate.
export const editor = {
  section: makeBlankState('new-section', DEFAULT_COLS, DEFAULT_ROWS),
  currentLayer: 'foreground', // 'foreground' | 'background': which grid painting/tools target
  currentTool: CELL.GROUND,
  isPainting: false,
  paintValue: CELL.GROUND,
  levelSections: [],

  // Which category the Tileset panel's dropdown/list is showing: purely a UI preference,
  // independent of currentLayer (e.g. you can browse Hazard's tileset while still painting
  // Ground). The char currently open in the side-modal editor, or null when it's closed.
  tilesetCategory: 'ground', // 'ground' | 'hazard' | 'background'
  tilesetModalChar: null,

  // Sprite keys available for the "Sprite" appearance mode, fetched once from
  // assets/images/platform-textures.json (see textureLoader.js).
  textureKeys: [],

  // Unified selection for the right sidebar's shared inspector:
  // { kind: 'entity', index } for a placed entity, or
  // { kind: 'platform', row, startCol, colSpan, type } for a merged tile run.
  selection: null,

  // Set while a "Reposition" button on a moving platform's waypoint is armed: the next
  // grid click sets that waypoint's position instead of painting/placing/selecting.
  placingWaypoint: null, // { entityIndex, waypointIndex } | null

  campaigns: [],
  currentCampaignId: null,
  currentErrors: [],

  pendingResize: null, // { cols, rows, rowOffset, losses } | null
};

export function makeMovingPlatformEntity(row, col) {
  return {
    type: ENTITY_TYPES.MOVING_PLATFORM,
    widthCells: DEFAULT_MOVING_PLATFORM_WIDTH_CELLS,
    heightCells: DEFAULT_MOVING_PLATFORM_HEIGHT_CELLS,
    color: DEFAULT_MOVING_PLATFORM_COLOR,
    waypoints: [
      { col, row },
      { col: Math.min(editor.section.cols - 1, col + 3), row },
    ],
    speeds: [DEFAULT_SEGMENT_SPEED],
  };
}

export function makeEnemyEntity(type, row, col) {
  const entity = { type, col, row };
  if (PATROLLING_ENEMY_TYPES.includes(type)) entity.rangeCols = DEFAULT_ENEMY_RANGE_COLS;
  return entity;
}
