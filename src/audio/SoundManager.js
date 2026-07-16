const MANIFEST_KEY = 'soundEvents';
const MANIFEST_PATH = 'assets/audio/sound-events.json';
const AUDIO_BASE_PATH = 'assets/audio/';

/**
 * Links abstract "events" (e.g. "jump", "win") to sound files, driven entirely by
 * assets/audio/sound-events.json: { "eventName": "file.ogg", ... }. Adding a new
 * sound to the game is a JSON edit + a file drop, not a code change.
 */
export default class SoundManager {
  /** Call from an early scene's preload() to fetch the manifest itself. */
  static queueManifestLoad(scene) {
    scene.load.json(MANIFEST_KEY, MANIFEST_PATH);
  }

  /**
   * Call from a later scene's preload() (after the manifest has finished loading)
   * to queue every sound file the manifest lists, keyed by its event name.
   * Returns the manifest so callers can inspect it if needed.
   */
  static queueSoundLoads(scene) {
    const manifest = scene.cache.json.get(MANIFEST_KEY) || {};
    Object.entries(manifest).forEach(([eventName, file]) => {
      scene.load.audio(eventName, AUDIO_BASE_PATH + file);
    });
    return manifest;
  }

  constructor(scene) {
    this.scene = scene;
  }

  /** Play the sound linked to `eventName`. No-op with a console warning if unmapped. */
  play(eventName, config) {
    if (!this.scene.cache.audio.exists(eventName)) {
      console.warn(`SoundManager: no sound loaded for event "${eventName}"`);
      return;
    }
    this.scene.sound.play(eventName, config);
  }
}
