# Qandil

A lantern-lit platformer built with vanilla HTML, CSS and JavaScript. No
frameworks, no build step, no external art or audio assets. You play a small
lantern spirit walking through abandoned, darkened places, carrying the only
light it has in its hand.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Gameplay](#gameplay)
  - [Controls](#controls)
  - [Player Mechanics](#player-mechanics)
  - [Resources and Scoring](#resources-and-scoring)
  - [Hazards](#hazards)
- [Content](#content)
  - [Worlds](#worlds)
  - [Levels](#levels)
- [Project Structure](#project-structure)
- [Running the Game](#running-the-game)
- [Architecture](#architecture)
  - [File Responsibilities](#file-responsibilities)
  - [Game Loop](#game-loop)
  - [Rendering Pipeline](#rendering-pipeline)
  - [Procedural Level Generation](#procedural-level-generation)
  - [Audio Engine](#audio-engine)
  - [Persistence](#persistence)
- [Internationalisation](#internationalisation)
- [Responsive Behaviour](#responsive-behaviour)
- [Performance Notes](#performance-notes)
- [Accessibility](#accessibility)
- [Customisation](#customisation)
- [Browser Support](#browser-support)
- [Credits](#credits)

---

## Overview

Qandil (Arabic: قنديل, "lantern") is a 2D side-scrolling platformer with a
light-driven theme. The core idea is simple: the character's visibility is
tied to a finite resource. Lamp oil drains continuously, and as it drains the
light radius around the spirit shrinks. Collecting oil flasks restores it.
Everything else in the game — the level layouts, the hazards, the three-star
scoring — is designed around that single tension.

The game ships as five worlds of five levels each, twenty-five levels in
total, with three stars available per level.

---

## Features

- **Pure vanilla stack.** No dependencies, no bundler, no transpiler. Open
  the HTML file and it runs.
- **Zero binary assets.** Every visual is drawn with the Canvas 2D API at
  runtime. Every sound and the entire soundtrack are synthesised with the
  Web Audio API.
- **Deterministic level generation.** All twenty-five levels are built at
  load time from a seeded PRNG, so every player gets the exact same layouts
  every time.
- **Validated geometry.** Nothing is placed in a level without passing a
  collision and fairness check first. No unreachable platforms, no hazards
  hidden under a drop-off, no checkpoints floating in the void.
- **Bilingual interface.** Full Arabic and English localisation with proper
  RTL/LTR layout switching, not a text swap on a fixed LTR layout.
- **Desktop and mobile.** Keyboard input on desktop, on-screen pads on
  touch devices, and an automatic landscape rotation for portrait phones.
- **Procedural soundtrack.** A generative chord progression with pad,
  arpeggio and bass voices, scheduled on the audio clock so it never drifts.
- **Persistent progress.** Stars, best times and settings are stored in
  `localStorage`.

---

## Gameplay

### Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move left | `Left Arrow` / `A` | Left pad button |
| Move right | `Right Arrow` / `D` | Right pad button |
| Jump | `Space` / `Up Arrow` / `W` | Jump button |
| Pause | `Escape` / `P` | Pause icon in the HUD |

Touch pads are bound with pointer events and pointer capture, so a finger
that slides slightly off a button keeps holding it instead of dropping the
input. The pressed state is driven from JavaScript rather than CSS `:active`
so it responds on the first frame.

### Player Mechanics

| Property | Value |
| --- | --- |
| Hitbox | 26 x 34 world units |
| Run speed | 320 units/s |
| Acceleration | 2600 units/s² |
| Friction | 2800 units/s² |
| Gravity | 2100 units/s² |
| Terminal velocity | 1150 units/s |
| First jump | 780 units/s |
| Second jump | 690 units/s |

The movement model includes three quality-of-life details that matter a lot
in practice:

- **Coyote time** — a 0.1 s window after leaving a ledge during which a jump
  still counts as a ground jump.
- **Jump buffering** — a jump pressed up to 0.13 s before landing fires the
  moment the character touches the ground.
- **Variable jump height** — releasing the jump key while rising applies
  extra gravity, giving short hops and full arcs from the same button.

The second jump is deliberately weaker than the first so the arc stays
controllable, and it refills the instant the player is grounded.

### Resources and Scoring

**Hearts.** Five per level. Losing a heart respawns the player at the last
checkpoint reached, with 1.4 s of invulnerability so a single mistake cannot
chain into a second death. When the fifth heart is lost, the level ends and
the player chooses between retrying and returning to the menu.

**Oil.** Starts at 100 and drains at 1.6 units/s, so a full tank lasts about
62 seconds. Each flask restores 38 units. The light radius around the spirit
scales with the remaining oil, which means running dry does not kill you
directly — it removes your ability to see what is coming.

**Gems.** Each level has a fixed set. Collecting all of them is required for
a high score.

**Stars.** Awarded at the end of a level:

| Stars | Condition |
| --- | --- |
| 1 | Reach the door |
| 2 | Reach the door and collect every gem |
| 3 | Reach the door, collect every gem, and finish within par time |

Par time is computed per level from its width and its hazard density, so a
dense late-game level gets a proportionally larger allowance rather than
sharing a flat multiplier with an easy opening level.

### Hazards

| Hazard | Behaviour |
| --- | --- |
| Spikes | Static, always lethal |
| Fire | Pulsing flame, active roughly 57% of its cycle |
| Lava | Static pool, always lethal |
| Fragile platforms | Crumble 0.55 s after being stood on |
| Falling out of the world | Lethal |

Every hazard is drawn so it reads as danger before the player reaches it.
Fragile platforms always show hairline cracks, which widen and glow during
the countdown. Fire lights its own surroundings through the darkness layer,
so a hazard is never invisible.

---

## Content

### Worlds

| # | World | Theme |
| --- | --- | --- |
| 1 | Clay House | Warm earth tones, rounded mud-brick platforms, low domed houses |
| 2 | Old Mosque | Cool teal light, marble slabs with gold inlay, minarets |
| 3 | The Market | Magenta dusk, wooden planks with cloth trim, hanging lanterns |
| 4 | The Ruined Court | Violet dust, cracked stone with moss, broken colonnades |
| 5 | Lantern Tower | Ember orange, riveted iron, tapering spires |

Each world has its own sky gradient, atmospheric layer, background
silhouette style, mid-layer parallax band, platform material and accent
palette. The music tempo rises slightly with the world index.

### Levels

Twenty-five levels, five per world, with a difficulty band that ramps from
0.08 to 0.88 across the set. Level width grows from 8,400 to 11,600 world
units.

<details>
<summary>Full level list</summary>

| # | World | Arabic | English |
| --- | --- | --- | --- |
| 1 | Clay House | أول شرارة | First Spark |
| 2 | Clay House | خطوة فاصلة | A Separate Step |
| 3 | Clay House | سلّم الظلال | Stair of Shadows |
| 4 | Clay House | قنديل معلّق | Hanging Lamp |
| 5 | Clay House | آخر ضوء | Last Light |
| 6 | Old Mosque | قوس الدخول | The Arch |
| 7 | Old Mosque | محراب مهجور | Abandoned Niche |
| 8 | Old Mosque | بئر النور | Well of Light |
| 9 | Old Mosque | قطعة زجاج | Shard of Glass |
| 10 | Old Mosque | ساعة الفجر | Dawn Hour |
| 11 | The Market | فوانيس السوق | Market Lanterns |
| 12 | The Market | حبل الحرير | Silk Rope |
| 13 | The Market | ليل طويل | Long Night |
| 14 | The Market | رقصة الظل | Shadow Dance |
| 15 | The Market | الفجر | Daybreak |
| 16 | The Ruined Court | بوابة الرمل | Gate of Sand |
| 17 | The Ruined Court | قناديل مقلوبة | Inverted Lamps |
| 18 | The Ruined Court | ممر الأشواك | Corridor of Thorns |
| 19 | The Ruined Court | سقوط حر | Freefall |
| 20 | The Ruined Court | عين العاصفة | Eye of the Storm |
| 21 | Lantern Tower | الدرج الأول | The First Stair |
| 22 | Lantern Tower | فانوس مزدوج | Twin Lanterns |
| 23 | Lantern Tower | قمة الظلام | Dark Summit |
| 24 | Lantern Tower | قلب القنديل | Heart of the Lantern |
| 25 | Lantern Tower | الفجر الأخير | The Last Dawn |

</details>

---

## Project Structure

```
Qandel/
├── index.html              Markup, inline SVG icon sprite, all screens and overlays
├── styles.css              Design tokens, layout, components, responsive rules
├── i18n.js                 Arabic and English string tables, language switching
├── levels.js               World definitions, level builder, all 25 levels
├── game.js                 State, physics, rendering, audio, input, UI wiring
├── manifest.webmanifest    PWA manifest — display:fullscreen, icons, orientation
├── sw.js                   Service worker — offline shell, cache versioning
├── icons/
│   ├── icon.svg            The lantern spirit, full-bleed
│   ├── maskable.svg        Same artwork, padded for Android's safe circle
│   ├── icon-192.png        Rasterised from icon.svg
│   ├── icon-512.png        Rasterised from icon.svg
│   ├── maskable-192.png    Rasterised from maskable.svg
│   ├── maskable-512.png    Rasterised from maskable.svg
│   └── make-icons.html     Opens in a browser; renders the four PNGs to download
├── README.md               This file
└── STORY.md                Narrative, worlds, difficulty curve
```

Load order in `index.html` is `i18n.js`, then `levels.js`, then `game.js`.
The first two define the globals that `game.js` consumes at boot.

---

## Running the Game

No installation and no build step are required.

**Local file.** Open `index.html` directly in a browser. Everything works,
including `localStorage`, on modern browsers.

**Local server.** Recommended if you plan to test on a phone over your
network:

```bash
# Python 3
python3 -m http.server 8000

# Node.js
npx serve .
```

Then open `http://localhost:8000`.

**Static hosting.** The project is a set of static files. Drop the folder on
GitHub Pages, Netlify, Vercel, Cloudflare Pages or any static host and it
works unchanged.

---

## Installing as an App (PWA)

The game can be installed to a phone's home screen and then runs with **no
browser chrome at all** — no URL bar, no toolbar, no status bar.

### Why the manifest, and not CSS

The URL bar and the toolbar are the browser's own interface. They are not part
of the page, and no amount of CSS or JavaScript can hide them from inside a
normal tab. There are exactly two honest routes to a chrome-free game:

| Route | What it does | Limitation |
| --- | --- | --- |
| **Fullscreen API** | Hides the chrome for the current tab | Needs a user gesture; no element fullscreen on iOS Safari |
| **Installing the PWA** | `display:fullscreen` removes the chrome permanently | Needs HTTPS and a manifest |

Qandil does both. Every entry point that is already a tap — *Begin Journey*,
a level tile, the Fullscreen row in Settings — calls the Fullscreen API, so a
desktop or Android player gets an edge-to-edge game immediately. Installing
the app is what makes it stick.

### The files

**`manifest.webmanifest`** declares `display: "fullscreen"`,
`orientation: "landscape"`, the theme colour, and the icon set. The
`display_override` array lists `fullscreen` first with `standalone` and
`minimal-ui` as fallbacks, so a browser that does not support true fullscreen
still installs the game in the best mode it can.

**`sw.js`** is the service worker. It precaches the shell — the three scripts,
the stylesheet, the manifest and the icons — so the game boots and is fully
playable with no network. Its strategy is deliberately split:

- **Navigations** are network-first, so a deploy is picked up on the next
  launch, with the cache as the offline fallback.
- **Same-origin assets** are cache-first, because the scripts and styles never
  change mid-session.
- **Cross-origin requests** (Google Fonts) are never cached. Caching them
  stores opaque responses that then fail to render offline.
- **Non-GET requests** pass straight through.

The cache name carries a version string. Bumping `VERSION` in `sw.js` retires
every old entry on the next activation, which is the only reliable way to
avoid serving a stale build.

**`icons/`** holds the artwork. `icon.svg` is the lantern spirit drawn with the
same geometry and the same gradients as `drawPlayer()` in `game.js` — the
cloak, the two dark eyes with their highlight dots, and the small caged lantern
with its white core. `maskable.svg` is the same drawing scaled to 74% and
re-centred, because Android crops maskable icons to a circle and anything
outside the 80% safe zone is lost. `make-icons.html` rasterises both SVGs into
the four PNG sizes the manifest asks for; open it in a browser and download
the results into `icons/`.

### Requirements

- **HTTPS** (or `localhost`). Service workers do not register on plain HTTP.
- Opening `index.html` from the filesystem still works — the game simply runs
  without the service worker, so it cannot be installed, but nothing breaks.

### Verifying the install

1. Serve the folder over HTTPS or `localhost`.
2. Open it in Chrome or Safari.
3. Chrome: the install icon appears in the address bar. Safari (iOS): Share →
   *Add to Home Screen*.
4. Launch from the home screen — the game opens in landscape, fullscreen, with
   no browser interface.

---

## Architecture

### File Responsibilities

**`index.html`** holds the entire DOM: one canvas, four screens (menu,
levels, settings, about), four overlays (pause, game over, results,
tutorial), the HUD, the touch pads, and an inline SVG sprite of every icon
used in the interface. Icons are referenced with `<use href="#id">`, so no
icon file is ever requested.

**`styles.css`** is organised in sections: design tokens, layout, menu,
buttons, screens, HUD, overlays, touch controls, tutorial card, game over
sheet, then media queries for small screens and reduced motion. Sizing uses
`clamp()` throughout so the interface scales continuously instead of
snapping at breakpoints.

**`i18n.js`** exports two flat key/value tables and three functions: `t()`
for lookup, `applyI18n()` to walk every `[data-i18n]` element, and
`setLang()` to switch and persist the choice.

**`levels.js`** defines the five worlds, the tuning constants, a seeded
PRNG, the `Builder` class with its placement and validation API, eight
segment templates, the segment picker, and the assembly routine that produces
all twenty-five levels at load.

**`game.js`** is a single IIFE in strict mode. It owns the canvas, the game
state, the physics step, the render pipeline, the audio engines, input
handling and all UI wiring.

### Game Loop

One `requestAnimationFrame` loop drives everything.

```
frame(now)
  ├─ dt = clamp((now - last) / 1000, 0, 0.1)
  ├─ S.t += dt                      // the only place the clock advances
  ├─ if playing and not paused:
  │    ├─ update(dt)                // physics, collisions, pickups
  │    ├─ updateHUD()
  │    └─ TUT.update()
  └─ render(dt)
```

Delta time is clamped at 0.1 s. That is high enough not to cut real frames on
a 60 Hz display, but low enough that a tab switch cannot teleport the player
through a wall. The game clock `S.t` advances in exactly one place, which
keeps every animation — flames, embers, gem bobbing, water bubbles — in sync
with the simulation.

The HUD is updated through a small cache so `textContent` and inline styles
are only written when a value actually changes, avoiding a forced re-layout
sixty times a second.

### Rendering Pipeline

Each frame is drawn in three passes.

1. **World pass.** The canvas transform is scaled by `SCALE` (viewport height
   divided by the 540-unit authoring height) so the world is always authored
   at a constant vertical field of view. Inside this pass: sky gradient,
   atmospheric layer, stars, far silhouettes, mid parallax, then everything
   inside the camera window — platforms, moving platforms, ceilings, lava,
   fragile platforms, spikes, checkpoints, the goal, gems, flasks, the player,
   fire, particles.

2. **Darkness pass.** A separate offscreen canvas is filled with a translucent
   dark overlay, then punched through with `destination-out` at the player's
   position and at every nearby light source, using a pre-rasterised radial
   gradient sprite. The result is composited over the scene, followed by a
   warm additive tint that gives the lantern light its colour.

3. **Screen-space pass.** Vignette, drawn from a cached canvas that is only
   rebuilt when the viewport size changes.

Everything outside the camera window plus a 140-unit margin is culled before
it reaches a draw call.

### Procedural Level Generation

Levels are generated, not hand-placed, but they are fully deterministic.

**Seeding.** A mulberry32 PRNG is seeded per level index with a fixed
constant mixed with the index. The same build produces the same twenty-five
levels on every machine, every run.

**The Builder.** Every placement goes through a method that validates before
it commits. `plat()`, `ceil()`, `crumb()` and `mover()` all run a padded
overlap test against existing geometry and refuse the placement if it
collides. `spike()`, `fire()` and `lava()` are stricter: a hazard must rest
on real solid ground, must leave a minimum headroom above it, must not
overlap anything, and must have nothing suspended directly over its
footprint. That last rule is what prevents a floating platform from sitting
just above a fire, where the player would drop off it straight into flames
with no chance to react.

**Segments.** Eight templates, each self-contained and each guaranteed to end
on solid ground:

| Segment | Shape |
| --- | --- |
| `run` | Continuous floor with ground hazards |
| `gap` | Floors separated by jumpable gaps |
| `stairs` | Rising or falling staircase |
| `island` | Floating islands over a void |
| `lava` | A pool crossed on stepping stones |
| `corridor` | A low ceiling that forces careful jumps |
| `mover` | A chasm crossed on moving platforms |
| `crumble` | A chain of fragile platforms |

Each has an `unlockAt` difficulty threshold, so mechanics are introduced in
order rather than all at once. The picker never repeats the same template
twice in a row, and gives a temporary weight boost to a template that has
just unlocked so the player actually meets the new mechanic.

**Ordering matters.** Inside several templates the order of placement is
load-bearing. In `run`, floating platforms are placed before hazards so the
hazard pass can see them and refuse to put fire underneath. In `lava`, the
stepping stones go down before the pool, because the pool reserves its whole
footprint and would otherwise reject every stone inside it, producing a
crossing with nothing to cross on. In `mover` and `crumble`, both banks are
placed first so the crossing has a corridor to exist in.

**Post-assembly passes.** Once the level is assembled:

- A **quota pass** tops up any hazard category that came out below its
  target, since the segment picker is probabilistic and could otherwise
  produce a level with no fires or no movers at all. It only ever adds, and
  every addition goes through the same validation.
- A **checkpoint pass** filters candidates: must sit on solid ground, never
  on a fragile platform, clear of hazards on both sides, and spaced at least
  900 units apart. An early checkpoint is inserted if the first one would
  otherwise be too far from the spawn.
- An **oil pass** places flasks at fixed intervals, always on solid ground.
- A **gem cleanup pass** drops any gem that ended up buried inside geometry.

### Audio Engine

Two independent systems share a single `AudioContext`.

**Sound effects** are short oscillator tones with exponential gain
envelopes — a rising triangle for a jump, a two-note sine pair for a gem, a
descending sawtooth for a death, a four-note arpeggio for a win.

**Music** is a generative sequencer. It runs an Am – F – C – G progression in
A minor at 70 BPM (rising slightly with the world index), with three voice
types: a soft detuned pad, a plucked bell arpeggio, and a round sine bass.
Everything is scheduled ahead of time on the audio clock rather than triggered
from a timer callback, so the tempo stays exact even when the tab is
throttled. A slow low-pass filter and a gentle stereo panner keep it soft.

The context is only created after a real user gesture, as browsers require.
It is suspended when the page is hidden and resumed on return, and the
soundtrack is hard-killed on `pagehide` and `beforeunload`.

### Persistence

Two `localStorage` keys:

| Key | Contents |
| --- | --- |
| `qandil.save.v1` | Per-level stars and best time, plus settings (sound, music, effect quality, tutorial seen) |
| `qandil.lang` | Selected language |

Both reads and writes are wrapped in `try/catch`, so the game runs normally
in private browsing modes where storage may be unavailable or throw.

Level unlocking is derived, not stored: level *n* is unlocked when level
*n − 1* has at least one star. Level 1 is always unlocked.

---

## Internationalisation

The interface ships in Arabic and English. Arabic is the default.

Switching language does not just swap strings. `applyI18n()` sets
`document.documentElement.lang` and `.dir`, which flips the entire layout to
RTL — the menu grid order, the sheet headers, the level grid, the padding
sides, the sheen animation on the primary button. The font stack also
changes: Cairo for Arabic, Outfit for English.

Two details are deliberately exempt from the direction flip:

- **The touch pads.** The movement pad is always physically on the left and
  the jump button always on the right, in both languages, because muscle
  memory should not depend on the selected language.
- **The arrow glyphs.** Left is always left.

---

## Responsive Behaviour

- **Portrait phones.** The entire stage is rotated 90° with a CSS transform
  so the game is always presented in landscape. The canvas sizing logic
  accounts for this by swapping the viewport width and height.
- **Continuous scaling.** Every size in the interface uses `clamp()` with
  viewport-relative units, so nothing snaps between breakpoints.
- **Short screens.** Dedicated media queries shrink the modal chrome, the
  star row and the button padding so the action buttons never fall below the
  fold. Overlays are content-sized and never scrollable — a modal that
  requires scrolling to find its own buttons is a broken modal.
- **Safe areas.** Touch pads respect `env(safe-area-inset-*)` for notched
  devices.
- **Reduced motion.** `prefers-reduced-motion` disables all animation and
  removes the rotating lamp rays.

---

## Performance Notes

The render loop was written with allocation pressure in mind, because at
60 fps every per-frame allocation compounds.

- **Cached light sprites.** Every radial gradient that does not change shape
  — the lantern hole, the warm tint, gem glow, flask glow, checkpoint glow,
  goal glow, player halo — is rasterised once into a small offscreen canvas
  and then blitted with `drawImage`. A dozen gems on screen used to cost a
  dozen gradient allocations per frame; now it costs a dozen blits.
- **Batched stars.** The starfield is quantised into four brightness buckets
  and drawn as four paths instead of eighty individual fills.
- **Batched motes.** All ambient dust particles are drawn in a single path.
- **Deterministic embers.** Ember positions are a pure function of time and
  index, so there is no particle array to maintain and no garbage.
- **View culling.** Platforms, hazards, gems and flasks outside the camera
  window are skipped entirely. Light holes in the darkness pass are only
  punched for objects near the camera.
- **HUD caching.** DOM writes are skipped when the value has not changed.
- **Device pixel ratio cap.** DPR is clamped to 2, which keeps the backing
  store reasonable on high-density phone screens.
- **Effect quality setting.** The low setting halves the particle count.

---

## Accessibility

- Every interactive control is a real `<button>` element.
- Overlays use `role="dialog"` or `role="alertdialog"` with `aria-modal`,
  `aria-labelledby` and `aria-describedby`.
- The hearts row is `aria-live="polite"` so life loss is announced.
- The tutorial card is `role="status"` with `aria-live="polite"` and
  `aria-atomic="true"`.
- Touch buttons carry `aria-label` text.
- `prefers-reduced-motion` is fully respected.
- All text scales with the viewport rather than being fixed in pixels.

---

## Customisation

**Tuning constants** live in two places and nowhere else:

- `game.js` — physics: `GRAV`, `MAXFALL`, `SPEED`, `ACC`, `FRIC`, `JUMPV`,
  `JUMPV2`, `MAX_JUMPS`, `MAX_HEARTS`.
- `levels.js` — geometry and generation: `TUNE` (ground height, gaps,
  headroom, checkpoint spacing, oil spacing) and `SEGMENTS` (per-template
  minimum width and unlock threshold).

**Adding a world** means pushing an entry into `WORLDS` in `levels.js` with
its palette and `archStyle`, then adding a matching `archStyle` branch in
`drawSky`, `drawArches`, `drawMidLayer`, `drawPlat` and `drawCeil` in
`game.js`.

**Adding a level** means adding a `LEVEL_META` entry. The builder handles the
rest. Changing `LEVEL_META` order changes the difficulty ramp, since the
index drives both width and difficulty band.

**Adding a segment template** means writing a function with the signature
`(B, x0, w, diff, rnd)` that returns the x position where it ends, then
registering it in `SEGMENTS` with a `minW` and an `unlockAt`.

**Changing the palette** is done through the CSS custom properties at the top
of `styles.css` for the interface, and through the `WORLDS` entries for the
game world.

---

## Browser Support

Requires a browser with Canvas 2D, Web Audio, Pointer Events, `ResizeObserver`
support, CSS `clamp()`, `aspect-ratio` and `dvh` units.

| Browser | Status |
| --- | --- |
| Chrome / Edge | Supported |
| Firefox | Supported |
| Safari (desktop and iOS) | Supported |
| Samsung Internet | Supported |

The game degrades gracefully where `AudioContext` is unavailable — it simply
runs silent. `roundRect` has a manual path fallback for older engines.

---

## Credits

Design and development: **Trex · Kivode**

Built with vanilla HTML, CSS and JavaScript. No third-party libraries, no
external assets. Fonts are Cairo and Outfit, served from Google Fonts.