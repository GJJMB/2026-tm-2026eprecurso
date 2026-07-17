import { initLocalesViaFetch } from '../i18n.js';
import { editor } from './state.js';
import { loadState } from './sectionLifecycle.js';
import { renderSectionList } from './levelSequence.js';
import { applyTranslations } from './localization.js';
import { initLocalLibrary } from './library.js';

// Every module below registers its own DOM event listeners and/or exposes functions that
// other modules call directly; importing them here (even where nothing is used by name)
// is what actually wires the whole editor together, same as their code all living in one
// file used to.
import './tileStyles.js';
import './gridRender.js';
import './tilesetPanel.js';
import './inspector.js';
import './objectLists.js';
import './painting.js';
import './toolbar.js';
import './sectionIO.js';
import './levelSequence.js';
import './validation.js';
import './campaigns.js';
import './library.js';
import './localization.js';
import './textureLoader.js';

// --- Init ---
//
// Locale dictionaries must be fetched before anything renders: otherwise every t() call
// made while building the initial grid/panels would fall back to raw keys (t()'s
// no-dictionary-yet fallback) and briefly flash untranslated strings.
async function init() {
  await initLocalesViaFetch();
  applyTranslations();
  loadState(editor.section);
  renderSectionList();
  await initLocalLibrary();
}

init();
