import { ENTITY_TYPES } from '../world/levelFormat.js';

/** Sums playerSpawn/goal entities across every section belonging to one level — matches
 * GameScene.js's actual runtime behavior, which scans a level's whole assembled entity
 * list (all its sections concatenated) rather than checking any one section in isolation. */
export function countSpawnGoal(sectionsArray) {
  let spawnCount = 0;
  let goalCount = 0;
  for (const section of sectionsArray) {
    for (const entity of (section && section.entities) || []) {
      if (entity.type === ENTITY_TYPES.PLAYER_SPAWN) spawnCount++;
      else if (entity.type === ENTITY_TYPES.GOAL) goalCount++;
    }
  }
  return { spawnCount, goalCount };
}

/**
 * Pure validation over already-fetched data (no I/O here — callers do the IndexedDB
 * `getAll()`s once and pass Maps in). Returns a flat, already-ordered (by campaign, then
 * by the level's position within that campaign) list of
 * `{campaignId, campaignName, levelId, message}` errors covering:
 *  - a campaign referencing a level id that doesn't exist in `levelsById`.
 *  - a level referencing a section id that doesn't exist in `sectionsById`.
 *  - a level whose resolved sections don't sum to exactly one spawn and one goal.
 */
export function computeAllErrors({ campaigns, levelsById, sectionsById }) {
  const errors = [];

  for (const campaign of campaigns) {
    for (const levelId of campaign.levelIds || []) {
      const level = levelsById.get(levelId);
      if (!level) {
        errors.push({ campaignId: campaign.id, campaignName: campaign.name, levelId, message: 'level not found' });
        continue;
      }

      const sections = [];
      let missingSection = null;
      for (const sectionId of level.sections || []) {
        const section = sectionsById.get(sectionId);
        if (!section) {
          missingSection = sectionId;
          break;
        }
        sections.push(section);
      }
      if (missingSection) {
        errors.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          levelId,
          message: `references missing section '${missingSection}'`,
        });
        continue;
      }

      const { spawnCount, goalCount } = countSpawnGoal(sections);
      if (spawnCount === 0) errors.push({ campaignId: campaign.id, campaignName: campaign.name, levelId, message: 'missing spawn (0 found)' });
      else if (spawnCount > 1) errors.push({ campaignId: campaign.id, campaignName: campaign.name, levelId, message: `duplicate spawn (${spawnCount} found)` });
      if (goalCount === 0) errors.push({ campaignId: campaign.id, campaignName: campaign.name, levelId, message: 'missing goal (0 found)' });
      else if (goalCount > 1) errors.push({ campaignId: campaign.id, campaignName: campaign.name, levelId, message: `duplicate goal (${goalCount} found)` });
    }
  }

  return errors;
}

/** True if `levelId` (within `campaignId`) has at least one error in an already-computed
 * error list — used by the editor's campaign-level-list rows to decide `.level-invalid`. */
export function hasError(errors, campaignId, levelId) {
  return errors.some((e) => e.campaignId === campaignId && e.levelId === levelId);
}
