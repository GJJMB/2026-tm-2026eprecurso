import { t } from '../i18n.js';
import {
  isIndexedDbAvailable,
  getAllSections,
  getSection,
  putSection,
  deleteSection,
  getAllLevels,
  getLevel,
  putLevel,
  deleteLevel,
  getAllCampaigns,
} from '../data/db.js';
import { els } from './dom.js';
import { editor } from './state.js';
import { exportSection } from './sectionLifecycle.js';
import { importSectionData } from './sectionIO.js';
import { buildLevelData, loadLevelData } from './levelSequence.js';
import { refreshValidation } from './validation.js';
import { renderCampaignSelect, renderCampaignLevelList, renderAssetList } from './campaigns.js';

async function confirmOverwrite(kindLabel, id, existing) {
  if (!existing) return true;
  return confirm(`${t('editor.confirm.overwritePrefix')} ${kindLabel} '${id}' ${t('editor.confirm.overwriteSuffix')}`);
}

function fillSelect(select, ids) {
  const prev = select.value;
  select.innerHTML = '';
  ids.forEach((id) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    select.appendChild(opt);
  });
  if (ids.includes(prev)) select.value = prev;
}

export async function populateSectionSelects() {
  const sections = await getAllSections();
  fillSelect(els.loadSectionSelect, sections.map((s) => s.id).sort());
}

export async function populateLevelSelects() {
  const levels = await getAllLevels();
  const ids = levels.map((l) => l.id).sort();
  fillSelect(els.loadLevelSelect, ids);
  fillSelect(els.addLevelToCampaignSelect, ids);
}

els.saveSectionBtn.addEventListener('click', async () => {
  if (!isIndexedDbAvailable()) return alert(t('editor.alert.indexedDbUnavailable'));
  const data = exportSection();
  const existing = await getSection(data.id);
  if (!(await confirmOverwrite(t('editor.kind.section'), data.id, existing))) return;
  await putSection(data);
  await populateSectionSelects();
  await refreshValidation();
});

els.loadSectionBtn.addEventListener('click', async () => {
  const id = els.loadSectionSelect.value;
  if (!id) return;
  const data = await getSection(id);
  if (!data) return alert(`${t('editor.alert.notInLibraryPrefix')} ${t('editor.kind.section')} '${id}' ${t('editor.alert.notInLibrarySuffix')}`);
  importSectionData(data);
});

els.deleteSectionBtn.addEventListener('click', async () => {
  const id = els.loadSectionSelect.value;
  if (!id) return;
  if (!confirm(`${t('editor.confirm.deleteSectionPrefix')} '${id}' ${t('editor.confirm.deleteSectionSuffix')}`)) return;
  await deleteSection(id);
  await populateSectionSelects();
  await refreshValidation();
});

els.saveLevelBtn.addEventListener('click', async () => {
  if (!isIndexedDbAvailable()) return alert(t('editor.alert.indexedDbUnavailable'));
  const data = buildLevelData();
  const existing = await getLevel(data.id);
  if (!(await confirmOverwrite(t('editor.kind.level'), data.id, existing))) return;
  await putLevel(data);
  await populateLevelSelects();
  await refreshValidation();
});

els.loadLevelBtn.addEventListener('click', async () => {
  const id = els.loadLevelSelect.value;
  if (!id) return;
  const data = await getLevel(id);
  if (!data) return alert(`${t('editor.alert.notInLibraryPrefix')} ${t('editor.kind.level')} '${id}' ${t('editor.alert.notInLibrarySuffix')}`);
  loadLevelData(data);
});

els.deleteLevelBtn.addEventListener('click', async () => {
  const id = els.loadLevelSelect.value;
  if (!id) return;
  if (!confirm(`${t('editor.confirm.deleteLevelPrefix')} '${id}' ${t('editor.confirm.deleteLevelSuffix')}`)) return;
  await deleteLevel(id);
  await populateLevelSelects();
  await refreshValidation();
});

export async function initLocalLibrary() {
  if (!isIndexedDbAvailable()) {
    console.warn('IndexedDB is not available: local library/campaign features are disabled.');
    return;
  }
  try {
    await populateSectionSelects();
  } catch (err) {
    console.error('Failed to load saved sections:', err);
  }
  try {
    await populateLevelSelects();
  } catch (err) {
    console.error('Failed to load saved levels:', err);
  }
  try {
    editor.campaigns = await getAllCampaigns();
    renderCampaignSelect();
    renderCampaignLevelList();
    await renderAssetList();
  } catch (err) {
    console.error('Failed to load saved campaigns:', err);
  }
  await refreshValidation();
}
