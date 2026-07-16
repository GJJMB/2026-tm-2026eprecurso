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

## Mandatory requirements this MVP must hit (from the spec)

- [ ] Player controlled by keyboard, clear movement (run + jump)
- [ ] Game elements that react to time/input (moving platforms or hazards)
- [ ] Collisions via Arcade `overlap`/`collider`
- [ ] Visible game state (lives or timer or checkpoint progress)
- [ ] Game Over and/or Victory condition, with reset (press R / button)
- [ ] At least 1 integrated sound
- [ ] ≥ 2 languages (PT + EN) with an accessible selector, no duplicated UI strings in code
- [ ] Reasonable asset sizes (compressed audio, proportional sprites, no unused assets)
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
│   └── scenes/
│       ├── BootScene.js      # minimal loader for preload assets
│       ├── PreloadScene.js   # loads all game assets + shows progress bar
│       ├── MenuScene.js      # title, language selector, start button
│       ├── GameScene.js      # the platformer level
│       └── GameOverScene.js  # win/lose screen, retry, back to menu
└── assets/
    ├── images/               # stickman spritesheet, platform tiles, goal flag, background
    ├── audio/                # jump.ogg, win.ogg/mp3, (optional bg music)
    └── fonts/                # optional
```

## Phased plan (time-boxed against the ~34h budget)

### Phase 0 — Scaffold (target: 1h)
- `npm init`, install/link Phaser 3 (npm or CDN — npm preferred for `npm start` story in README)
- `index.html` + `main.js` with empty Boot/Preload/Menu/Game/GameOver scenes wired up
- `.gitignore` for `node_modules/`
- Confirm it runs via `npx serve` / `live-server` in a real browser before writing any gameplay
- Git init, first commit

### Phase 1 — Core platforming (target: 4-5h)
- Stickman as an Arcade Physics sprite: gravity, left/right movement, jump (only when grounded)
- Static platform group, `collider(player, platforms)`
- Tilemap-free approach is fine: hand-placed platform sprites is enough for MVP
- Camera follows player, world bounds set beyond screen width
- Basic animation states (idle/run/jump) — even 2-3 frames each is enough

### Phase 2 — Level content + goal (target: 3-4h)
- One hazard/obstacle type that reacts to time or input (e.g. moving platform via tween, or a
  spike/pit that triggers Game Over on `overlap`)
- End-of-level goal object; reaching it via `overlap` triggers Victory
- Falling off the world / touching hazard triggers Game Over
- Visible game state: simple HUD (timer counting up, or lives counter, or checkpoint text)
- Reset: pressing R (or a button in GameOverScene) restarts GameScene cleanly

### Phase 3 — Audio + i18n (target: 2-3h — do NOT skip, both are hard requirements)
- Add jump sound + one more (win/death) — compress to OGG/MP3, keep files small
- `src/i18n.js`: loads `en.json`/`pt.json`, `t(key)` lookup, `setLang()` swaps text live
- All UI strings (menu title, buttons, HUD labels, game over/win text) pulled from locale files —
  zero hardcoded UI strings in scene code
- Language selector in MenuScene (two buttons/flags), persists selection (localStorage is fine)

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
