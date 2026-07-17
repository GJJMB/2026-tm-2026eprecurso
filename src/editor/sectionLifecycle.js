import { t } from '../i18n.js';
import { els } from './dom.js';
import { editor, makeBlankState, entityLabel } from './state.js';
import { CELL, ENTITY_TYPES, DEFAULT_COLS, DEFAULT_ROWS } from '../world/levelFormat.js';
import { MAX_COLS, MAX_ROWS } from './constants.js';
import { renderFgToolButtons, renderBgToolButtons, setLayer } from './toolbar.js';
import { renderGrid } from './gridRender.js';
import { renderTilesetFields, closeTilesetModal } from './tilesetPanel.js';
import { renderEntityList, renderPlatformList, renderBgList } from './objectLists.js';
import { renderInspector } from './inspector.js';

export function exportSection() {
  return {
    id: editor.section.id,
    cols: editor.section.cols,
    rows: editor.section.rows,
    grid: editor.section.grid.map((row) => row.join('')),
    bgGrid: editor.section.bgGrid.map((row) => row.join('')),
    entities: editor.section.entities,
    tileStyles: editor.section.tileStyles,
  };
}

export function syncPreview() {
  els.jsonPreview.value = JSON.stringify(exportSection(), null, 2);
}

export function loadState(next) {
  editor.section = next;
  editor.selection = null;
  editor.placingWaypoint = null;
  clearPendingResize();
  closeTilesetModal();
  els.sectionId.value = editor.section.id;
  els.cols.value = String(editor.section.cols);
  els.rows.value = String(editor.section.rows);
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

export function clearPendingResize() {
  editor.pendingResize = null;
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
  const rowOffset = rows - editor.section.rows;
  const losses = [];

  const checkGrid = (grid, layerLabelKey) => {
    for (let r = 0; r < editor.section.rows; r++) {
      for (let c = 0; c < editor.section.cols; c++) {
        if (grid[r][c] === CELL.EMPTY) continue;
        const newRow = r + rowOffset;
        if (newRow < 0 || newRow >= rows || c >= cols) {
          losses.push(`${t(layerLabelKey)} ${t('editor.resize.tileAt')} ${t('editor.pos.col')} ${c}, ${t('editor.pos.row')} ${r}`);
        }
      }
    }
  };
  checkGrid(editor.section.grid, 'editor.tiles.foregroundBtn');
  checkGrid(editor.section.bgGrid, 'editor.tiles.backgroundBtn');

  editor.section.entities.forEach((entity) => {
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
        rowChars.push(oldRow >= 0 && oldRow < editor.section.rows && newCol < editor.section.cols ? grid[oldRow][newCol] : CELL.EMPTY);
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
    id: editor.section.id,
    cols,
    rows,
    grid: remapGrid(editor.section.grid),
    bgGrid: remapGrid(editor.section.bgGrid),
    entities: editor.section.entities.map(remapEntity).filter(Boolean),
    tileStyles: editor.section.tileStyles,
  });
}

els.resizeBtn.addEventListener('click', () => {
  const cols = Math.max(4, Math.min(MAX_COLS, Number(els.cols.value) || DEFAULT_COLS));
  const rows = Math.max(4, Math.min(MAX_ROWS, Number(els.rows.value) || DEFAULT_ROWS));

  if (editor.pendingResize && editor.pendingResize.cols === cols && editor.pendingResize.rows === rows) {
    applyResize(cols, rows, editor.pendingResize.rowOffset);
    clearPendingResize();
    return;
  }

  const { rowOffset, losses } = computeResizeImpact(cols, rows);
  if (losses.length === 0) {
    applyResize(cols, rows, rowOffset);
    clearPendingResize();
    return;
  }

  editor.pendingResize = { cols, rows, rowOffset, losses };
  els.resizeBtn.textContent = t('editor.section.resizeConfirmBtn');
  els.resizeBtn.classList.add('confirm-danger');
  renderResizeWarning(losses);
});

els.cols.addEventListener('input', clearPendingResize);
els.rows.addEventListener('input', clearPendingResize);

els.sectionId.addEventListener('input', () => {
  editor.section.id = els.sectionId.value.trim() || 'section';
  syncPreview();
});
