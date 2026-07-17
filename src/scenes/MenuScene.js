import { showMainMenu, hideMainMenu } from '../ui/DomMenus.js';
import { getCampaign, getLevel, getSection } from '../data/db.js';
import { levelDefCacheKey, sectionCacheKey, campaignManifestCacheKey } from '../world/LevelLoader.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    // `campaignId` is null for "no campaign selected" (see DomMenus.showMainMenu, reset
    // every time the menu is shown): that's today's exact built-in-game behavior,
    // unchanged. A truthy campaignId means the player picked a user-authored,
    // IndexedDB-stored campaign (see src/data/db.js / the editor's Campaign panel):
    // its levels/sections aren't preloaded like the built-in game's are (BootScene/
    // PreloadScene only ever queue the static assets/levels/* files), so they're fetched
    // from IndexedDB here and seeded directly into Phaser's JSON cache
    // (cache.json.add: same read-side API LevelLoader already uses via cache.json.get,
    // just skipping the network load since the data's already in memory) before starting
    // GameScene at the campaign's first level.
    const start = async (campaignId) => {
      if (!campaignId) {
        this.scene.start('GameScene');
        return;
      }

      let campaign;
      try {
        campaign = await getCampaign(campaignId);
      } catch (err) {
        console.error('Failed to load campaign:', err);
        return;
      }
      if (!campaign || !campaign.levelIds || campaign.levelIds.length === 0) return;

      for (const levelId of campaign.levelIds) {
        const level = await getLevel(levelId);
        if (!level) continue;
        this.cache.json.add(levelDefCacheKey(levelId, campaignId), level);
        for (const sectionId of level.sections || []) {
          if (this.cache.json.has(sectionCacheKey(sectionId, campaignId))) continue;
          const section = await getSection(sectionId);
          if (section) this.cache.json.add(sectionCacheKey(sectionId, campaignId), section);
        }
      }
      this.cache.json.add(campaignManifestCacheKey(campaignId), campaign.levelIds);

      this.scene.start('GameScene', { level: campaign.levelIds[0], campaignId });
    };

    showMainMenu({ onStart: start });

    this.input.keyboard.once('keydown-SPACE', () => {
      hideMainMenu();
      start(null);
    });

    this.events.once('shutdown', hideMainMenu);
  }
}
