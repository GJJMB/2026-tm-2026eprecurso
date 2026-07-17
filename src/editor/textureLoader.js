import { editor } from './state.js';
import { renderTilesetFields } from './tilesetPanel.js';
import { renderInspector } from './inspector.js';

// Sprite keys available for the "Sprite" appearance mode, fetched once from
// assets/images/platform-textures.json (the editor is plain static JS, not a Phaser
// scene, so it can't use PlatformTextures.js's loader: a plain fetch does the same job).
fetch('assets/images/platform-textures.json')
  .then((res) => res.json())
  .then((manifest) => {
    editor.textureKeys = Object.keys(manifest);
    renderTilesetFields();
    renderInspector();
  })
  .catch(() => {});
