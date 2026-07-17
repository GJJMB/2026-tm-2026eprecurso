import { CELL, emptyGrid, isValidSection } from '../world/levelFormat.js';
import { t } from '../i18n.js';
import { els } from './dom.js';
import { DEFAULT_GROUND_COLOR, DEFAULT_HAZARD_COLOR, DEFAULT_BACKGROUND_COLOR } from './constants.js';
import { loadState, exportSection } from './sectionLifecycle.js';

export function download(filename, text) {
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

export function importSectionData(data) {
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
    // than leaving editor.section.bgGrid undefined.
    bgGrid: (data.bgGrid && data.bgGrid.length === data.rows ? data.bgGrid : emptyGrid(data.cols, data.rows)).map((row) =>
      row.split('')
    ),
    entities: (data.entities || []).map((e) => ({ ...e })),
    // Spread every incoming key first so custom variants (see tileStyles.js's "Tile
    // variants" section) round-trip through export/import instead of being silently
    // dropped; older section files predate per-section tileStyles entirely, so the three
    // base entries are defaulted in afterwards rather than left with nothing bound to edit.
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
