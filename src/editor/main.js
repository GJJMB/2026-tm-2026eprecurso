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
} from '../world/levelFormat.js';

const els = {
  sectionId: document.getElementById('section-id'),
  cols: document.getElementById('section-cols'),
  rows: document.getElementById('section-rows'),
  resizeBtn: document.getElementById('resize-btn'),
  newBtn: document.getElementById('new-btn'),
  toolBtns: Array.from(document.querySelectorAll('.tool-btn')),
  grid: document.getElementById('grid'),
  jsonPreview: document.getElementById('json-preview'),
  applyJsonBtn: document.getElementById('apply-json-btn'),
  exportSectionBtn: document.getElementById('export-section-btn'),
  importFile: document.getElementById('import-section-file'),
  importLabelBtn: document.getElementById('import-section-label-btn'),
  levelId: document.getElementById('level-id'),
  levelParallax: document.getElementById('level-parallax'),
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

// Must match the .cell width/gap in editor.html's CSS — used to place the SVG path
// overlay's points without needing a DOM measurement round-trip.
const CELL_PX = 28;
const GAP_PX = 1;

function makeMovingPlatformEntity(row, col) {
  return {
    type: ENTITY_TYPES.MOVING_PLATFORM,
    widthCells: DEFAULT_MOVING_PLATFORM_WIDTH_CELLS,
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
    entities: [],
  };
}

let state = makeBlankState('new-section', DEFAULT_COLS, DEFAULT_ROWS);
let currentTool = CELL.GROUND;
let isPainting = false;
let paintValue = CELL.GROUND;
let levelSections = [];

// Unified selection for the right sidebar's shared inspector:
// { kind: 'entity', index } for a placed entity, or
// { kind: 'platform', row, startCol, colSpan, type } for a merged tile run.
let selection = null;

// Set while a "Reposition" button on a moving platform's waypoint is armed: the next
// grid click sets that waypoint's position instead of painting/placing/selecting.
let placingWaypoint = null; // { entityIndex, waypointIndex } | null

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
      cell.dataset.type = state.grid[row][col];
      cell.addEventListener('mousedown', onCellMouseDown);
      cell.addEventListener('mouseenter', onCellMouseEnter);
      els.grid.appendChild(cell);
    }
  }
  renderMarkersAndHighlight();
}

function cellEl(row, col) {
  return els.grid.children[row * state.cols + col];
}

function updateCellVisual(row, col) {
  const cell = cellEl(row, col);
  if (cell) cell.dataset.type = state.grid[row][col];
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

  if (selection && selection.kind === 'platform') {
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

function addTypeToggleField(container, labelText, currentType) {
  const wrap = document.createElement('div');
  wrap.className = 'type-toggle';
  const makeBtn = (type, label) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.className = type === currentType ? 'primary' : '';
    btn.addEventListener('click', () => setSelectedPlatformType(type));
    return btn;
  };
  wrap.append(makeBtn(CELL.GROUND, 'Ground'), makeBtn(CELL.HAZARD, 'Hazard'));
  addFieldRow(container, labelText, wrap);
}

function setSelectedPlatformType(newType) {
  if (!selection || selection.kind !== 'platform') return;
  for (let c = selection.startCol; c < selection.startCol + selection.colSpan; c++) {
    state.grid[selection.row][c] = newType;
    updateCellVisual(selection.row, c);
  }
  refreshPlatformSelection();
  afterSelectionChange();
  syncPreview();
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
  } else {
    els.inspectorTitle.textContent = selection.type === CELL.HAZARD ? 'Hazard' : 'Ground / Platform';
    const lastCol = selection.startCol + selection.colSpan - 1;
    addReadonlyField(
      els.inspectorFields,
      'Position',
      `row ${selection.row}, cols ${selection.startCol}–${lastCol} (${selection.colSpan} cells)`
    );
    addTypeToggleField(els.inspectorFields, 'Type', selection.type);
  }
}

els.inspectorDelete.addEventListener('click', () => {
  if (!selection) return;
  placingWaypoint = null;
  if (selection.kind === 'entity') {
    state.entities.splice(selection.index, 1);
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
    swatch.style.background = run.type === CELL.HAZARD ? '#d1495b' : '#4a4a5e';

    const label = document.createElement('span');
    label.className = 'obj-item-label';
    label.textContent = `${run.type === CELL.HAZARD ? 'Hazard' : 'Ground'} — row ${run.row}, cols ${run.startCol}-${run.startCol + run.colSpan - 1}`;

    li.append(swatch, label);
    li.addEventListener('click', () => selectPlatform(run));
    els.platformList.appendChild(li);
  });
  els.platformListEmpty.classList.toggle('hidden', runs.length > 0);
}

function exportSection() {
  return {
    id: state.id,
    cols: state.cols,
    rows: state.rows,
    grid: state.grid.map((row) => row.join('')),
    entities: state.entities,
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

  if (currentTool === CELL.GROUND || currentTool === CELL.HAZARD || currentTool === CELL.EMPTY) {
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
  state.grid[row][col] = paintValue;
  updateCellVisual(row, col);
  refreshPlatformSelection();
  renderMarkersAndHighlight();
  renderPlatformList();
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

els.toolBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    currentTool = btn.dataset.tool;
    els.toolBtns.forEach((b) => b.classList.toggle('active', b === btn));
  });
});

// --- New / resize / load ---

function loadState(next) {
  state = next;
  selection = null;
  placingWaypoint = null;
  els.sectionId.value = state.id;
  els.cols.value = String(state.cols);
  els.rows.value = String(state.rows);
  renderGrid();
  renderEntityList();
  renderPlatformList();
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
    entities: (data.entities || []).map((e) => ({ ...e })),
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
