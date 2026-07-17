import { computeAllErrors } from '../data/validation.js';
import { getAllSections, getAllLevels, getAllCampaigns } from '../data/db.js';
import { els } from './dom.js';
import { editor } from './state.js';
import { renderCampaignLevelList } from './campaigns.js';

export async function refreshValidation() {
  try {
    const [sections, levels, camps] = await Promise.all([getAllSections(), getAllLevels(), getAllCampaigns()]);
    const sectionsById = new Map(sections.map((s) => [s.id, s]));
    const levelsById = new Map(levels.map((l) => [l.id, l]));
    editor.campaigns = camps;
    editor.currentErrors = computeAllErrors({ campaigns: editor.campaigns, levelsById, sectionsById });
  } catch (err) {
    console.error('Validation refresh failed:', err);
    editor.currentErrors = [];
  }

  els.notifBadge.textContent = String(editor.currentErrors.length);
  els.notifBadge.classList.toggle('hidden', editor.currentErrors.length === 0);
  els.notifEmpty.classList.toggle('hidden', editor.currentErrors.length > 0);
  els.notifList.innerHTML = '';
  editor.currentErrors.forEach((e) => {
    const li = document.createElement('li');
    li.textContent = `${e.campaignName} › ${e.levelId}: ${e.message}`;
    els.notifList.appendChild(li);
  });

  renderCampaignLevelList();
}
