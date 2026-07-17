import { ENTITY_TYPES } from '../world/levelFormat.js';
import { t } from '../i18n.js';
import { els } from './dom.js';
import { editor, entityLabel } from './state.js';
import { ENTITY_COLORS } from './constants.js';
import { styleLabel, cellSwatchColor } from './tileStyles.js';
import { getPlatformRuns, getBgRuns } from './gridRender.js';
import { selectEntity, selectPlatform, selectBgPlatform } from './inspector.js';

export function renderEntityList() {
  els.entityList.innerHTML = '';
  editor.section.entities.forEach((entity, idx) => {
    const li = document.createElement('li');
    li.className = 'obj-item' + (editor.selection && editor.selection.kind === 'entity' && editor.selection.index === idx ? ' selected' : '');

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
  els.entityListEmpty.classList.toggle('hidden', editor.section.entities.length > 0);
}

export function renderPlatformList() {
  els.platformList.innerHTML = '';
  const runs = getPlatformRuns();
  runs.forEach((run) => {
    const li = document.createElement('li');
    const isSelected =
      editor.selection && editor.selection.kind === 'platform' && editor.selection.row === run.row && editor.selection.startCol === run.startCol;
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

export function renderBgList() {
  els.bgList.innerHTML = '';
  const runs = getBgRuns();
  runs.forEach((run) => {
    const li = document.createElement('li');
    const isSelected =
      editor.selection && editor.selection.kind === 'bgplatform' && editor.selection.row === run.row && editor.selection.startCol === run.startCol;
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
