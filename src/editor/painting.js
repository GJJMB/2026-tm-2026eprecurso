import { ENTITY_TYPES } from '../world/levelFormat.js';
import { editor, makeMovingPlatformEntity, makeEnemyEntity } from './state.js';
import { ENEMY_TOOL_TYPES } from './constants.js';
import { updateCellVisual, refreshPlatformSelection, refreshBgSelection, renderMarkersAndHighlight } from './gridRender.js';
import { renderPlatformList, renderBgList } from './objectLists.js';
import { renderInspector, selectEntity, setWaypointFromClick } from './inspector.js';
import { syncPreview } from './sectionLifecycle.js';

/** Hit-tests a cell against every placed entity: moving platforms match any of their waypoints. */
function findEntityAtCell(row, col) {
  return editor.section.entities.findIndex((en) => {
    if (en.type === ENTITY_TYPES.MOVING_PLATFORM) {
      return en.waypoints.some((wp) => wp.row === row && wp.col === col);
    }
    return en.row === row && en.col === col;
  });
}

export function onCellMouseDown(e) {
  const row = Number(e.currentTarget.dataset.row);
  const col = Number(e.currentTarget.dataset.col);

  // A waypoint "Reposition" button is armed: this click sets its position and takes
  // priority over painting/placing/selecting, regardless of which left-sidebar tool is active.
  if (editor.placingWaypoint) {
    setWaypointFromClick(row, col);
    return;
  }

  // Background layer only ever paints (Background/Eraser/variants): no entities: so it
  // can't fall through to the entity-placement logic below.
  if (editor.currentLayer === 'background') {
    editor.isPainting = true;
    editor.paintValue = editor.currentTool;
    paintCell(row, col);
    return;
  }

  // Paint tools are single-char cell types (Ground/Hazard/Eraser and any variant: see
  // tileStyles.js's "Tile variants" section); entity tools are the longer ENTITY_TYPES
  // strings ('playerSpawn', 'movingPlatform', ...), so length alone tells them apart.
  if (editor.currentTool.length === 1) {
    editor.isPainting = true;
    editor.paintValue = editor.currentTool;
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

export function onCellMouseEnter(e) {
  if (!editor.isPainting) return;
  paintCell(Number(e.currentTarget.dataset.row), Number(e.currentTarget.dataset.col));
}

export function paintCell(row, col) {
  if (editor.currentLayer === 'background') {
    editor.section.bgGrid[row][col] = editor.paintValue;
  } else {
    editor.section.grid[row][col] = editor.paintValue;
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
  editor.isPainting = false;
});

export function placeEntity(row, col) {
  if (editor.currentTool === ENTITY_TYPES.PLAYER_SPAWN || editor.currentTool === ENTITY_TYPES.GOAL) {
    editor.section.entities = editor.section.entities.filter((e) => e.type !== editor.currentTool);
    editor.section.entities.push({ type: editor.currentTool, col, row });
  } else if (editor.currentTool === ENTITY_TYPES.MOVING_PLATFORM) {
    editor.section.entities.push(makeMovingPlatformEntity(row, col));
  } else if (ENEMY_TOOL_TYPES.includes(editor.currentTool)) {
    editor.section.entities.push(makeEnemyEntity(editor.currentTool, row, col));
  } else if (editor.currentTool === ENTITY_TYPES.CHECKPOINT) {
    editor.section.entities.push({ type: editor.currentTool, col, row });
  } else {
    return;
  }
  selectEntity(editor.section.entities.length - 1);
  syncPreview();
}
