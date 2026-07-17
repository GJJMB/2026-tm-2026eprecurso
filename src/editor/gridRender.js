import { CELL, ENTITY_TYPES, groundRow, mergeRowRuns } from '../world/levelFormat.js';
import { els } from './dom.js';
import { editor } from './state.js';
import { CELL_PX, GAP_PX, ENEMY_MARKER_CLASS, ENEMY_MARKER_TEXT } from './constants.js';
import { cellSwatchColor } from './tileStyles.js';
import { onCellMouseDown, onCellMouseEnter } from './painting.js';

export function renderGrid() {
  els.grid.innerHTML = '';
  els.grid.style.gridTemplateColumns = `repeat(${editor.section.cols}, 28px)`;
  els.grid.style.gridTemplateRows = `repeat(${editor.section.rows}, 28px)`;

  const lastRow = groundRow(editor.section.rows);
  for (let row = 0; row < editor.section.rows; row++) {
    for (let col = 0; col < editor.section.cols; col++) {
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

export function cellEl(row, col) {
  return els.grid.children[row * editor.section.cols + col];
}

export function updateCellVisual(row, col) {
  const cell = cellEl(row, col);
  if (!cell) return;
  const fgChar = editor.section.grid[row][col];
  const bgChar = editor.section.bgGrid[row][col];
  cell.dataset.type = fgChar;
  cell.dataset.bgtype = bgChar;
  cell.style.background = cellSwatchColor(fgChar) || cellSwatchColor(bgChar) || '';
  cell.classList.toggle('has-bg-under-fg', fgChar !== CELL.EMPTY && bgChar !== CELL.EMPTY);
}

/** Re-applies every cell's fill color: needed after a tileStyles color/texture edit,
 * since already-painted cells otherwise keep showing their old color. */
export function refreshGridColors() {
  for (let r = 0; r < editor.section.rows; r++) {
    for (let c = 0; c < editor.section.cols; c++) updateCellVisual(r, c);
  }
}

export function renderMarkersAndHighlight() {
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

  editor.section.entities.forEach((entity, idx) => {
    const isSelected = editor.selection && editor.selection.kind === 'entity' && editor.selection.index === idx;

    if (entity.type === ENTITY_TYPES.MOVING_PLATFORM) {
      entity.waypoints.forEach((wp, wpIdx) => {
        const cell = cellEl(wp.row, wp.col);
        if (!cell) return;
        const marker = document.createElement('div');
        marker.className = 'entity-marker moving';
        marker.textContent = String(wpIdx + 1);
        cell.appendChild(marker);

        const isArmed =
          editor.placingWaypoint && editor.placingWaypoint.entityIndex === idx && editor.placingWaypoint.waypointIndex === wpIdx;
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

  if (editor.selection && (editor.selection.kind === 'platform' || editor.selection.kind === 'bgplatform')) {
    for (let c = editor.selection.startCol; c < editor.selection.startCol + editor.selection.colSpan; c++) {
      outline(cellEl(editor.selection.row, c), '#fff');
    }
  }

  renderPathOverlay();
}

export function cellCenterPx(row, col) {
  return {
    x: col * (CELL_PX + GAP_PX) + CELL_PX / 2,
    y: row * (CELL_PX + GAP_PX) + CELL_PX / 2,
  };
}

/** Draws a connecting line between each moving platform's waypoints, in path order. */
export function renderPathOverlay() {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let svg = document.getElementById('path-overlay');
  if (!svg) {
    svg = document.createElementNS(SVG_NS, 'svg');
    svg.id = 'path-overlay';
    els.grid.appendChild(svg);
  }
  svg.innerHTML = '';
  svg.setAttribute('width', editor.section.cols * (CELL_PX + GAP_PX));
  svg.setAttribute('height', editor.section.rows * (CELL_PX + GAP_PX));

  editor.section.entities.forEach((entity, idx) => {
    if (entity.type !== ENTITY_TYPES.MOVING_PLATFORM || entity.waypoints.length < 2) return;
    const isSelected = editor.selection && editor.selection.kind === 'entity' && editor.selection.index === idx;
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
export function getPlatformRuns() {
  const runs = [];
  for (let row = 0; row < editor.section.rows; row++) {
    for (const run of mergeRowRuns(editor.section.grid[row].join(''))) {
      runs.push({ row, startCol: run.startCol, colSpan: run.colSpan, type: run.type });
    }
  }
  return runs;
}

/** Re-locate the selected platform run after a grid edit (it may have grown/shrunk/merged/vanished). */
export function refreshPlatformSelection() {
  if (!editor.selection || editor.selection.kind !== 'platform') return;
  const match = getPlatformRuns().find(
    (r) => r.row === editor.selection.row && editor.selection.startCol >= r.startCol && editor.selection.startCol < r.startCol + r.colSpan
  );
  editor.selection = match ? { kind: 'platform', ...match } : null;
}

/** Every contiguous background-tile run: the decorative-layer equivalent of getPlatformRuns. */
export function getBgRuns() {
  const runs = [];
  for (let row = 0; row < editor.section.rows; row++) {
    for (const run of mergeRowRuns(editor.section.bgGrid[row].join(''))) {
      runs.push({ row, startCol: run.startCol, colSpan: run.colSpan, type: run.type });
    }
  }
  return runs;
}

/** Re-locate the selected background run after a grid edit, mirroring refreshPlatformSelection. */
export function refreshBgSelection() {
  if (!editor.selection || editor.selection.kind !== 'bgplatform') return;
  const match = getBgRuns().find(
    (r) => r.row === editor.selection.row && editor.selection.startCol >= r.startCol && editor.selection.startCol < r.startCol + r.colSpan
  );
  editor.selection = match ? { kind: 'bgplatform', ...match } : null;
}
