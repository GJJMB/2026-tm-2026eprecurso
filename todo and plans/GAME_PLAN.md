# Stickman Runner/Platformer — Build Plan

**Deadline: 17 July 2026, 23:59 (~34h from now, 16 July 13:28)**
Source spec: [EnunciadoEpocaRecurso_TP2_Phaser_2025.pdf](./EnunciadoEpocaRecurso_TP2_Phaser_2025.pdf)

## Concept

2D side-scrolling platformer/runner. Player controls a stickman affected by gravity/velocity
(Arcade Physics), running and jumping across platforms/obstacles to reach an end goal (flag/door).
MVP = get from start to finish with real physics, real obstacles, and a win/lose state. Everything
past that is a stretch goal, not a requirement.

**Physics decision:** use **Arcade Physics** (gravity + `setVelocity` + `collider`/`overlap`), not
Matter.js ragdoll physics. Arcade is what's taught in class, what the rubric explicitly rewards
("Uso de Phaser... física... quando aplicável"), and it's far lower-risk in the time available.
"Physics-based stickman" here means gravity/jump/collision feel, not a jointed ragdoll. If there's
time left after MVP + polish, a ragdoll death animation (Matter.js) is a fun stretch goal — not before.

**Player rendering decision (Phase 1):** the stickman is a `Phaser.GameObjects.Container` that
carries the Arcade body directly (no spritesheet). Its pose is redrawn every frame from a single
`Graphics` child using forward-kinematics-style limb angles pivoting from shoulder/hip points —
running/jumping/idle are computed poses, not pre-drawn frames. See
[../src/entities/Stickman.js](../src/entities/Stickman.js). Trade-off: this doesn't produce a
texture-based "sprite" for the player, which the rubric's "sprites e imagens" line technically
expects — worth having at least one texture-based image element elsewhere (background, goal flag)
to keep that box checked.

## Mandatory requirements this MVP must hit (from the spec)

- [x] Player controlled by keyboard, clear movement (run + jump)
- [x] Game elements that react to time/input (moving platform + spike hazard + pit)
- [x] Collisions via Arcade `overlap`/`collider`
- [x] Visible game state (HUD elapsed-time counter)
- [x] Game Over and/or Victory condition, with reset (press R / button)
- [x] At least 1 integrated sound (jump, win, lose — three OGG clips via SoundManager)
- [x] ≥ 2 languages (PT + EN) with an accessible selector, no duplicated UI strings in code
- [x] Reasonable asset sizes (3 OGG clips, ~4KB each; no images yet; nothing unused)
- [ ] Runs from a local HTTP server (Live Server / `npx serve` / `npm start`)
- [ ] Repo at root, `.gitignore`, README, tag `1.0`

## Project structure

```
2026-tm-2026eprecurso/
├── index.html
├── package.json
├── .gitignore
├── README.md
├── todo and plans/          (this file + the PDF — already fine to keep at root)
├── src/
│   ├── main.js              # Phaser config, scene registration
│   ├── i18n.js               # tiny translation helper (get(key), setLang(lang))
│   ├── locales/
│   │   ├── en.json
│   │   └── pt.json
│   ├── entities/
│   │   └── Stickman.js       # procedurally-posed physics player (Container + Graphics)
│   ├── audio/
│   │   └── SoundManager.js   # event-name -> sound-file system, driven by the JSON below
│   └── scenes/
│       ├── BootScene.js      # fetches sound-events.json, then hands off to PreloadScene
│       ├── PreloadScene.js   # queues audio + locale loads from the manifest, shows progress
│       ├── MenuScene.js      # title, language selector, start button
│       ├── GameScene.js      # the platformer level
│       └── GameOverScene.js  # win/lose screen, retry, back to menu
└── assets/
    ├── images/               # platform tiles/textures, goal flag, background (no player spritesheet)
    ├── audio/
    │   ├── sound-events.json # { "eventName": "file.ogg" } — edit this to add/remap sounds
    │   ├── jump.ogg           # ~4KB, self-synthesized (ffmpeg sine sweep), no licensing concerns
    │   ├── win.ogg
    │   └── lose.ogg
    └── fonts/                # optional
```

## Phased plan (time-boxed against the ~34h budget)

### Phase 0 — Scaffold (target: 1h)
- `npm init`, install/link Phaser 3 (npm or CDN — npm preferred for `npm start` story in README)
- `index.html` + `main.js` with empty Boot/Preload/Menu/Game/GameOver scenes wired up
- `.gitignore` for `node_modules/`
- Confirm it runs via `npx serve` / `live-server` in a real browser before writing any gameplay
- Git init, first commit

### Phase 1 — Core platforming (target: 4-5h) — DONE
- [x] Stickman (`src/entities/Stickman.js`): a `Container` carrying the Arcade body directly
  (gravity, `setAccelerationX`/drag for run, `setVelocityY` for jump only when grounded)
- [x] Static platforms (plain rectangles + `physics.add.existing(rect, true)`),
  `collider(player, platforms)`
- [x] Camera follows player (`startFollow` + deadzone), world bounds wider than one screen
- [x] Pose is **procedural, not spritesheet frames**: a `Graphics` child is redrawn every frame
  from limb angles computed from movement state (idle sway, run gait cycle scaled to speed,
  scissor-legs jump pose rising vs falling) — verified visually via headless-Chromium screenshots
  at each state

### Phase 2 — Level content + goal (target: 3-4h) — DONE
- [x] Pit gap in the ground (x 9001050) — falling past `deathY` (viewport height + 150,
  with physics world bounds extended below the visible area for room to actually fall)
  triggers Game Over. World/camera bound distinction matters here: `collideWorldBounds`
  stayed on as a safety net, but the world was made taller than the camera so the fall is
  visible before the death check fires.
- [x] Moving platform (`_addMovingPlatform`, vertical patrol) — a real Arcade `velocity`-driven
  patrol, not a manually-set position each frame, so Arcade's own collision separation
  carries a rider for free (confirmed: player Y tracked platform Y with a stable ~12px
  offset while `touching.down` stayed true)
- [x] Static spike hazard — `overlap` with the player triggers Game Over
- [x] Goal flag (pole + triangle, `Container` + Arcade body) at the end of the level —
  `overlap` triggers Victory
- [x] HUD: elapsed-time counter, top-left, pauses once the run ends
- [x] Reset: `GameOverScene` R now restarts `GameScene` directly (not via MenuScene)
- All four end states (goal win, hazard lose, pit-fall lose, moving-platform ride) verified
  via headless-Chromium with direct state teleportation (`body.reset`) for determinism,
  since blindly holding arrow keys in real time to reach each trigger would have been slow
  and imprecise. One test-coordinate gotcha along the way, not a game bug: the x=1040
  floating platform's footprint (9601120) overlaps most of the pit gap (9001050) by
  design (an elevated alternate path across the pit) — an early test teleport landed on
  its edge instead of falling, which looked like a broken pit until the coordinate was
  moved to x=930, safely inside the open part of the gap.

### Phase 3 — Audio + i18n (target: 2-3h — do NOT skip, both are hard requirements) — DONE
- [x] Sound-event system (`src/audio/SoundManager.js` + `assets/audio/sound-events.json`):
  the JSON maps `{ "eventName": "file.ogg" }`; `SoundManager.queueManifestLoad` (BootScene)
  fetches the JSON itself, `SoundManager.queueSoundLoads` (PreloadScene) reads it from cache
  and queues every file it lists under its event name, and `new SoundManager(scene).play(
  eventName)` plays it. Adding a new sound is a JSON edit + a file drop — no code change.
  Three self-synthesized OGG clips (`jump`, `win`, `lose`, ffmpeg sine/chirp tones, ~4KB
  each) wired to the jump action and the win/lose transition in `GameScene`.
- [x] `src/i18n.js`: `queueLocaleLoads`/`initLocales` load `src/locales/{en,pt}.json` into
  memory, `t(key)` looks up the current language (falls back to the key itself),
  `setLanguage()` persists to `localStorage`
- [x] All UI strings (menu title/start prompt, language label, game instructions, HUD
  "Time"/"Tempo" label, game over win/lose/restart text) pulled from locale files — zero
  hardcoded UI strings left in scene code
- [x] Language selector in MenuScene: EN/PT buttons, active language highlighted, click
  calls `setLanguage` + `scene.restart()` to re-render all text; selection persists across
  a reload via `localStorage`
- Verified via headless Chromium: both locale JSON files and all three audio files load
  into cache without errors, clicking PT re-renders the whole menu correctly (incl.
  accented characters), the language choice carries into GameScene's HUD/instructions and
  into the win/lose screen, and the `jump`/`win`/`lose` sound *events* actually fire
  (confirmed via a `scene.sound.on('play', ...)` listener — polling `sound.sounds.length`
  after the fact reads 0 because Phaser auto-cleans up short one-shot sounds once they
  finish playing, which looked like a bug until switched to an event listener). Actually
  judging whether the three clips *sound* right is left to a human ear, not headless
  screenshots — files are at `assets/audio/{jump,win,lose}.ogg`.

### Phase 4 — Polish pass / rubric coverage (target: 2-3h, cut first if time is short)
- MenuScene and GameOverScene should look intentional, not placeholder rectangles
- Camera shake or simple tween feedback on death/win (cheap rubric points under "Animações")
- Asset audit: delete any unused files in `assets/`, check total size stays well under 10 MB
- Sanity check every mandatory checkbox above against the actual running game

### Phase 5 — README + submission (target: 1-2h, do this well before the deadline, not at 23:50)
- Write README.md per spec §4.3: names+student numbers, "época de recurso" statement, Phaser
  version + how included, game description, controls, how to run, multimedia section (formats,
  origin, justification of size/compression)
- `git tag 1.0` on the commit you're actually submitting, `git push --tags`
- Create `numeroaluno.txt` (or `numeroaluno1_numeroaluno2.txt`) with repo URL + commit hash + names,
  submit on Moodle
- Confirm repo is public (or lecturer has access) and the project is at repo root, not a subfolder
- Schedule the mandatory in-person demo with the lecturer — do this early, don't wait

## Explicit non-goals for MVP (stretch only, in priority order if time remains)

1. Second level / multiple GameScene variants
2. Collectibles / scoring beyond pass-fail
3. Matter.js ragdoll death physics
4. Particle effects, screen transitions, background music loop
5. 3rd language
6. GitHub Pages deployment (optional bonus, spec explicitly allows it — do last)

## Risk notes

- Biggest time sink is usually asset creation (stickman spritesheet). Don't hand-draw frame-by-frame
  animation from scratch under time pressure — a simple 3-4 frame sprite (idle/run/jump) or even a
  primitive-shapes stickman (rectangles/circles as body parts, Arcade-physics-driven) is enough to
  satisfy the rubric. Visual polish is a stretch goal, not MVP.
- i18n and sound are both hard requirements that are easy to forget until the end — they're
  scheduled as Phase 3, before polish, on purpose.
- Leave Phase 5 (README/tag/submission) real buffer time. A late Moodle submission or missing tag
  risks the grade regardless of game quality.
