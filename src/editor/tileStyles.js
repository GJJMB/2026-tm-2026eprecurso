import { CELL, tileStyleKind } from '../world/levelFormat.js';
import { t } from '../i18n.js';
import { editor } from './state.js';
import { VARIANT_CHAR_POOL, DEFAULT_GROUND_COLOR, DEFAULT_HAZARD_COLOR, DEFAULT_BACKGROUND_COLOR } from './constants.js';
import { renderTilesetFields, openTilesetModal } from './tilesetPanel.js';
import { renderFgToolButtons, renderBgToolButtons } from './toolbar.js';
import { syncPreview } from './sectionLifecycle.js';
import { renderGrid, refreshPlatformSelection, refreshBgSelection } from './gridRender.js';
import { afterSelectionChange } from './inspector.js';

// --- Tile variants ---
//
// A section's tileStyles isn't limited to the three base characters (G/H/B): "+ Add
// variant" hands out one more character from VARIANT_CHAR_POOL, so e.g. a section can
// paint two visually distinct Ground brushes ('G' and, say, '1') that both behave as
// solid ground (see levelFormat.js's tileStyleKind). Foreground variants carry an
// explicit `kind` ('ground'/'hazard'); background variants don't need one: everything
// in bgGrid is decorative by construction.

/** Every non-base character whose tileStyleKind resolves to `kind`, in creation order. */
export function variantCharsOfKind(kind) {
  return Object.keys(editor.section.tileStyles).filter(
    (c) =>
      c !== CELL.GROUND && c !== CELL.HAZARD && c !== CELL.BACKGROUND && tileStyleKind(c, editor.section.tileStyles) === kind
  );
}

/** Display label for any foreground/background character, base or variant: "Ground",
 * "Ground 2", "Hazard 3", "Background 2", etc. */
export function styleLabel(char) {
  if (char === CELL.GROUND) return t('editor.style.ground');
  if (char === CELL.HAZARD) return t('editor.style.hazard');
  if (char === CELL.BACKGROUND) return t('editor.style.background');
  const kind = tileStyleKind(char, editor.section.tileStyles);
  const kindLabel = kind === 'hazard' ? t('editor.style.hazard') : kind === 'background' ? t('editor.style.background') : t('editor.style.ground');
  const idx = variantCharsOfKind(kind).indexOf(char);
  return `${kindLabel} ${idx + 2}`; // base itself is implicitly "1"
}

/** Swatch color for any foreground/background character: used by tool buttons, the
 * Platforms/Background lists, and cell fill color. Sprite-only variants (no `color` set)
 * fall back to a neutral placeholder since the editor can't preview actual sprite pixels. */
export function cellSwatchColor(char) {
  if (char === CELL.EMPTY) return '';
  const style = editor.section.tileStyles[char];
  if (!style) return '#888';
  return style.color || '#57607a';
}

export function nextVariantChar() {
  const used = new Set(Object.keys(editor.section.tileStyles));
  return VARIANT_CHAR_POOL.find((c) => !used.has(c)) || null;
}

export function addVariant(kind) {
  const char = nextVariantChar();
  if (!char) {
    alert(t('editor.alert.noVariantSlots'));
    return;
  }
  const defaultColor =
    kind === 'hazard' ? DEFAULT_HAZARD_COLOR : kind === 'background' ? DEFAULT_BACKGROUND_COLOR : DEFAULT_GROUND_COLOR;
  editor.section.tileStyles[char] = kind === 'background' ? { color: defaultColor } : { kind, color: defaultColor };
  renderTilesetFields();
  renderFgToolButtons();
  renderBgToolButtons();
  syncPreview();
  openTilesetModal(char);
}

/** Deletes a variant and clears any cells painted with it back to empty: a dangling
 * character with no tileStyles entry would otherwise render with the '#888' fallback and
 * silently break re-export/re-import round-tripping. */
export function removeVariant(char) {
  if (char === CELL.GROUND || char === CELL.HAZARD || char === CELL.BACKGROUND) return;
  if (!confirm(t('editor.confirm.removeVariant'))) return;
  for (let r = 0; r < editor.section.rows; r++) {
    for (let c = 0; c < editor.section.cols; c++) {
      if (editor.section.grid[r][c] === char) editor.section.grid[r][c] = CELL.EMPTY;
      if (editor.section.bgGrid[r][c] === char) editor.section.bgGrid[r][c] = CELL.EMPTY;
    }
  }
  delete editor.section.tileStyles[char];
  if (editor.currentTool === char) editor.currentTool = editor.currentLayer === 'background' ? CELL.BACKGROUND : CELL.GROUND;
  renderGrid();
  renderTilesetFields();
  renderFgToolButtons();
  renderBgToolButtons();
  refreshPlatformSelection();
  refreshBgSelection();
  afterSelectionChange();
  syncPreview();
}
