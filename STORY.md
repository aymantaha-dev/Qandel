# Qandil — World, Story and Progression

A companion document to `README.md`. This one covers the narrative, the five
worlds, the twenty-five levels, the systems that shape a run, and how long the
whole thing takes.

---

## Table of Contents

- [The Premise](#the-premise)
- [The Character](#the-character)
- [The Story, World by World](#the-story-world-by-world)
- [The Five Worlds in Detail](#the-five-worlds-in-detail)
- [The Twenty-Five Levels](#the-twenty-five-levels)
- [The Fourteen Segment Types](#the-fourteen-segment-types)
- [Hazard Quotas](#hazard-quotas)
- [Difficulty Curve](#difficulty-curve)
- [How to Play](#how-to-play)
- [Scoring and Mastery](#scoring-and-mastery)
- [How Long It Takes](#how-long-it-takes)
- [Design Philosophy](#design-philosophy)
- [Credits](#credits)

---

## The Premise

Qandil is a small lantern spirit. It has no name, no face beyond two dark
eyes, and no weapon. It carries one thing: a lantern, held low in one hand,
and that lantern is the only light left in a place that has gone dark.

The game does not tell this story in cutscenes. There is no dialogue, no
narration track, no text crawl between levels. The story is told by the
worlds themselves — five abandoned places, each one a step further from
warmth and a step closer to something that has been left burning at the top
of a tower.

What the player is doing is simple and never changes: walk forward through
the dark, keep the flame alive, reach the door.

---

## The Character

| Property | Detail |
| --- | --- |
| Form | A cloaked spirit, 26 by 34 world units |
| Light source | A lantern carried in one hand |
| Movement | Runs, jumps, double jumps |
| Vulnerable to | Spikes, fire, lava, saws, nails, falling stones, fragile ground, falling |
| Cannot | Attack, block, or fight in any way |

The spirit has no offensive ability at all. Every hazard must be avoided or
timed, never defeated. That constraint is what keeps the tension where it
belongs: on the light and on the route.

The lantern is drawn as a small dark cage with a bright core, so it reads as
an object being carried rather than a glow attached to the character. It hangs
on a short spring — it trails when you accelerate and floats up when you fall —
so it has weight without ever being in the way.

---

## The Story, World by World

The five worlds read as a single descent-then-ascent. Each is a place people
left, and each still holds a little of what they left behind.

**Clay House.** Where the journey starts. Low domed houses with warm windows
still faintly lit, straw-flecked mud brick, dust hanging in the air. The
gentlest place in the game, deliberately: it is where the player learns that
the light is finite and that the ground can be trusted.

**Old Mosque.** Cooler, taller, quieter. Marble slabs with gold inlay,
minarets, shafts of pale light falling from somewhere above. The architecture
turns vertical and the platforming follows — the first real heights, the first
moments where a missed jump means a fall rather than a stumble.

**The Market.** Colour and noise, or the memory of them. Cloth awnings,
hanging lanterns, banners strung across a magenta dusk. The most crowded world
visually, and the first one that makes you wait for windows rather than run.

**The Ruined Court.** The lights are gone. Broken colonnades, cracked stone,
moss on the edges, violet dust drifting upward instead of down. The widest
gaps and the least mercy. This is where the player either understands the
movement system completely or keeps dying.

**Lantern Tower.** The end. Riveted iron, tapering spires, embers rising from
below rather than falling from above. Every mechanic the game has taught is
present at once, and the final door is the brightest thing in the game.

The tower answers the question the other four worlds ask. Every place the
spirit passed through was dark because the light had been taken somewhere.
It was taken up.

---

## The Five Worlds in Detail

Each world owns a full colour ramp — a stone trio, a rim colour, a shadow
colour, a haze colour, a spike trio and a steel trio — and every renderer reads
its colours from that ramp. A single frame of a world's floor is enough to
identify it.

### World 1 — Clay House

| | |
| --- | --- |
| Levels | 1 – 5 |
| Difficulty band | 0.10 – 0.18 |
| Palette | Warm earth; stone `#a06a34 · #6b3f1d · #2a1609`, rim `#ffcf95` |
| Platform material | Rounded mud brick with straw flecks |
| Background | Low domed houses, lit windows, chimneys |
| Atmosphere | Warm dust haze rising from the ground |
| Signature | Wide floor, honest gaps, fragile stone |

The teaching world — but teaching does not mean empty. Every hazard family is
present from level 1 in its gentlest form: one slow blade over open ground, one
short spike row, a long stretch of unbroken floor. The player meets each
mechanic while there is still room to recover from getting it wrong.

The picker leans on `run`, `gap` and `crumble` here and keeps blades, nails and
falling stone rare.

The controls tutorial runs on level 1, once, and advances the moment the player
performs each action rather than on a timer. The hazard cards are separate:
they fire wherever the player first *sees* the thing, which may be here and may
be three worlds later.

### World 2 — Old Mosque

| | |
| --- | --- |
| Levels | 6 – 10 |
| Difficulty band | 0.21 – 0.33 |
| Palette | Cool teal; stone `#3f8b82 · #1f4d48 · #08201e`, rim `#b8fff2` |
| Platform material | Polished marble with a gold inlay line |
| Background | Minarets, arcades of pointed arches |
| Atmosphere | Pale shafts of light falling from above |
| Signature | The ceiling |

Verticality arrives. Floating islands and staircases become common, and low
slabs start appearing — ceilings that punish careless jumping. Fire becomes a
regular hazard rather than an occasional one.

The mosque's signature is the roof. It is the world that leans hardest on
`corridor`, `gate` and nail rows, because indoors the threat is not the drop,
it is what is above you.

### World 3 — The Market

| | |
| --- | --- |
| Levels | 11 – 15 |
| Difficulty band | 0.37 – 0.53 |
| Palette | Magenta; stone `#8e3a6c · #5a1e42 · #20081a`, rim `#ffc2e4` |
| Platform material | Wooden planks with cloth trim hanging off the edge |
| Background | Market awnings on poles, hanging lanterns |
| Atmosphere | Colourful cloth banners strung across the sky |
| Signature | Motion |

The midpoint, and the sharpest step up so far. Gaps widen past the comfortable
single-jump range and start demanding the second jump. Ceiling nails arrive —
the first hazard that forbids jumping outright, where the player has to walk
under instead of over.

The market's signature is motion: moving platforms, lava chasms, and the wide
gaps between them. The picker doubles the weight on `mover` and `lava`, so the
world is crossed rather than walked.

### World 4 — The Ruined Court

| | |
| --- | --- |
| Levels | 16 – 20 |
| Difficulty band | 0.57 – 0.74 |
| Palette | Violet; stone `#4b4480 · #2a2549 · #0d0b1a`, rim `#d9d0ff` |
| Platform material | Cracked stone blocks with moss on the top edge |
| Background | Shattered colonnades of unequal height, rubble |
| Atmosphere | Violet dust drifting upward |
| Signature | Things that fall |

Everything is in play and the quotas are near their ceiling: up to seven spike
runs, five fires, five saws and five nail rows in a single level, with falling
stones in every stretch.

The court's signature is falling: blades and stones, and the fragile stone that
turns a careful route into a sprint. It is the world most likely to end a run,
and the one where a player who has learned the movement starts moving through
it quickly, because the gaps are large but readable.

### World 5 — Lantern Tower

| | |
| --- | --- |
| Levels | 21 – 25 |
| Difficulty band | 0.79 – 0.98 |
| Palette | Ember; stone `#8c4214 · #4a2208 · #1a0802`, rim `#ffd0a0` |
| Platform material | Riveted iron with a glowing ember line |
| Background | Tapering spires with iron rings and lit windows |
| Atmosphere | Embers rising from below |
| Signature | Everything, at density |

Expert tier. Every segment type is in the pool, every hazard category is at
quota, and these are the longest levels in the game at 11,600 units. Nothing new
is introduced — the tower is a test of everything already taught, run fast.

What changes at this tier is not the rules but the numbers: blades at their
fastest, fuses at their shortest, falling stones at their deepest drop, and the
gauntlet segment — saw, nails, saw, crusher, saw in one unbroken run — turning
up regularly.

The final level, **The Last Dawn**, ends the way every level does: at a glowing
door. The difference is that there is no next level, and the results screen says
so.

---

## The Twenty-Five Levels

Difficulty is a single number per level:

```
baseDiff = min(0.98, 0.10 + (index / 24)^1.35 * 0.88)
```

Width scales on the same index, from 8,400 world units at level 1 to 11,600 at
level 25.

| # | World | Level | `baseDiff` | Width |
| --- | --- | --- | --- | --- |
| 1 | Clay House | First Spark | 0.10 | 8,400 |
| 2 | Clay House | A Separate Step | 0.11 | 8,533 |
| 3 | Clay House | Stair of Shadows | 0.13 | 8,667 |
| 4 | Clay House | Hanging Lamp | 0.15 | 8,800 |
| 5 | Clay House | Last Light | 0.18 | 8,933 |
| 6 | Old Mosque | The Arch | 0.21 | 9,067 |
| 7 | Old Mosque | Abandoned Niche | 0.24 | 9,200 |
| 8 | Old Mosque | Well of Light | 0.27 | 9,333 |
| 9 | Old Mosque | Shard of Glass | 0.30 | 9,467 |
| 10 | Old Mosque | Dawn Hour | 0.33 | 9,600 |
| 11 | The Market | Market Lanterns | 0.37 | 9,733 |
| 12 | The Market | Silk Rope | 0.41 | 9,867 |
| 13 | The Market | Long Night | 0.45 | 10,000 |
| 14 | The Market | Shadow Dance | 0.48 | 10,133 |
| 15 | The Market | Daybreak | 0.53 | 10,267 |
| 16 | The Ruined Court | Gate of Sand | 0.57 | 10,400 |
| 17 | The Ruined Court | Inverted Lamps | 0.61 | 10,533 |
| 18 | The Ruined Court | Corridor of Thorns | 0.65 | 10,667 |
| 19 | The Ruined Court | Freefall | 0.70 | 10,800 |
| 20 | The Ruined Court | Eye of the Storm | 0.74 | 10,933 |
| 21 | Lantern Tower | The First Stair | 0.79 | 11,067 |
| 22 | Lantern Tower | Twin Lanterns | 0.83 | 11,200 |
| 23 | Lantern Tower | Dark Summit | 0.88 | 11,333 |
| 24 | Lantern Tower | Heart of the Lantern | 0.93 | 11,467 |
| 25 | Lantern Tower | The Last Dawn | 0.98 | 11,600 |

---

## The Fourteen Segment Types

Every level is assembled from these, mixed by the segment picker. `bridge` and
`gate` are hand-authored: their layout is identical on every seed, and one of
them lands in the middle of every level.

| Segment | What it tests | Appears at |
| --- | --- | --- |
| `run` | Ground hazards, reading a hazard at speed | 0.00 |
| `gap` | Jump distance, the core skill | 0.00 |
| `stairs` | Vertical movement, timing on ascent and descent | 0.02 |
| `island` | Precision on small platforms over a void | 0.05 |
| `nails` | Restraint — a ceiling row forbids jumping | 0.08 |
| `saws` | Reading a fixed patrol and crossing between passes | 0.10 |
| `bridge` | One safe island and a blade above it | 0.10 |
| `corridor` | Low ceilings that punish careless jumping | 0.12 |
| `mover` | Patience and prediction | 0.15 |
| `gate` | A jump the low ceiling turns into a scrape | 0.16 |
| `lava` | Chaining jumps across stepping stones | 0.18 |
| `crumble` | Forward momentum — stopping is fatal | 0.18 |
| `crushers` | Crossing under a stone that is about to fall | 0.25 |
| `gauntlet` | Everything at once, in a readable order | 0.30 |

**Every family is available from level 1.** The `Appears at` column is not a
gate the player has to reach — it is the difficulty at which the template
starts showing up in the mix, and every value is low enough that level 1
qualifies for all of them. What scales is intensity: the segment functions read
`diff` and change their own count, speed, travel and fuse.

```
segment        level 1                          level 25
──────────────────────────────────────────────────────────────
saws           1 blade, slow, narrow patrol     4 blades, fast, wide patrol
nails          2 short floor rows               4 floor rows + 2 ceiling slabs
crushers       2 stones, slow, short drop       3 stones, fast, deep drop
crumble        3 stones, 0.35 s fuse            5 stones, 0.35 s fuse
bridge         1 safe island, slow blade        1 safe island, fast blade
```

The picker never repeats the same segment twice in a row, and boosts a template
that has just entered the pool so the player meets it several times in quick
succession instead of once and forgets it. The weights on `run` and `gap`
*decay* with difficulty (1.60 → 0.50), so the back half of the game is
genuinely dense rather than mostly open floor.

Two further rules shape a level:

- **Pacing.** Every fourth segment is a set-piece. A weighted draw produces
  density but never rhythm; one authored moment per stretch gives a level a
  shape the player can remember.
- **World character.** Each world carries its own weight table (`WORLD_BIAS`)
  that multiplies the picker's choice, so the same difficulty band reads
  differently in the Mosque than in the Market.

---

## Hazard Quotas

After a level is assembled, a top-up pass guarantees a minimum count of each
hazard family, scaled by the level's difficulty:

| Hazard | Quota |
| --- | --- |
| Spikes | 3 to 8 |
| Fire | 1 to 6 |
| Moving platforms | 1 to 3 |
| Lava pools | 1 to 3 |
| Nails | 1 to 6 |
| Saws | 1 to 5 |
| Falling stones | 1 to 4 |

**Every family has a floor of at least one at every difficulty.** No level can
be missing a mechanic, because the segment picker is probabilistic — without the
top-up pass a level could come out with no fires at all, flattening its curve
and letting a player reach world 3 without ever meeting a saw.

Two guards keep the top-up pass from making a level look random:

- **Attempts.** Each missing hazard gets up to four placement attempts with a
  fresh seed, across four sweeps at a 90-unit step. A single failed sweep never
  abandons a whole family.
- **Spacing.** Before anything is placed, `_nearHazard()` checks for an existing
  hazard inside a 140-unit window and refuses. Density in a level comes from the
  authored templates; the top-up pass only fills genuine gaps.

---

## Difficulty Curve

The curve is built from five independent layers that stack.

**Across the set.** Base difficulty follows `0.10 + (index/24)^1.35 * 0.88`,
capped at 0.98. This decides which templates are in the pool and how many
hazards are guaranteed.

The curve is deliberately not linear. A linear ramp spreads the same span
evenly across 24 steps, so no single level ever feels like a step up. The
exponent front-loads the gentle part and back-loads the steep part: levels 1–10
cover 0.10 → 0.33, while levels 20–25 cover 0.74 → 0.98. The endgame is a
different game from the opening, and the player can feel the moment it changes.

**Within a level.** Difficulty is modulated by progress:
`baseDiff + (progress − 0.5) × 0.22`. The opening of a level is slightly easier
than its band and the final stretch is noticeably harder. The hardest moment in
any level is always the last third.

**Through segment intensity.** Every template is available from the start; what
changes is how hard each one is when it appears — see the table above.

**Through hazard density.** The quotas grow with difficulty, so a late level is
not just longer, it has more in it per unit of distance.

**Through world character.** Each world's weight table pushes its own families
forward, so the shape of a level changes as much as its numbers do.

Nothing is ever introduced and then abandoned: `mover` and `lava` carry extra
weight in the picker so they cannot vanish from late levels, and every family
has a quota floor.

---

## How to Play

### The Loop

1. Enter a level with five hearts and a full tank of oil.
2. Move right. Collect gems. Collect oil flasks.
3. Touch checkpoints to save your respawn position.
4. Reach the glowing door at the end.

### Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move left | `Left Arrow` / `A` | Left pad |
| Move right | `Right Arrow` / `D` | Right pad |
| Jump | `Space` / `Up Arrow` / `W` | Jump button |
| Pause | `Escape` / `P` | Pause icon |

### What Kills You

Eight hazard families, each with one rule. Every one appears from level 1.

| Hazard | The rule |
| --- | --- |
| Spikes | Static, lethal on contact. Jump it. |
| Fire | Lights and dies on a steady rhythm. Read the beat, cross while it is out. |
| Lava | Never goes out. Cross on the stones or not at all. |
| Saws | A spinning blade on a fixed patrol. Watch the far end of its travel. |
| Nails | Dense short rows, floor or ceiling. The ceiling kind forbids jumping. |
| Falling stones | Drop when you pass under. The red rail shows where. |
| Fragile platforms | Crumble after a variable delay. The stone warms before it gives way. |
| Moving platforms | Carry you over voids. Their motion is regular and learnable. |

**Falling** below the bottom of the view costs a heart.

**The timing rule.** Fragile platforms carry their own fuse and a respawn flag,
so half of them come back and half never do. A player who memorises one chain
will die on the next; a player who understands "keep moving" will cross any of
them.

**The fairness floor.** No fuse is shorter than 0.30 s. That is not a tuning
choice, it is a promise: below that threshold the player cannot physically
react, and the death stops being their fault.

### Learning the Hazards

The controls are taught in six steps on the first level. The hazards are not
taught in a sequence at all — each introduces itself the first time the player
actually sees it, wherever that happens to be. A card appears in the corner,
says what the thing is and how to beat it, then leaves. It does not pause the
game, and it never comes back.

A lesson lands hardest at the moment it is needed. A player reading about saws
while standing in front of a saw will remember it; the same player reading about
saws on level 1, with no saw in sight, will not.

### The Two Things That Run Out

**Hearts.** Five per level. Losing one puts you back at the last checkpoint you
touched, with 1.4 s of invulnerability so a mistake cannot chain into a second
death. Lose all five and the level ends — you choose between retrying it from
the start and returning to the menu.

**Oil.** Drains at 1.6 units per second from a maximum of 100, so a full tank
lasts about 62 seconds. Each flask restores 38 units. The lantern's reach runs
from 470 world units at a full tank to 130 at empty, the surrounding darkness
deepens as it falls, and below a third the light begins to tremble. Running dry
does not kill you; it makes the level unreadable, which amounts to the same
thing.

### Practical Advice

- **Do not hoard the double jump.** It refills the instant you touch ground.
  Use it to extend a jump you have already committed to.
- **Watch the light, not the meter.** The oil bar gives the number, but the
  shrinking circle tells you whether you can still see the next platform.
- **Read a hazard before you reach it.** Fire lights its own surroundings
  through the darkness layer, so a pulsing glow ahead means time your approach
  instead of running at it.
- **Never stop on a fragile platform.** A crumble chain is a rhythm, not a set
  of individual jumps.
- **Read a saw's far end, not its centre.** The blade is always somewhere in the
  middle of its travel. What matters is where it will be when you arrive.
- **A ceiling nail row means walk, not jump.** The instinct to hop is exactly
  what kills you there.
- **A falling stone's red rail is the whole answer.** It shows the landing spot
  before the stone moves. Cross while the stone is raised; never step into the
  rail as it comes down.
- **Checkpoints are lanterns, not flags.** They stand on solid ground that
  cannot crumble, well clear of anything lethal, and they put you back with your
  feet on the stone you claimed them from.
- **The camera leads you.** It sits the character slightly left of centre and
  pushes further ahead the faster you run, so trust what you can see on the
  right.

---

## Scoring and Mastery

| Stars | Requirement |
| --- | --- |
| 1 | Reach the door |
| 2 | Reach the door with every gem in the level |
| 3 | Reach the door with every gem, within par time |

Par time is not a flat multiplier. It is computed per level as:

```
par = (width / 320) × (1.95 + difficulty × 0.85)
      + spikes   × 1.6
      + fires    × 2.0
      + lava     × 2.8
      + movers   × 3.0
      + nails    × 1.4
      + saws     × 2.6
      + crushers × 3.0
```

The first term is travel time scaled by difficulty. The second group adds a
per-hazard cost, weighted by how much each one actually slows a competent player
down: a saw or a crushing stone costs more than a spike because it forces a
wait, not just a jump. That is what makes a three-star run on level 25 demanding
and still reachable.

Best time is recorded per level. A new best overwrites the old one, and a better
star count is never downgraded by a worse run.

Level *n* is unlocked the moment it is entered, and the fact is written down:
`save.unlocked` records every level the player has stood in, and a migration
pass rebuilds that record from the star table for older saves. Entering a level
is therefore the only requirement for progression; stars are for players who
want all of it.

---

## How Long It Takes

These figures come from the level dimensions and the movement constants.

### Per Level

| Measure | Value |
| --- | --- |
| Level width | 8,400 to 11,600 world units |
| Run speed | 320 units/s |
| Effective speed | roughly 65% of maximum, accounting for jumps, corrections and pauses |
| Pure traversal time | 40 to 56 seconds |
| Realistic first clear | 2 to 5 minutes |
| Realistic clean run | 1 to 2 minutes |

### Full Playthrough

| Playstyle | Estimated time |
| --- | --- |
| Deathless run, all 25 levels, no retries | about 20 minutes |
| First playthrough, learning each level | 1.5 to 2.5 hours |
| All 25 levels at three stars | 3 to 5 hours |
| Completionist, including best-time chasing | open-ended |

The deathless figure is the design target: 25 levels averaging roughly 10,000
units, at an effective 208 units/s, works out to about 1,200 seconds of pure
movement. Everything above that is the cost of the learning.

### Where the Time Goes

- **Worlds 1 and 2** are fast. A confident player clears each level on the first
  or second attempt.
- **World 3** is where retries begin. Moving platforms and lava require waiting
  for a window, which adds real time even to a clean run.
- **World 4** is the time sink on a first playthrough. Wide levels, dense
  hazards, and a checkpoint spacing of 900 units mean a death in the middle
  costs a meaningful chunk of progress.
- **World 5** is fast for a player who has mastered the movement and slow for
  one who has not. There is no new information here, only density.

---

## Design Philosophy

A few principles shaped everything above.

**The light is the game.** The oil meter is not a timer bolted onto a
platformer. It decides how much of the level you can see, and therefore how much
of the level you can plan. Every other system is subordinate to it — the radius,
the ambient darkness, the warmth of the tint and the additively lit bloom all
answer to the same number.

**Nothing is placed blind.** Every platform, hazard, gem, flask and checkpoint
passes a validation call before it is committed. A hazard must rest on one
continuous surface, leave headroom above it, and have nothing suspended over its
footprint. A ground hazard is checked across its whole width, not just its
centre, so nothing can overhang an edge. A checkpoint must sit on solid ground
that cannot crumble, stand clear of every lethal family, and be far enough from
the previous one to matter. The builder refuses a bad placement rather than
placing it and hoping.

**Determinism over randomness.** Levels come from a seeded PRNG, so they are the
same for everyone, every run. A level can be learned, a route optimised, and a
three-star time chased. Procedural does not have to mean unpredictable.

**Hazards must be legible.** Every hazard reads as danger before the player
reaches it, and every one punches its own hole in the darkness layer so the
lantern reveals it before it can kill you:

- **Fire** lights its own surroundings and keeps its embers drifting even while
  the flame is out, so the pit never disappears.
- **Lava** fills its whole chasm, burns a white-hot line along the entire
  surface, and throws heat up over the rim.
- **Fragile platforms** look exactly like the ground they sit between, and warm
  from the inside as the countdown runs.
- **Falling stones** carry a dashed red rail showing exactly where they will
  land, before they ever move.
- **Saws** have twelve real teeth, a hot rim and a hazard glow.
- **Nails** are thinner and brighter than spikes, with a visible base rail, so
  the two are never confused.
- **Moving platforms** have chains above them, direction chevrons on the deck,
  and a lit underside.

Nothing in the game is dangerous without looking dangerous first. A hazard the
player cannot see is not a hazard, it is a trap.

**The character cannot fight.** No combat, no power-ups, no upgrades. The spirit
has movement and light, and the whole game is built to make those two enough.

---

## Credits

Design and development: **Trex · Kivode**

See `README.md` for the technical architecture, project structure and
customisation guide.