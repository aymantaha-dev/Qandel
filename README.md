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
  - [Teaching the Hazards](#teaching-the-hazards)
- [Content](#content)
  - [Worlds](#worlds)
  - [Levels](#levels)
- [Project Structure](#project-structure)
- [Running the Game](#running-the-game)
- [Installing as an App](#installing-as-an-app)
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

Qandil (Arabic: قنديل, "lantern") is a 2D side-scrolling platformer built
around one tension: the character's visibility is tied to a finite resource.
Lamp oil drains continuously, and as it drains the world goes dark — the light
radius shrinks, the surrounding darkness deepens, and the warm tint of the
lantern cools towards nothing. Oil flasks restore it. Level layouts, hazard
placement and the three-star scoring are all designed around that single
pressure.

The game ships as five worlds of five levels each — twenty-five levels, three
stars per level.

---

## Features

- **Pure vanilla stack.** No dependencies, no bundler, no transpiler. Open the
  HTML file and it runs.
- **Zero binary assets.** Every visual is drawn with the Canvas 2D API at
  runtime. Every sound and the whole soundtrack are synthesised with the Web
  Audio API.
- **Deterministic level generation.** All twenty-five levels are built at load
  time from a seeded PRNG, so every player gets the same layouts on every run
  and every device.
- **Eight hazard families, all present from level 1.** Spikes, fire, lava,
  saws, nails, falling stones, fragile platforms and moving platforms. Each is
  introduced in a survivable form and then scaled — count, speed, travel and
  fuse all read the level's difficulty index.
- **A colour ramp per world.** Stone, rim light, shadow, haze, spike metal and
  steel come from one table per world, so no renderer carries a hard-coded
  colour and a single frame of a floor identifies the world.
- **A signature per world.** Difficulty says how hard a level is; the world says
  what kind of hard. Clay leans on gaps and fragile stone, the Mosque on
  ceilings and nails, the Market on moving platforms and lava, the Court on
  blades and falling stone, the Tower on all of it at once.
- **Two hand-authored set-pieces.** A fragile bridge with one safe island and a
  blade above it, and a gate whose low ceiling turns a jump into a scrape. One
  lands in the middle of every level.
- **Contextual hazard cards.** The first time the player meets a spike, a saw, a
  nail row, a falling stone or a fragile platform, a card explains it — once, in
  place, without pausing. Persisted, so it never repeats.
- **Variable-timing traps.** Fragile platforms carry a per-instance fuse and a
  `respawn` flag, so roughly half return and half never do. The player learns
  the rule, not a memorised sequence.
- **A fairness floor on every fuse.** Nothing crumbles in under 0.30 s of
  contact, enforced in the builder rather than per template.
- **Validated geometry.** Nothing enters a level without passing a collision,
  clearance and fairness check first. No floating hazards, no unreachable
  platforms, no checkpoint standing in a fire.
- **Bilingual interface.** Full Arabic and English localisation with real
  RTL/LTR layout switching, not a string swap on a fixed LTR layout.
- **Desktop and mobile.** Keyboard on desktop, on-screen pads on touch, and an
  automatic landscape rotation for portrait phones.
- **Procedural soundtrack.** A generative chord progression with pad, arpeggio
  and bass voices, scheduled on the audio clock so it never drifts.
- **Installable.** A manifest and a service worker make the game a home-screen
  app with no browser chrome at all.
- **Persistent progress.** Stars, best times, unlocks and settings live in
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

Touch pads are bound with pointer events and pointer capture, so a finger that
slides slightly off a button keeps holding it instead of dropping the input. The
pressed state is driven from JavaScript rather than CSS `:active`, so it lights
up on the first frame.

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

Three details of the movement model matter more than they look:

- **Coyote time** — 0.1 s after leaving a ledge during which a jump still counts
  as a ground jump.
- **Jump buffering** — a jump pressed up to 0.13 s before landing fires the
  moment the feet touch.
- **Variable height** — releasing the jump key while rising applies extra
  gravity, so the same button gives both short hops and full arcs.

The second jump is deliberately weaker than the first so the arc stays
controllable, and it refills the instant the player is grounded.

### Resources and Scoring

**Hearts.** Five per level. Losing one returns you to the last checkpoint you
claimed, with 1.4 s of invulnerability so a single mistake cannot chain into a
second death. When the fifth heart goes the level ends, and the player chooses
between retrying it and returning to the menu.

**Oil.** Starts at 100 and drains at 1.6 units/s, so a full tank lasts about 62
seconds. Each flask restores 38 units. The lantern's reach runs from 470 world
units on a full tank down to 130 on empty; the ambient darkness deepens from
0.26 to 0.62 over the same span, the warm tint cools, and below a third the
light begins to tremble. Running dry does not kill you — it removes your ability
to see what is coming.

**Gems.** A fixed set per level. Collecting all of them is required for a high
score.

**Stars.** Awarded when a level ends:

| Stars | Condition |
| --- | --- |
| 1 | Reach the door |
| 2 | Reach the door and collect every gem |
| 3 | Reach the door, collect every gem, and finish within par time |

Par time is computed per level from its width and its hazard density, so a dense
late level gets a proportionally larger allowance instead of sharing a flat
multiplier with an easy opening level.

### Hazards

Eight hazard families. **Every one appears from level 1**, in its simplest
survivable form; what scales with difficulty is count, speed, size and timing —
never the rule itself.

| Hazard | Behaviour | Tell |
| --- | --- | --- |
| Spikes | Static row, always lethal | Dark wedge with a lit bevel and a specular tip, in the world's own spike ramp |
| Fire | Pulsing flame, active about 57% of its cycle | Embers drift even while it is out, so the pit stays visible |
| Lava | Static pit, always lethal | Molten body filling the whole chasm, a white-hot meniscus and lifting heat |
| Saws | Spinning blade on a fixed patrol (`x`, `y` or orbit) | Twelve real teeth, a hot rim and a hazard glow |
| Nails | Dense short metal rows, floor or ceiling | Thinner and brighter than spikes, with a visible base rail |
| Falling stones | Hang from a ceiling, drop when the player passes under | A dashed red rail showing exactly where they will land |
| Fragile platforms | Crumble a variable time after being stood on | The same stone as the ground, warming from the inside |
| Moving platforms | Carry the player over voids | Chains above, a lit underside, direction chevrons on the deck |
| Falling out of the world | Lethal | — |

**Fairness floor.** No fragile surface may vanish in under `TUNE.FUSE_MIN`
(0.30 s) of contact. Below that the player physically cannot react, and the
death stops being their fault. Every fuse is clamped to that value inside
`Builder.crumb()`.

**One continuous surface.** A ground hazard is legal only when its whole
footprint stands on a single platform at a single height. The builder probes the
entire row rather than its centre, so no spike or flame can overhang an edge.

**Visibility.** Every hazard punches its own hole in the darkness layer, so the
lantern reveals it before it can kill you. A hazard you cannot see is not a
hazard, it is a trap.

**Variation, not randomness.** Fragile platforms carry a per-platform fuse and a
`respawn` flag — roughly half come back after a cooldown, half never do. A chain
therefore cannot be memorised as a fixed shape: the player learns the *rule*
(keep moving) rather than the *timing* of one specific platform.

### Teaching the Hazards

The controls tutorial is a six-step sequence that runs once, on level 1, and
advances the moment the player performs each action rather than on a timer.

Hazards are taught separately, and contextually:

- Each of the five carded families — spikes, saws, nails, falling stones,
  fragile platforms — has its own card.
- A card fires the **first time the player actually sees** that hazard, on any
  level, at any point in a run.
- Each card fires **at most once, ever**, and the fact is persisted in
  `save.tutorialSeen`, so a returning player is never told about saws again.
- The card never pauses the game. It sits in the corner, dismisses itself after
  seven seconds, and can be tapped away early.
- Cards never interrupt the controls sequence: while the tutorial is running the
  hazard driver stands down.

A card explaining saws is only useful while the player is looking at a saw. A
card for every hazard, served on level 1, would be a wall of text nobody reads.

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

Each world carries a full colour ramp in `PALETTE` — a stone trio, a rim colour,
a shadow colour, a haze colour, a spike trio and a steel trio — which
`levels.js` attaches to the world so `game.js` reads it as `W.pal`. On top of
that, each world has its own sky gradient, atmospheric layer, background
silhouette style and mid-layer parallax band. The music tempo rises slightly
with the world index.

### Levels

Twenty-five levels, five per world. Width grows from 8,400 to 11,600 world
units across the set.

**Difficulty curve.** A convex ramp, `0.10 + (index/24)^1.35 * 0.88`, capped at
0.98:

| Level | `baseDiff` | What it feels like |
| --- | --- | --- |
| 1 | 0.10 | One slow blade, one short spike row, unbroken floor — a teaching level |
| 5 | 0.18 | Two of each, faster; fire arrives |
| 10 | 0.33 | Fragile chains, moving platforms, ceiling nails |
| 15 | 0.53 | Chasms and lava; falling stones become routine |
| 20 | 0.74 | Four saws, five nail rows, tight fuses |
| 25 | 0.98 | Everything at maximum: fastest blades, shortest fuses, densest mix |

The low floor lets level 1 open gently, and the exponent makes the last five
levels climb steeply enough to read as a different game from the opening.

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
├── levels.js               Worlds, palette, builder, generator, all 25 levels
├── game.js                 State, physics, rendering, audio, input, UI wiring
├── manifest.webmanifest    PWA manifest — standalone display, icons, orientation
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
└── STORY.md                Narrative, worlds, progression
```

Load order in `index.html` is `i18n.js`, then `levels.js`, then `game.js`. The
first two define the globals that `game.js` consumes at boot.

---

## Running the Game

No installation and no build step are required.

**Local file.** Open `index.html` directly in a browser. Everything works,
including `localStorage`, on a modern browser.

**Local server.** Recommended for testing on a phone across your network:

```bash
# Python 3
python3 -m http.server 8000

# Node.js
npx serve .
```

Then open `http://localhost:8000`.

**Static hosting.** The project is a set of static files. Drop the folder on
GitHub Pages, Netlify, Vercel, Cloudflare Pages or any static host and it works
unchanged.

---

## Installing as an App

The game installs to a phone's home screen and then runs with **no browser
chrome at all** — no URL bar, no toolbar, no status bar.

The URL bar is the browser's own interface, and no amount of CSS or JavaScript
can hide it from inside a normal tab. The only honest route to a chrome-free
game is installing the app. The Fullscreen API is deliberately not used: it
creates a second, competing layout mode in which the viewport changes size
underneath a page whose CSS has already been measured. One mode is better than
two, and the app window is the mode.

### The files

**`manifest.webmanifest`** declares `display: "standalone"`,
`orientation: "landscape"`, the theme colour and the icon set.

**`sw.js`** is the service worker. It precaches the shell — the three scripts,
the stylesheet, the manifest and the icons — so the game boots and is playable
with no network. Its strategy is deliberately split:

- **Navigations** are network-first, so a deploy is picked up on the next launch,
  with the cache as the offline fallback.
- **Same-origin assets** are cache-first, because the scripts and styles never
  change mid-session.
- **Cross-origin requests** (Google Fonts) are never cached. Caching them stores
  opaque responses that then fail to render offline.
- **Non-GET requests** pass straight through.

The cache name carries a version string. Bumping `VERSION` retires every old
entry on the next activation, which is the only reliable way to avoid serving a
stale build.

**`icons/`** holds the artwork. `icon.svg` is the lantern spirit drawn with the
same geometry and gradients as `drawPlayer()` — the cloak, the two dark eyes
with their highlight dots, and the small caged lantern with its white core.
`maskable.svg` is the same drawing scaled to 74% and re-centred, because Android
crops maskable icons to a circle and anything outside the safe zone is lost.
`make-icons.html` rasterises both SVGs into the four PNG sizes the manifest asks
for.

### Requirements

- **HTTPS** (or `localhost`). Service workers do not register on plain HTTP.
- Opening `index.html` from the filesystem still works — the game simply runs
  without the service worker, so it cannot be installed, but nothing breaks.

### Verifying the install

1. Serve the folder over HTTPS or `localhost`.
2. Open it in Chrome or Safari.
3. Chrome: the install icon appears in the address bar. Safari (iOS): Share →
   *Add to Home Screen*.
4. Launch from the home screen — the game opens in landscape, standalone, with
   no browser interface.

---

## Architecture

### File Responsibilities

**`index.html`** holds the entire DOM: one canvas, four screens (menu, levels,
settings, about), three overlays plus the tutorial card, the HUD, the touch pads
and an inline SVG sprite of every icon in the interface. Icons are referenced
with `<use href="#id">`, so no icon file is ever requested.

**`styles.css`** is organised in sections: design tokens, layout, menu, buttons,
screens, HUD, overlays, touch controls, tutorial card, game-over sheet, then
media queries for small screens and reduced motion. Sizing uses `clamp()`
throughout, so the interface scales continuously instead of snapping at
breakpoints.

**`i18n.js`** exposes two flat key/value tables and three functions: `t()` for
lookup, `applyI18n()` to walk every `[data-i18n]` element, and `setLang()` to
switch and persist the choice.

**`levels.js`** defines the five worlds, the colour ramp table, the tuning
constants, a seeded PRNG, the `Builder` with its placement and validation API,
fourteen segment templates, the segment picker with its per-world weight tables,
and the assembly routine that produces all twenty-five levels at load.

**`game.js`** is a single IIFE in strict mode. It owns the canvas, the game
state, the physics step, the render pipeline, the audio engines, input handling
and all UI wiring.

### Game Loop

One `requestAnimationFrame` loop drives everything.

```
frame(now)
  ├─ dt = clamp((now - last) / 1000, 0, 0.1)
  ├─ perfTick(dt)                    // adaptive post-processing guard
  ├─ S.t += dt                       // the only place the clock advances
  ├─ if playing and not paused:
  │    ├─ update(dt)                 // physics, collisions, pickups
  │    ├─ updateHUD()
  │    └─ TUT.update(dt)
  └─ render(dt)
```

Delta time is clamped at 0.1 s: high enough not to cut real frames on a 60 Hz
display, low enough that a tab switch cannot teleport the player through a wall.
The game clock `S.t` advances in exactly one place, which keeps every animation
— flames, embers, gem bobbing, lava bubbles, the trailing cloak — in sync with
the simulation.

The HUD is written through a small cache, so `textContent` and inline styles are
only touched when a value actually changes, avoiding a forced re-layout sixty
times a second.

### Rendering Pipeline

Each frame is drawn in four passes.

1. **World pass.** The transform is scaled by `SCALE` (viewport height divided
   by the 540-unit authoring height), so the world is always authored at a
   constant vertical field of view. Inside this pass: sky gradient, atmospheric
   layer, stars, far silhouettes, a haze band tinted with the world's own air
   colour, mid parallax, then everything inside the camera window — platforms,
   moving platforms, ceilings, lava, fragile platforms, spikes, nails, falling
   stones, checkpoints, the goal, gems, flasks, the player and its wake, fire,
   particles, and finally the saws, drawn last so a blade always reads as being
   in front of the player.

2. **Darkness pass.** An offscreen canvas is filled with a translucent dark
   overlay whose strength grows as the oil drains. The side shadows of the map
   are painted into this layer *before* the light holes, so the lantern cuts
   through them as the player walks into an edge and the world lights up on
   approach. The layer is then punched with `destination-out` at the player and
   at every nearby light source using a pre-rasterised radial sprite, composited
   over the scene, and followed by a warm additive tint whose warmth also
   follows the oil.

3. **Overlay pass.** Vignette and a top/bottom shade, both drawn from cached
   canvases that are rebuilt only when the viewport size changes.

4. **Post pass.** Bloom, then split-tone grade, then film grain — in that order,
   so the glow belongs to the image, the grade colours the glow, and the grain
   sits on top like film. Bloom samples the frame at one sixth of its size and is
   rebuilt on every other frame.

Everything outside the camera window plus a 140-unit margin is culled before it
reaches a draw call.

### Procedural Level Generation

Levels are generated rather than hand-placed, and fully deterministic.

**Seeding.** A mulberry32 PRNG is seeded per level index with a fixed constant
mixed with the index. The same build produces the same twenty-five levels on
every machine, every run.

**The Builder.** Every placement goes through a method that validates before it
commits. `plat()`, `ceil()`, `crumb()` and `mover()` run a padded overlap test
against existing geometry and refuse a collision. `spike()`, `fire()` and
`nail()` are stricter: a ground hazard must rest on one continuous surface, must
leave a minimum headroom above it, must not overlap anything, and must have
nothing suspended directly over its footprint. `crusher()` additionally demands
a real ceiling to hang from and a drop that reaches walkable ground.

**Segments.** Fourteen templates, each self-contained and each guaranteed to end
on solid ground. Twelve are generated from the difficulty index; `bridge` and
`gate` are hand-authored set-pieces with an identical layout on every seed.

| Segment | Shape |
| --- | --- |
| `run` | Continuous floor with ground hazards |
| `gap` | Floors separated by jumpable gaps |
| `stairs` | Rising or falling staircase |
| `island` | Floating islands over a void |
| `nails` | Floor rows plus ceiling slabs with hanging nails |
| `saws` | Blades patrolling the floor line on a fixed grid |
| `corridor` | A low ceiling that forces careful jumps |
| `mover` | A chasm crossed on moving platforms |
| `lava` | A pool crossed on stepping stones |
| `crumble` | A chain of fragile platforms with variable fuses |
| `crushers` | A hall of stones that drop from the ceiling |
| `gauntlet` | Saw, nails, saw, crusher, saw — one readable run |
| `bridge` | A fragile bridge, one safe island, one blade above it |
| `gate` | Low slabs with a floor hazard beneath, twice or more in a row |

**Every family is available from level 1.** `unlockAt` values run from 0.00 to
0.30, which every level satisfies, and the segment functions themselves read
`diff` and scale count, speed, travel and fuse. A level-1 saw run is one slow
blade over open ground; a late one is four fast blades with twice the patrol.

**Picker rules.** The picker never repeats a template twice in a row, and boosts
one that has just entered the pool so the player meets it repeatedly rather than
once. `run` and `gap` weights *decay* with difficulty (1.60 → 0.50), so the back
half of the game is genuinely dense rather than mostly open floor.

**World signature.** `pickSegment()` also takes the level's world index and
multiplies each template's weight by a `WORLD_BIAS` entry. The multipliers are
gentle — nothing becomes impossible, only characteristic — so five worlds stop
being five tints of one level.

**Pacing.** Every fourth segment is a set-piece. A weighted draw produces
density but never rhythm; one authored moment per stretch gives a level a shape
the player can remember.

**Ordering matters.** The order of placement inside several templates is
load-bearing. In `run`, floating platforms go down before hazards so the hazard
pass can see them and refuse a fire underneath. In `lava`, the stepping stones
go down before the pool, because the pool reserves its whole footprint and would
otherwise reject every stone inside it. In `mover` and `crumble`, both banks are
placed first so the crossing has a corridor to exist in.

**Post-assembly passes.** Once the level is assembled:

- A **quota pass** tops up any hazard family that came out below its target,
  since the picker is probabilistic. It only ever adds, and every addition goes
  through the same validation.
- A **checkpoint pass** filters candidates: solid ground, never a fragile
  platform, clear of every lethal family within a 220-unit forward and 170-unit
  backward window — including the full sweep of a saw — and at least 900 units
  apart. The fallback checkpoint is found by searching for a safe spot rather
  than assuming one. Each checkpoint stores the platform it hangs from, so a
  respawn places the feet on that surface with the whole body inside the stone.
- An **oil pass** places flasks at fixed intervals, always on solid ground.
- A **gem cleanup pass** drops any gem that ended up buried in geometry.

**Determinism.** Everything above is seeded from the level index alone, so the
geometry — platforms, hazards, gems, flasks, checkpoints — is identical for
every player, every run. A level can therefore be learned and a route optimised.

### Audio Engine

Two independent systems share a single `AudioContext`.

**Sound effects** are short oscillator tones with exponential gain envelopes — a
rising triangle for a jump, a two-note sine pair for a gem, a descending sawtooth
for a death, a four-note arpeggio for a win.

**Music** is a generative sequencer. It runs an Am – F – C – G progression in A
minor at 70 BPM (rising slightly with the world index), with three voice types:
a soft detuned pad, a plucked bell arpeggio, and a round sine bass. Everything is
scheduled ahead of time on the audio clock rather than triggered from a timer, so
the tempo stays exact even when the tab is throttled. A slow low-pass filter and
a gentle stereo panner keep it soft.

The context is only created after a real user gesture, as browsers require. It is
suspended when the page is hidden and resumed on return, and the soundtrack is
hard-killed on `pagehide` and `beforeunload`.

### Persistence

Two `localStorage` keys:

| Key | Contents |
| --- | --- |
| `qandil.save.v1` | Per-level stars and best time, the unlock record, and settings (sound, music, effects quality, tutorial flags) |
| `qandil.lang` | Selected language |

Both reads and writes are wrapped in `try/catch`, so the game runs normally in
private browsing modes where storage may be unavailable or throw.

Level unlocking is stored, not derived. `save.unlocked` is an explicit map of
level index to open, written the moment a level is entered, and `maxUnlocked`
records the highest index ever reached. A migration pass rebuilds the map from
the star table for saves created before it existed. Level 1 is always open.

---

## Internationalisation

The interface ships in Arabic and English, with Arabic as the default.

Switching language does not just swap strings. `applyI18n()` sets
`document.documentElement.lang` and `.dir`, which flips the whole layout to RTL —
the menu grid order, the sheet headers, the level grid, the padding sides, the
sheen on the primary button. The font stack changes too: Cairo for Arabic, Outfit
for English.

Two details are deliberately exempt from the flip:

- **The touch pads.** Movement is always physically on the left and jump always
  on the right, in both languages, because muscle memory should not depend on the
  selected language.
- **The arrow glyphs.** Left is always left.

---

## Responsive Behaviour

- **Portrait phones.** The whole stage is rotated 90° with a CSS transform so the
  game is always presented in landscape. The canvas sizing logic accounts for it
  by swapping the viewport width and height, and measures the stage's own rect
  rather than the window.
- **Continuous scaling.** Every size uses `clamp()` with viewport-relative units,
  so nothing snaps between breakpoints.
- **Short screens.** Dedicated media queries shrink the modal chrome, the star
  row and the button padding so the action buttons never fall below the fold.
  Overlays are content-sized and never scrollable — a modal that needs scrolling
  to reach its own buttons is a broken modal.
- **Safe areas.** Touch pads respect `env(safe-area-inset-*)` for notched
  devices.
- **Reduced motion.** `prefers-reduced-motion` disables animation and removes
  the rotating lamp rays.
- **Resize that lands.** The canvas re-fits on the next frame, then again after
  the transition settles, then once more as a safety pass, and reacts to
  `visualViewport` changes that `window.resize` misses when a mobile toolbar
  hides.

---

## Performance Notes

The renderer was written with allocation pressure in mind, because at 60 fps
every per-frame allocation compounds.

- **Cached light sprites.** Every radial gradient that never changes shape — the
  lantern hole, the warm tint, gem glow, flask glow, checkpoint glow, goal glow,
  player halo — is rasterised once into a small offscreen canvas and blitted with
  `drawImage`.
- **Batched stars.** The starfield is quantised into four brightness buckets and
  drawn as four paths instead of eighty individual fills.
- **Batched motes.** All ambient dust is drawn in a single path.
- **Deterministic embers.** Ember positions are a pure function of time and
  index, so there is no particle array and no garbage.
- **View culling.** Platforms, hazards, gems and flasks outside the camera window
  are skipped entirely, and light holes are only punched for objects near the
  camera.
- **HUD caching.** DOM writes are skipped when the value has not changed.
- **Device pixel ratio cap.** DPR is clamped to 2, which keeps the backing store
  reasonable on high-density screens.
- **Effect quality setting.** The low setting halves the particle count and skips
  bloom, grain and grade entirely.
- **Bloom on a budget.** The frame is sampled at one sixth of its size and the
  result rebuilt on every other frame; a one-frame-old blur is invisible, and it
  halves the cost of the most expensive pass in the renderer.
- **Adaptive post stack.** The loop measures its own frame time. If the average
  passes 23 ms the post stack disables itself for the rest of the session and the
  game returns to plain, sharp rendering.
- **Palette-driven drawing.** Every material colour is read from `W.pal` at draw
  time instead of being hard-coded per renderer.

---

## Accessibility

- Every interactive control is a real `<button>` element.
- Overlays use `role="dialog"` or `role="alertdialog"` with `aria-modal`,
  `aria-labelledby` and `aria-describedby`.
- The hearts row is `aria-live="polite"`, so life loss is announced.
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
- `levels.js` — geometry and generation: `TUNE`, `QUOTA`, `SEGMENTS`,
  `WORLD_BIAS`, `PALETTE`.

**Tuning a hazard family.** Each family owns a block in `TUNE`:

| Block | Constants |
| --- | --- |
| `SAW_*` | `SAW_R`, `SAW_DIST`, `SAW_SPEED` |
| `NAIL_*` | `NAIL_H`, `NAIL_STEP` |
| `CRUSH_*` | `CRUSH_H`, `CRUSH_DROP`, `CRUSH_SPEED` |
| `LAVA_*` | `LAVA_DROP`, `LAVA_DEPTH` |
| `FUSE_*` | `FUSE_MIN`, `FUSE_MAX`, `CRUMB_RESPAWN` |
| float | `MIN_FLOAT_CLEAR` — the air a floating stone must leave under itself |
| checkpoint | `CP_SPACING`, `CP_SAFE_FWD`, `CP_SAFE_BACK` |

Raising `FUSE_MIN` makes every fragile surface more forgiving at once; lowering
`CRUSH_SPEED` slows every falling stone. No segment code needs to change.

**World character** is tuned in `WORLD_BIAS` — one weight table per world, read
by the segment picker.

**Colour** is tuned in `PALETTE` — one ramp per world, attached to the world so
every renderer reads it.

**Adding a world** means pushing an entry into `WORLDS` with its palette entry
and `archStyle`, then adding a matching `archStyle` branch in `drawSky`,
`drawArches`, `drawMidLayer` and `drawPlatBody`.

**Adding a level** means adding a `LEVEL_META` entry; the builder handles the
rest. Reordering `LEVEL_META` changes the difficulty ramp, because the index
drives both width and difficulty band.

**Adding a segment template** means writing a function with the signature
`(B, x0, w, diff, rnd)` that returns the x position where it ends, then
registering it in `SEGMENTS` with a `minW` and an `unlockAt`.

**Changing interface colours** is done through the CSS custom properties at the
top of `styles.css`; game-world colour lives in `PALETTE` in `levels.js`.

---

## Browser Support

Requires Canvas 2D, Web Audio, Pointer Events, `ResizeObserver`, CSS `clamp()`,
`aspect-ratio` and `dvh` units.

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