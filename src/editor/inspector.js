import { PATROLLING_ENEMY_TYPES, ENTITY_TYPES, CELL } from '../world/levelFormat.js';
import { t } from '../i18n.js';
import { els } from './dom.js';
import { editor, entityLabel } from './state.js';
import { DEFAULT_MOVING_PLATFORM_COLOR, TILE_MODE_LABEL_KEYS, TILE_MODE_HINT_KEYS } from './constants.js';
import { styleLabel, cellSwatchColor, variantCharsOfKind } from './tileStyles.js';
import { renderMarkersAndHighlight, refreshPlatformSelection, refreshBgSelection, updateCellVisual } from './gridRender.js';
import { renderEntityList, renderPlatformList, renderBgList } from './objectLists.js';
import { syncPreview } from './sectionLifecycle.js';

// --- Selection / inspector ---

export function selectEntity(idx) {
  editor.placingWaypoint = null;
  editor.selection = { kind: 'entity', index: idx };
  afterSelectionChange();
}

export function selectPlatform(run) {
  editor.placingWaypoint = null;
  editor.selection = { kind: 'platform', ...run };
  afterSelectionChange();
}

export function selectBgPlatform(run) {
  editor.placingWaypoint = null;
  editor.selection = { kind: 'bgplatform', ...run };
  afterSelectionChange();
}

export function armWaypointPlacement(entityIndex, waypointIndex) {
  const alreadyArmed =
    editor.placingWaypoint && editor.placingWaypoint.entityIndex === entityIndex && editor.placingWaypoint.waypointIndex === waypointIndex;
  editor.placingWaypoint = alreadyArmed ? null : { entityIndex, waypointIndex };
  renderMarkersAndHighlight();
  renderInspector();
}

export function setWaypointFromClick(row, col) {
  const { entityIndex, waypointIndex } = editor.placingWaypoint;
  const entity = editor.section.entities[entityIndex];
  if (entity && entity.waypoints[waypointIndex]) {
    entity.waypoints[waypointIndex] = { col, row };
  }
  editor.placingWaypoint = null;
  renderMarkersAndHighlight();
  renderEntityList();
  renderInspector();
  syncPreview();
}

export function addMidpoint(entityIndex) {
  const entity = editor.section.entities[entityIndex];
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

export function removeMidpoint(entityIndex, waypointIndex) {
  const entity = editor.section.entities[entityIndex];
  if (!entity) return;
  entity.waypoints.splice(waypointIndex, 1);
  // The two segments touching this waypoint merge into one -> drop one speed entry.
  entity.speeds.splice(Math.max(0, waypointIndex - 1), 1);
  if (editor.placingWaypoint && editor.placingWaypoint.entityIndex === entityIndex) editor.placingWaypoint = null;
  afterSelectionChange();
  syncPreview();
}

export function afterSelectionChange() {
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
      editor.placingWaypoint && editor.placingWaypoint.entityIndex === entityIndex && editor.placingWaypoint.waypointIndex === wpIdx;
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
  if (!editor.selection || (editor.selection.kind !== 'platform' && editor.selection.kind !== 'bgplatform')) return;
  const targetGrid = editor.selection.kind === 'bgplatform' ? editor.section.bgGrid : editor.section.grid;
  for (let c = editor.selection.startCol; c < editor.selection.startCol + editor.selection.colSpan; c++) {
    targetGrid[editor.selection.row][c] = newType;
    updateCellVisual(editor.selection.row, c);
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
export function addAppearanceField(container, labelText, obj, defaultColor, onValueChange, rerender) {
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
        obj.texture = editor.textureKeys[0] || '';
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
  } else if (editor.textureKeys.length) {
    const select = document.createElement('select');
    editor.textureKeys.forEach((key) => {
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

export function renderInspector() {
  if (!editor.selection) {
    els.inspector.classList.add('hidden');
    els.inspectorEmptyHint.classList.remove('hidden');
    els.inspectorFields.innerHTML = '';
    return;
  }

  if (editor.selection.kind === 'entity' && !editor.section.entities[editor.selection.index]) {
    editor.selection = null;
    return renderInspector();
  }

  els.inspectorEmptyHint.classList.add('hidden');
  els.inspector.classList.remove('hidden');
  els.inspectorFields.innerHTML = '';

  if (editor.selection.kind === 'entity') {
    const entity = editor.section.entities[editor.selection.index];
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
      addWaypointsField(els.inspectorFields, editor.selection.index, entity);
      addSegmentSpeedsField(els.inspectorFields, entity);
      if (editor.placingWaypoint && editor.placingWaypoint.entityIndex === editor.selection.index) {
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
  } else if (editor.selection.kind === 'bgplatform') {
    els.inspectorTitle.textContent = styleLabel(editor.selection.type);
    const lastCol = editor.selection.startCol + editor.selection.colSpan - 1;
    addReadonlyField(
      els.inspectorFields,
      t('editor.inspector.position'),
      `${t('editor.pos.row')} ${editor.selection.row}, ${t('editor.pos.cols')} ${editor.selection.startCol}-${lastCol} (${editor.selection.colSpan} ${t('editor.pos.cells')})`
    );
    addVariantPickerField(els.inspectorFields, t('editor.inspector.type'), editor.selection.type, ['background']);
  } else {
    els.inspectorTitle.textContent = styleLabel(editor.selection.type);
    const lastCol = editor.selection.startCol + editor.selection.colSpan - 1;
    addReadonlyField(
      els.inspectorFields,
      t('editor.inspector.position'),
      `${t('editor.pos.row')} ${editor.selection.row}, ${t('editor.pos.cols')} ${editor.selection.startCol}-${lastCol} (${editor.selection.colSpan} ${t('editor.pos.cells')})`
    );
    addVariantPickerField(els.inspectorFields, t('editor.inspector.type'), editor.selection.type, ['ground', 'hazard']);
  }
}

els.inspectorDelete.addEventListener('click', () => {
  if (!editor.selection) return;
  editor.placingWaypoint = null;
  if (editor.selection.kind === 'entity') {
    editor.section.entities.splice(editor.selection.index, 1);
  } else if (editor.selection.kind === 'bgplatform') {
    for (let c = editor.selection.startCol; c < editor.selection.startCol + editor.selection.colSpan; c++) {
      editor.section.bgGrid[editor.selection.row][c] = CELL.EMPTY;
      updateCellVisual(editor.selection.row, c);
    }
  } else {
    for (let c = editor.selection.startCol; c < editor.selection.startCol + editor.selection.colSpan; c++) {
      editor.section.grid[editor.selection.row][c] = CELL.EMPTY;
      updateCellVisual(editor.selection.row, c);
    }
  }
  editor.selection = null;
  afterSelectionChange();
  syncPreview();
});
