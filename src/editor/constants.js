import { CELL, ENTITY_TYPES } from '../world/levelFormat.js';

// Keys, not literal strings, so entityLabel() (state.js) always reflects the current
// language (unlike a plain lookup object, which would freeze in whatever language was
// active when the module first evaluated).
export const ENTITY_LABEL_KEYS = {
  [ENTITY_TYPES.PLAYER_SPAWN]: 'editor.entityLabel.playerSpawn',
  [ENTITY_TYPES.GOAL]: 'editor.entityLabel.goal',
  [ENTITY_TYPES.MOVING_PLATFORM]: 'editor.entityLabel.movingPlatform',
  [ENTITY_TYPES.ENEMY_FALSE_FRIEND]: 'editor.entityLabel.enemyFalseFriend',
  [ENTITY_TYPES.ENEMY_CRAWLER]: 'editor.entityLabel.enemyCrawler',
  [ENTITY_TYPES.ENEMY_VOMIT_SEAGULL]: 'editor.entityLabel.enemyVomitSeagull',
  [ENTITY_TYPES.CHECKPOINT]: 'editor.entityLabel.checkpoint',
};

export const ENTITY_COLORS = {
  [ENTITY_TYPES.PLAYER_SPAWN]: '#7CFC9A',
  [ENTITY_TYPES.GOAL]: '#ffcc33',
  [ENTITY_TYPES.MOVING_PLATFORM]: '#00ccff',
  [ENTITY_TYPES.ENEMY_FALSE_FRIEND]: '#ff8800',
  [ENTITY_TYPES.ENEMY_CRAWLER]: '#44aa44',
  [ENTITY_TYPES.ENEMY_VOMIT_SEAGULL]: '#ffcc00',
  [ENTITY_TYPES.CHECKPOINT]: '#38d9a9',
};

export const ENEMY_MARKER_TEXT = {
  [ENTITY_TYPES.ENEMY_FALSE_FRIEND]: 'FF',
  [ENTITY_TYPES.ENEMY_CRAWLER]: 'CR',
  [ENTITY_TYPES.ENEMY_VOMIT_SEAGULL]: 'VS',
};

export const ENEMY_MARKER_CLASS = {
  [ENTITY_TYPES.ENEMY_FALSE_FRIEND]: 'enemy-falsefriend',
  [ENTITY_TYPES.ENEMY_CRAWLER]: 'enemy-crawler',
  [ENTITY_TYPES.ENEMY_VOMIT_SEAGULL]: 'enemy-vomitseagull',
};

export const ENEMY_TOOL_TYPES = [
  ENTITY_TYPES.ENEMY_FALSE_FRIEND,
  ENTITY_TYPES.ENEMY_CRAWLER,
  ENTITY_TYPES.ENEMY_VOMIT_SEAGULL,
];

export const DEFAULT_SEGMENT_SPEED = 70;
export const DEFAULT_MOVING_PLATFORM_WIDTH_CELLS = 3;
export const DEFAULT_MOVING_PLATFORM_HEIGHT_CELLS = 1;
export const DEFAULT_MOVING_PLATFORM_COLOR = '#4f7a5c';
export const DEFAULT_GROUND_COLOR = '#4a4a5e';
export const DEFAULT_HAZARD_COLOR = '#d1495b';
export const DEFAULT_BACKGROUND_COLOR = '#2e3a4a';

// Extra single-character slots a section can hand out to its own Ground/Hazard/Background
// variants (see levelFormat.js's tileStyleKind docs): '.', 'G', 'H', 'B' are reserved, so
// this pool is picked from every other easily-typed printable character.
export const VARIANT_CHAR_POOL = '123456789abcdefghijklmnopqrstuvwxyzACDEFIJKLMNOPQRSTUVWXYZ'.split('');

// Must match the .cell width/gap in editor.html's CSS: used to place the SVG path
// overlay's points without needing a DOM measurement round-trip.
export const CELL_PX = 28;
export const GAP_PX = 1;

export const TILESET_BASE_CHAR = { ground: CELL.GROUND, hazard: CELL.HAZARD, background: CELL.BACKGROUND };
export const TILESET_DEFAULT_COLOR = {
  ground: DEFAULT_GROUND_COLOR,
  hazard: DEFAULT_HAZARD_COLOR,
  background: DEFAULT_BACKGROUND_COLOR,
};

export const TILE_MODE_LABEL_KEYS = {
  stretch: 'editor.tileMode.stretch',
  repeat: 'editor.tileMode.repeat',
  maximise: 'editor.tileMode.maximise',
};
export const TILE_MODE_HINT_KEYS = {
  stretch: 'editor.tileMode.stretchHint',
  repeat: 'editor.tileMode.repeatHint',
  maximise: 'editor.tileMode.maximiseHint',
};

export const MAX_COLS = 256;
export const MAX_ROWS = 64;
