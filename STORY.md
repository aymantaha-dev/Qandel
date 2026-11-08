# Qandil — World, Story and Progression

A companion document to `README.md`. This one covers the narrative, the
worlds and levels in detail, the difficulty curve, how the game is meant to
be played, and how long it takes to finish.

---

## Table of Contents

- [The Premise](#the-premise)
- [The Character](#the-character)
- [The Story, World by World](#the-story-world-by-world)
- [The Five Worlds in Detail](#the-five-worlds-in-detail)
- [The Twenty-Five Levels](#the-twenty-five-levels)
- [Difficulty Curve](#difficulty-curve)
- [How to Play](#how-to-play)
- [Scoring and Mastery](#scoring-and-mastery)
- [How Long It Takes](#how-long-it-takes)
- [Design Philosophy](#design-philosophy)

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

What the player is doing is simple and does not change: walking forward
through the dark, keeping the flame alive, and reaching the door at the end.

---

## The Character

| Property | Detail |
| --- | --- |
| Form | A cloaked spirit, roughly 26 by 34 units |
| Light source | A lantern carried in one hand |
| Movement | Runs, jumps, double jumps |
| Vulnerable to | Spikes, fire, lava, falling, crumbling ground |
| Cannot | Attack, block, or fight in any way |

The spirit has no offensive ability at all. Every hazard in the game must be
avoided or timed, never defeated. This is a deliberate constraint: it keeps
the tension focused entirely on the light and the route.

The lantern in its hand is drawn as a small dark cage with a bright core, so
it reads as an object being carried rather than a glow attached to the
character. The light it casts is what actually lights the level. When the oil
runs low, that light contracts, and the world closes in.

---

## The Story, World by World

The five worlds are read as a single descent-then-ascent. Each one is a place
that people left, and each one still holds a little of what they left behind.

**Clay House.** Where the journey starts. Low domed houses with warm windows
still faintly lit, straw-flecked mud brick, dust hanging in the air. This is
the gentlest place in the game and it is meant to be — it is where the player
learns that the light is finite and that the ground can be trusted.

**Old Mosque.** Cooler, taller, quieter. Marble slabs with gold inlay,
minarets, shafts of pale light falling from somewhere above. The architecture
gets vertical here and the platforming follows: the first real heights, the
first moments where a missed jump means a fall rather than a stumble.

**The Market.** Colour and noise, or the memory of them. Cloth awnings,
hanging lanterns, banners strung across a magenta dusk. It is the most
crowded world visually and the most crowded with hazards. The market is where
the game stops being forgiving.

**The Ruined Court.** The lights are gone. Broken colonnades, cracked stone,
moss on the edges, violet dust drifting upward instead of down. This world
has the widest gaps and the least mercy. It is the point where the player
either understands the movement system completely or keeps dying.

**Lantern Tower.** The end. Riveted iron, tapering spires, embers rising from
below rather than falling from above. Every mechanic the game has taught is
present here at once, and the final door is the brightest thing in the game.

The tower is the answer to the question the other four worlds ask. Every
place the spirit passed through was dark because the light had been taken
somewhere. It was taken up.

---

## The Five Worlds in Detail

### World 1 — Clay House

| | |
| --- | --- |
| Levels | 1 – 5 |
| Difficulty band | 0.08 – 0.21 |
| Palette | Warm earth, amber and deep brown |
| Platform material | Rounded mud brick with straw flecks |
| Background | Low domed houses, lit windows, chimneys |
| Atmosphere | Warm dust haze rising from the ground |

The teaching world. Levels here are built almost entirely from `run` and `gap`
segments with the occasional staircase. Spikes appear first, fire appears
later in the world and only sparingly. Every level is wide and forgiving, and
the par times are generous.

This is also the only world with the tutorial. It runs once, on level 1, and
advances the moment the player actually performs each action rather than on a
timer.

### World 2 — Old Mosque

| | |
| --- | --- |
| Levels | 6 – 10 |
| Difficulty band | 0.25 – 0.38 |
| Palette | Cool teal, jade and near-black |
| Platform material | Polished marble with a gold inlay line |
| Background | Minarets, arcades of pointed arches |
| Atmosphere | Pale shafts of light falling from above |

Verticality arrives. Floating islands and staircases become common, and the
corridor segment is introduced at difficulty 0.38 — low ceilings that punish
careless jumping. Fire becomes a regular hazard rather than an occasional one.

The contrast with World 1 is deliberate: the same mechanics, a colder light,
and a much longer drop when you miss.

### World 3 — The Market

| | |
| --- | --- |
| Levels | 11 – 15 |
| Difficulty band | 0.42 – 0.55 |
| Palette | Magenta, rose and deep plum |
| Platform material | Wooden planks with cloth trim hanging off the edge |
| Background | Market awnings on poles, hanging lanterns |
| Atmosphere | Colourful cloth banners strung across the sky |

The midpoint, and the hardest world relative to what came before it. Moving
platforms unlock at 0.45 and lava at 0.55, so both new mechanics arrive inside
this world. Gaps widen past the comfortable single-jump range and start
demanding the second jump.

This is where the game expects the player to stop treating the double jump as
a rescue and start treating it as part of the route.

### World 4 — The Ruined Court

| | |
| --- | --- |
| Levels | 16 – 20 |
| Difficulty band | 0.59 – 0.72 |
| Palette | Violet, slate and cold indigo |
| Platform material | Cracked stone blocks with moss on the top edge |
| Background | Shattered colonnades of uneven height, rubble |
| Atmosphere | Violet dust drifting upward |

The last mechanic, fragile platforms, unlocks at 0.68 — near the end of this
world. Everything else is already in play. Levels are at their widest and the
hazard quotas are at their highest: up to eight spike runs, six fires, three
moving platforms and three lava pools in a single level.

The ruined court is the world most likely to end a run. It is also the world
where a player who has learned the movement system starts moving through it
quickly, because the gaps are large but readable.

### World 5 — Lantern Tower

| | |
| --- | --- |
| Levels | 21 – 25 |
| Difficulty band | 0.75 – 0.88 |
| Palette | Ember orange, rust and black |
| Platform material | Riveted iron with a glowing ember line |
| Background | Tapering spires with iron rings and lit windows |
| Atmosphere | Embers rising from below |

Expert tier. Every segment type is in the pool, every hazard category is at
quota, and the levels are the longest in the game at 11,600 units. Nothing new
is introduced here — the tower is a test of everything already taught, run at
full density.

The final level, **The Last Dawn**, ends the same way every level does: at a
glowing door. The difference is that there is no next level, and the results
screen says so.

---

## The Twenty-Five Levels

Difficulty is expressed as a band from 0.05 to 0.95. It rises across the set
and also rises within each level, so the second half of any level is harder
than its first half.

| # | World | Level | Difficulty | Unlocks in the pool |
| --- | --- | --- | --- | --- |
| 1 | Clay House | First Spark | 0.08 | run, gap |
| 2 | Clay House | A Separate Step | 0.11 | |
| 3 | Clay House | Stair of Shadows | 0.14 | stairs (0.12) |
| 4 | Clay House | Hanging Lamp | 0.17 | |
| 5 | Clay House | Last Light | 0.21 | |
| 6 | Old Mosque | The Arch | 0.25 | island (0.22) |
| 7 | Old Mosque | Abandoned Niche | 0.28 | |
| 8 | Old Mosque | Well of Light | 0.31 | |
| 9 | Old Mosque | Shard of Glass | 0.35 | corridor (0.38, next level) |
| 10 | Old Mosque | Dawn Hour | 0.38 | corridor |
| 11 | The Market | Market Lanterns | 0.42 | |
| 12 | The Market | Silk Rope | 0.45 | mover (0.45) |
| 13 | The Market | Long Night | 0.48 | |
| 14 | The Market | Shadow Dance | 0.52 | |
| 15 | The Market | Daybreak | 0.55 | lava (0.55) |
| 16 | The Ruined Court | Gate of Sand | 0.59 | |
| 17 | The Ruined Court | Inverted Lamps | 0.62 | |
| 18 | The Ruined Court | Corridor of Thorns | 0.65 | |
| 19 | The Ruined Court | Freefall | 0.69 | crumble (0.68) |
| 20 | The Ruined Court | Eye of the Storm | 0.72 | |
| 21 | Lantern Tower | The First Stair | 0.75 | |
| 22 | Lantern Tower | Twin Lanterns | 0.78 | |
| 23 | Lantern Tower | Dark Summit | 0.81 | |
| 24 | Lantern Tower | Heart of the Lantern | 0.85 | |
| 25 | Lantern Tower | The Last Dawn | 0.88 | |

Level width scales with the index, from 8,400 units at level 1 to 11,600 at
level 25.

### The Eight Segment Types

Every level is assembled from these, mixed by the segment picker.

| Segment | What it tests | Unlocks at |
| --- | --- | --- |
| `run` | Ground hazards, reading a hazard at speed | 0.00 |
| `gap` | Jump distance, the core skill | 0.00 |
| `stairs` | Vertical movement, timing on ascent and descent | 0.12 |
| `island` | Precision on small platforms over a void | 0.22 |
| `corridor` | Restraint — you cannot jump freely under a low ceiling | 0.38 |
| `mover` | Patience and prediction | 0.45 |
| `lava` | Chaining jumps across stepping stones | 0.55 |
| `crumble` | Forward momentum — stopping is fatal | 0.68 |

The picker never repeats the same segment twice in a row, keeps `run` and
`gap` weighted up so every level has breathing room, and gives a temporary
boost to a segment that has just unlocked so the player actually meets the new
mechanic instead of missing it in the shuffle.

### Hazard Quotas

After a level is assembled, a top-up pass guarantees a minimum count of each
hazard category based on the level's difficulty band:

| Hazard | Quota |
| --- | --- |
| Spikes | 3 to 8 |
| Fire | 0 to 6 (none below difficulty 0.20) |
| Moving platforms | 0 to 3 (none below 0.35) |
| Lava pools | 0 to 3 (none below 0.50) |

This exists because the segment picker is probabilistic. Without the top-up
pass, a level could come out with no fires at all, which would flatten the
difficulty curve for that level.

---

## Difficulty Curve

The curve is built from four independent layers that stack.

**Across the set.** Base difficulty rises linearly from 0.08 at level 1 to
0.88 at level 25. This controls which segment types are available and how
many hazards are guaranteed.

**Within a level.** Difficulty is modulated by progress through the level:
`baseDiff + (progress − 0.5) × 0.22`. So the opening of a level is slightly
easier than its band and the final stretch is noticeably harder. The hardest
moment in any level is always the last third.

**Through segment unlocks.** Mechanics are introduced in this order:

```
0.00  run, gap
0.12  stairs
0.22  island
0.38  corridor
0.45  mover
0.55  lava
0.68  crumble
```

Each new mechanic gets a weighted boost for a short window after it unlocks,
so the player meets it several times in quick succession and learns it
properly rather than encountering it once and forgetting it.

**Through hazard density.** The quotas grow with difficulty, so a late level
is not just longer — it has more things in it per unit of distance.

The result is a curve that starts as a walk and ends as a test of everything
the game has taught, without a single spike in difficulty that feels unfair.
The important property is that nothing is ever introduced and then abandoned:
`mover` and `lava` in particular carry extra weight in the picker so they
cannot vanish from late levels.

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

### The Three Things That Kill You

**Hazards.** Spikes, fire and lava each cost one heart. Fire pulses on and off
across roughly 57% of its cycle, so it can be timed. Spikes and lava cannot.

**Falling.** Dropping below the bottom of the view costs a heart.

**Crumbling ground.** Fragile platforms show hairline cracks at all times.
Stand on one and a 0.55 second countdown starts, the cracks widen and glow,
and then it is gone. You cannot wait on it.

### The Two Things That Run Out

**Hearts.** Five per level. Losing one respawns you at the last checkpoint you
touched, with 1.4 seconds of invulnerability so you cannot chain-die
instantly. Lose all five and the level ends — you choose between retrying it
from the start and returning to the menu.

**Oil.** Drains at 1.6 units per second from a maximum of 100, so a full tank
lasts about 62 seconds. Each flask restores 38 units. As oil drops, the light
radius around you contracts. Running out does not kill you, but it makes the
level unreadable, which amounts to the same thing.

### Practical Advice

- **Do not hoard the double jump.** It refills the instant you touch ground.
  Use it to extend a jump you have already committed to.
- **Watch the light, not the meter.** The oil bar tells you the number, but
  the shrinking radius tells you whether you can still see the next platform.
- **Read a hazard before you reach it.** Fire lights its own surroundings
  through the darkness layer, so a pulsing glow ahead means time your approach
  rather than run at it.
- **Never stop on a fragile platform.** A crumble chain is a rhythm, not a
  set of individual jumps.
- **Checkpoints are lanterns on poles, not flags.** They sit 30 units above
  solid ground and are never placed on anything that can break.
- **The camera leads you.** It keeps the character at about 42% of the screen
  width, so you always see further ahead than behind. Trust what you can see
  on the right.

---

## Scoring and Mastery

| Stars | Requirement |
| --- | --- |
| 1 | Reach the door |
| 2 | Reach the door with every gem in the level |
| 3 | Reach the door with every gem, within par time |

Par time is not a flat multiplier. It is computed per level as:

```
par = (width / 320) × (2.35 + difficulty × 0.95)
      + (spikes + fires × 2 + lava × 2 + movers × 3) × 1.6
```

The first term is travel time scaled by difficulty. The second term adds a
flat cost per hazard, so a dense level gets the time it actually needs. This
is why a three-star run on level 25 is demanding but genuinely reachable,
rather than mathematically impossible as it would be under a flat multiplier.

Best time is recorded per level. A new best overwrites the old one, and a
better star count is never downgraded by a worse run.

Level *n* unlocks when level *n − 1* has at least one star. Finishing a level
is therefore the only requirement for progression; stars are for players who
want the whole thing.

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

The twenty-minute figure is the design target for a perfect run: 25 levels
averaging roughly 10,000 units each, at an effective 208 units/s, works out to
around 1,200 seconds of pure movement. Everything above that is the cost of
learning.

### Where the Time Goes

- **Worlds 1 and 2** are fast. A confident player clears each level on the
  first or second attempt.
- **World 3** is where retries start. Moving platforms and lava require
  waiting for a window, which adds real time even to a clean run.
- **World 4** is the time sink on a first playthrough. Wide levels, dense
  hazards, and a checkpoint spacing of 900 units means a death in the middle
  costs a meaningful chunk of progress.
- **World 5** is fast for a player who has mastered the movement and slow for
  one who has not. There is no new information here, only density.

---

## Design Philosophy

A few principles shaped everything above.

**The light is the game.** The oil meter is not a timer bolted onto a
platformer. It is the thing that decides how much of the level you can see,
and therefore how much of the level you can plan. Every other system is
subordinate to it.

**Nothing is placed blind.** Every platform, hazard, gem, flask and checkpoint
in every level passes a validation call before it is committed. A hazard must
rest on real ground, leave headroom above it, and have nothing suspended over
its footprint. A checkpoint must sit on solid ground that cannot crumble, be
clear of hazards on both sides, and be far enough from the previous one to
matter. The builder refuses bad placements rather than placing them and hoping.

**Determinism over randomness.** Levels are generated from a seeded PRNG, so
they are the same for everyone, every run. This means a level can be learned,
a route can be optimised, and a three-star time can be chased. Procedural does
not have to mean unpredictable.

**Hazards must be legible.** Fire lights its own surroundings. Fragile
platforms always show cracks. Moving platforms have chains above them,
direction chevrons on the deck, and a lit underside. Spikes have a bevel and a
specular tip. Nothing in the game is dangerous without looking dangerous
first.

**The character cannot fight.** No combat, no power-ups, no upgrades. The
spirit only has movement and light, and the whole game is built to make those
two things enough.

---

## Credits

Design and development: **Trex · Kivode**

See `README.md` for the technical architecture, project structure and
customisation guide.