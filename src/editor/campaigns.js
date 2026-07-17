import { t } from '../i18n.js';
import { putCampaign, deleteCampaign, generateCampaignId, getAsset, deleteAsset } from '../data/db.js';
import { hasError } from '../data/validation.js';
import { ASSET_KIND, saveAssetFile, assetToDataUrl } from '../data/assets.js';
import { els } from './dom.js';
import { editor } from './state.js';
import { refreshValidation } from './validation.js';

// --- Campaign panel ---
//
// Additive to the Download/Load-file flow (sectionIO.js/levelSequence.js): sections/levels
// saved via library.js persist in this browser's IndexedDB with no manual file step, and
// can be grouped into a "Campaign" (ordered list of levels) that shows up in the game's
// main menu. Levels/sections stay globally reusable by id, same as the file-based model:
// deleting one that's still referenced elsewhere isn't blocked, it just surfaces as a
// validation error (see refreshValidation) instead.

export function renderCampaignSelect() {
  const prev = editor.currentCampaignId;
  els.campaignSelect.innerHTML = '';
  editor.campaigns.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    els.campaignSelect.appendChild(opt);
  });
  editor.currentCampaignId = editor.campaigns.some((c) => c.id === prev) ? prev : editor.campaigns.length ? editor.campaigns[0].id : null;
  if (editor.currentCampaignId) els.campaignSelect.value = editor.currentCampaignId;
}

export function currentCampaign() {
  return editor.campaigns.find((c) => c.id === editor.currentCampaignId) || null;
}

export function renderCampaignLevelList() {
  els.campaignLevelList.innerHTML = '';
  const campaign = currentCampaign();
  els.campaignNameInput.value = campaign ? campaign.name : '';
  if (!campaign) return;

  campaign.levelIds.forEach((id, idx) => {
    const li = document.createElement('li');
    if (hasError(editor.currentErrors, campaign.id, id)) li.classList.add('level-invalid');

    const span = document.createElement('span');
    span.textContent = `${idx + 1}. ${id}`;
    li.appendChild(span);

    const up = document.createElement('button');
    up.textContent = '↑';
    up.addEventListener('click', async () => {
      if (idx === 0) return;
      [campaign.levelIds[idx - 1], campaign.levelIds[idx]] = [campaign.levelIds[idx], campaign.levelIds[idx - 1]];
      await putCampaign(campaign);
      renderCampaignLevelList();
    });

    const down = document.createElement('button');
    down.textContent = '↓';
    down.addEventListener('click', async () => {
      if (idx === campaign.levelIds.length - 1) return;
      [campaign.levelIds[idx + 1], campaign.levelIds[idx]] = [campaign.levelIds[idx], campaign.levelIds[idx + 1]];
      await putCampaign(campaign);
      renderCampaignLevelList();
    });

    const remove = document.createElement('button');
    remove.textContent = '✕';
    remove.addEventListener('click', async () => {
      campaign.levelIds.splice(idx, 1);
      await putCampaign(campaign);
      renderCampaignLevelList();
      await refreshValidation();
    });

    li.append(up, down, remove);
    els.campaignLevelList.appendChild(li);
  });
}

els.campaignSelect.addEventListener('change', () => {
  editor.currentCampaignId = els.campaignSelect.value || null;
  renderCampaignLevelList();
  renderAssetList();
});

els.newCampaignBtn.addEventListener('click', async () => {
  const name = els.campaignNameInput.value.trim() || t('editor.newCampaignDefaultName');
  const campaign = { id: generateCampaignId(), name, levelIds: [], assets: { keyMap: {} } };
  await putCampaign(campaign);
  editor.campaigns.push(campaign);
  editor.currentCampaignId = campaign.id;
  renderCampaignSelect();
  renderCampaignLevelList();
  renderAssetList();
  await refreshValidation();
});

els.campaignNameInput.addEventListener('change', async () => {
  const campaign = currentCampaign();
  if (!campaign) return;
  campaign.name = els.campaignNameInput.value.trim() || campaign.name;
  await putCampaign(campaign);
  renderCampaignSelect();
});

els.deleteCampaignBtn.addEventListener('click', async () => {
  const campaign = currentCampaign();
  if (!campaign) return;
  if (!confirm(`${t('editor.confirm.deleteCampaignPrefix')} '${campaign.name}'? ${t('editor.confirm.deleteCampaignSuffix')}`)) return;
  // Unlike sections/levels/campaigns (globally reusable by id), an asset belongs
  // exclusively to the campaign that owns its keyMap entry: so it doesn't outlive it.
  const keyMap = (campaign.assets && campaign.assets.keyMap) || {};
  await Promise.all(Object.values(keyMap).map((systemKey) => deleteAsset(systemKey)));
  await deleteCampaign(campaign.id);
  editor.campaigns = editor.campaigns.filter((c) => c.id !== campaign.id);
  editor.currentCampaignId = null;
  renderCampaignSelect();
  renderCampaignLevelList();
  renderAssetList();
  await refreshValidation();
});

els.addLevelToCampaignBtn.addEventListener('click', async () => {
  const campaign = currentCampaign();
  const id = els.addLevelToCampaignSelect.value;
  if (!campaign || !id) return;
  campaign.levelIds.push(id);
  await putCampaign(campaign);
  renderCampaignLevelList();
  await refreshValidation();
});

// --- Assets (per-campaign, top-bar panel) ---
//
// Unlike sections/levels (global, reused by id across levels/campaigns), assets belong to
// exactly one campaign: the campaign's own `assets.keyMap` is the sole source of truth for
// which asset records belong to it (see the deleteCampaignBtn handler above for the
// cascade-delete this implies). Each entry is `{ [userKey]: systemKey }`: `userKey` is the
// editable display name; `systemKey` is the stable id actually used to store/retrieve the
// base64 record (see data/assets.js) and never changes, so renaming never has to move data.

function generateAssetSystemKey() {
  return `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function assetsOf(campaign) {
  if (!campaign.assets) campaign.assets = { keyMap: {} };
  if (!campaign.assets.keyMap) campaign.assets.keyMap = {};
  return campaign.assets;
}

/** Builds one asset row (thumbnail/icon + editable name + delete), shared by both the
 * Images/Sprites and Audio lists: the only thing that differs between them is which
 * container it's appended to and how the thumbnail renders (see renderAssetList). */
function buildAssetRow(userKey, systemKey, asset, keyMap, campaign) {
  const li = document.createElement('li');
  li.className = 'obj-item asset-item';

  const thumb = document.createElement('div');
  thumb.className = 'asset-thumb';
  if (asset.kind === ASSET_KIND.IMAGE) {
    const img = document.createElement('img');
    img.src = assetToDataUrl(asset);
    img.alt = userKey;
    thumb.appendChild(img);
  } else {
    // Audio has no meaningful visual thumbnail: a generic note icon stands in for it.
    thumb.classList.add('asset-thumb-audio');
    thumb.textContent = '🎵';
  }

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'asset-name-input';
  nameInput.value = userKey;
  nameInput.addEventListener('change', async () => {
    const newKey = nameInput.value.trim();
    if (!newKey || newKey === userKey) {
      nameInput.value = userKey;
      return;
    }
    if (keyMap[newKey]) {
      alert(`${t('editor.alert.assetNameExists')} '${newKey}' ${t('editor.alert.assetNameExistsSuffix')}`);
      nameInput.value = userKey;
      return;
    }
    delete keyMap[userKey];
    keyMap[newKey] = systemKey;
    await putCampaign(campaign);
    renderAssetList();
  });

  const removeBtn = document.createElement('button');
  removeBtn.textContent = '✕';
  removeBtn.className = 'danger';
  removeBtn.addEventListener('click', async () => {
    if (!confirm(`${t('editor.confirm.deleteAssetPrefix')} '${userKey}'?`)) return;
    delete keyMap[userKey];
    await putCampaign(campaign);
    await deleteAsset(systemKey);
    renderAssetList();
  });

  li.append(thumb, nameInput, removeBtn);
  return li;
}

/** Renders the Assets tab's two always-visible divided lists (Images/Sprites, Audio):
 * one shared upload button feeds both, routed by each asset's own `kind` (auto-detected
 * from the uploaded file's mime type: see data/assets.js's validateAssetFile). */
export async function renderAssetList() {
  els.assetListImage.innerHTML = '';
  els.assetListAudio.innerHTML = '';
  const campaign = currentCampaign();
  els.uploadAssetLabelBtn.disabled = !campaign;

  if (!campaign) {
    els.assetListImageEmpty.classList.remove('hidden');
    els.assetListImageEmpty.textContent = t('editor.assets.selectCampaignFirst');
    els.assetListAudioEmpty.classList.add('hidden');
    return;
  }

  const keyMap = assetsOf(campaign).keyMap;
  const imageRows = [];
  const audioRows = [];
  for (const [userKey, systemKey] of Object.entries(keyMap)) {
    const asset = await getAsset(systemKey);
    if (!asset) continue;
    (asset.kind === ASSET_KIND.IMAGE ? imageRows : audioRows).push({ userKey, systemKey, asset });
  }

  els.assetListImageEmpty.classList.toggle('hidden', imageRows.length > 0);
  els.assetListImageEmpty.textContent = t('editor.assets.imagesEmpty');
  els.assetListAudioEmpty.classList.toggle('hidden', audioRows.length > 0);
  els.assetListAudioEmpty.textContent = t('editor.assets.audioEmpty');

  for (const { userKey, systemKey, asset } of imageRows) {
    els.assetListImage.appendChild(buildAssetRow(userKey, systemKey, asset, keyMap, campaign));
  }
  for (const { userKey, systemKey, asset } of audioRows) {
    els.assetListAudio.appendChild(buildAssetRow(userKey, systemKey, asset, keyMap, campaign));
  }
}

els.uploadAssetLabelBtn.addEventListener('click', () => {
  if (!els.uploadAssetLabelBtn.disabled) els.uploadAssetFile.click();
});

els.uploadAssetFile.addEventListener('change', async () => {
  const file = els.uploadAssetFile.files[0];
  els.uploadAssetFile.value = '';
  if (!file) return;

  const campaign = currentCampaign();
  if (!campaign) return alert(t('editor.alert.selectCampaignFirst'));
  const keyMap = assetsOf(campaign).keyMap;

  // Dedupe the default key (the filename, minus its extension) against this campaign's
  // existing keys: the user can always rename afterward via the name field.
  let userKey = file.name.replace(/\.[^.]+$/, '') || file.name;
  if (keyMap[userKey]) {
    let n = 2;
    while (keyMap[`${userKey} ${n}`]) n++;
    userKey = `${userKey} ${n}`;
  }

  const systemKey = generateAssetSystemKey();
  try {
    await saveAssetFile(systemKey, file, userKey);
  } catch (err) {
    alert(err.message);
    return;
  }
  keyMap[userKey] = systemKey;
  await putCampaign(campaign);
  renderAssetList();
});
