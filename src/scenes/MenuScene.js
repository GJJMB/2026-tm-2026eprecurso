import { t, getLanguage, setLanguage, getSupportedLanguages } from '../i18n.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const { width, height } = this.cameras.main;

    this.add
      .text(width / 2, height / 2 - 60, t('menu.title'), { fontSize: '40px', color: '#ffffff' })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2, t('menu.start'), { fontSize: '20px', color: '#cccccc' })
      .setOrigin(0.5);

    this._addLanguageSelector(width / 2, height / 2 + 70);

    this.input.keyboard.once('keydown-SPACE', () => this.scene.start('GameScene'));
  }

  _addLanguageSelector(x, y) {
    this.add
      .text(x, y - 26, t('menu.language'), { fontSize: '14px', color: '#888888' })
      .setOrigin(0.5);

    const languages = getSupportedLanguages();
    const spacing = 70;
    const startX = x - ((languages.length - 1) * spacing) / 2;

    languages.forEach((lang, i) => {
      const isActive = lang === getLanguage();
      const button = this.add
        .text(startX + i * spacing, y, lang.toUpperCase(), {
          fontSize: '16px',
          color: isActive ? '#ffffff' : '#777777',
          backgroundColor: isActive ? '#333344' : '#242430',
          padding: { x: 10, y: 6 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      button.on('pointerdown', (pointer, localX, localY, event) => {
        event.stopPropagation();
        if (lang === getLanguage()) return;
        setLanguage(lang);
        this.scene.restart();
      });
    });
  }
}
