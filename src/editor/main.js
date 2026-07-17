import {
  CELL,
  CELL_SIZE,
  DEFAULT_COLS,
  DEFAULT_ENEMY_RANGE_COLS,
  DEFAULT_ROWS,
  ENTITY_TYPES,
  PATROLLING_ENEMY_TYPES,
  emptyGrid,
  groundRow,
  isValidSection,
  mergeRowRuns,
  tileStyleKind,
} from '../world/levelFormat.js';
import {
  isIndexedDbAvailable,
  getAllSections,
  getSection,
  putSection,
  deleteSection,
  getAllLevels,
  getLevel,
  putLevel,
  deleteLevel,
  getAllCampaigns,
  putCampaign,
  deleteCampaign,
  generateCampaignId,
  getAsset,
  deleteAsset,
} from '../data/db.js';
import { computeAllErrors, hasError } from '../data/validation.js';
import { ASSET_KIND, saveAssetFile, assetToDataUrl } from '../data/assets.js';
import { t, getLanguage, setLanguage, initLocalesViaFetch } from '../i18n.js';

const els = {
  sectionId: document.getElementById('section-id'),
  cols: document.getElementById('section-cols'),
  rows: document.getElementById('section-rows'),
  resizeBtn: document.getElementById('resize-btn'),
  resizeWarning: document.getElementById('resize-warning'),
  newBtn: document.getElementById('new-btn'),
  fgToolGrid: document.getElementById('fg-tool-grid'),
  bgToolGrid: document.getElementById('bg-tool-grid'),
  grid: document.getElementById('grid'),
  jsonPreview: document.getElementById('json-preview'),
  applyJsonBtn: document.getElementById('apply-json-btn'),
  exportSectionBtn: document.getElementById('export-section-btn'),
  importFile: document.getElementById('import-section-file'),
  importLabelBtn: document.getElementById('import-section-label-btn'),
  levelId: document.getElementById('level-id'),
  levelParallax: document.getElementById('level-parallax'),
  levelMaxTime: document.getElementById('level-max-time'),
  levelMedalGold: document.getElementById('level-medal-gold'),
  levelMedalSilver: document.getElementById('level-medal-silver'),
  levelMedalBronze: document.getElementById('level-medal-bronze'),
  tilesetCategorySelect: document.getElementById('tileset-category'),
  tilesetTypeList: document.getElementById('tileset-type-list'),
  tilesetAddBtn: document.getElementById('tileset-add-btn'),
  tilesetModalBackdrop: document.getElementById('tileset-modal-backdrop'),
  tilesetModal: document.getElementById('tileset-modal'),
  tilesetModalTitle: document.getElementById('tileset-modal-title'),
  tilesetModalClose: document.getElementById('tileset-modal-close'),
  tilesetModalBody: document.getElementById('tileset-modal-body'),
  layerFgBtn: document.getElementById('layer-fg-btn'),
  layerBgBtn: document.getElementById('layer-bg-btn'),
  fgTools: document.getElementById('fg-tools'),
  bgTools: document.getElementById('bg-tools'),
  bgList: document.getElementById('bg-list'),
  bgListEmpty: document.getElementById('bg-list-empty'),
  addSectionInput: document.getElementById('add-section-input'),
  addSectionBtn: document.getElementById('add-section-btn'),
  sectionList: document.getElementById('section-list'),
  exportLevelBtn: document.getElementById('export-level-btn'),
  inspector: document.getElementById('entity-inspector'),
  inspectorTitle: document.getElementById('inspector-title'),
  inspectorFields: document.getElementById('inspector-fields'),
  inspectorDelete: document.getElementById('inspector-delete'),
  inspectorEmptyHint: document.getElementById('inspector-empty-hint'),
  entityList: document.getElementById('entity-list'),
  entityListEmpty: document.getElementById('entity-list-empty'),
  platformList: document.getElementById('platform-list'),
  platformListEmpty: document.getElementById('platform-list-empty'),
  saveSectionBtn: document.getElementById('save-section-btn'),
  loadSectionSelect: document.getElementById('load-section-select'),
  loadSectionBtn: document.getElementById('load-section-btn'),
  deleteSectionBtn: document.getElementById('delete-section-btn'),
  saveLevelBtn: document.getElementById('save-level-btn'),
  loadLevelSelect: document.getElementById('load-level-select'),
  loadLevelBtn: document.getElementById('load-level-btn'),
  deleteLevelBtn: document.getElementById('delete-level-btn'),
  campaignSelect: document.getElementById('campaign-select'),
  campaignNameInput: document.getElementById('campaign-name-input'),
  newCampaignBtn: document.getElementById('new-campaign-btn'),
  deleteCampaignBtn: document.getElementById('delete-campaign-btn'),
  addLevelToCampaignSelect: document.getElementById('add-level-to-campaign-select'),
  addLevelToCampaignBtn: document.getElementById('add-level-to-campaign-btn'),
  campaignLevelList: document.getElementById('campaign-level-list'),
  notifBadge: document.getElementById('notif-badge'),
  notifList: document.getElementById('notif-list'),
  notifEmpty: document.getElementById('notif-empty'),
  langEnBtn: document.getElementById('lang-en-btn'),
  langPtBtn: document.getElementById('lang-pt-btn'),
  uploadAssetLabelBtn: document.getElementById('upload-asset-label-btn'),
  uploadAssetFile: document.getElementById('upload-asset-file'),
  assetListImage: document.getElementById('asset-list-image'),
  assetListImageEmpty: document.getElementById('asset-list-image-empty'),
  assetListAudio: document.getElementById('asset-list-audio'),
  assetListAudioEmpty: document.getElementById('asset-list-audio-empty'),
};

// Keys, not literal strings, so entityLabel() below always reflects the current language
// (unlike a plain lookup object, which would freeze in whatever language was active when
// the module first evaluated).
const ENTITY_LABEL_KEYS = {
  [ENTITY_TYPES.PLAYER_SPAWN]: 'editor.entityLabel.playerSpawn',
  [ENTITY_TYPES.GOAL]: 'editor.entityLabel.goal',
  [ENTITY_TYPES.MOVING_PLATFORM]: 'editor.entityLabel.movingPlatform',
  [ENTITY_TYPES.ENEMY_FALSE_FRIEND]: 'editor.entityLabel.enemyFalseFriend',
  [ENTITY_TYPES.ENEMY_CRAWLER]: 'editor.entityLabel.enemyCrawler',
  [ENTITY_TYPES.ENEMY_VOMIT_SEAGULL]: 'editor.entityLabel.enemyVomitSeagull',
  [ENTITY_TYPES.CHECKPOINT]: 'editor.entityLabel.checkpoint',
};

function entityLabel(type) {
  const key = ENTITY_LABEL_KEYS[type];
  return key ? t(key) : type;
}

const ENTITY_COLORS = {
  [ENTITY_TYPES.PLAYER_SPAWN]: '#7CFC9A',
  [ENTITY_TYPES.GOAL]: '#ffcc33',
  [ENTITY_TYPES.MOVING_PLATFORM]: '#00ccff',
  [ENTITY_TYPES.ENEMY_FALSE_FRIEND]: '#ff8800',
  [ENTITY_TYPES.ENEMY_CRAWLER]: '#44aa44',
  [ENTITY_TYPES.ENEMY_VOMIT_SEAGULL]: '#ffcc00',
  [ENTITY_TYPES.CHECKPOINT]: '#38d9a9',
};

const ENEMY_MARKER_TEXT = {
  [ENTITY_TYPES.ENEMY_FALSE_FRIEND]: 'FF',
  [ENTITY_TYPES.ENEMY_CRAWLER]: 'CR',
  [ENTITY_TYPES.ENEMY_VOMIT_SEAGULL]: 'VS',
};

const ENEMY_MARKER_CLASS = {
  [ENTITY_TYPES.ENEMY_FALSE_FRIEND]: 'enemy-falsefriend',
  [ENTITY_TYPES.ENEMY_CRAWLER]: 'enemy-crawler',
  [ENTITY_TYPES.ENEMY_VOMIT_SEAGULL]: 'enemy-vomitseagull',
};

const DEFAULT_SEGMENT_SPEED = 70;
const DEFAULT_MOVING_PLATFORM_WIDTH_CELLS = 3;
const DEFAULT_MOVING_PLATFORM_HEIGHT_CELLS = 1;
const DEFAULT_MOVING_PLATFORM_COLOR = '#4f7a5c';
const DEFAULT_GROUND_COLOR = '#4a4a5e';
const DEFAULT_HAZARD_COLOR = '#d1495b';
const DEFAULT_BACKGROUND_COLOR = '#2e3a4a';

// Extra single-character slots a section can hand out to its own Ground/Hazard/Background
// variants (see levelFormat.js's tileStyleKind docs): '.', 'G', 'H', 'B' are reserved, so
// this pool is picked from every other easily-typed printable character.
const VARIANT_CHAR_POOL = '123456789abcdefghijklmnopqrstuvwxyzACDEFIJKLMNOPQRSTUVWXYZ'.split('');

// Must match the .cell width/gap in editor.html's CSS: used to place the SVG path
// overlay's points without needing a DOM measurement round-trip.
const CELL_PX = 28;
const GAP_PX = 1;

function makeMovingPlatformEntity(row, col) {
  return {
    type: ENTITY_TYPES.MOVING_PLATFORM,
    widthCells: DEFAULT_MOVING_PLATFORM_WIDTH_CELLS,
    heightCells: DEFAULT_MOVING_PLATFORM_HEIGHT_CELLS,
    color: DEFAULT_MOVING_PLATFORM_COLOR,
    waypoints: [
      { col, row },
      { col: Math.min(state.cols - 1, col + 3), row },
    ],
    speeds: [DEFAULT_SEGMENT_SPEED],
  };
}

function makeEnemyEntity(type, row, col) {
  const entity = { type, col, row };
  if (PATROLLING_ENEMY_TYPES.includes(type)) entity.rangeCols = DEFAULT_ENEMY_RANGE_COLS;
  return entity;
}

function makeBlankState(id, cols, rows) {
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

let state = makeBlankState('new-section', DEFAULT_COLS, DEFAULT_ROWS);
let currentLayer = 'foreground'; // 'foreground' | 'background': which grid painting/tools target
let currentTool = CELL.GROUND;
let isPainting = false;
let paintValue = CELL.GROUND;
let levelSections = [];

// Which category the Tileset panel's dropdown/list is showing: purely a UI preference,
// independent of currentLayer (e.g. you can browse Hazard's tileset while still painting
// Ground). The char currently open in the side-modal editor, or null when it's closed.
let tilesetCategory = 'ground'; // 'ground' | 'hazard' | 'background'
let tilesetModalChar = null;

// Sprite keys available for the "Sprite" appearance mode, fetched once from
// assets/images/platform-textures.json (the editor is plain static JS, not a Phaser
// scene, so it can't use PlatformTextures.js's loader: a plain fetch does the same job).
let textureKeys = [];
fetch('assets/images/platform-textures.json')
  .then((res) => res.json())
  .then((manifest) => {
    textureKeys = Object.keys(manifest);
    renderTilesetFields();
    renderInspector();
  })
  .catch(() => {});

// Unified selection for the right sidebar's shared inspector:
// { kind: 'entity', index } for a placed entity, or
// { kind: 'platform', row, startCol, colSpan, type } for a merged tile run.
let selection = null;

// Set while a "Reposition" button on a moving platform's waypoint is armed: the next
// grid click sets that waypoint's position instead of painting/placing/selecting.
let placingWaypoint = null; // { entityIndex, waypointIndex } | null

// --- Tile variants ---
//
// A section's tileStyles isn't limited to the three base characters (G/H/B): "+ Add
// variant" hands out one more character from VARIANT_CHAR_POOL, so e.g. a section can
// paint two visually distinct Ground brushes ('G' and, say, '1') that both behave as
// solid ground (see levelFormat.js's tileStyleKind). Foreground variants carry an
// explicit `kind` ('ground'/'hazard'); background variants don't need one: everything
// in bgGrid is decorative by construction.

/** Every non-base character whose tileStyleKind resolves to `kind`, in creation order. */
function variantCharsOfKind(kind) {
  return Object.keys(state.tileStyles).filter(
    (c) => c !== CELL.GROUND && c !== CELL.HAZARD && c !== CELL.BACKGROUND && tileStyleKind(c, state.tileStyles) === kind
  );
}

/** Display label for any foreground/background character, base or variant: "Ground",
 * "Ground 2", "Hazard 3", "Background 2", etc. */
function styleLabel(char) {
  if (char === CELL.GROUND) return t('editor.style.ground');
  if (char === CELL.HAZARD) return t('editor.style.hazard');
  if (char === CELL.BACKGROUND) return t('editor.style.background');
  const kind = tileStyleKind(char, state.tileStyles);
  const kindLabel = kind === 'hazard' ? t('editor.style.hazard') : kind === 'background' ? t('editor.style.background') : t('editor.style.ground');
  const idx = variantCharsOfKind(kind).indexOf(char);
  return `${kindLabel} ${idx + 2}`; // base itself is implicitly "1"
}

/** Swatch color for any foreground/background character: used by tool buttons, the
 * Platforms/Background lists, and cell fill color. Sprite-only variants (no `color` set)
 * fall back to a neutral placeholder since the editor can't preview actual sprite pixels. */
function cellSwatchColor(char) {
  if (char === CELL.EMPTY) return '';
  const style = state.tileStyles[char];
  if (!style) return '#888';
  return style.color || '#57607a';
}

function nextVariantChar() {
  const used = new Set(Object.keys(state.tileStyles));
  return VARIANT_CHAR_POOL.find((c) => !used.has(c)) || null;
}

function addVariant(kind) {
  const char = nextVariantChar();
  if (!char) {
    alert(t('editor.alert.noVariantSlots'));
    return;
  }
  const defaultColor =
    kind === 'hazard' ? DEFAULT_HAZARD_COLOR : kind === 'background' ? DEFAULT_BACKGROUND_COLOR : DEFAULT_GROUND_COLOR;
  state.tileStyles[char] = kind === 'background' ? { color: defaultColor } : { kind, color: defaultColor };
  renderTilesetFields();
  renderFgToolButtons();
  renderBgToolButtons();
  syncPreview();
  openTilesetModal(char);
}

/** Deletes a variant and clears any cells painted with it back to empty: a dangling
 * character with no tileStyles entry would otherwise render with the '#888' fallback and
 * silently break re-export/re-import round-tripping. */
function removeVariant(char) {
  if (char === CELL.GROUND || char === CELL.HAZARD || char === CELL.BACKGROUND) return;
  if (!confirm(t('editor.confirm.removeVariant'))) return;
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (state.grid[r][c] === char) state.grid[r][c] = CELL.EMPTY;
      if (state.bgGrid[r][c] === char) state.bgGrid[r][c] = CELL.EMPTY;
    }
  }
  delete state.tileStyles[char];
  if (currentTool === char) currentTool = currentLayer === 'background' ? CELL.BACKGROUND : CELL.GROUND;
  renderGrid();
  renderTilesetFields();
  renderFgToolButtons();
  renderBgToolButtons();
  refreshPlatformSelection();
  refreshBgSelection();
  afterSelectionChange();
  syncPreview();
}

// --- Rendering ---

function renderGrid() {
  els.grid.innerHTML = '';
  els.grid.style.gridTemplateColumns = `repeat(${state.cols}, 28px)`;
  els.grid.style.gridTemplateRows = `repeat(${state.rows}, 28px)`;

  const lastRow = groundRow(state.rows);
  for (let row = 0; row < state.rows; row++) {
    for (let col = 0; col < state.cols; col++) {
      const cell = document.createElement('div');
      cell.className = 'cell' + (row === lastRow ? ' ground-row' : '');
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.addEventListener('mousedown', onCellMouseDown);
      cell.addEventListener('mouseenter', onCellMouseEnter);
      els.grid.appendChild(cell);
      updateCellVisual(row, col);
    }
  }
  renderMarkersAndHighlight();
}

const TILESET_BASE_CHAR = { ground: CELL.GROUND, hazard: CELL.HAZARD, background: CELL.BACKGROUND };
const TILESET_DEFAULT_COLOR = { ground: DEFAULT_GROUND_COLOR, hazard: DEFAULT_HAZARD_COLOR, background: DEFAULT_BACKGROUND_COLOR };

/**
 * Renders the Tileset panel's type list for whichever category (Ground/Hazard/Background)
 * the dropdown is currently set to: the base type plus any of that kind's variants (see
 * the "Tile variants" section above), each a clickable row that opens the side-modal
 * editor (see openTilesetModal) rather than expanding inline.
 */
function renderTilesetTypeList() {
  els.tilesetCategorySelect.value = tilesetCategory;
  els.tilesetTypeList.innerHTML = '';
  const baseChar = TILESET_BASE_CHAR[tilesetCategory];
  const chars = [baseChar, ...variantCharsOfKind(tilesetCategory)];

  chars.forEach((char) => {
    const li = document.createElement('li');
    li.className = 'obj-item tileset-row';

    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = cellSwatchColor(char);

    const label = document.createElement('span');
    label.className = 'obj-item-label';
    label.textContent = styleLabel(char);

    li.append(swatch, label);
    if (state.tileStyles[char] && state.tileStyles[char].texture) {
      const badge = document.createElement('span');
      badge.className = 'sprite-badge';
      badge.textContent = t('editor.tileset.spriteBadge');
      li.appendChild(badge);
    }
    li.addEventListener('click', () => openTilesetModal(char));
    els.tilesetTypeList.appendChild(li);
  });
}

/** Thin wrapper kept so existing call sites (loadState, addVariant, removeVariant, import)
 * don't need to know about the list/modal split: also closes the side-modal if it was
 * open for a character that no longer exists in the (possibly just-reloaded) state. */
function renderTilesetFields() {
  renderTilesetTypeList();
  if (tilesetModalChar && !state.tileStyles[tilesetModalChar]) closeTilesetModal();
}

/** Opens the side-modal editor for `char`'s appearance (see editor.html's .side-modal):
 * used both right after "+ Add variant" creates a new type and when clicking an existing
 * row in the Tileset list. */
function openTilesetModal(char) {
  tilesetModalChar = char;
  const isBase = char === CELL.GROUND || char === CELL.HAZARD || char === CELL.BACKGROUND;
  els.tilesetModalTitle.textContent = styleLabel(char);
  els.tilesetModalBody.innerHTML = '';

  addAppearanceField(
    els.tilesetModalBody,
    t('editor.inspector.appearance'),
    state.tileStyles[char],
    TILESET_DEFAULT_COLOR[tilesetCategory],
    () => {
      syncPreview();
      refreshGridColors();
      renderFgToolButtons();
      renderBgToolButtons();
      renderTilesetTypeList();
    },
    () => openTilesetModal(char) // re-render the modal body in place after a Color/Sprite mode switch
  );

  if (!isBase) {
    const removeBtn = document.createElement('button');
    removeBtn.textContent = t('editor.tileset.removeVariantBtn');
    removeBtn.className = 'danger';
    removeBtn.style.width = '100%';
    removeBtn.style.marginTop = '14px';
    // removeVariant() re-renders the list and (via renderTilesetFields' check above)
    // closes this modal itself once the char is actually gone: but confirm() inside it
    // may be cancelled, so this must NOT unconditionally close the modal here too.
    removeBtn.addEventListener('click', () => removeVariant(char));
    els.tilesetModalBody.appendChild(removeBtn);
  }

  els.tilesetModalBackdrop.classList.remove('hidden');
  els.tilesetModal.classList.add('open');
}

function closeTilesetModal() {
  tilesetModalChar = null;
  els.tilesetModalBackdrop.classList.add('hidden');
  els.tilesetModal.classList.remove('open');
}

els.tilesetCategorySelect.addEventListener('change', () => {
  tilesetCategory = els.tilesetCategorySelect.value;
  renderTilesetTypeList();
});
els.tilesetAddBtn.addEventListener('click', () => addVariant(tilesetCategory));
els.tilesetModalClose.addEventListener('click', closeTilesetModal);
els.tilesetModalBackdrop.addEventListener('click', closeTilesetModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && tilesetModalChar) closeTilesetModal();
});

function cellEl(row, col) {
  return els.grid.children[row * state.cols + col];
}

function updateCellVisual(row, col) {
  const cell = cellEl(row, col);
  if (!cell) return;
  const fgChar = state.grid[row][col];
  const bgChar = state.bgGrid[row][col];
  cell.dataset.type = fgChar;
  cell.dataset.bgtype = bgChar;
  cell.style.background = cellSwatchColor(fgChar) || cellSwatchColor(bgChar) || '';
  cell.classList.toggle('has-bg-under-fg', fgChar !== CELL.EMPTY && bgChar !== CELL.EMPTY);
}

/** Re-applies every cell's fill color: needed after a tileStyles color/texture edit,
 * since already-painted cells otherwise keep showing their old color. */
function refreshGridColors() {
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) updateCellVisual(r, c);
  }
}

function renderMarkersAndHighlight() {
  els.grid.querySelectorAll('.cell').forEach((cell) => {
    cell.style.outline = '';
    cell.style.outlineOffset = '';
  });
  els.grid.querySelectorAll('.entity-marker').forEach((el) => el.remove());

  const outline = (cell, color) => {
    if (!cell) return;
    cell.style.outline = `2px solid ${color}`;
    cell.style.outlineOffset = '-2px';
  };

  state.entities.forEach((entity, idx) => {
    const isSelected = selection && selection.kind === 'entity' && selection.index === idx;

    if (entity.type === ENTITY_TYPES.MOVING_PLATFORM) {
      entity.waypoints.forEach((wp, wpIdx) => {
        const cell = cellEl(wp.row, wp.col);
        if (!cell) return;
        const marker = document.createElement('div');
        marker.className = 'entity-marker moving';
        marker.textContent = String(wpIdx + 1);
        cell.appendChild(marker);

        const isArmed =
          placingWaypoint && placingWaypoint.entityIndex === idx && placingWaypoint.waypointIndex === wpIdx;
        if (isArmed) outline(cell, '#7CFC9A');
        else if (isSelected) outline(cell, '#fff');
      });
      return;
    }

    const cell = cellEl(entity.row, entity.col);
    if (!cell) return;
    const marker = document.createElement('div');
    if (entity.type === ENTITY_TYPES.PLAYER_SPAWN) {
      marker.className = 'entity-marker spawn';
      marker.textContent = 'S';
    } else if (entity.type === ENTITY_TYPES.GOAL) {
      marker.className = 'entity-marker goal';
      marker.textContent = 'F';
    } else if (entity.type === ENTITY_TYPES.CHECKPOINT) {
      marker.className = 'entity-marker checkpoint';
      marker.textContent = 'C';
    } else if (ENEMY_MARKER_CLASS[entity.type]) {
      marker.className = `entity-marker ${ENEMY_MARKER_CLASS[entity.type]}`;
      marker.textContent = ENEMY_MARKER_TEXT[entity.type];
    }
    cell.appendChild(marker);
    if (isSelected) outline(cell, '#fff');
  });

  if (selection && (selection.kind === 'platform' || selection.kind === 'bgplatform')) {
    for (let c = selection.startCol; c < selection.startCol + selection.colSpan; c++) {
      outline(cellEl(selection.row, c), '#fff');
    }
  }

  renderPathOverlay();
}

function cellCenterPx(row, col) {
  return {
    x: col * (CELL_PX + GAP_PX) + CELL_PX / 2,
    y: row * (CELL_PX + GAP_PX) + CELL_PX / 2,
  };
}

/** Draws a connecting line between each moving platform's waypoints, in path order. */
function renderPathOverlay() {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let svg = document.getElementById('path-overlay');
  if (!svg) {
    svg = document.createElementNS(SVG_NS, 'svg');
    svg.id = 'path-overlay';
    els.grid.appendChild(svg);
  }
  svg.innerHTML = '';
  svg.setAttribute('width', state.cols * (CELL_PX + GAP_PX));
  svg.setAttribute('height', state.rows * (CELL_PX + GAP_PX));

  state.entities.forEach((entity, idx) => {
    if (entity.type !== ENTITY_TYPES.MOVING_PLATFORM || entity.waypoints.length < 2) return;
    const isSelected = selection && selection.kind === 'entity' && selection.index === idx;
    const points = entity.waypoints.map((wp) => {
      const c = cellCenterPx(wp.row, wp.col);
      return `${c.x},${c.y}`;
    });

    const polyline = document.createElementNS(SVG_NS, 'polyline');
    polyline.setAttribute('points', points.join(' '));
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', isSelected ? '#00ccff' : 'rgba(0, 204, 255, 0.35)');
    polyline.setAttribute('stroke-width', isSelected ? '2.5' : '1.5');
    if (!isSelected) polyline.setAttribute('stroke-dasharray', '4 3');
    svg.appendChild(polyline);
  });
}

/** Every contiguous same-type run in the grid, i.e. what the game renders as one platform tile. */
function getPlatformRuns() {
  const runs = [];
  for (let row = 0; row < state.rows; row++) {
    for (const run of mergeRowRuns(state.grid[row].join(''))) {
      runs.push({ row, startCol: run.startCol, colSpan: run.colSpan, type: run.type });
    }
  }
  return runs;
}

/** Re-locate the selected platform run after a grid edit (it may have grown/shrunk/merged/vanished). */
function refreshPlatformSelection() {
  if (!selection || selection.kind !== 'platform') return;
  const match = getPlatformRuns().find(
    (r) => r.row === selection.row && selection.startCol >= r.startCol && selection.startCol < r.startCol + r.colSpan
  );
  selection = match ? { kind: 'platform', ...match } : null;
}

/** Every contiguous background-tile run: the decorative-layer equivalent of getPlatformRuns. */
function getBgRuns() {
  const runs = [];
  for (let row = 0; row < state.rows; row++) {
    for (const run of mergeRowRuns(state.bgGrid[row].join(''))) {
      runs.push({ row, startCol: run.startCol, colSpan: run.colSpan, type: run.type });
    }
  }
  return runs;
}

/** Re-locate the selected background run after a grid edit, mirroring refreshPlatformSelection. */
function refreshBgSelection() {
  if (!selection || selection.kind !== 'bgplatform') return;
  const match = getBgRuns().find(
    (r) => r.row === selection.row && selection.startCol >= r.startCol && selection.startCol < r.startCol + r.colSpan
  );
  selection = match ? { kind: 'bgplatform', ...match } : null;
}

// --- Selection / inspector ---

function selectEntity(idx) {
  placingWaypoint = null;
  selection = { kind: 'entity', index: idx };
  afterSelectionChange();
}

function selectPlatform(run) {
  placingWaypoint = null;
  selection = { kind: 'platform', ...run };
  afterSelectionChange();
}

function selectBgPlatform(run) {
  placingWaypoint = null;
  selection = { kind: 'bgplatform', ...run };
  afterSelectionChange();
}

function armWaypointPlacement(entityIndex, waypointIndex) {
  const alreadyArmed =
    placingWaypoint && placingWaypoint.entityIndex === entityIndex && placingWaypoint.waypointIndex === waypointIndex;
  placingWaypoint = alreadyArmed ? null : { entityIndex, waypointIndex };
  renderMarkersAndHighlight();
  renderInspector();
}

function setWaypointFromClick(row, col) {
  const { entityIndex, waypointIndex } = placingWaypoint;
  const entity = state.entities[entityIndex];
  if (entity && entity.waypoints[waypointIndex]) {
    entity.waypoints[waypointIndex] = { col, row };
  }
  placingWaypoint = null;
  renderMarkersAndHighlight();
  renderEntityList();
  renderInspector();
  syncPreview();
}

function addMidpoint(entityIndex) {
  const entity = state.entities[entityIndex];
  if (!entity) return;
  const wps = entity.waypoints;
  const insertAt = wps.length - 1; // right before the End waypoint
  const prev = wps[insertAt - 1];
  const next = wps[insertAt];
  wps.splice(insertAt, 0, {
    col: Math.round((prev.col + next.col) / 2),
    row: Math.round((prev.row + next.row) / 2),
  });
  // Splitting the old last segment into two -> both new segments inherit its speed.
  entity.speeds.splice(insertAt, 0, entity.speeds[insertAt - 1]);
  afterSelectionChange();
  syncPreview();
}

function removeMidpoint(entityIndex, waypointIndex) {
  const entity = state.entities[entityIndex];
  if (!entity) return;
  entity.waypoints.splice(waypointIndex, 1);
  // The two segments touching this waypoint merge into one -> drop one speed entry.
  entity.speeds.splice(Math.max(0, waypointIndex - 1), 1);
  if (placingWaypoint && placingWaypoint.entityIndex === entityIndex) placingWaypoint = null;
  afterSelectionChange();
  syncPreview();
}

function afterSelectionChange() {
  renderMarkersAndHighlight();
  renderEntityList();
  renderPlatformList();
  renderBgList();
  renderInspector();
}

function addFieldRow(container, labelText, inputEl) {
  const row = document.createElement('div');
  row.className = 'field-row';
  const label = document.createElement('label');
  label.textContent = labelText;
  row.append(label, inputEl);
  container.appendChild(row);
  return row;
}

function addReadonlyField(container, labelText, text) {
  const box = document.createElement('div');
  box.className = 'field-readonly';
  box.textContent = text;
  addFieldRow(container, labelText, box);
}

function addNumberField(container, labelText, value, onChange) {
  const input = document.createElement('input');
  input.type = 'number';
  input.value = value;
  input.addEventListener('input', () => onChange(Number(input.value) || 0));
  addFieldRow(container, labelText, input);
}

function addWaypointsField(container, entityIndex, entity) {
  const wrap = document.createElement('div');
  wrap.className = 'field-row';
  const label = document.createElement('label');
  label.textContent = t('editor.inspector.waypoints');
  wrap.appendChild(label);

  const lastIdx = entity.waypoints.length - 1;
  entity.waypoints.forEach((wp, wpIdx) => {
    const row = document.createElement('div');
    row.className = 'waypoint-row';

    const tag = document.createElement('span');
    tag.className = 'wp-label';
    tag.textContent = wpIdx === 0 ? t('editor.waypoint.start') : wpIdx === lastIdx ? t('editor.waypoint.end') : `${t('editor.waypoint.mid')} ${wpIdx}`;

    const pos = document.createElement('span');
    pos.className = 'wp-pos';
    pos.textContent = `${t('editor.pos.col')} ${wp.col}, ${t('editor.pos.row')} ${wp.row}`;

    const isArmed =
      placingWaypoint && placingWaypoint.entityIndex === entityIndex && placingWaypoint.waypointIndex === wpIdx;
    const placeBtn = document.createElement('button');
    placeBtn.textContent = isArmed ? t('editor.inspector.clickGridBtn') : t('editor.inspector.repositionBtn');
    placeBtn.className = isArmed ? 'armed' : '';
    placeBtn.addEventListener('click', () => armWaypointPlacement(entityIndex, wpIdx));

    row.append(tag, pos, placeBtn);

    if (wpIdx !== 0 && wpIdx !== lastIdx) {
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => removeMidpoint(entityIndex, wpIdx));
      row.appendChild(removeBtn);
    }

    wrap.appendChild(row);
  });

  const addBtn = document.createElement('button');
  addBtn.textContent = t('editor.inspector.addMidpointBtn');
  addBtn.style.width = '100%';
  addBtn.style.marginTop = '2px';
  addBtn.addEventListener('click', () => addMidpoint(entityIndex));
  wrap.appendChild(addBtn);

  container.appendChild(wrap);
}

function addSegmentSpeedsField(container, entity) {
  const wrap = document.createElement('div');
  wrap.className = 'field-row';
  const label = document.createElement('label');
  label.textContent = t('editor.inspector.segmentSpeeds');
  wrap.appendChild(label);

  entity.speeds.forEach((speed, segIdx) => {
    const row = document.createElement('div');
    row.className = 'segment-speed-row';

    const tag = document.createElement('span');
    tag.className = 'seg-label';
    tag.textContent = `${segIdx + 1} → ${segIdx + 2}`;

    const input = document.createElement('input');
    input.type = 'number';
    input.value = speed;
    input.addEventListener('input', () => {
      entity.speeds[segIdx] = Number(input.value) || 0;
      syncPreview();
    });

    row.append(tag, input);
    wrap.appendChild(row);
  });

  container.appendChild(wrap);
}

/** Lets a selected platform/background run be repainted with any Ground/Hazard variant
 * (or, on the background layer, any Background variant): the run-level equivalent of
 * picking a tool brush, for reassigning an already-placed run's look after the fact. */
function addVariantPickerField(container, labelText, currentType, kinds) {
  const wrap = document.createElement('div');
  wrap.className = 'variant-picker';
  const chars = kinds.flatMap((kind) => {
    const base = kind === 'hazard' ? CELL.HAZARD : kind === 'background' ? CELL.BACKGROUND : CELL.GROUND;
    return [base, ...variantCharsOfKind(kind)];
  });
  chars.forEach((char) => {
    const btn = document.createElement('button');
    btn.className = 'tool-btn' + (char === currentType ? ' active' : '');
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = cellSwatchColor(char);
    btn.append(swatch, document.createTextNode(styleLabel(char)));
    btn.addEventListener('click', () => setSelectedPlatformType(char));
    wrap.appendChild(btn);
  });
  addFieldRow(container, labelText, wrap);
}

function setSelectedPlatformType(newType) {
  if (!selection || (selection.kind !== 'platform' && selection.kind !== 'bgplatform')) return;
  const targetGrid = selection.kind === 'bgplatform' ? state.bgGrid : state.grid;
  for (let c = selection.startCol; c < selection.startCol + selection.colSpan; c++) {
    targetGrid[selection.row][c] = newType;
    updateCellVisual(selection.row, c);
  }
  refreshPlatformSelection();
  refreshBgSelection();
  afterSelectionChange();
  syncPreview();
}

/**
 * A Color/Sprite appearance picker bound to `obj` (a moving platform entity, or one of the
 * current section's tileStyles entries: anything shaped `{ color, texture }`). Switching
 * mode deletes the other field, so exported JSON never carries both at once: texture
 * always wins over color at runtime (see levelFormat.js) so a stale leftover would
 * otherwise silently do nothing.
 */
function addAppearanceField(container, labelText, obj, defaultColor, onValueChange, rerender) {
  const wrap = document.createElement('div');
  wrap.className = 'field-row';
  const label = document.createElement('label');
  label.textContent = labelText;
  wrap.appendChild(label);

  const mode = obj.texture ? 'sprite' : 'color';

  const toggle = document.createElement('div');
  toggle.className = 'type-toggle';
  const makeModeBtn = (targetMode, text) => {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.className = mode === targetMode ? 'primary' : '';
    btn.addEventListener('click', () => {
      if (mode === targetMode) return;
      if (targetMode === 'color') {
        delete obj.texture;
        delete obj.tileMode;
        obj.color = obj.color || defaultColor;
      } else {
        delete obj.color;
        obj.texture = textureKeys[0] || '';
      }
      onValueChange();
      rerender();
    });
    return btn;
  };
  toggle.append(makeModeBtn('color', t('editor.appearance.color')), makeModeBtn('sprite', t('editor.appearance.sprite')));
  wrap.appendChild(toggle);

  if (mode === 'color') {
    const input = document.createElement('input');
    input.type = 'color';
    input.value = obj.color || defaultColor;
    input.addEventListener('input', () => {
      obj.color = input.value;
      onValueChange();
    });
    wrap.appendChild(input);
  } else if (textureKeys.length) {
    const select = document.createElement('select');
    textureKeys.forEach((key) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = key;
      if (obj.texture === key) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => {
      obj.texture = select.value;
      onValueChange();
    });
    wrap.appendChild(select);
  } else {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.style.marginTop = '6px';
    hint.textContent = t('editor.hint.noSpriteTextures');
    wrap.appendChild(hint);
  }

  if (mode === 'sprite') addTileModeField(wrap, obj, onValueChange, rerender);

  container.appendChild(wrap);
}

const TILE_MODE_LABEL_KEYS = { stretch: 'editor.tileMode.stretch', repeat: 'editor.tileMode.repeat', maximise: 'editor.tileMode.maximise' };
const TILE_MODE_HINT_KEYS = { stretch: 'editor.tileMode.stretchHint', repeat: 'editor.tileMode.repeatHint', maximise: 'editor.tileMode.maximiseHint' };

/** Sprite-only tiling mode picker (Stretch/Repeat/Maximise: see levelFormat.js's
 * decomposeMaximizedRegions for what Maximise actually does). Not shown for Color
 * appearances, which have no texture to stretch/repeat/decompose. Undefined/missing
 * `tileMode` means 'stretch' (today's only behavior, so old sections need no migration);
 * that default is left unwritten rather than stamped in, matching how e.g. a moving
 * platform's speeds/cell-span fall back silently elsewhere in this format. */
function addTileModeField(container, obj, onValueChange, rerender) {
  const currentMode = obj.tileMode || 'stretch';
  const wrap = document.createElement('div');
  wrap.className = 'field-row';
  const label = document.createElement('label');
  label.textContent = t('editor.inspector.tilingLabel');
  wrap.appendChild(label);

  const toggle = document.createElement('div');
  toggle.className = 'type-toggle';
  ['stretch', 'repeat', 'maximise'].forEach((mode) => {
    const btn = document.createElement('button');
    btn.textContent = t(TILE_MODE_LABEL_KEYS[mode]);
    btn.className = mode === currentMode ? 'primary' : '';
    btn.addEventListener('click', () => {
      if (mode === 'stretch') delete obj.tileMode;
      else obj.tileMode = mode;
      onValueChange();
      rerender();
    });
    toggle.appendChild(btn);
  });
  wrap.appendChild(toggle);

  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.style.marginTop = '6px';
  hint.textContent = t(TILE_MODE_HINT_KEYS[currentMode]);
  wrap.appendChild(hint);

  container.appendChild(wrap);
}

function renderInspector() {
  if (!selection) {
    els.inspector.classList.add('hidden');
    els.inspectorEmptyHint.classList.remove('hidden');
    els.inspectorFields.innerHTML = '';
    return;
  }

  if (selection.kind === 'entity' && !state.entities[selection.index]) {
    selection = null;
    return renderInspector();
  }

  els.inspectorEmptyHint.classList.add('hidden');
  els.inspector.classList.remove('hidden');
  els.inspectorFields.innerHTML = '';

  if (selection.kind === 'entity') {
    const entity = state.entities[selection.index];
    els.inspectorTitle.textContent = entityLabel(entity.type);

    if (entity.type === ENTITY_TYPES.MOVING_PLATFORM) {
      addNumberField(els.inspectorFields, t('editor.inspector.widthCells'), entity.widthCells, (v) => {
        entity.widthCells = v;
        syncPreview();
      });
      addNumberField(els.inspectorFields, t('editor.inspector.heightCells'), entity.heightCells || 1, (v) => {
        entity.heightCells = v;
        syncPreview();
      });
      addAppearanceField(
        els.inspectorFields,
        t('editor.inspector.appearance'),
        entity,
        DEFAULT_MOVING_PLATFORM_COLOR,
        syncPreview,
        renderInspector
      );
      addWaypointsField(els.inspectorFields, selection.index, entity);
      addSegmentSpeedsField(els.inspectorFields, entity);
      if (placingWaypoint && placingWaypoint.entityIndex === selection.index) {
        const hint = document.createElement('div');
        hint.className = 'placement-hint';
        hint.textContent = t('editor.inspector.placementHint');
        els.inspectorFields.appendChild(hint);
      }
    } else {
      addReadonlyField(els.inspectorFields, t('editor.inspector.position'), `${t('editor.pos.col')} ${entity.col}, ${t('editor.pos.row')} ${entity.row}`);
      if (PATROLLING_ENEMY_TYPES.includes(entity.type)) {
        addNumberField(els.inspectorFields, t('editor.inspector.patrolRange'), entity.rangeCols, (v) => {
          entity.rangeCols = v;
          syncPreview();
        });
      }
    }
  } else if (selection.kind === 'bgplatform') {
    els.inspectorTitle.textContent = styleLabel(selection.type);
    const lastCol = selection.startCol + selection.colSpan - 1;
    addReadonlyField(
      els.inspectorFields,
      t('editor.inspector.position'),
      `${t('editor.pos.row')} ${selection.row}, ${t('editor.pos.cols')} ${selection.startCol}-${lastCol} (${selection.colSpan} ${t('editor.pos.cells')})`
    );
    addVariantPickerField(els.inspectorFields, t('editor.inspector.type'), selection.type, ['background']);
  } else {
    els.inspectorTitle.textContent = styleLabel(selection.type);
    const lastCol = selection.startCol + selection.colSpan - 1;
    addReadonlyField(
      els.inspectorFields,
      t('editor.inspector.position'),
      `${t('editor.pos.row')} ${selection.row}, ${t('editor.pos.cols')} ${selection.startCol}-${lastCol} (${selection.colSpan} ${t('editor.pos.cells')})`
    );
    addVariantPickerField(els.inspectorFields, t('editor.inspector.type'), selection.type, ['ground', 'hazard']);
  }
}

els.inspectorDelete.addEventListener('click', () => {
  if (!selection) return;
  placingWaypoint = null;
  if (selection.kind === 'entity') {
    state.entities.splice(selection.index, 1);
  } else if (selection.kind === 'bgplatform') {
    for (let c = selection.startCol; c < selection.startCol + selection.colSpan; c++) {
      state.bgGrid[selection.row][c] = CELL.EMPTY;
      updateCellVisual(selection.row, c);
    }
  } else {
    for (let c = selection.startCol; c < selection.startCol + selection.colSpan; c++) {
      state.grid[selection.row][c] = CELL.EMPTY;
      updateCellVisual(selection.row, c);
    }
  }
  selection = null;
  afterSelectionChange();
  syncPreview();
});

// --- Entity / platform lists ---

function renderEntityList() {
  els.entityList.innerHTML = '';
  state.entities.forEach((entity, idx) => {
    const li = document.createElement('li');
    li.className = 'obj-item' + (selection && selection.kind === 'entity' && selection.index === idx ? ' selected' : '');

    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = ENTITY_COLORS[entity.type] || '#888';

    const label = document.createElement('span');
    label.className = 'obj-item-label';
    label.textContent =
      entity.type === ENTITY_TYPES.MOVING_PLATFORM
        ? `${entityLabel(ENTITY_TYPES.MOVING_PLATFORM)}: ${entity.waypoints.length} ${t('editor.entityList.waypointsSuffix')}`
        : `${entityLabel(entity.type)}: ${t('editor.pos.col')} ${entity.col}, ${t('editor.pos.row')} ${entity.row}`;

    li.append(swatch, label);
    li.addEventListener('click', () => selectEntity(idx));
    els.entityList.appendChild(li);
  });
  els.entityListEmpty.classList.toggle('hidden', state.entities.length > 0);
}

function renderPlatformList() {
  els.platformList.innerHTML = '';
  const runs = getPlatformRuns();
  runs.forEach((run) => {
    const li = document.createElement('li');
    const isSelected =
      selection && selection.kind === 'platform' && selection.row === run.row && selection.startCol === run.startCol;
    li.className = 'obj-item' + (isSelected ? ' selected' : '');

    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = cellSwatchColor(run.type);

    const label = document.createElement('span');
    label.className = 'obj-item-label';
    label.textContent = `${styleLabel(run.type)}: ${t('editor.pos.row')} ${run.row}, ${t('editor.pos.cols')} ${run.startCol}-${run.startCol + run.colSpan - 1}`;

    li.append(swatch, label);
    li.addEventListener('click', () => selectPlatform(run));
    els.platformList.appendChild(li);
  });
  els.platformListEmpty.classList.toggle('hidden', runs.length > 0);
}

function renderBgList() {
  els.bgList.innerHTML = '';
  const runs = getBgRuns();
  runs.forEach((run) => {
    const li = document.createElement('li');
    const isSelected =
      selection && selection.kind === 'bgplatform' && selection.row === run.row && selection.startCol === run.startCol;
    li.className = 'obj-item' + (isSelected ? ' selected' : '');

    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = cellSwatchColor(run.type);

    const label = document.createElement('span');
    label.className = 'obj-item-label';
    label.textContent = `${styleLabel(run.type)}: ${t('editor.pos.row')} ${run.row}, ${t('editor.pos.cols')} ${run.startCol}-${run.startCol + run.colSpan - 1}`;

    li.append(swatch, label);
    li.addEventListener('click', () => selectBgPlatform(run));
    els.bgList.appendChild(li);
  });
  els.bgListEmpty.classList.toggle('hidden', runs.length > 0);
}

function exportSection() {
  return {
    id: state.id,
    cols: state.cols,
    rows: state.rows,
    grid: state.grid.map((row) => row.join('')),
    bgGrid: state.bgGrid.map((row) => row.join('')),
    entities: state.entities,
    tileStyles: state.tileStyles,
  };
}

function syncPreview() {
  els.jsonPreview.value = JSON.stringify(exportSection(), null, 2);
}

// --- Painting ---

/** Hit-tests a cell against every placed entity: moving platforms match any of their waypoints. */
function findEntityAtCell(row, col) {
  return state.entities.findIndex((en) => {
    if (en.type === ENTITY_TYPES.MOVING_PLATFORM) {
      return en.waypoints.some((wp) => wp.row === row && wp.col === col);
    }
    return en.row === row && en.col === col;
  });
}

function onCellMouseDown(e) {
  const row = Number(e.currentTarget.dataset.row);
  const col = Number(e.currentTarget.dataset.col);

  // A waypoint "Reposition" button is armed: this click sets its position and takes
  // priority over painting/placing/selecting, regardless of which left-sidebar tool is active.
  if (placingWaypoint) {
    setWaypointFromClick(row, col);
    return;
  }

  // Background layer only ever paints (Background/Eraser/variants): no entities: so it
  // can't fall through to the entity-placement logic below.
  if (currentLayer === 'background') {
    isPainting = true;
    paintValue = currentTool;
    paintCell(row, col);
    return;
  }

  // Paint tools are single-char cell types (Ground/Hazard/Eraser and any variant: see the
  // "Tile variants" section above); entity tools are the longer ENTITY_TYPES strings
  // ('playerSpawn', 'movingPlatform', ...), so length alone tells them apart.
  if (currentTool.length === 1) {
    isPainting = true;
    paintValue = currentTool;
    paintCell(row, col);
    return;
  }

  // Entity tools: clicking an already-placed entity selects it for editing instead of
  // re-placing/removing it, so its custom settings can be edited in the inspector.
  const existingIdx = findEntityAtCell(row, col);
  if (existingIdx !== -1) {
    selectEntity(existingIdx);
    return;
  }
  placeEntity(row, col);
}

function onCellMouseEnter(e) {
  if (!isPainting) return;
  paintCell(Number(e.currentTarget.dataset.row), Number(e.currentTarget.dataset.col));
}

function paintCell(row, col) {
  if (currentLayer === 'background') {
    state.bgGrid[row][col] = paintValue;
  } else {
    state.grid[row][col] = paintValue;
  }
  updateCellVisual(row, col);
  refreshPlatformSelection();
  refreshBgSelection();
  renderMarkersAndHighlight();
  renderPlatformList();
  renderBgList();
  renderInspector();
  syncPreview();
}

document.addEventListener('mouseup', () => {
  isPainting = false;
});

const ENEMY_TOOL_TYPES = [
  ENTITY_TYPES.ENEMY_FALSE_FRIEND,
  ENTITY_TYPES.ENEMY_CRAWLER,
  ENTITY_TYPES.ENEMY_VOMIT_SEAGULL,
];

function placeEntity(row, col) {
  if (currentTool === ENTITY_TYPES.PLAYER_SPAWN || currentTool === ENTITY_TYPES.GOAL) {
    state.entities = state.entities.filter((e) => e.type !== currentTool);
    state.entities.push({ type: currentTool, col, row });
  } else if (currentTool === ENTITY_TYPES.MOVING_PLATFORM) {
    state.entities.push(makeMovingPlatformEntity(row, col));
  } else if (ENEMY_TOOL_TYPES.includes(currentTool)) {
    state.entities.push(makeEnemyEntity(currentTool, row, col));
  } else if (currentTool === ENTITY_TYPES.CHECKPOINT) {
    state.entities.push({ type: currentTool, col, row });
  } else {
    return;
  }
  selectEntity(state.entities.length - 1);
  syncPreview();
}

// --- Toolbar ---
//
// Tool buttons (paint brushes in #fg-tool-grid/#bg-tool-grid, entity tabs in #tab-entities)
// are handled by one delegated listener rather than per-button
// listeners, since the brush buttons are regenerated whenever a variant is added/removed
// (see renderFgToolButtons/renderBgToolButtons) and per-button listeners would need
// re-wiring on every regeneration.
document.getElementById('sidebar').addEventListener('click', (e) => {
  const btn = e.target.closest('.tool-btn');
  if (!btn || !btn.dataset.tool) return;
  currentTool = btn.dataset.tool;
  syncToolButtonActive();
});

function syncToolButtonActive() {
  document.querySelectorAll('.tool-btn').forEach((b) => b.classList.toggle('active', b.dataset.tool === currentTool));
}

function makeToolButton(char, label, color) {
  const btn = document.createElement('button');
  btn.className = 'tool-btn';
  btn.dataset.tool = char;
  const swatch = document.createElement('span');
  swatch.className = 'swatch';
  swatch.style.background = color;
  btn.append(swatch, document.createTextNode(label));
  return btn;
}

/** Rebuilds the Ground/Hazard/Eraser brush buttons from state.tileStyles: every Ground
 * and Hazard variant (see the "Tile variants" section above) gets its own brush. */
function renderFgToolButtons() {
  els.fgToolGrid.innerHTML = '';
  const chars = [CELL.GROUND, ...variantCharsOfKind('ground'), CELL.HAZARD, ...variantCharsOfKind('hazard')];
  chars.forEach((c) => els.fgToolGrid.appendChild(makeToolButton(c, styleLabel(c), cellSwatchColor(c))));
  els.fgToolGrid.appendChild(makeToolButton(CELL.EMPTY, t('editor.tools.eraser'), '#1d1d2b'));
  syncToolButtonActive();
}

/** Background-layer equivalent of renderFgToolButtons. */
function renderBgToolButtons() {
  els.bgToolGrid.innerHTML = '';
  const chars = [CELL.BACKGROUND, ...variantCharsOfKind('background')];
  chars.forEach((c) => els.bgToolGrid.appendChild(makeToolButton(c, styleLabel(c), cellSwatchColor(c))));
  els.bgToolGrid.appendChild(makeToolButton(CELL.EMPTY, t('editor.tools.eraser'), '#1d1d2b'));
  syncToolButtonActive();
}

// --- Layers ---

function setLayer(layer) {
  currentLayer = layer;
  els.layerFgBtn.classList.toggle('primary', layer === 'foreground');
  els.layerBgBtn.classList.toggle('primary', layer === 'background');
  els.fgTools.classList.toggle('hidden', layer !== 'foreground');
  els.bgTools.classList.toggle('hidden', layer !== 'background');
  currentTool = layer === 'foreground' ? CELL.GROUND : CELL.BACKGROUND;
  syncToolButtonActive();
}

els.layerFgBtn.addEventListener('click', () => setLayer('foreground'));
els.layerBgBtn.addEventListener('click', () => setLayer('background'));

// --- Sidebar tabs ---
//
// Section/Tiles/Entities each get their own top-bar tab (see editor.html's
// .editor-tab/.tab-panel) so the sidebar only shows the controls relevant to what you're
// currently doing. Entities are foreground-only (see levelFormat.js's bgGrid docs: the
// background layer can't hold entities), so switching to the Entities tab also forces the
// Tiles tab's layer back to Foreground; without that guard, an entity tool selected while
// the Background layer was still active would get painted straight into bgGrid as a raw
// string, corrupting that cell's single-character invariant.
function switchSidebarTab(tab) {
  document.querySelectorAll('.editor-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('hidden', p.dataset.tabPanel !== tab));
  if (tab === 'entities') setLayer('foreground');
}

document.querySelectorAll('.editor-tab').forEach((btn) => {
  btn.addEventListener('click', () => switchSidebarTab(btn.dataset.tab));
});

// --- New / resize / load ---

function loadState(next) {
  state = next;
  selection = null;
  placingWaypoint = null;
  clearPendingResize();
  closeTilesetModal();
  els.sectionId.value = state.id;
  els.cols.value = String(state.cols);
  els.rows.value = String(state.rows);
  renderFgToolButtons();
  renderBgToolButtons();
  setLayer('foreground');
  renderGrid();
  renderTilesetFields();
  renderEntityList();
  renderPlatformList();
  renderBgList();
  renderInspector();
  syncPreview();
}

els.newBtn.addEventListener('click', () => {
  if (!confirm(t('editor.confirm.newBlankSection'))) return;
  loadState(makeBlankState('new-section', DEFAULT_COLS, DEFAULT_ROWS));
});

// --- Resize (non-destructive) ---
//
// Resizing keeps everything that still fits: new columns are added at the right (and
// removed from the right when shrinking: see MAX_COLS), matching how the grid is
// addressed left-to-right. Rows instead shift so the ground row (always the grid's last
// row: see levelFormat.js's docstring) stays anchored at the bottom: new rows are added
// above, and shrinking removes from the top. If that shift would push any painted tile or
// entity outside the new bounds, the resize doesn't happen immediately: the button arms
// into a red "Confirm?" state listing what would be deleted, and a second click on the
// same target size actually applies it.
const MAX_COLS = 256;
const MAX_ROWS = 64;

let pendingResize = null; // { cols, rows, rowOffset, losses } | null

function clearPendingResize() {
  pendingResize = null;
  els.resizeBtn.textContent = t('editor.section.resizeBtn');
  els.resizeBtn.classList.remove('confirm-danger');
  els.resizeWarning.classList.add('hidden');
  els.resizeWarning.innerHTML = '';
}

function renderResizeWarning(losses) {
  els.resizeWarning.innerHTML = '';
  const intro = document.createElement('p');
  intro.style.margin = '0 0 4px';
  intro.textContent = `${t('editor.resize.deletesPrefix')} ${losses.length} ${losses.length === 1 ? t('editor.resize.item') : t('editor.resize.items')}:`;
  els.resizeWarning.appendChild(intro);

  const list = document.createElement('ul');
  list.style.margin = '0';
  list.style.paddingLeft = '16px';
  const shown = losses.slice(0, 12);
  shown.forEach((label) => {
    const li = document.createElement('li');
    li.textContent = label;
    list.appendChild(li);
  });
  if (losses.length > shown.length) {
    const li = document.createElement('li');
    li.textContent = `${t('editor.resize.andMorePrefix')} ${losses.length - shown.length} ${t('editor.resize.andMoreSuffix')}`;
    list.appendChild(li);
  }
  els.resizeWarning.appendChild(list);
  els.resizeWarning.classList.remove('hidden');
}

/** Every painted tile/entity that would fall outside a resize to `cols`x`rows`, plus the
 * row shift (see the comment above) that resize would apply. */
function computeResizeImpact(cols, rows) {
  const rowOffset = rows - state.rows;
  const losses = [];

  const checkGrid = (grid, layerLabelKey) => {
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        if (grid[r][c] === CELL.EMPTY) continue;
        const newRow = r + rowOffset;
        if (newRow < 0 || newRow >= rows || c >= cols) {
          losses.push(`${t(layerLabelKey)} ${t('editor.resize.tileAt')} ${t('editor.pos.col')} ${c}, ${t('editor.pos.row')} ${r}`);
        }
      }
    }
  };
  checkGrid(state.grid, 'editor.tiles.foregroundBtn');
  checkGrid(state.bgGrid, 'editor.tiles.backgroundBtn');

  state.entities.forEach((entity) => {
    if (entity.type === ENTITY_TYPES.MOVING_PLATFORM) {
      const outOfBounds = entity.waypoints.some((wp) => {
        const newRow = wp.row + rowOffset;
        return newRow < 0 || newRow >= rows || wp.col < 0 || wp.col >= cols;
      });
      if (outOfBounds) losses.push(t('editor.resize.movingPlatformEntity'));
    } else {
      const newRow = entity.row + rowOffset;
      if (newRow < 0 || newRow >= rows || entity.col < 0 || entity.col >= cols) {
        losses.push(`${entityLabel(entity.type)} ${t('editor.resize.entityAt')} ${t('editor.pos.col')} ${entity.col}, ${t('editor.pos.row')} ${entity.row}`);
      }
    }
  });

  return { rowOffset, losses };
}

/** Applies a resize to `cols`x`rows`, remapping every existing tile/entity per the row
 * shift described above (col 0 always keeps its meaning) and dropping anything that lands
 * outside the new bounds: computeResizeImpact should already have warned about those. */
function applyResize(cols, rows, rowOffset) {
  const remapGrid = (grid) => {
    const result = [];
    for (let newRow = 0; newRow < rows; newRow++) {
      const oldRow = newRow - rowOffset;
      const rowChars = [];
      for (let newCol = 0; newCol < cols; newCol++) {
        rowChars.push(oldRow >= 0 && oldRow < state.rows && newCol < state.cols ? grid[oldRow][newCol] : CELL.EMPTY);
      }
      result.push(rowChars);
    }
    return result;
  };

  const remapEntity = (entity) => {
    if (entity.type === ENTITY_TYPES.MOVING_PLATFORM) {
      const waypoints = entity.waypoints.map((wp) => ({ col: wp.col, row: wp.row + rowOffset }));
      const outOfBounds = waypoints.some((wp) => wp.row < 0 || wp.row >= rows || wp.col < 0 || wp.col >= cols);
      return outOfBounds ? null : { ...entity, waypoints };
    }
    const row = entity.row + rowOffset;
    const outOfBounds = row < 0 || row >= rows || entity.col < 0 || entity.col >= cols;
    return outOfBounds ? null : { ...entity, row };
  };

  loadState({
    id: state.id,
    cols,
    rows,
    grid: remapGrid(state.grid),
    bgGrid: remapGrid(state.bgGrid),
    entities: state.entities.map(remapEntity).filter(Boolean),
    tileStyles: state.tileStyles,
  });
}

els.resizeBtn.addEventListener('click', () => {
  const cols = Math.max(4, Math.min(MAX_COLS, Number(els.cols.value) || DEFAULT_COLS));
  const rows = Math.max(4, Math.min(MAX_ROWS, Number(els.rows.value) || DEFAULT_ROWS));

  if (pendingResize && pendingResize.cols === cols && pendingResize.rows === rows) {
    applyResize(cols, rows, pendingResize.rowOffset);
    clearPendingResize();
    return;
  }

  const { rowOffset, losses } = computeResizeImpact(cols, rows);
  if (losses.length === 0) {
    applyResize(cols, rows, rowOffset);
    clearPendingResize();
    return;
  }

  pendingResize = { cols, rows, rowOffset, losses };
  els.resizeBtn.textContent = t('editor.section.resizeConfirmBtn');
  els.resizeBtn.classList.add('confirm-danger');
  renderResizeWarning(losses);
});

els.cols.addEventListener('input', clearPendingResize);
els.rows.addEventListener('input', clearPendingResize);

els.sectionId.addEventListener('input', () => {
  state.id = els.sectionId.value.trim() || 'section';
  syncPreview();
});

// --- Export / import section ---

function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

els.exportSectionBtn.addEventListener('click', () => {
  const data = exportSection();
  download(`${data.id}.json`, JSON.stringify(data, null, 2) + '\n');
});

function importSectionData(data) {
  if (!isValidSection(data)) {
    alert(t('editor.alert.invalidSectionJson'));
    return;
  }
  loadState({
    id: data.id || 'section',
    cols: data.cols,
    rows: data.rows,
    grid: data.grid.map((row) => row.split('')),
    // Older section files predate bgGrid: default to an empty background layer rather
    // than leaving state.bgGrid undefined.
    bgGrid: (data.bgGrid && data.bgGrid.length === data.rows ? data.bgGrid : emptyGrid(data.cols, data.rows)).map((row) =>
      row.split('')
    ),
    entities: (data.entities || []).map((e) => ({ ...e })),
    // Spread every incoming key first so custom variants (see the "Tile variants" section
    // above) round-trip through export/import instead of being silently dropped; older
    // section files predate per-section tileStyles entirely, so the three base entries
    // are defaulted in afterwards rather than left with nothing bound to edit.
    tileStyles: {
      ...(data.tileStyles || {}),
      [CELL.GROUND]: { color: DEFAULT_GROUND_COLOR, ...(data.tileStyles && data.tileStyles[CELL.GROUND]) },
      [CELL.HAZARD]: { color: DEFAULT_HAZARD_COLOR, ...(data.tileStyles && data.tileStyles[CELL.HAZARD]) },
      [CELL.BACKGROUND]: { color: DEFAULT_BACKGROUND_COLOR, ...(data.tileStyles && data.tileStyles[CELL.BACKGROUND]) },
    },
  });
}

els.importLabelBtn.addEventListener('click', () => els.importFile.click());
els.importFile.addEventListener('change', async () => {
  const file = els.importFile.files[0];
  if (!file) return;
  try {
    importSectionData(JSON.parse(await file.text()));
  } catch (err) {
    alert(`${t('editor.alert.jsonParseErrorPrefix')} ${err.message}`);
  }
  els.importFile.value = '';
});

els.applyJsonBtn.addEventListener('click', () => {
  try {
    importSectionData(JSON.parse(els.jsonPreview.value));
  } catch (err) {
    alert(`${t('editor.alert.jsonParseErrorPrefix')} ${err.message}`);
  }
});

// --- Level sequence ---

function renderSectionList() {
  els.sectionList.innerHTML = '';
  levelSections.forEach((id, idx) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = `${idx + 1}. ${id}`;
    li.appendChild(span);

    const up = document.createElement('button');
    up.textContent = '↑';
    up.addEventListener('click', () => {
      if (idx === 0) return;
      [levelSections[idx - 1], levelSections[idx]] = [levelSections[idx], levelSections[idx - 1]];
      renderSectionList();
    });

    const down = document.createElement('button');
    down.textContent = '↓';
    down.addEventListener('click', () => {
      if (idx === levelSections.length - 1) return;
      [levelSections[idx + 1], levelSections[idx]] = [levelSections[idx], levelSections[idx + 1]];
      renderSectionList();
    });

    const remove = document.createElement('button');
    remove.textContent = '✕';
    remove.addEventListener('click', () => {
      levelSections.splice(idx, 1);
      renderSectionList();
    });

    li.append(up, down, remove);
    els.sectionList.appendChild(li);
  });
}

els.addSectionBtn.addEventListener('click', () => {
  const id = (els.addSectionInput.value.trim() || state.id).trim();
  if (!id) return;
  levelSections.push(id);
  els.addSectionInput.value = '';
  renderSectionList();
});

/** Reads a numeric time-threshold input (max time or one medal), or undefined if left
 * blank/non-positive: both buildLevelData and the exported JSON treat "unset" as "this
 * level doesn't time-limit / doesn't offer this medal" (see GameScene/computeMedal). */
function readSeconds(input) {
  const n = Number(input.value);
  return input.value.trim() !== '' && Number.isFinite(n) && n > 0 ? n : undefined;
}

function buildLevelData() {
  const levelId = els.levelId.value.trim() || 'level';
  const medals = {
    gold: readSeconds(els.levelMedalGold),
    silver: readSeconds(els.levelMedalSilver),
    bronze: readSeconds(els.levelMedalBronze),
  };
  const hasMedals = medals.gold !== undefined || medals.silver !== undefined || medals.bronze !== undefined;
  return {
    id: levelId,
    parallax: els.levelParallax.value.trim() || levelId,
    cellSize: CELL_SIZE,
    sections: levelSections,
    maxTimeSeconds: readSeconds(els.levelMaxTime),
    medals: hasMedals ? medals : undefined,
  };
}

function loadLevelData(data) {
  els.levelId.value = data.id || 'level';
  els.levelParallax.value = data.parallax || data.id || 'level';
  els.levelMaxTime.value = Number.isFinite(data.maxTimeSeconds) ? data.maxTimeSeconds : '';
  const medals = data.medals || {};
  els.levelMedalGold.value = Number.isFinite(medals.gold) ? medals.gold : '';
  els.levelMedalSilver.value = Number.isFinite(medals.silver) ? medals.silver : '';
  els.levelMedalBronze.value = Number.isFinite(medals.bronze) ? medals.bronze : '';
  levelSections = Array.isArray(data.sections) ? [...data.sections] : [];
  renderSectionList();
}

els.exportLevelBtn.addEventListener('click', () => {
  const data = buildLevelData();
  download(`${data.id}.json`, JSON.stringify(data, null, 2) + '\n');
});

// --- Local library (IndexedDB) ---
//
// Additive to the Download/Load-file flow above: sections/levels saved here persist in
// this browser's IndexedDB (see src/data/db.js) with no manual file step, and can be
// grouped into a "Campaign" (ordered list of levels) that shows up in the game's main
// menu. Levels/sections stay globally reusable by id, same as the file-based model:
// deleting one that's still referenced elsewhere isn't blocked, it just surfaces as a
// validation error (see refreshValidation below) instead.

let campaigns = [];
let currentCampaignId = null;
let currentErrors = [];

async function confirmOverwrite(kindLabel, id, existing) {
  if (!existing) return true;
  return confirm(`${t('editor.confirm.overwritePrefix')} ${kindLabel} '${id}' ${t('editor.confirm.overwriteSuffix')}`);
}

function fillSelect(select, ids) {
  const prev = select.value;
  select.innerHTML = '';
  ids.forEach((id) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    select.appendChild(opt);
  });
  if (ids.includes(prev)) select.value = prev;
}

async function populateSectionSelects() {
  const sections = await getAllSections();
  fillSelect(els.loadSectionSelect, sections.map((s) => s.id).sort());
}

async function populateLevelSelects() {
  const levels = await getAllLevels();
  const ids = levels.map((l) => l.id).sort();
  fillSelect(els.loadLevelSelect, ids);
  fillSelect(els.addLevelToCampaignSelect, ids);
}

els.saveSectionBtn.addEventListener('click', async () => {
  if (!isIndexedDbAvailable()) return alert(t('editor.alert.indexedDbUnavailable'));
  const data = exportSection();
  const existing = await getSection(data.id);
  if (!(await confirmOverwrite(t('editor.kind.section'), data.id, existing))) return;
  await putSection(data);
  await populateSectionSelects();
  await refreshValidation();
});

els.loadSectionBtn.addEventListener('click', async () => {
  const id = els.loadSectionSelect.value;
  if (!id) return;
  const data = await getSection(id);
  if (!data) return alert(`${t('editor.alert.notInLibraryPrefix')} ${t('editor.kind.section')} '${id}' ${t('editor.alert.notInLibrarySuffix')}`);
  importSectionData(data);
});

els.deleteSectionBtn.addEventListener('click', async () => {
  const id = els.loadSectionSelect.value;
  if (!id) return;
  if (!confirm(`${t('editor.confirm.deleteSectionPrefix')} '${id}' ${t('editor.confirm.deleteSectionSuffix')}`)) return;
  await deleteSection(id);
  await populateSectionSelects();
  await refreshValidation();
});

els.saveLevelBtn.addEventListener('click', async () => {
  if (!isIndexedDbAvailable()) return alert(t('editor.alert.indexedDbUnavailable'));
  const data = buildLevelData();
  const existing = await getLevel(data.id);
  if (!(await confirmOverwrite(t('editor.kind.level'), data.id, existing))) return;
  await putLevel(data);
  await populateLevelSelects();
  await refreshValidation();
});

els.loadLevelBtn.addEventListener('click', async () => {
  const id = els.loadLevelSelect.value;
  if (!id) return;
  const data = await getLevel(id);
  if (!data) return alert(`${t('editor.alert.notInLibraryPrefix')} ${t('editor.kind.level')} '${id}' ${t('editor.alert.notInLibrarySuffix')}`);
  loadLevelData(data);
});

els.deleteLevelBtn.addEventListener('click', async () => {
  const id = els.loadLevelSelect.value;
  if (!id) return;
  if (!confirm(`${t('editor.confirm.deleteLevelPrefix')} '${id}' ${t('editor.confirm.deleteLevelSuffix')}`)) return;
  await deleteLevel(id);
  await populateLevelSelects();
  await refreshValidation();
});

// --- Campaign panel ---

function renderCampaignSelect() {
  const prev = currentCampaignId;
  els.campaignSelect.innerHTML = '';
  campaigns.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    els.campaignSelect.appendChild(opt);
  });
  currentCampaignId = campaigns.some((c) => c.id === prev) ? prev : campaigns.length ? campaigns[0].id : null;
  if (currentCampaignId) els.campaignSelect.value = currentCampaignId;
}

function currentCampaign() {
  return campaigns.find((c) => c.id === currentCampaignId) || null;
}

function renderCampaignLevelList() {
  els.campaignLevelList.innerHTML = '';
  const campaign = currentCampaign();
  els.campaignNameInput.value = campaign ? campaign.name : '';
  if (!campaign) return;

  campaign.levelIds.forEach((id, idx) => {
    const li = document.createElement('li');
    if (hasError(currentErrors, campaign.id, id)) li.classList.add('level-invalid');

    const span = document.createElement('span');
    span.textContent = `${idx + 1}. ${id}`;
    li.appendChild(span);

    const up = document.createElement('button');
    up.textContent = '↑';
    up.addEventListener('click', async () => {
      if (idx === 0) return;
      [campaign.levelIds[idx - 1], campaign.levelIds[idx]] = [campaign.levelIds[idx], campaign.levelIds[idx - 1]];
      await putCampaign(campaign);
      renderCampaignLevelList();
    });

    const down = document.createElement('button');
    down.textContent = '↓';
    down.addEventListener('click', async () => {
      if (idx === campaign.levelIds.length - 1) return;
      [campaign.levelIds[idx + 1], campaign.levelIds[idx]] = [campaign.levelIds[idx], campaign.levelIds[idx + 1]];
      await putCampaign(campaign);
      renderCampaignLevelList();
    });

    const remove = document.createElement('button');
    remove.textContent = '✕';
    remove.addEventListener('click', async () => {
      campaign.levelIds.splice(idx, 1);
      await putCampaign(campaign);
      renderCampaignLevelList();
      await refreshValidation();
    });

    li.append(up, down, remove);
    els.campaignLevelList.appendChild(li);
  });
}

els.campaignSelect.addEventListener('change', () => {
  currentCampaignId = els.campaignSelect.value || null;
  renderCampaignLevelList();
  renderAssetList();
});

els.newCampaignBtn.addEventListener('click', async () => {
  const name = els.campaignNameInput.value.trim() || t('editor.newCampaignDefaultName');
  const campaign = { id: generateCampaignId(), name, levelIds: [], assets: { keyMap: {} } };
  await putCampaign(campaign);
  campaigns.push(campaign);
  currentCampaignId = campaign.id;
  renderCampaignSelect();
  renderCampaignLevelList();
  renderAssetList();
  await refreshValidation();
});

els.campaignNameInput.addEventListener('change', async () => {
  const campaign = currentCampaign();
  if (!campaign) return;
  campaign.name = els.campaignNameInput.value.trim() || campaign.name;
  await putCampaign(campaign);
  renderCampaignSelect();
});

els.deleteCampaignBtn.addEventListener('click', async () => {
  const campaign = currentCampaign();
  if (!campaign) return;
  if (!confirm(`${t('editor.confirm.deleteCampaignPrefix')} '${campaign.name}'? ${t('editor.confirm.deleteCampaignSuffix')}`)) return;
  // Unlike sections/levels/campaigns (globally reusable by id), an asset belongs
  // exclusively to the campaign that owns its keyMap entry: so it doesn't outlive it.
  const keyMap = (campaign.assets && campaign.assets.keyMap) || {};
  await Promise.all(Object.values(keyMap).map((systemKey) => deleteAsset(systemKey)));
  await deleteCampaign(campaign.id);
  campaigns = campaigns.filter((c) => c.id !== campaign.id);
  currentCampaignId = null;
  renderCampaignSelect();
  renderCampaignLevelList();
  renderAssetList();
  await refreshValidation();
});

// --- Assets (per-campaign, top-bar panel) ---
//
// Unlike sections/levels (global, reused by id across levels/campaigns), assets belong to
// exactly one campaign: the campaign's own `assets.keyMap` is the sole source of truth for
// which asset records belong to it (see the deleteCampaignBtn handler above for the
// cascade-delete this implies). Each entry is `{ [userKey]: systemKey }`: `userKey` is the
// editable display name; `systemKey` is the stable id actually used to store/retrieve the
// base64 record (see assets.js) and never changes, so renaming never has to move data.

function generateAssetSystemKey() {
  return `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function assetsOf(campaign) {
  if (!campaign.assets) campaign.assets = { keyMap: {} };
  if (!campaign.assets.keyMap) campaign.assets.keyMap = {};
  return campaign.assets;
}

/** Builds one asset row (thumbnail/icon + editable name + delete), shared by both the
 * Images/Sprites and Audio lists: the only thing that differs between them is which
 * container it's appended to and how the thumbnail renders (see renderAssetList). */
function buildAssetRow(userKey, systemKey, asset, keyMap, campaign) {
  const li = document.createElement('li');
  li.className = 'obj-item asset-item';

  const thumb = document.createElement('div');
  thumb.className = 'asset-thumb';
  if (asset.kind === ASSET_KIND.IMAGE) {
    const img = document.createElement('img');
    img.src = assetToDataUrl(asset);
    img.alt = userKey;
    thumb.appendChild(img);
  } else {
    // Audio has no meaningful visual thumbnail: a generic note icon stands in for it.
    thumb.classList.add('asset-thumb-audio');
    thumb.textContent = '🎵';
  }

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'asset-name-input';
  nameInput.value = userKey;
  nameInput.addEventListener('change', async () => {
    const newKey = nameInput.value.trim();
    if (!newKey || newKey === userKey) {
      nameInput.value = userKey;
      return;
    }
    if (keyMap[newKey]) {
      alert(`${t('editor.alert.assetNameExists')} '${newKey}' ${t('editor.alert.assetNameExistsSuffix')}`);
      nameInput.value = userKey;
      return;
    }
    delete keyMap[userKey];
    keyMap[newKey] = systemKey;
    await putCampaign(campaign);
    renderAssetList();
  });

  const removeBtn = document.createElement('button');
  removeBtn.textContent = '✕';
  removeBtn.className = 'danger';
  removeBtn.addEventListener('click', async () => {
    if (!confirm(`${t('editor.confirm.deleteAssetPrefix')} '${userKey}'?`)) return;
    delete keyMap[userKey];
    await putCampaign(campaign);
    await deleteAsset(systemKey);
    renderAssetList();
  });

  li.append(thumb, nameInput, removeBtn);
  return li;
}

/** Renders the Assets tab's two always-visible divided lists (Images/Sprites, Audio):
 * one shared upload button feeds both, routed by each asset's own `kind` (auto-detected
 * from the uploaded file's mime type: see assets.js's validateAssetFile). */
async function renderAssetList() {
  els.assetListImage.innerHTML = '';
  els.assetListAudio.innerHTML = '';
  const campaign = currentCampaign();
  els.uploadAssetLabelBtn.disabled = !campaign;

  if (!campaign) {
    els.assetListImageEmpty.classList.remove('hidden');
    els.assetListImageEmpty.textContent = t('editor.assets.selectCampaignFirst');
    els.assetListAudioEmpty.classList.add('hidden');
    return;
  }

  const keyMap = assetsOf(campaign).keyMap;
  const imageRows = [];
  const audioRows = [];
  for (const [userKey, systemKey] of Object.entries(keyMap)) {
    const asset = await getAsset(systemKey);
    if (!asset) continue;
    (asset.kind === ASSET_KIND.IMAGE ? imageRows : audioRows).push({ userKey, systemKey, asset });
  }

  els.assetListImageEmpty.classList.toggle('hidden', imageRows.length > 0);
  els.assetListImageEmpty.textContent = t('editor.assets.imagesEmpty');
  els.assetListAudioEmpty.classList.toggle('hidden', audioRows.length > 0);
  els.assetListAudioEmpty.textContent = t('editor.assets.audioEmpty');

  for (const { userKey, systemKey, asset } of imageRows) {
    els.assetListImage.appendChild(buildAssetRow(userKey, systemKey, asset, keyMap, campaign));
  }
  for (const { userKey, systemKey, asset } of audioRows) {
    els.assetListAudio.appendChild(buildAssetRow(userKey, systemKey, asset, keyMap, campaign));
  }
}

els.uploadAssetLabelBtn.addEventListener('click', () => {
  if (!els.uploadAssetLabelBtn.disabled) els.uploadAssetFile.click();
});

els.uploadAssetFile.addEventListener('change', async () => {
  const file = els.uploadAssetFile.files[0];
  els.uploadAssetFile.value = '';
  if (!file) return;

  const campaign = currentCampaign();
  if (!campaign) return alert(t('editor.alert.selectCampaignFirst'));
  const keyMap = assetsOf(campaign).keyMap;

  // Dedupe the default key (the filename, minus its extension) against this campaign's
  // existing keys: the user can always rename afterward via the name field.
  let userKey = file.name.replace(/\.[^.]+$/, '') || file.name;
  if (keyMap[userKey]) {
    let n = 2;
    while (keyMap[`${userKey} ${n}`]) n++;
    userKey = `${userKey} ${n}`;
  }

  const systemKey = generateAssetSystemKey();
  try {
    await saveAssetFile(systemKey, file, userKey);
  } catch (err) {
    alert(err.message);
    return;
  }
  keyMap[userKey] = systemKey;
  await putCampaign(campaign);
  renderAssetList();
});

els.addLevelToCampaignBtn.addEventListener('click', async () => {
  const campaign = currentCampaign();
  const id = els.addLevelToCampaignSelect.value;
  if (!campaign || !id) return;
  campaign.levelIds.push(id);
  await putCampaign(campaign);
  renderCampaignLevelList();
  await refreshValidation();
});

// --- Validation / top-bar notifications ---

async function refreshValidation() {
  try {
    const [sections, levels, camps] = await Promise.all([getAllSections(), getAllLevels(), getAllCampaigns()]);
    const sectionsById = new Map(sections.map((s) => [s.id, s]));
    const levelsById = new Map(levels.map((l) => [l.id, l]));
    campaigns = camps;
    currentErrors = computeAllErrors({ campaigns, levelsById, sectionsById });
  } catch (err) {
    console.error('Validation refresh failed:', err);
    currentErrors = [];
  }

  els.notifBadge.textContent = String(currentErrors.length);
  els.notifBadge.classList.toggle('hidden', currentErrors.length === 0);
  els.notifEmpty.classList.toggle('hidden', currentErrors.length > 0);
  els.notifList.innerHTML = '';
  currentErrors.forEach((e) => {
    const li = document.createElement('li');
    li.textContent = `${e.campaignName} › ${e.levelId}: ${e.message}`;
    els.notifList.appendChild(li);
  });

  renderCampaignLevelList();
}

// --- Local library init ---

async function initLocalLibrary() {
  if (!isIndexedDbAvailable()) {
    console.warn('IndexedDB is not available: local library/campaign features are disabled.');
    return;
  }
  try {
    await populateSectionSelects();
  } catch (err) {
    console.error('Failed to load saved sections:', err);
  }
  try {
    await populateLevelSelects();
  } catch (err) {
    console.error('Failed to load saved levels:', err);
  }
  try {
    campaigns = await getAllCampaigns();
    renderCampaignSelect();
    renderCampaignLevelList();
    await renderAssetList();
  } catch (err) {
    console.error('Failed to load saved campaigns:', err);
  }
  await refreshValidation();
}

// --- Localization (flag toggle, top-right of the top bar: see editor.html) ---
//
// The editor is plain static JS, not a Phaser scene (same reasoning as the
// platform-textures.json fetch above), so it can't use i18n.js's normal
// queueLocaleLoads/initLocales pair (those drive off a Phaser scene's load queue/cache):
// initLocalesViaFetch() is the fetch-based equivalent for exactly this kind of context.
// `t`/`getLanguage`/`setLanguage` are otherwise identical to the game's usage, including
// sharing the same localStorage key, so a language picked in one tab is picked up by the
// other next time it loads.

function syncLangButtons() {
  const lang = getLanguage();
  els.langEnBtn.classList.toggle('active', lang === 'en');
  els.langPtBtn.classList.toggle('active', lang === 'pt');
}

/** Applies the current language to every static piece of markup carrying a data-i18n
 * (textContent) or data-i18n-placeholder (placeholder) attribute: see editor.html. */
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.documentElement.lang = getLanguage();
  syncLangButtons();
}

/** Re-renders every panel whose text is built in JS rather than sitting in static HTML
 * (entity/tool labels, tileset names, inspector fields, campaign list, ...): these don't
 * carry data-i18n attributes, so applyTranslations() alone can't refresh them. Only needed
 * after an explicit language switch; on first load, loadState()/initLocalLibrary() below
 * already render everything fresh once the dictionaries are in place. */
function refreshDynamicLabels() {
  renderFgToolButtons();
  renderBgToolButtons();
  renderTilesetFields();
  renderEntityList();
  renderPlatformList();
  renderBgList();
  renderInspector();
  renderCampaignLevelList();
  renderAssetList();
}

function setLang(lang) {
  if (lang === getLanguage()) return;
  setLanguage(lang);
  applyTranslations();
  refreshDynamicLabels();
}

els.langEnBtn.addEventListener('click', () => setLang('en'));
els.langPtBtn.addEventListener('click', () => setLang('pt'));

// --- Init ---
//
// Locale dictionaries must be fetched before anything renders: otherwise every t() call
// made while building the initial grid/panels would fall back to raw keys (t()'s
// no-dictionary-yet fallback) and briefly flash untranslated strings.
async function init() {
  await initLocalesViaFetch();
  applyTranslations();
  loadState(state);
  renderSectionList();
  await initLocalLibrary();
}

init();
