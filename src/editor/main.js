import {
  CELL,
  CELL_SIZE,
  DEFAULT_COLS,
  DEFAULT_ROWS,
  ENTITY_TYPES,
  emptyGrid,
  groundRow,
  isValidSection,
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
};

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
  renderEntityMarkers();
}

function cellEl(row, col) {
  return els.grid.children[row * state.cols + col];
}

function updateCellVisual(row, col) {
  const cell = cellEl(row, col);
  if (cell) cell.dataset.type = state.grid[row][col];
}

function renderEntityMarkers() {
  els.grid.querySelectorAll('.entity-marker').forEach((el) => el.remove());
  for (const entity of state.entities) {
    const cell = cellEl(entity.row, entity.col);
    if (!cell) continue;
    const marker = document.createElement('div');
    if (entity.type === ENTITY_TYPES.PLAYER_SPAWN) {
      marker.className = 'entity-marker spawn';
      marker.textContent = 'S';
    } else if (entity.type === ENTITY_TYPES.GOAL) {
      marker.className = 'entity-marker goal';
      marker.textContent = 'F';
    } else if (entity.type === ENTITY_TYPES.MOVING_PLATFORM) {
      marker.className = 'entity-marker moving';
      marker.textContent = 'M';
    }
    cell.appendChild(marker);
  }
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

function onCellMouseDown(e) {
  const row = Number(e.currentTarget.dataset.row);
  const col = Number(e.currentTarget.dataset.col);
  if (currentTool === CELL.GROUND || currentTool === CELL.HAZARD || currentTool === CELL.EMPTY) {
    isPainting = true;
    paintValue = currentTool;
    paintCell(row, col);
  } else {
    placeEntity(row, col);
  }
}

function onCellMouseEnter(e) {
  if (!isPainting) return;
  paintCell(Number(e.currentTarget.dataset.row), Number(e.currentTarget.dataset.col));
}

function paintCell(row, col) {
  state.grid[row][col] = paintValue;
  updateCellVisual(row, col);
  syncPreview();
}

document.addEventListener('mouseup', () => {
  isPainting = false;
});

function placeEntity(row, col) {
  if (currentTool === ENTITY_TYPES.PLAYER_SPAWN || currentTool === ENTITY_TYPES.GOAL) {
    state.entities = state.entities.filter((e) => e.type !== currentTool);
    state.entities.push({ type: currentTool, col, row });
  } else if (currentTool === ENTITY_TYPES.MOVING_PLATFORM) {
    const existingIdx = state.entities.findIndex(
      (e) => e.type === ENTITY_TYPES.MOVING_PLATFORM && e.row === row && e.col === col
    );
    if (existingIdx !== -1) {
      state.entities.splice(existingIdx, 1);
    } else {
      const axis = (prompt('Axis (x or y)', 'y') || 'y').trim() === 'x' ? 'x' : 'y';
      const range = Number(prompt('Range (px)', '80')) || 80;
      const speed = Number(prompt('Speed (px/s)', '70')) || 70;
      const widthCells = Number(prompt('Width (cells)', '3')) || 3;
      state.entities.push({ type: ENTITY_TYPES.MOVING_PLATFORM, col, row, axis, range, speed, widthCells });
    }
  }
  renderEntityMarkers();
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
  els.sectionId.value = state.id;
  els.cols.value = String(state.cols);
  els.rows.value = String(state.rows);
  renderGrid();
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
    [levelId]: {
      parallax: els.levelParallax.value.trim() || levelId,
      cellSize: CELL_SIZE,
      sections: levelSections,
    },
  };
  download('levels.json', JSON.stringify(data, null, 2) + '\n');
});

// --- Init ---

loadState(state);
renderSectionList();
