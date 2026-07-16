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

const els = {
  sectionId: document.getElementById('section-id'),
  cols: document.getElementById('section-cols'),
  rows: document.getElementById('section-rows'),
  resizeBtn: document.getElementById('resize-btn'),
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
  groundTilesetField: document.getElementById('ground-tileset-field'),
  hazardTilesetField: document.getElementById('hazard-tileset-field'),
  bgTilesetField: document.getElementById('bg-tileset-field'),
  layerFgBtn: document.getElementById('layer-fg-btn'),
  layerBgBtn: document.getElementById('layer-bg-btn'),
  fgTools: document.getElementById('fg-tools'),
  bgTools: document.getElementById('bg-tools'),
  entitiesSection: document.getElementById('entities-section'),
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
};

const ENTITY_LABELS = {
  [ENTITY_TYPES.PLAYER_SPAWN]: 'Player Spawn',
  [ENTITY_TYPES.GOAL]: 'Goal',
  [ENTITY_TYPES.MOVING_PLATFORM]: 'Moving Platform',
  [ENTITY_TYPES.ENEMY_FALSE_FRIEND]: 'False Friend',
  [ENTITY_TYPES.ENEMY_CRAWLER]: 'Crawler',
  [ENTITY_TYPES.ENEMY_VOMIT_SEAGULL]: 'Vomit Seagull',
};

const ENTITY_COLORS = {
  [ENTITY_TYPES.PLAYER_SPAWN]: '#7CFC9A',
  [ENTITY_TYPES.GOAL]: '#ffcc33',
  [ENTITY_TYPES.MOVING_PLATFORM]: '#00ccff',
  [ENTITY_TYPES.ENEMY_FALSE_FRIEND]: '#ff8800',
  [ENTITY_TYPES.ENEMY_CRAWLER]: '#44aa44',
  [ENTITY_TYPES.ENEMY_VOMIT_SEAGULL]: '#ffcc00',
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
// variants (see levelFormat.js's tileStyleKind docs) — '.', 'G', 'H', 'B' are reserved, so
// this pool is picked from every other easily-typed printable character.
const VARIANT_CHAR_POOL = '123456789abcdefghijklmnopqrstuvwxyzACDEFIJKLMNOPQRSTUVWXYZ'.split('');

// Must match the .cell width/gap in editor.html's CSS — used to place the SVG path
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
    // Decorative layer, same dimensions as `grid` — see levelFormat.js's bgGrid docs.
    bgGrid: emptyGrid(cols, rows).map((row) => row.split('')),
    entities: [],
    // This section's own floor/wall/backdrop tileset (see levelFormat.js's tileStyles
    // docs) — each section keeps its own, rather than sharing one level-wide look.
    tileStyles: {
      [CELL.GROUND]: { color: DEFAULT_GROUND_COLOR },
      [CELL.HAZARD]: { color: DEFAULT_HAZARD_COLOR },
      [CELL.BACKGROUND]: { color: DEFAULT_BACKGROUND_COLOR },
    },
  };
}

let state = makeBlankState('new-section', DEFAULT_COLS, DEFAULT_ROWS);
let currentLayer = 'foreground'; // 'foreground' | 'background' — which grid painting/tools target
let currentTool = CELL.GROUND;
let isPainting = false;
let paintValue = CELL.GROUND;
let levelSections = [];

// Sprite keys available for the "Sprite" appearance mode, fetched once from
// assets/images/platform-textures.json (the editor is plain static JS, not a Phaser
// scene, so it can't use PlatformTextures.js's loader — a plain fetch does the same job).
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
// explicit `kind` ('ground'/'hazard'); background variants don't need one — everything
// in bgGrid is decorative by construction.

/** Every non-base character whose tileStyleKind resolves to `kind`, in creation order. */
function variantCharsOfKind(kind) {
  return Object.keys(state.tileStyles).filter(
    (c) => c !== CELL.GROUND && c !== CELL.HAZARD && c !== CELL.BACKGROUND && tileStyleKind(c, state.tileStyles) === kind
  );
}

/** Display label for any foreground/background character, base or variant — "Ground",
 * "Ground 2", "Hazard 3", "Background 2", etc. */
function styleLabel(char) {
  if (char === CELL.GROUND) return 'Ground';
  if (char === CELL.HAZARD) return 'Hazard';
  if (char === CELL.BACKGROUND) return 'Background';
  const kind = tileStyleKind(char, state.tileStyles);
  const kindLabel = kind === 'hazard' ? 'Hazard' : kind === 'background' ? 'Background' : 'Ground';
  const idx = variantCharsOfKind(kind).indexOf(char);
  return `${kindLabel} ${idx + 2}`; // base itself is implicitly "1"
}

/** Swatch color for any foreground/background character — used by tool buttons, the
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
    alert('No more tile-variant slots available for this section.');
    return;
  }
  const defaultColor =
    kind === 'hazard' ? DEFAULT_HAZARD_COLOR : kind === 'background' ? DEFAULT_BACKGROUND_COLOR : DEFAULT_GROUND_COLOR;
  state.tileStyles[char] = kind === 'background' ? { color: defaultColor } : { kind, color: defaultColor };
  renderTilesetFields();
  renderFgToolButtons();
  renderBgToolButtons();
  syncPreview();
}

/** Deletes a variant and clears any cells painted with it back to empty — a dangling
 * character with no tileStyles entry would otherwise render with the '#888' fallback and
 * silently break re-export/re-import round-tripping. */
function removeVariant(char) {
  if (char === CELL.GROUND || char === CELL.HAZARD || char === CELL.BACKGROUND) return;
  if (!confirm('Remove this variant? Any tiles painted with it will be cleared back to empty.')) return;
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

/**
 * Renders the current section's Ground/Hazard/Background tileset pickers, each as a base
 * appearance field plus any of that kind's variants (see the "Tile variants" section
 * above) with their own appearance field and a remove button, plus an "+ Add variant" button.
 */
function renderTileStyleGroup(container, kindLabel, baseChar, kind, defaultColor) {
  const chars = [baseChar, ...variantCharsOfKind(kind)];
  chars.forEach((char, idx) => {
    const block = document.createElement('div');
    block.className = 'variant-block';
    addAppearanceField(
      block,
      idx === 0 ? `${kindLabel} appearance` : `${kindLabel} ${idx + 1}`,
      state.tileStyles[char],
      defaultColor,
      () => {
        syncPreview();
        refreshGridColors();
        renderFgToolButtons();
        renderBgToolButtons();
      },
      renderTilesetFields
    );
    if (idx > 0) {
      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remove variant';
      removeBtn.className = 'danger';
      removeBtn.style.width = '100%';
      removeBtn.style.marginTop = '4px';
      removeBtn.addEventListener('click', () => removeVariant(char));
      block.appendChild(removeBtn);
    }
    container.appendChild(block);
  });

  const addBtn = document.createElement('button');
  addBtn.textContent = `+ Add ${kindLabel.toLowerCase()} variant`;
  addBtn.style.width = '100%';
  addBtn.style.marginTop = '10px';
  addBtn.addEventListener('click', () => addVariant(kind));
  container.appendChild(addBtn);
}

function renderTilesetFields() {
  els.groundTilesetField.innerHTML = '';
  renderTileStyleGroup(els.groundTilesetField, 'Ground', CELL.GROUND, 'ground', DEFAULT_GROUND_COLOR);

  els.hazardTilesetField.innerHTML = '';
  renderTileStyleGroup(els.hazardTilesetField, 'Hazard', CELL.HAZARD, 'hazard', DEFAULT_HAZARD_COLOR);

  els.bgTilesetField.innerHTML = '';
  renderTileStyleGroup(els.bgTilesetField, 'Background', CELL.BACKGROUND, 'background', DEFAULT_BACKGROUND_COLOR);
}

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

/** Re-applies every cell's fill color — needed after a tileStyles color/texture edit,
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

/** Every contiguous background-tile run — the decorative-layer equivalent of getPlatformRuns. */
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
  label.textContent = 'Waypoints';
  wrap.appendChild(label);

  const lastIdx = entity.waypoints.length - 1;
  entity.waypoints.forEach((wp, wpIdx) => {
    const row = document.createElement('div');
    row.className = 'waypoint-row';

    const tag = document.createElement('span');
    tag.className = 'wp-label';
    tag.textContent = wpIdx === 0 ? 'Start' : wpIdx === lastIdx ? 'End' : `Mid ${wpIdx}`;

    const pos = document.createElement('span');
    pos.className = 'wp-pos';
    pos.textContent = `col ${wp.col}, row ${wp.row}`;

    const isArmed =
      placingWaypoint && placingWaypoint.entityIndex === entityIndex && placingWaypoint.waypointIndex === wpIdx;
    const placeBtn = document.createElement('button');
    placeBtn.textContent = isArmed ? 'Click grid…' : 'Reposition';
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
  addBtn.textContent = '+ Add midpoint';
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
  label.textContent = 'Segment speeds (px/s)';
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
 * (or, on the background layer, any Background variant) — the run-level equivalent of
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
 * current section's tileStyles entries — anything shaped `{ color, texture }`). Switching
 * mode deletes the other field, so exported JSON never carries both at once — texture
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
  toggle.append(makeModeBtn('color', 'Color'), makeModeBtn('sprite', 'Sprite'));
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
    hint.textContent = 'No sprite textures available yet — add one to assets/images/platform-textures.json.';
    wrap.appendChild(hint);
  }

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
    els.inspectorTitle.textContent = ENTITY_LABELS[entity.type] || entity.type;

    if (entity.type === ENTITY_TYPES.MOVING_PLATFORM) {
      addNumberField(els.inspectorFields, 'Width (cells)', entity.widthCells, (v) => {
        entity.widthCells = v;
        syncPreview();
      });
      addNumberField(els.inspectorFields, 'Height (cells)', entity.heightCells || 1, (v) => {
        entity.heightCells = v;
        syncPreview();
      });
      addAppearanceField(
        els.inspectorFields,
        'Appearance',
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
        hint.textContent = 'Click a cell on the grid to place this waypoint.';
        els.inspectorFields.appendChild(hint);
      }
    } else {
      addReadonlyField(els.inspectorFields, 'Position', `col ${entity.col}, row ${entity.row}`);
      if (PATROLLING_ENEMY_TYPES.includes(entity.type)) {
        addNumberField(els.inspectorFields, 'Patrol range (cells each way)', entity.rangeCols, (v) => {
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
      'Position',
      `row ${selection.row}, cols ${selection.startCol}-${lastCol} (${selection.colSpan} cells)`
    );
    addVariantPickerField(els.inspectorFields, 'Type', selection.type, ['background']);
  } else {
    els.inspectorTitle.textContent = styleLabel(selection.type);
    const lastCol = selection.startCol + selection.colSpan - 1;
    addReadonlyField(
      els.inspectorFields,
      'Position',
      `row ${selection.row}, cols ${selection.startCol}-${lastCol} (${selection.colSpan} cells)`
    );
    addVariantPickerField(els.inspectorFields, 'Type', selection.type, ['ground', 'hazard']);
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
        ? `Moving Platform — ${entity.waypoints.length} waypoints`
        : `${ENTITY_LABELS[entity.type] || entity.type} — col ${entity.col}, row ${entity.row}`;

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
    label.textContent = `${styleLabel(run.type)} — row ${run.row}, cols ${run.startCol}-${run.startCol + run.colSpan - 1}`;

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
    label.textContent = `${styleLabel(run.type)} — row ${run.row}, cols ${run.startCol}-${run.startCol + run.colSpan - 1}`;

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

/** Hit-tests a cell against every placed entity — moving platforms match any of their waypoints. */
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

  // Background layer only ever paints (Background/Eraser/variants) — no entities — so it
  // can't fall through to the entity-placement logic below.
  if (currentLayer === 'background') {
    isPainting = true;
    paintValue = currentTool;
    paintCell(row, col);
    return;
  }

  // Paint tools are single-char cell types (Ground/Hazard/Eraser and any variant — see the
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
  } else {
    return;
  }
  selectEntity(state.entities.length - 1);
  syncPreview();
}

// --- Toolbar ---
//
// Tool buttons (paint brushes in #fg-tool-grid/#bg-tool-grid, entity tabs in
// #entities-section) are handled by one delegated listener rather than per-button
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

/** Rebuilds the Ground/Hazard/Eraser brush buttons from state.tileStyles — every Ground
 * and Hazard variant (see the "Tile variants" section above) gets its own brush. */
function renderFgToolButtons() {
  els.fgToolGrid.innerHTML = '';
  const chars = [CELL.GROUND, ...variantCharsOfKind('ground'), CELL.HAZARD, ...variantCharsOfKind('hazard')];
  chars.forEach((c) => els.fgToolGrid.appendChild(makeToolButton(c, styleLabel(c), cellSwatchColor(c))));
  els.fgToolGrid.appendChild(makeToolButton(CELL.EMPTY, 'Eraser', '#1d1d2b'));
  syncToolButtonActive();
}

/** Background-layer equivalent of renderFgToolButtons. */
function renderBgToolButtons() {
  els.bgToolGrid.innerHTML = '';
  const chars = [CELL.BACKGROUND, ...variantCharsOfKind('background')];
  chars.forEach((c) => els.bgToolGrid.appendChild(makeToolButton(c, styleLabel(c), cellSwatchColor(c))));
  els.bgToolGrid.appendChild(makeToolButton(CELL.EMPTY, 'Eraser', '#1d1d2b'));
  syncToolButtonActive();
}

// --- Layers ---

function setLayer(layer) {
  currentLayer = layer;
  els.layerFgBtn.classList.toggle('primary', layer === 'foreground');
  els.layerBgBtn.classList.toggle('primary', layer === 'background');
  els.fgTools.classList.toggle('hidden', layer !== 'foreground');
  els.bgTools.classList.toggle('hidden', layer !== 'background');
  els.entitiesSection.classList.toggle('hidden', layer !== 'foreground');
  currentTool = layer === 'foreground' ? CELL.GROUND : CELL.BACKGROUND;
  syncToolButtonActive();
}

els.layerFgBtn.addEventListener('click', () => setLayer('foreground'));
els.layerBgBtn.addEventListener('click', () => setLayer('background'));

// --- New / resize / load ---

function loadState(next) {
  state = next;
  selection = null;
  placingWaypoint = null;
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
  if (!confirm('Start a new blank section? Unsaved changes will be lost.')) return;
  loadState(makeBlankState('new-section', DEFAULT_COLS, DEFAULT_ROWS));
});

els.resizeBtn.addEventListener('click', () => {
  const cols = Math.max(4, Math.min(60, Number(els.cols.value) || DEFAULT_COLS));
  const rows = Math.max(4, Math.min(30, Number(els.rows.value) || DEFAULT_ROWS));
  if (!confirm('Resizing clears the current grid and entities. Continue?')) return;
  loadState(makeBlankState(els.sectionId.value.trim() || 'section', cols, rows));
});

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
    alert('That JSON does not look like a valid section file.');
    return;
  }
  loadState({
    id: data.id || 'section',
    cols: data.cols,
    rows: data.rows,
    grid: data.grid.map((row) => row.split('')),
    // Older section files predate bgGrid — default to an empty background layer rather
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
    alert(`Could not parse JSON: ${err.message}`);
  }
  els.importFile.value = '';
});

els.applyJsonBtn.addEventListener('click', () => {
  try {
    importSectionData(JSON.parse(els.jsonPreview.value));
  } catch (err) {
    alert(`Could not parse JSON: ${err.message}`);
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

els.exportLevelBtn.addEventListener('click', () => {
  const levelId = els.levelId.value.trim() || 'level';
  const data = {
    id: levelId,
    parallax: els.levelParallax.value.trim() || levelId,
    cellSize: CELL_SIZE,
    sections: levelSections,
  };
  download(`${levelId}.json`, JSON.stringify(data, null, 2) + '\n');
});

// --- Init ---

loadState(state);
renderSectionList();
