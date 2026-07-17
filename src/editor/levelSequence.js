import { CELL_SIZE } from '../world/levelFormat.js';
import { els } from './dom.js';
import { editor } from './state.js';
import { download } from './sectionIO.js';

export function renderSectionList() {
  els.sectionList.innerHTML = '';
  editor.levelSections.forEach((id, idx) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = `${idx + 1}. ${id}`;
    li.appendChild(span);

    const up = document.createElement('button');
    up.textContent = '↑';
    up.addEventListener('click', () => {
      if (idx === 0) return;
      [editor.levelSections[idx - 1], editor.levelSections[idx]] = [editor.levelSections[idx], editor.levelSections[idx - 1]];
      renderSectionList();
    });

    const down = document.createElement('button');
    down.textContent = '↓';
    down.addEventListener('click', () => {
      if (idx === editor.levelSections.length - 1) return;
      [editor.levelSections[idx + 1], editor.levelSections[idx]] = [editor.levelSections[idx], editor.levelSections[idx + 1]];
      renderSectionList();
    });

    const remove = document.createElement('button');
    remove.textContent = '✕';
    remove.addEventListener('click', () => {
      editor.levelSections.splice(idx, 1);
      renderSectionList();
    });

    li.append(up, down, remove);
    els.sectionList.appendChild(li);
  });
}

els.addSectionBtn.addEventListener('click', () => {
  const id = (els.addSectionInput.value.trim() || editor.section.id).trim();
  if (!id) return;
  editor.levelSections.push(id);
  els.addSectionInput.value = '';
  renderSectionList();
});

/** Reads a numeric time-threshold input (max time or one medal), or undefined if left
 * blank/non-positive: both buildLevelData and the exported JSON treat "unset" as "this
 * level doesn't time-limit / doesn't offer this medal" (see GameScene/computeMedal). */
export function readSeconds(input) {
  const n = Number(input.value);
  return input.value.trim() !== '' && Number.isFinite(n) && n > 0 ? n : undefined;
}

export function buildLevelData() {
  const levelId = els.levelId.value.trim() || 'level';
  const medals = {
    gold: readSeconds(els.levelMedalGold),
    silver: readSeconds(els.levelMedalSilver),
    bronze: readSeconds(els.levelMedalBronze),
  };
  const hasMedals = medals.gold !== undefined || medals.silver !== undefined || medals.bronze !== undefined;
  return {
    id: levelId,
    parallax: els.levelParallax.value.trim() || levelId,
    cellSize: CELL_SIZE,
    sections: editor.levelSections,
    maxTimeSeconds: readSeconds(els.levelMaxTime),
    medals: hasMedals ? medals : undefined,
  };
}

export function loadLevelData(data) {
  els.levelId.value = data.id || 'level';
  els.levelParallax.value = data.parallax || data.id || 'level';
  els.levelMaxTime.value = Number.isFinite(data.maxTimeSeconds) ? data.maxTimeSeconds : '';
  const medals = data.medals || {};
  els.levelMedalGold.value = Number.isFinite(medals.gold) ? medals.gold : '';
  els.levelMedalSilver.value = Number.isFinite(medals.silver) ? medals.silver : '';
  els.levelMedalBronze.value = Number.isFinite(medals.bronze) ? medals.bronze : '';
  editor.levelSections = Array.isArray(data.sections) ? [...data.sections] : [];
  renderSectionList();
}

els.exportLevelBtn.addEventListener('click', () => {
  const data = buildLevelData();
  download(`${data.id}.json`, JSON.stringify(data, null, 2) + '\n');
});
