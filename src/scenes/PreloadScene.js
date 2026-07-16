import SoundManager from '../audio/SoundManager.js';
import ParallaxBackground from '../world/ParallaxBackground.js';
import PlatformTextures from '../world/PlatformTextures.js';
import LevelLoader from '../world/LevelLoader.js';
import { queueLocaleLoads, initLocales } from '../i18n.js';

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    const { width, height } = this.cameras.main;

    const loadingText = this.add
      .text(width / 2, height / 2, 'Loading...', { fontSize: '24px', color: '#ffffff' })
      .setOrigin(0.5);

    this.load.on('complete', () => loadingText.destroy());

    // The player has no texture-based sprite (see Stickman.js), so there's nothing to
    // queue here for it. Sound files are queued from the manifest BootScene already
    // fetched; locale JSON is queued alongside it.
    SoundManager.queueSoundLoads(this);
    queueLocaleLoads(this);

    // No level has been chosen yet at this point in the flow, so preload every
    // parallax set and every level's sections; GameScene picks a level by key at create().
    ParallaxBackground.queueImageLoads(this);
    PlatformTextures.queueImageLoads(this);
    LevelLoader.queueSectionLoads(this);
  }

  create() {
    initLocales(this);
    this.scene.start('MenuScene');
  }
}
