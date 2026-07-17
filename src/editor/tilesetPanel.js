import { CELL } from '../world/levelFormat.js';
import { t } from '../i18n.js';
import { els } from './dom.js';
import { editor } from './state.js';
import { TILESET_BASE_CHAR, TILESET_DEFAULT_COLOR } from './constants.js';
import { styleLabel, cellSwatchColor, variantCharsOfKind, removeVariant, addVariant } from './tileStyles.js';
import { addAppearanceField } from './inspector.js';
import { refreshGridColors } from './gridRender.js';
import { renderFgToolButtons, renderBgToolButtons } from './toolbar.js';
import { syncPreview } from './sectionLifecycle.js';

/**
 * Renders the Tileset panel's type list for whichever category (Ground/Hazard/Background)
 * the dropdown is currently set to: the base type plus any of that kind's variants (see
 * tileStyles.js's "Tile variants" section), each a clickable row that opens the side-modal
 * editor (see openTilesetModal) rather than expanding inline.
 */
export function renderTilesetTypeList() {
  els.tilesetCategorySelect.value = editor.tilesetCategory;
  els.tilesetTypeList.innerHTML = '';
  const baseChar = TILESET_BASE_CHAR[editor.tilesetCategory];
  const chars = [baseChar, ...variantCharsOfKind(editor.tilesetCategory)];

  chars.forEach((char) => {
    const li = document.createElement('li');
    li.className = 'obj-item tileset-row';

    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = cellSwatchColor(char);

    const label = document.createElement('span');
    label.className = 'obj-item-label';
    label.textContent = styleLabel(char);

    li.append(swatch, label);
    if (editor.section.tileStyles[char] && editor.section.tileStyles[char].texture) {
      const badge = document.createElement('span');
      badge.className = 'sprite-badge';
      badge.textContent = t('editor.tileset.spriteBadge');
      li.appendChild(badge);
    }
    li.addEventListener('click', () => openTilesetModal(char));
    els.tilesetTypeList.appendChild(li);
  });
}

/** Thin wrapper kept so existing call sites (loadState, addVariant, removeVariant, import)
 * don't need to know about the list/modal split: also closes the side-modal if it was
 * open for a character that no longer exists in the (possibly just-reloaded) state. */
export function renderTilesetFields() {
  renderTilesetTypeList();
  if (editor.tilesetModalChar && !editor.section.tileStyles[editor.tilesetModalChar]) closeTilesetModal();
}

/** Opens the side-modal editor for `char`'s appearance (see editor.html's .side-modal):
 * used both right after "+ Add variant" creates a new type and when clicking an existing
 * row in the Tileset list. */
export function openTilesetModal(char) {
  editor.tilesetModalChar = char;
  const isBase = char === CELL.GROUND || char === CELL.HAZARD || char === CELL.BACKGROUND;
  els.tilesetModalTitle.textContent = styleLabel(char);
  els.tilesetModalBody.innerHTML = '';

  addAppearanceField(
    els.tilesetModalBody,
    t('editor.inspector.appearance'),
    editor.section.tileStyles[char],
    TILESET_DEFAULT_COLOR[editor.tilesetCategory],
    () => {
      syncPreview();
      refreshGridColors();
      renderFgToolButtons();
      renderBgToolButtons();
      renderTilesetTypeList();
    },
    () => openTilesetModal(char) // re-render the modal body in place after a Color/Sprite mode switch
  );

  if (!isBase) {
    const removeBtn = document.createElement('button');
    removeBtn.textContent = t('editor.tileset.removeVariantBtn');
    removeBtn.className = 'danger';
    removeBtn.style.width = '100%';
    removeBtn.style.marginTop = '14px';
    // removeVariant() re-renders the list and (via renderTilesetFields' check above)
    // closes this modal itself once the char is actually gone: but confirm() inside it
    // may be cancelled, so this must NOT unconditionally close the modal here too.
    removeBtn.addEventListener('click', () => removeVariant(char));
    els.tilesetModalBody.appendChild(removeBtn);
  }

  els.tilesetModalBackdrop.classList.remove('hidden');
  els.tilesetModal.classList.add('open');
}

export function closeTilesetModal() {
  editor.tilesetModalChar = null;
  els.tilesetModalBackdrop.classList.add('hidden');
  els.tilesetModal.classList.remove('open');
}

els.tilesetCategorySelect.addEventListener('change', () => {
  editor.tilesetCategory = els.tilesetCategorySelect.value;
  renderTilesetTypeList();
});
els.tilesetAddBtn.addEventListener('click', () => addVariant(editor.tilesetCategory));
els.tilesetModalClose.addEventListener('click', closeTilesetModal);
els.tilesetModalBackdrop.addEventListener('click', closeTilesetModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && editor.tilesetModalChar) closeTilesetModal();
});
