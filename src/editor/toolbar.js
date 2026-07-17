import { CELL } from '../world/levelFormat.js';
import { t } from '../i18n.js';
import { els } from './dom.js';
import { editor } from './state.js';
import { styleLabel, cellSwatchColor, variantCharsOfKind } from './tileStyles.js';

// --- Toolbar ---
//
// Tool buttons (paint brushes in #fg-tool-grid/#bg-tool-grid, entity tabs in #tab-entities)
// are handled by one delegated listener rather than per-button listeners, since the brush
// buttons are regenerated whenever a variant is added/removed (see renderFgToolButtons/
// renderBgToolButtons) and per-button listeners would need re-wiring on every regeneration.
document.getElementById('sidebar').addEventListener('click', (e) => {
  const btn = e.target.closest('.tool-btn');
  if (!btn || !btn.dataset.tool) return;
  editor.currentTool = btn.dataset.tool;
  syncToolButtonActive();
});

export function syncToolButtonActive() {
  document.querySelectorAll('.tool-btn').forEach((b) => b.classList.toggle('active', b.dataset.tool === editor.currentTool));
}

function makeToolButton(char, label, color) {
  const btn = document.createElement('button');
  btn.className = 'tool-btn';
  btn.dataset.tool = char;
  const swatch = document.createElement('span');
  swatch.className = 'swatch';
  swatch.style.background = color;
  btn.append(swatch, document.createTextNode(label));
  return btn;
}

/** Rebuilds the Ground/Hazard/Eraser brush buttons from editor.section.tileStyles: every
 * Ground and Hazard variant (see tileStyles.js's "Tile variants" section) gets its own brush. */
export function renderFgToolButtons() {
  els.fgToolGrid.innerHTML = '';
  const chars = [CELL.GROUND, ...variantCharsOfKind('ground'), CELL.HAZARD, ...variantCharsOfKind('hazard')];
  chars.forEach((c) => els.fgToolGrid.appendChild(makeToolButton(c, styleLabel(c), cellSwatchColor(c))));
  els.fgToolGrid.appendChild(makeToolButton(CELL.EMPTY, t('editor.tools.eraser'), '#1d1d2b'));
  syncToolButtonActive();
}

/** Background-layer equivalent of renderFgToolButtons. */
export function renderBgToolButtons() {
  els.bgToolGrid.innerHTML = '';
  const chars = [CELL.BACKGROUND, ...variantCharsOfKind('background')];
  chars.forEach((c) => els.bgToolGrid.appendChild(makeToolButton(c, styleLabel(c), cellSwatchColor(c))));
  els.bgToolGrid.appendChild(makeToolButton(CELL.EMPTY, t('editor.tools.eraser'), '#1d1d2b'));
  syncToolButtonActive();
}

// --- Layers ---

export function setLayer(layer) {
  editor.currentLayer = layer;
  els.layerFgBtn.classList.toggle('primary', layer === 'foreground');
  els.layerBgBtn.classList.toggle('primary', layer === 'background');
  els.fgTools.classList.toggle('hidden', layer !== 'foreground');
  els.bgTools.classList.toggle('hidden', layer !== 'background');
  editor.currentTool = layer === 'foreground' ? CELL.GROUND : CELL.BACKGROUND;
  syncToolButtonActive();
}

els.layerFgBtn.addEventListener('click', () => setLayer('foreground'));
els.layerBgBtn.addEventListener('click', () => setLayer('background'));

// --- Sidebar tabs ---
//
// Section/Tiles/Entities each get their own top-bar tab (see editor.html's
// .editor-tab/.tab-panel) so the sidebar only shows the controls relevant to what you're
// currently doing. Entities are foreground-only (see levelFormat.js's bgGrid docs: the
// background layer can't hold entities), so switching to the Entities tab also forces the
// Tiles tab's layer back to Foreground; without that guard, an entity tool selected while
// the Background layer was still active would get painted straight into bgGrid as a raw
// string, corrupting that cell's single-character invariant.
export function switchSidebarTab(tab) {
  document.querySelectorAll('.editor-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('hidden', p.dataset.tabPanel !== tab));
  if (tab === 'entities') setLayer('foreground');
}

document.querySelectorAll('.editor-tab').forEach((btn) => {
  btn.addEventListener('click', () => switchSidebarTab(btn.dataset.tab));
});
