/* Qandel — level data + deterministic, hand-designed segment builder
   =========================================================
   DESIGN CONTRACT
   ---------------
   plats:  [x, y, w, h]
   ceils:  [x, y, w, h]   hanging ceiling blocks
   crumbs: [x, y, w, h]   fragile — crumbles 0.55s after being stood on
   spikes: [x, y, w]      h = 22, sits on a surface at y
   fires:  [x, y, w, h, speed]
   lavas:  [x, y, w, h, groundY]  a PIT cut into the floor, never a
                                  block resting on top of it
   movers: {x,y,w,h,axis,dist,speed,phase}
   gems:   [x, y]         centre
   oil:    [x, y]         centre
   goal:   [x, y]         44x70 door, bottom at y+70
   checkpoints: [x, y]    pole base — verified against real geometry

   WORLD GEOMETRY
   --------------
   Ground top   : y = 500
   Player       : 26 x 34
   Single jump  : ~145 up, ~250 across at full speed
   Double jump  : ~260 up, ~380 across
   Safe gap     : 90 .. 200    single jump, comfortable
   Hard gap     : 200 .. 285   double jump required
   Mover gap    : 285 .. 380   only crossable on a moving platform
   Ceiling floor: never below y = 200 over walkable ground
   ========================================================= */

const WORLDS = [
  {
    id:'clay', name:{ar:'بيت الطين', en:'Clay House'},
    skyTop:'#3a1c06', skyBot:'#0d0502', fog:'#1c0c04',
    accent:'#ffb15c', accent2:'#ffe0b0', platTop:'#8a5428', platBot:'#2c180c',
    arch:'#4a2a12', star:'#ffd7a0', archStyle:'dome'
  },
  {
    id:'mosque', name:{ar:'المسجد القديم', en:'Old Mosque'},
    skyTop:'#0a2a30', skyBot:'#020e0d', fog:'#051615',
    accent:'#5fd6c0', accent2:'#c9fff2', platTop:'#2a6660', platBot:'#0b2422',
    arch:'#0e3532', star:'#b6fff0', archStyle:'minaret'
  },
  {
    id:'market', name:{ar:'السوق', en:'The Market'},
    skyTop:'#3a0f2c', skyBot:'#0d030f', fog:'#1c0512',
    accent:'#ff86c8', accent2:'#ffd6ec', platTop:'#7d2c5e', platBot:'#280a1c',
    arch:'#4a1538', star:'#ffd0e8', archStyle:'stalls'
  },
  {
    id:'ruins', name:{ar:'الفناء المهجور', en:'The Ruined Court'},
    skyTop:'#221f3d', skyBot:'#05040a', fog:'#100e1e',
    accent:'#9d8bff', accent2:'#dcd4ff', platTop:'#423c6e', platBot:'#151228',
    arch:'#282244', star:'#cfc6ff', archStyle:'broken'
  },
  {
    id:'tower', name:{ar:'برج الفوانيس', en:'Lantern Tower'},
    skyTop:'#3d1503', skyBot:'#0a0201', fog:'#1f0803',
    accent:'#ff9a3c', accent2:'#ffd9a8', platTop:'#8c4214', platBot:'#2a0f03',
    arch:'#4d1f06', star:'#ffc98a', archStyle:'spire'
  }
];

/* =========================================================
   PALETTE — ONE COLOUR RAMP PER WORLD, AND NOTHING ELSE.
   ---------------------------------------------------------
   Every world already carried an `accent`, but the renderers in
   game.js still held hard-coded hexes: the lava was `#ffb347` in
   every world, the saw was the same grey, the spikes the same
   red. That is why five worlds read as one world with five
   tints — the large surfaces followed the palette and every
   small one ignored it.

   This table is now the ONLY source of colour for geometry:

     stone  · [lit top, body, underside] for every solid slab
     rim    · the single lit edge every stone gets (top-left)
     shadow · the ground shadow under a stone — never pure black
     haze   · the air between the parallax layers
     spike  · [dark base, lit face, specular tip] for danger metal
     steel  · [dark, mid, light] for saws and nails

   All of them stay inside the world's own hue, so a world can be
   recognised from a single frame of its floor.
   ========================================================= */
const PALETTE = {
  clay: {
    stone : ['#a06a34','#6b3f1d','#2a1609'],
    rim   : '#ffcf95', shadow:'#160b04', haze:'#2a1408',
    spike : ['#3a1512','#a4614a','#fff0d8'],
    steel : ['#1d2129','#4a4f5c','#b9bfcc']
  },
  mosque: {
    stone : ['#3f8b82','#1f4d48','#08201e'],
    rim   : '#b8fff2', shadow:'#04120f', haze:'#0a2624',
    spike : ['#123330','#5f9e97','#d9fff8'],
    steel : ['#1b2426','#46585a','#aebfc1']
  },
  market: {
    stone : ['#8e3a6c','#5a1e42','#20081a'],
    rim   : '#ffc2e4', shadow:'#12030c', haze:'#2a0a1e',
    spike : ['#3a1030','#a05b7e','#ffe0ef'],
    steel : ['#241a22','#584352','#c6b0bf']
  },
  ruins: {
    stone : ['#4b4480','#2a2549','#0d0b1a'],
    rim   : '#d9d0ff', shadow:'#060512', haze:'#141033',
    spike : ['#241a3a','#6a5f9e','#e6e0ff'],
    steel : ['#1b1b28','#464a5e','#b6bacd']
  },
  tower: {
    stone : ['#8c4214','#4a2208','#1a0802'],
    rim   : '#ffd0a0', shadow:'#0a0201', haze:'#1f0803',
    spike : ['#3a1408','#a0622e','#ffd9a8'],
    steel : ['#20232a','#4c525c','#c2c8d2']
  }
};

/* attach the ramp to each world once, so game.js can read W.pal and
   never has to know the table exists */
WORLDS.forEach(function(w){ w.pal = PALETTE[w.id] || null; });

/* =========================================================
   TUNING — every magic number lives here.
   ---------------------------------------------------------
   The four new hazard families each get their own block so a
   balance pass never has to hunt through the segment code:

     SAW     · a spinning blade that patrols a path
     NAIL    · a dense row of short metal spikes (floor or ceiling)
           CRUSHER · a stone that drops from the ceiling when you pass
     CRUMB   · the fragile platform, now with a variable fuse

   FAIRNESS FLOOR
   --------------
   `FUSE_MIN` is not a style choice, it is a promise: no fragile
   surface may vanish in under 0.30s of contact. Below that the
   player physically cannot react, and the death stops being their
   fault. Every fuse in the game is clamped to this value.
   ========================================================= */
const TUNE = {
  GROUND_Y     : 500,
  GROUND_H     : 40,
  FLOAT_H      : 22,
  CEIL_H       : 28,
  SPIKE_H      : 22,
  PLAYER_W     : 26,
  PLAYER_H     : 34,
  SAFE_GAP     : 200,
  HARD_GAP     : 285,
  MOVER_GAP    : 380,
  MIN_HEADROOM : 130,
  CP_SPACING   : 900,
  CP_SAFE_BACK : 120,
  CP_SAFE_FWD  : 90,
  OIL_STEP     : 1400,

  /* ---- lava (a fissure in the floor, not a block on it) ------ */
  LAVA_DROP    : 22,     /* how far the surface sinks BELOW ground  */
  LAVA_DEPTH   : 320,    /* how far the molten body runs down       */

  /* ---- floating platforms ----------------------------------- */
  /* The minimum air a floating platform must leave under itself.
     120 is one comfortable hop — the platform is clearly a step up,
     not a shelf bolted to the ground, and it is nowhere near the
     top of the screen. The first pass used 190, which pushed every
     floating stone so high the level looked like it was missing its
     middle. */
  MIN_FLOAT_CLEAR : 120,

  /* ---- saw -------------------------------------------------- */
  SAW_R        : 26,     /* blade radius                        */
  SAW_DIST     : 110,    /* default patrol half-travel          */
  SAW_SPEED    : 1.3,    /* angular speed of the patrol         */

  /* ---- nails ------------------------------------------------ */
  NAIL_H       : 15,     /* short and dense — a different read  */
  NAIL_STEP    : 13,     /* horizontal spacing between points   */


  /* ---- crusher (stone drops from the ceiling) --------------- */
  CRUSH_H      : 26,
  CRUSH_DROP   : 150,    /* travel of the drop                  */
  CRUSH_SPEED  : 1.9,

  /* ---- fragile platforms ------------------------------------ */
  FUSE_MIN     : 0.30,   /* HARD FLOOR — never go below this    */
  FUSE_MAX     : 0.95,
  CRUMB_RESPAWN: 2.6     /* seconds before a respawning crumb returns */
};

/* =========================================================
   DETERMINISTIC PRNG (mulberry32) — identical every run.
   ========================================================= */
function seedRand(seed){
  let a = seed >>> 0;
  return function(){
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* =========================================================
   BUILDER — every piece of geometry must pass a validation
   call before it is allowed into the level. Nothing is ever
   pushed directly.
   ========================================================= */
function Builder(){
  this.plats = [];
  this.ceils = [];
  this.crumbs = [];
  this.gems = [];
  this.oil = [];
  this.spikes = [];
  this.fires = [];
  this.lavas = [];
  this.movers = [];
  /* ---- new hazard families ---- */
  this.saws = [];
  this.nails = [];
  this.crushers = [];
  this.cpCandidates = [];
  this.lastGroundEnd = 0;
}

/* ---- collision helpers ---- */
Builder.prototype._hitBox = function(x,y,w,h,pad,skipTop){
  pad = pad || 0;
  const test = function(o){
    /* =========================================================
       `skipTop` — THE BUG THAT DELETED EVERY GROUND HAZARD
       ---------------------------------------------------------
       A spike, a fire and a floor nail all validate themselves with
       a box that shares its BOTTOM edge with the surface they stand
       on. With a 14-unit pad the test therefore ALWAYS overlapped
       the floor slab itself, so `_hitBox` answered "occupied" for
       the one piece of geometry a ground hazard is meant to sit on
       — and every spike, every fire and every nail row in the game
       was silently refused, on all 25 levels.

       `skipTop` is the y of that surface: a block whose top sits
       within 4 units of it is the ground, not an obstruction.
       Everything else is tested exactly as before, and every caller
       that does not pass it behaves unchanged.
       ========================================================= */
    if(skipTop !== undefined && Math.abs(o.y - skipTop) < 4) return false;
    return x < o.x+o.w+pad && x+w > o.x-pad && y < o.y+o.h+pad && y+h > o.y-pad;
  };
  let i, p;
  for(i=0;i<this.plats.length;i++){ p=this.plats[i]; if(test({x:p[0],y:p[1],w:p[2],h:p[3]})) return true; }
  for(i=0;i<this.ceils.length;i++){ p=this.ceils[i]; if(test({x:p[0],y:p[1],w:p[2],h:p[3]})) return true; }
  for(i=0;i<this.crumbs.length;i++){ p=this.crumbs[i]; if(test({x:p[0],y:p[1],w:p[2],h:p[3]})) return true; }
  for(i=0;i<this.movers.length;i++){ p=this.movers[i]; if(test({x:p.x,y:p.y,w:p.w,h:p.h})) return true; }
  /* the new families reserve their own footprint too, otherwise a
     later platform could be dropped straight through a saw's path */
  for(i=0;i<this.crushers.length;i++){ p=this.crushers[i]; if(test({x:p[0],y:p[1],w:p[2],h:p[3]})) return true; }
  return false;
};

/* nearest solid top at or below y that covers x */
Builder.prototype.groundUnder = function(x, y){
  let best = null;
  for(let i=0;i<this.plats.length;i++){
    const p = this.plats[i];
    if(x < p[0]-2 || x > p[0]+p[2]+2) continue;
    if(p[1] < y-2) continue;
    if(!best || p[1] < best[1]) best = p;
  }
  return best;
};

/* clear vertical air above a point, up to the lowest ceiling */
Builder.prototype.headroom = function(x, y){
  let top = 0;
  for(let i=0;i<this.ceils.length;i++){
    const c = this.ceils[i];
    if(x < c[0] || x > c[0]+c[2]) continue;
    const bottom = c[1] + c[3];
    if(bottom <= y && bottom > top) top = bottom;
  }
  return y - top;
};

/* ---- placement API ---- */

Builder.prototype.floor = function(x, w){
  if(w < 40) return null;
  const p = [Math.round(x), TUNE.GROUND_Y, Math.round(w), TUNE.GROUND_H];
  this.plats.push(p);
  if(x+w > this.lastGroundEnd) this.lastGroundEnd = x+w;
  return p;
};

/* =========================================================
   SPAWN SAFETY — the fix for "the player falls and dies at once"
   ---------------------------------------------------------
   The spawn point is authored at a fixed x (80). Nothing used to
   guarantee that a floor existed under it: `segStairs` lays its
   landing floor at `x0 + w*0.80`, so the first 80% of that
   segment has NO ground at y=500. When the level happened to
   open with a stairs segment, the player spawned over empty air,
   fell out of the world, and lost a heart before the first frame
   was even drawn.

   The same hole existed along the whole level, which is also why
   a checkpoint could be anchored over thin air.

   `ensureGround()` walks a strip of x positions and, wherever
   nothing solid covers the spawn height, lays a floor. It never
   removes anything, so it cannot break a hand-tuned layout — it
   only fills genuine voids.
   ========================================================= */
Builder.prototype.ensureGround = function(x0, x1){
  const step = 40;

  const solidAt = function(x){
    for(let i=0;i<this.plats.length;i++){
      const p = this.plats[i];
      if(x >= p[0] && x <= p[0]+p[2] && Math.abs(p[1]-TUNE.GROUND_Y) < 2) return true;
    }
    return false;
  };

  /* collect the gaps first, then fill them — filling while
     scanning would make the new floor mask the rest of the gap */
  const gaps = [];
  let runStart = null;

  for(let x = x0; x <= x1; x += step){
    const solid = solidAt.call(this, x);
    if(!solid && runStart === null){
      runStart = x;
    } else if(solid && runStart !== null){
      gaps.push([runStart, x - runStart]);
      runStart = null;
    }
  }
  if(runStart !== null) gaps.push([runStart, x1 - runStart + step]);

  for(let i=0;i<gaps.length;i++){
    this.floor(gaps[i][0], gaps[i][1]);
  }

  return gaps.length;
};

/* =========================================================
   SPAWN PAD — a hard guarantee that the player starts on ground.
   ---------------------------------------------------------
   `ensureGround` SAMPLES the strip in 40-unit steps and only
   accepts platforms sitting exactly on y = 500. That leaves three
   ways a level can still open over thin air:

     · a gap narrower than the sampling step, straddling a probe
     · a floating stone over the spawn counted as ground, when the
       player would land on it and immediately slide off the edge
     · the strip ending at 260 while the player box is 26 wide

   This function does not sample. It asks the exact question the
   physics engine asks on the first frame:

     "Is there a solid top at or below the spawn height that covers
      the player's entire footprint?"

   `spawn` is authored at x = 80 with a 26-wide player, so the
   footprint is 80 .. 106. If nothing covers it, a real floor is
   laid from x = 0 to 420 — wide enough to give the camera a
   runway and to make the first step safe.

   It is a FLOOR at GROUND_Y, not a floating stone: a platform
   hovering over the spawn would satisfy a naive overlap test while
   still letting the player fall past its edge.

   Any floating stone left inside the pad footprint is removed, so
   nothing can shadow the ground the player is standing on.

   Returns true when a pad had to be laid.
   ========================================================= */
Builder.prototype.ensureSpawnPad = function(){
  const SPAWN_X  = 80;
  const PLAYER_W = TUNE.PLAYER_W;
  const padTo    = SPAWN_X + PLAYER_W + 314;   /* 420 */

  /* =========================================================
     NOTE — THE SPAWN COLUMN IS NOT CLEARED
     ---------------------------------------------------------
     An earlier revision of this function deleted every floating
     stone whose footprint touched the spawn column. That was a
     mistake: it silently removed geometry the level had authored
     on purpose, and it fought with `spawnY` below — the stone was
     gone, so `spawnY` found nothing to stand on and fell back to
     the ground line, which is exactly the bug it was meant to fix.

     The correct division of labour is:

       · `ensureSpawnPad` guarantees there is FLOOR under the spawn
       · `spawnY`        puts the player ON TOP of whatever is there

     Neither of them deletes anything. A stone over the spawn is
     legitimate level design; the player simply starts on it.
     ========================================================= */

  /* =========================================================
     STEP 1 — is the footprint covered by a real floor?
     ========================================================= */
  let covered = false;
  for(let i=0;i<this.plats.length;i++){
    const p = this.plats[i];
    if(Math.abs(p[1] - TUNE.GROUND_Y) > 2) continue;   /* floor only */
    if(p[0] <= SPAWN_X && p[0] + p[2] >= SPAWN_X + PLAYER_W){
      covered = true;
      break;
    }
  }

  /* =========================================================
     STEP 3 — lay the pad when the floor is missing.
     `floor()` refuses anything under 40 wide, so a 420-wide pad
     is always legal.
     ========================================================= */
  if(!covered) this.floor(0, padTo);

  return !covered;
};

/* =========================================================
   SPAWN HEIGHT — the player must start ON TOP of whatever is at
   the spawn column, not at a fixed y.
   ---------------------------------------------------------
   THE BUG THIS FIXES
   ------------------
   `spawn` was authored as `[80, GROUND_Y - PLAYER_H]` — a fixed
   y of 466, i.e. the player's feet exactly on the ground line.

   That is only correct when the spawn column is empty. When a
   level's first segment left a FLOATING STONE over x = 80 (and
   several do — `segStairs`, `segIsland` and `segRun` all place
   platforms in the first few hundred units), the player was
   spawned INSIDE that stone:

        stone top    y = 440
        player top   y = 466   ← 26 units BELOW the stone's top
        player feet  y = 500

   On the first physics frame the Y-resolution pushes the player
   up to `stone.y - PLAYER_H` = 406, so the spirit pops out of the
   top of the rock, slides off its edge, and drops into the void
   between the stone and the floor. From the player's side that is
   "the level starts and I am already falling".

   The fix is not to delete the stone — it is to spawn the player
   where they can actually stand: on the HIGHEST solid top that
   covers the spawn column, at or above the ground line.

   Returns the corrected y.
   ========================================================= */
Builder.prototype.spawnY = function(x, w){
  const SPAWN_X = (x === undefined) ? 80 : x;
  const PW = w || TUNE.PLAYER_W;

  /* =========================================================
     WHICH SURFACES COUNT?
     ---------------------------------------------------------
     The old test demanded that a platform cover the FULL
     footprint (80 .. 106). That is too strict: a stone starting
     at x = 90 and 100 wide covers the player's feet perfectly
     well, but 90 > 80 made the test reject it — so the player
     was spawned at the ground line, inside the stone, and the
     physics popped them out of its top.

     The honest question is: "would the player's feet land on this
     surface?" The feet are a box, and a landing needs the stone
     to overlap the MIDDLE of that box, not to swallow it whole.
     Requiring an overlap of at least half the player width is the
     same tolerance the physics engine's own `hit()` test gives,
     without being so loose that a stone clipping one corner of
     the spawn counts as a floor.

     `p[1] <= GROUND_Y` keeps the search to surfaces at or above
     the floor — nothing below the ground line is walkable.
     ========================================================= */
  const feetL = SPAWN_X;
  const feetR = SPAWN_X + PW;
  const needOverlap = PW * 0.5;

  let best = null;
  for(let i=0;i<this.plats.length;i++){
    const p = this.plats[i];
    if(p[1] < 70) continue;                 /* off-screen — not a surface */
    if(p[1] > TUNE.GROUND_Y) continue;      /* below the ground line */
    const overlap = Math.min(p[0] + p[2], feetR) - Math.max(p[0], feetL);
    if(overlap < needOverlap) continue;     /* does not hold the feet */
    if(!best || p[1] < best) best = p[1];
  }

  /* nothing solid → fall back to the ground line */
  const surfaceY = (best === null) ? TUNE.GROUND_Y : best;
  return surfaceY - TUNE.PLAYER_H;
};

/* =========================================================
   FLOATING PLATFORM — with a MEANINGFUL-CLEARANCE rule.
   ---------------------------------------------------------
   THE "STONE WITH NO REASON" PROBLEM
   ----------------------------------
   The level builder used to drop floating platforms at whatever
   height a template happened to ask for. `segRun` put two of them
   at y=380 and y=350 over a floor at y=500 — 120 and 150 units of
   air. The player could jump up, land, and step straight back down
   onto the same floor. The platform asked nothing and gave nothing,
   so it read as a rock somebody forgot to delete.

   A floating platform is only worth placing when it is genuinely
   ABOVE the ground it hovers over — high enough that reaching it
   is a decision, and that falling off it costs something. The rule
   below enforces that:

     · find the highest solid surface directly underneath
     · if the gap is smaller than MIN_FLOAT_CLEAR, RAISE the
       platform until it is — never drop it, never reject it, so
       the level keeps its detail and simply reads better

   `MIN_FLOAT_CLEAR` is 190: a single jump clears ~145 and a double
   clears ~260, so 190 sits between them. The platform is therefore
   reachable, but only with intent.
   ========================================================= */
Builder.prototype.plat = function(x, y, w, h){
  h = h || TUNE.FLOAT_H;
  if(y < 70) return false;

  /* ---- raise it out of the "pointless" band ---- */
  const below = this.groundUnder(x + w/2, y + h);
  if(below){
    const clear = below[1] - (y + h);
    if(clear < TUNE.MIN_FLOAT_CLEAR){
      y = below[1] - TUNE.MIN_FLOAT_CLEAR - h;
    }
  }

  if(y < 70) return false;
  if(this._hitBox(x, y, w, h, 8)) return false;
  this.plats.push([Math.round(x), Math.round(y), Math.round(w), h]);
  return true;
};

Builder.prototype.ceil = function(x, y, w){
  if(y < 70) return false;
  if(this._hitBox(x, y, w, TUNE.CEIL_H, 10)) return false;
  this.ceils.push([Math.round(x), Math.round(y), Math.round(w), TUNE.CEIL_H]);
  return true;
};

/* =========================================================
   FRAGILE PLATFORM — now with a VARIABLE fuse.
   ---------------------------------------------------------
   The old signature was `crumb(x, y, w)` and the fuse was a
   hard-coded 0.55s inside game.js. That made every fragile
   platform in the game identical: learn one, you have learned
   them all.

   The fuse is now authored per platform and clamped to
   `TUNE.FUSE_MIN`. `respawn` is the second half of the same
   idea — a platform that comes back cannot be memorised as
   "gone forever", and one that does not cannot be memorised as
   "it will save me".

   crumbs: [x, y, w, h, fuse, respawn]
   ========================================================= */
Builder.prototype.crumb = function(x, y, w, fuse, respawn){
  w = w || 70;
  if(this._hitBox(x, y, w, 20, 10)) return false;
  const f = Math.max(TUNE.FUSE_MIN,
              Math.min(TUNE.FUSE_MAX, fuse === undefined ? 0.55 : fuse));
  this.crumbs.push([
    Math.round(x), Math.round(y), Math.round(w), 20,
    Math.round(f * 100) / 100,
    respawn ? 1 : 0
  ]);
  return true;
};

/* =========================================================
   SAW — a spinning blade that patrols a path.
   ---------------------------------------------------------
   `axis` is 'x' (slides along the floor), 'y' (bobs vertically)
   or 'c' (a circular orbit — the hardest to read, so it is only
   used at high difficulty).

   The blade is stored as its RESTING centre plus the patrol
   parameters; the sweep corridor is reserved in `_hitBox` so
   nothing else can be placed inside the arc it will travel.
   ========================================================= */
Builder.prototype.saw = function(x, y, r, axis, dist, speed){
  r = r || TUNE.SAW_R;
  axis = axis || 'x';
  dist = dist || TUNE.SAW_DIST;
  speed = speed || TUNE.SAW_SPEED;

  /* =========================================================
     THE BLADE MUST NOT BE ON TOP OF THE PLAYER AT SPAWN
     ---------------------------------------------------------
     A saw's corridor is the only hazard footprint that is not
     anchored to the floor, so it is the one that could reach the
     spawn column. The spawn zone is enforced on the WHOLE sweep,
     not just the resting centre: a blade that rests at x = 900 but
     travels 120 units left still reaches x = 780.
     ========================================================= */
  const reachL = axis === 'x' ? x - dist - r : x - r;
  const reachR = axis === 'x' ? x + dist + r : x + r;
  if(this.inSpawnZone(reachL, reachR - reachL)) return false;

  /* the whole corridor must be free of solid geometry */
  const pad = r + 12;
  const cx0 = axis === 'y' ? x - pad : x - dist - pad;
  const cy0 = axis === 'x' ? y - pad : y - dist - pad;
  const cw  = axis === 'y' ? pad * 2 : dist * 2 + pad * 2;
  const ch  = axis === 'x' ? pad * 2 : dist * 2 + pad * 2;
  if(this._hitBox(cx0, cy0, cw, ch, 6)) return false;

  /* never let a blade sit inside the floor or off the top */
  if(y - r < 60) return false;
  if(y + r > TUNE.GROUND_Y + 20) return false;

  this.saws.push({
    x:Math.round(x), y:Math.round(y), r:Math.round(r),
    axis:axis, dist:Math.round(dist), speed:speed, phase:0
  });
  return true;
};

/* =========================================================
   NAILS — a dense row of short metal spikes.
   ---------------------------------------------------------
   Unlike `spike`, nails can hang from a ceiling (`dir = -1`),
   which is what makes a corridor genuinely tight: you cannot
   jump over them, you have to walk under them at the right
   moment. They are deliberately SHORTER than spikes (15 vs 22)
   so the read is different at a glance.
   ========================================================= */
Builder.prototype.nail = function(x, w, dir){
  w = w || 60;
  dir = dir === -1 ? -1 : 1;
  if(this.inSpawnZone(x, w)) return false;
  const cx = x + w/2;

  if(dir === 1){
    /* floor nails — need real ground and headroom */
    const g = this.groundUnder(cx, 300);
    if(!g) return false;
    /* same rule as spikes and fires: the whole row, one surface */
    if(!this._flatUnder(x, w, g[1])) return false;
    if(this.headroom(cx, g[1]) < TUNE.MIN_HEADROOM) return false;
    if(!this._clearAbove(x, w, g[1], TUNE.MIN_HEADROOM)) return false;
    if(this._hitBox(x, g[1]-TUNE.NAIL_H, w, TUNE.NAIL_H, 14, g[1])) return false;
    this.nails.push([Math.round(x), Math.round(g[1]-TUNE.NAIL_H), Math.round(w), TUNE.NAIL_H, 1]);
    return true;
  }

  /* ceiling nails — must hang from a real ceiling block */
  let best = null, bestTop = null;
  for(let i=0;i<this.ceils.length;i++){
    const c = this.ceils[i];
    if(cx < c[0] || cx > c[0]+c[2]) continue;
    const bottom = c[1] + c[3];
    if(!best || bottom > best){ best = bottom; bestTop = c[1]; }
  }
  if(best === null) return false;
  /* the ceiling must be low enough that the nails are a real threat */
  if(best > TUNE.GROUND_Y - TUNE.MIN_HEADROOM) return false;
  /* skipTop = the slab's own top, so the slab the nails hang from is
     not mistaken for an obstruction */
  if(this._hitBox(x, best, w, TUNE.NAIL_H, 14, bestTop)) return false;
  this.nails.push([Math.round(x), Math.round(best), Math.round(w), TUNE.NAIL_H, -1]);
  return true;
};


/* =========================================================
   CRUSHER — a stone that drops from the ceiling.
   ---------------------------------------------------------
   Authored at its RAISED position. The engine holds it there
   until the player walks underneath, then it falls, waits, and
   climbs back. The drop corridor is reserved so nothing is ever
   placed inside it.

   crushers: [x, y, w, h, drop, speed]
   ========================================================= */
/* =========================================================
   CRUSHER — a stone that drops from the ceiling.
   ---------------------------------------------------------
   THE INVISIBLE-TRAP BUG THIS FIXES
   ---------------------------------
   The old version validated only that the drop corridor was
   clear of geometry. It never checked that there was a CEILING
   above the stone. A top-up pass could therefore hang a stone in
   mid-air, and because `drawCrusher` draws the stone at its rest
   position and the rail below it, the result was a hazard with
   no visible anchor — a stone that appeared out of nothing and
   killed the player on a level where they had no reason to look
   up.

   A crusher is now legal only when ALL of these hold:
     1. there is a real ceiling block whose underside is at or
        just above the stone's rest position
     2. the stone hangs from that ceiling, not floating near it
     3. the whole drop corridor is clear
     4. the drop actually reaches the floor the player walks on

   Rule 1 is the one that matters: no ceiling, no crusher.
   ========================================================= */
Builder.prototype.crusher = function(x, y, w, drop, speed){
  w = w || 70;
  drop = drop || TUNE.CRUSH_DROP;
  if(y < 70) return false;
  if(this.inSpawnZone(x, w)) return false;

  /* ---- 1 · find a ceiling that actually covers this stone ---- */
  let anchor = null;
  const cx = x + w/2;
  for(let i=0;i<this.ceils.length;i++){
    const c = this.ceils[i];
    if(cx < c[0] + 8 || cx > c[0] + c[2] - 8) continue;
    const bottom = c[1] + c[3];
    if(bottom > y + 6) continue;          /* ceiling must be ABOVE the stone */
    if(!anchor || bottom > anchor) anchor = bottom;
  }
  /* no ceiling → no crusher. This is the fix. */
  if(anchor === null) return false;

  /* ---- 2 · the stone must hang from it, not float near it ---- */
  if(y - anchor > 26) return false;

  /* ---- 3 · the drop corridor must be clear ---- */
  if(this._hitBox(x, y, w, TUNE.CRUSH_H + drop, 10)) return false;

  /* ---- 4 · the drop must reach walkable ground ---- */
  const g = this.groundUnder(cx, y + TUNE.CRUSH_H);
  if(!g) return false;
  const floorY = g[1];
  const bottomAtRest = y + TUNE.CRUSH_H;
  const bottomAtDrop = bottomAtRest + drop;
  /* it must come close enough to the floor to be a real threat,
     but never overlap it (a stone sunk into the floor is a bug) */
  if(bottomAtDrop > floorY + 4) return false;
  if(bottomAtDrop < floorY - 70) return false;

  this.crushers.push([
    Math.round(x), Math.round(y), Math.round(w), TUNE.CRUSH_H,
    Math.round(drop), speed || TUNE.CRUSH_SPEED
  ]);
  return true;
};

Builder.prototype.mover = function(x, y, w, axis, dist, speed){
  dist = dist || 70;
  if(this._hitBox(x-dist, y-dist, w+dist*2, 60+dist*2, 10)) return false;
  this.movers.push({
    x:Math.round(x), y:Math.round(y), w:Math.round(w), h:18,
    axis:axis||'x', dist:dist, speed:speed||1.2, phase:0
  });
  return true;
};

/* =========================================================
   HAZARD PLACEMENT
   ---------------------------------------------------------
   A hazard is legal only when ALL of these hold:
     1. it rests on a real solid surface
     2. it leaves MIN_HEADROOM of clear air above it
     3. it does not overlap existing geometry
     4. nothing is suspended directly above it

   Rule 4 exists because a floating platform could otherwise sit
   86 units over a fire: the player drops off it and lands on
   flames with no way to see the danger coming.
   ========================================================= */

/* =========================================================
   HAZARD CLEARANCE — THE BUG THAT MADE EVERY GROUND HAZARD VANISH
   ---------------------------------------------------------
   Every ground hazard (spike, fire, nail) validated itself with
   `_clearAbove(x, w, topY, need)`, which asks: "is anything
   hanging over this footprint whose underside is above the hazard
   but below the required clearance?"

   It walks `this.plats` — and `this.plats` contains the FLOOR
   itself. `plat()` raises every floating stone to
   `GROUND_Y - MIN_FLOAT_CLEAR - h` = 358, so its underside sits at
   380 — 120 units above the ground line. The old window
   (`bottom > topY - need`) counted that stone as "suspended over"
   the hazard standing on the floor, and refused the placement.

   Combined with a headroom rule that demanded
   `MIN_HEADROOM + SPIKE_H`, that rejected EVERY spike, EVERY fire
   and EVERY nail in the game — while saws (which never call this
   function) were placed normally. The level dump showed exactly
   that: 0 spikes, 0 fires, 0 nails on all 25 levels.

   THE FIX
   -------
   1. only geometry whose underside is genuinely ABOVE the hazard
      counts — a stone higher up the level is not "over" a 22-unit
      spike
   2. the surface the hazard is standing on is skipped explicitly
   3. the caller asks for MIN_HEADROOM (room to jump it), not
      MIN_HEADROOM plus the hazard's own height
   ========================================================= */
Builder.prototype._clearAbove = function(x, w, topY, need){
  const x2 = x + w;
  const counts = function(px, pw, pBottom){
    if(px >= x2 || px + pw <= x) return false;      /* no x overlap */
    if(pBottom > topY) return false;                /* not above us   */
    if(pBottom <= topY - need) return false;        /* far enough up  */
    return true;
  };
  let i;
  for(i=0;i<this.plats.length;i++){
    const p = this.plats[i];
    /* the surface the hazard is standing on is never "above" it */
    if(Math.abs(p[1] - topY) < 4) continue;
    if(counts(p[0], p[2], p[1] + p[3])) return false;
  }
  for(i=0;i<this.ceils.length;i++){
    const c = this.ceils[i];
    if(counts(c[0], c[2], c[1] + c[3])) return false;
  }
  for(i=0;i<this.crumbs.length;i++){
    const c = this.crumbs[i];
    if(counts(c[0], c[2], c[1] + c[3])) return false;
  }
  return true;
};

/* =========================================================
   SPAWN CLEAR ZONE — no hazard may sit on the player's doorstep.
   ---------------------------------------------------------
   A top-up pass used to scan from x = 400, so on a level whose
   first segment is a `run` the first hazard could land 320 units
   from the spawn at x = 80 — under a second of walking, with the
   camera still settling. The player died before taking a single
   deliberate step.

   Nothing lethal is allowed inside the first CLEAR units, and
   nothing lethal may overlap the spawn column. Every hazard
   placement checks this, so no segment template and no top-up can
   break it.
   ========================================================= */
Builder.prototype.inSpawnZone = function(x, w){
  w = w || 0;
  const SPAWN_X = 80;
  const CLEAR   = 700;
  return (x + w) < SPAWN_X + CLEAR;
};

/* =========================================================
   FLAT FOOTPRINT GUARD
   ---------------------------------------------------------
   `groundUnder(cx, 300)` only ever asked about the hazard's
   CENTRE. A 62-wide spike row on a 40-wide stone therefore passed
   validation and was drawn with half of itself hanging in the air
   — which is exactly what the screenshots show.

   A hazard needs the WHOLE footprint on one continuous surface at
   one continuous height. Every 6 units is probed, and the far edge
   is probed explicitly, because a row that ends a single unit past
   the stone still reads as broken.
   ========================================================= */
Builder.prototype._flatUnder = function(x, w, topY){
  const covers = function(px){
    for(let i=0;i<this.plats.length;i++){
      const p = this.plats[i];
      if(Math.abs(p[1] - topY) > 2) continue;
      if(px >= p[0] - 1 && px <= p[0] + p[2] + 1) return true;
    }
    return false;
  }.bind(this);

  const step = 6;
  for(let px = x; px < x + w; px += step){
    if(!covers(px)) return false;
  }
  return covers(x + w);
};

Builder.prototype.spike = function(x, w){
  w = w || 55;
  if(this.inSpawnZone(x, w)) return false;
  const cx = x + w/2;
  const g = this.groundUnder(cx, 300);
  if(!g) return false;
  /* the whole row must stand on ONE surface — see _flatUnder */
  if(!this._flatUnder(x, w, g[1])) return false;
  if(this.headroom(cx, g[1]) < TUNE.MIN_HEADROOM) return false;
  if(!this._clearAbove(x, w, g[1], TUNE.MIN_HEADROOM)) return false;
  if(this._hitBox(x, g[1]-TUNE.SPIKE_H, w, TUNE.SPIKE_H, 14, g[1])) return false;
  this.spikes.push([Math.round(x), Math.round(g[1]-TUNE.SPIKE_H), Math.round(w)]);
  return true;
};

Builder.prototype.fire = function(x, w, speed){
  w = w || 60;
  if(this.inSpawnZone(x, w)) return false;
  const cx = x + w/2;
  const g = this.groundUnder(cx, 300);
  if(!g) return false;
  /* a flame standing half over an edge is a flame in mid-air */
  if(!this._flatUnder(x, w, g[1])) return false;
  if(this.headroom(cx, g[1]) < TUNE.MIN_HEADROOM) return false;
  if(!this._clearAbove(x, w, g[1], TUNE.MIN_HEADROOM)) return false;
  if(this._hitBox(x, g[1]-34, w, 34, 14, g[1])) return false;
  this.fires.push([Math.round(x), Math.round(g[1]-34), Math.round(w), 34, speed||1.6]);
  return true;
};

/* =========================================================
   LAVA — a FISSURE cut into the floor, never a block resting on it.
   ---------------------------------------------------------
   THE FLOATING-VOLCANO BUG THIS FIXES
   -----------------------------------
   The old version put the molten surface `surfaceH` units ABOVE
   the ground line (50 by default) and stacked the body on top of
   it. In a chasm there was nothing underneath, so the level ended
   up carrying a slab of molten rock hovering over empty air — a
   volcano in mid-air. The player could walk under it, and it read
   as an object rather than as the hole it was meant to be.

   A pool is now a PIT:
     · the surface sits LAVA_DROP BELOW the ground line
     · the body runs LAVA_DEPTH further down, so there is never a
       floor inside the pool to land on
     · the pit mouth must be genuinely open — no floor, deck or
       fragile stone may cross it
     · the renderer draws the rock walls that run from the ground
       line down past the pool, so the fire is visibly a hole in
       the earth with stone on every side

   A fifth field (groundY) travels with the pool so the renderer
   knows where the ground line above it is.

   Signature: lava(x, w)
   ========================================================= */
Builder.prototype.lava = function(x, w){
  if(w < 90) return false;

  const g   = TUNE.GROUND_Y;
  const top = g + TUNE.LAVA_DROP;
  const h   = TUNE.LAVA_DEPTH;

  /* =========================================================
     THE POOL MUST FILL ITS OWN CHASM
     ---------------------------------------------------------
     A pool used to be poured at exactly the width it was asked for.
     That was fine for `segLava`, which knows its chasm, but the
     top-up pass asks for a flat 130 units wherever it finds no
     floor — so inside a 600-wide chasm it produced a slab of lava
     sitting in the middle of a black hole. That is the "the volcano
     is a box in the gap" everybody sees.

     The width is now MEASURED, not requested: walk out from the
     requested centre until the floor starts on each side, and pour
     the whole span. A pool is a hole in the earth — the hole
     decides how big it is.
     ========================================================= */
  const self = this;
  const solidFloorAt = function(px){
    for(let i=0;i<self.plats.length;i++){
      const p = self.plats[i];
      if(Math.abs(p[1] - g) > 2) continue;
      if(px >= p[0] && px <= p[0] + p[2]) return true;
    }
    return false;
  };

  const step     = 8;
  const guardMax = 400;              /* 3200 units — past any chasm */
  let L = x, R = x + w, guard = 0;

  while(L > 0 && guard++ < guardMax && !solidFloorAt(L - step)) L -= step;
  guard = 0;
  while(guard++ < guardMax && !solidFloorAt(R + step)) R += step;

  const px0 = Math.max(0, L);
  const pw  = R - px0;
  if(pw < 90) return false;

  /* never pour a second pool into water that is already there */
  for(let i=0;i<this.lavas.length;i++){
    const o = this.lavas[i];
    if(px0 < o[0] + o[2] && px0 + pw > o[0]) return false;
  }

  /* the pit mouth must be open. Inset by 10 on each side so the solid
     banks that bound the pit are not counted as obstructions. */
  const inset = 10;
  if(this._hitBox(px0 + inset, g - 20, pw - inset*2,
                  TUNE.LAVA_DROP + 46, 0)) return false;

  this.lavas.push([
    Math.round(px0), Math.round(top), Math.round(pw), Math.round(h), g
  ]);
  return true;
};

Builder.prototype.gem = function(x, y){
  if(this._hitBox(x-12, y-12, 24, 24, 16)) return false;
  this.gems.push([Math.round(x), Math.round(y)]);
  return true;
};

Builder.prototype.oilFlask = function(x, y){
  if(this._hitBox(x-10, y-14, 20, 28, 18)) return false;
  this.oil.push([Math.round(x), Math.round(y)]);
  return true;
};

Builder.prototype.cpCandidate = function(x){
  this.cpCandidates.push(Math.round(x));
};

/* =========================================================
   SPACING GUARD — the thing that stops a level looking random.
   ---------------------------------------------------------
   A top-up pass that drops a hazard into the first legal slot
   produces clusters: three nail rows inside 120 units, a saw
   sitting on top of a fire. That reads as noise, not design.

   `_nearHazard` answers "is there already something lethal in
   this stretch of the level?" and the top-up pass refuses to
   place a second hazard inside the same window. The window is
   generous enough that a deliberately dense segment is still
   possible — it only blocks the accidents.
   ========================================================= */
Builder.prototype._nearHazard = function(x, w, pad){
  pad = pad === undefined ? 110 : pad;
  const x0 = x - pad, x1 = x + w + pad;
  const overlaps = function(o){
    const ow = o[2] !== undefined ? o[2] : (o.w || 0);
    return x0 < o[0] + ow && x1 > o[0];
  };
  let i;
  for(i=0;i<this.spikes.length;i++)   if(overlaps(this.spikes[i]))   return true;
  for(i=0;i<this.fires.length;i++)    if(overlaps(this.fires[i]))    return true;
  for(i=0;i<this.lavas.length;i++)    if(overlaps(this.lavas[i]))    return true;
  for(i=0;i<this.nails.length;i++)    if(overlaps(this.nails[i]))    return true;
  for(i=0;i<this.crushers.length;i++) if(overlaps(this.crushers[i])) return true;
  for(i=0;i<this.saws.length;i++){
    const s = this.saws[i];
    if(x0 < s.x + s.r + s.dist && x1 > s.x - s.r - s.dist) return true;
  }
  return false;
};

/* =========================================================
   SEGMENT TEMPLATES
   Each one is self-contained and always ends on solid ground.
   ========================================================= */

/* 1 · RUN — continuous floor with ground hazards.
   ---------------------------------------------------------
   ORDER MATTERS. The floating platforms are placed FIRST, so the
   hazard pass can see them and refuse to put a fire underneath
   one. The old order did the opposite: hazards went down blind,
   then a platform could be dropped 86 units above a flame, and
   the player would fall off it straight into the fire.
   --------------------------------------------------------- */
function segRun(B, x0, w, diff, rnd){
  B.floor(x0, w);

  /* =========================================================
     FLOATING PLATFORMS — one, not two, and high enough to matter.
     ---------------------------------------------------------
     This segment used to drop TWO platforms over continuous floor,
     at y=380 and y=350. With the ground at y=500 that is 120 and
     150 units of air: the player hops up, lands, and steps back
     down onto the same floor. Neither platform was a route, a
     reward or a risk — they were rocks floating for no reason.

     Now there is ONE platform, placed at a height the player has
     to commit to, and it carries the gem that makes it worth the
     climb. The `plat()` clearance rule raises it further if a
     later segment needs it.
     ========================================================= */
  if(w > 400){
    const px = x0 + w*0.52;
    if(B.plat(px, 370, 110)) B.gem(px+55, 320);
  }

  /* =========================================================
     HAZARDS ON A FIXED RHYTHM
     ---------------------------------------------------------
     The old loop placed hazards at `x0 + 140 + (span/hazards)*i
     + rnd()*40` and chose the TYPE with a coin flip. Two levels
     with the same difficulty could therefore feel completely
     different, and a player could never predict what came next.

     Now the positions are a fixed grid and the type ALTERNATES
     in a fixed order: spike, fire, spike, fire… The only thing
     difficulty changes is how many there are and how wide they
     are. That is the difference between a level that is hard and
     a level that is arbitrary.
     ========================================================= */
  const hazards = 1 + Math.floor(diff*3);
  const span = w - 240;
  const inset = 140;
  const step = hazards > 1 ? (span - inset) / (hazards - 1) : 0;

  for(let i=0;i<hazards;i++){
    const hx = x0 + inset + step * i;
    /* alternating type — never two of the same in a row */
    const useFire = (i % 2 === 1);
    if(useFire){
      B.fire(hx, 60, 1.4 + diff * 0.8);
    } else {
      B.spike(hx, 50 + diff * 12);
    }
  }

  return x0 + w;
}

/* 2 · GAP — floors separated by jumpable gaps */
function segGap(B, x0, w, diff, rnd){
  const gapBase = 110 + diff*90;
  const end = x0 + w;
  let x = x0;
  let first = true;
  while(x < end - 100){
    const fw = 150 + rnd()*160;
    const stop = Math.min(end, x + fw);
    B.floor(x, stop - x);
    if(first){ B.cpCandidate(x + 50); first = false; }
    x = stop;
    if(x >= end - 100) break;
    const gap = gapBase + rnd()*40;
    if(gap > 150 && rnd() > 0.4) B.gem(x + gap/2, 430);
    x += gap;
  }
  if(x < end) B.floor(x, end - x);
  return end;
}

/* =========================================================
   3 · STAIRS — a rising or falling staircase
   ---------------------------------------------------------
   THE BUG THIS REPLACES
   ---------------------
   The old version computed each step's y, then clamped it:

       py = 500 - (i+1)*rise
       cy = Math.max(250, Math.min(480, py))

   Two things went wrong with that.

   1. The clamp silently FLATTENED the staircase. Once the
      unclamped y went above 250, every remaining step clamped to
      exactly 250 — so the top half of the stairs became one
      horizontal shelf hanging in mid-air, and the player had to
      make a single impossible vertical leap to reach it.

   2. The descending branch was worse. It started at
      `500 - steps*rise`, i.e. the HIGHEST point of the whole
      flight, so a long flight began above the ceiling limit and
      the first step was already clamped. The "stairs" then read
      as a platform floating at the top of the screen.

   THE FIX
   -------
   Work out the TOTAL height of the flight first, then derive a
   per-step rise that fits inside the legal band. The staircase is
   therefore always complete, always reachable, and never
   collapses into a shelf.

   The legal band is:
     bottom  : GROUND_Y (500) — the flight must start on the floor
     top     : the highest a double jump can comfortably reach,
               minus clearance, so the last step is always landable
   ========================================================= */
function segStairs(B, x0, w, diff, rnd){
  const up = rnd() > 0.45;

  /* how many steps fit in this segment */
  const steps = Math.max(3, Math.floor(w/130));
  const stepW = w / steps;

  /* ---------------------------------------------------------
     THE BAND
     A double jump clears roughly 260 units of height, but the
     player also needs horizontal room and a landing margin. 200
     is the highest step top that is comfortably reachable from
     the floor without a perfect input, so that is the ceiling of
     the flight.
     --------------------------------------------------------- */
  const FLOOR_Y = TUNE.GROUND_Y;      /* 500 */
  const TOP_Y   = 300;                /* highest step top allowed */
  const MAX_TOTAL_RISE = FLOOR_Y - TOP_Y;   /* 200 */

  /* the flight's total height: never more than the band allows,
     and it grows with difficulty so late levels feel taller */
  const wantRise = 90 + diff * 110;                  /* 90 .. 200 */
  const totalRise = Math.min(MAX_TOTAL_RISE, wantRise);

  /* per-step rise — derived from the total, never clamped after */
  const rise = totalRise / steps;

  for(let i=0;i<steps;i++){
    const px = x0 + i*stepW;

    /* -------------------------------------------------------
       Both directions are now built from the SAME total rise,
       so neither can overshoot the band.

       ascending : step 0 sits one rise above the floor, the last
                   step sits `totalRise` above it.
       descending: step 0 sits `totalRise` above the floor, the
                   last step sits one rise above it — i.e. the
                   flight starts high and walks DOWN to the floor,
                   which is the opposite of the old behaviour.
       ------------------------------------------------------- */
    const py = up
      ? FLOOR_Y - (i + 1) * rise
      : FLOOR_Y - (steps - i) * rise;

    /* a final safety clamp — with the maths above it can never
       trigger, but it costs nothing and guarantees the invariant */
    const cy = Math.max(TOP_Y, Math.min(FLOOR_Y - rise, py));

    if(B.plat(px, cy, stepW*0.72, 22)){
      if(rnd() > 0.35) B.gem(px + stepW*0.36, cy - 46);
    }
  }

  /* ---------------------------------------------------------
     The landing floor must OVERLAP the next segment, not just
     touch it — otherwise the player stands on a bare edge with a
     gap right behind it.
     --------------------------------------------------------- */
  B.floor(x0 + w*0.80, w*0.20 + 60);

  return x0 + w;
}

/* =========================================================
   4 · ISLAND — floating islands over a genuine void
   ---------------------------------------------------------
   The old version scattered islands at `380 + sin(i*1.3)*60 - diff*30`
   with a width of `110 - diff*25`. Three things were wrong:

     · the height wobbled by ±60 units per island, so the chain had
       no readable rhythm — every island sat at a different altitude
       for no reason the player could learn
     · the width shrank with difficulty, so late levels had thin
       slivers next to early levels with wide slabs — the same
       mechanic, two different games
     · nothing guaranteed the gaps between islands were jumpable

   Now the islands sit on a FIXED height and a FIXED size, spaced
   on a grid. The only thing difficulty changes is how many there
   are. That is the difference between a level you can read and a
   level you survive.
   ========================================================= */
function segIsland(B, x0, w, diff, rnd){
  B.floor(x0, 130);
  B.floor(x0 + w - 150, 150);

  const count = 3 + Math.floor(diff*3);
  const span  = w - 280;                 /* usable air between banks */
  const step  = span / count;

  /* one height, one size — the chain reads as a designed path */
  const ISLAND_Y = 370;
  const ISLAND_W = 100;

  for(let i=0;i<count;i++){
    const px = x0 + 150 + i*step + (step - ISLAND_W)/2;
    if(B.plat(px, ISLAND_Y, ISLAND_W, 22)){
      if(i % 2 === 0) B.gem(px + ISLAND_W/2, ISLAND_Y - 44);
    }
  }

  return x0 + w;
}

/* 5 · LAVA — a pool crossed on stepping stones.
   ---------------------------------------------------------
   ORDER MATTERS. The old version placed the lava FIRST, then the
   stepping stones. `lava()` reserves its whole footprint, so any
   stone that landed inside the pool was silently rejected — and
   the result was a lava pool with nothing to cross it, i.e. an
   unpassable gap.
   Now the stones go down first and the lava fills the water
   around them.
   --------------------------------------------------------- */
/* =========================================================
   5 · LAVA CHASM — the pool IS the gap.
   ---------------------------------------------------------
   THE DESIGN RULE THIS ENFORCES
   -----------------------------
   A lava pool must not be a decoration sitting on top of solid
   ground. If there is floor underneath it, the player can simply
   walk around the end of the pool, or fall in and climb out onto
   the same floor. The pool is then a speed bump, not a chasm.

   The correct shape is:

       [ bank ]  [ .......... CHASM .......... ]  [ bank ]
       [ bank ]  [ ==== lava, from top to bottom ==== ]  [ bank ]

   The chasm is a genuine void: no floor at y = 500 anywhere
   inside it. The lava fills that void from the surface down past
   the bottom of the screen. The only way across is the stepping
   stones, and falling between them is death, not a stumble.

   BUILD ORDER (load-bearing):
     1. both banks first  — they define the chasm's edges
     2. the stones        — they define the safe route
     3. the lava last     — it fills whatever is left
   ========================================================= */
function segLava(B, x0, w, diff, rnd){
  /* ---- 1 · both banks, with a real chasm between them ---- */
  const bankIn  = 150;
  const chasmW  = Math.min(w - bankIn * 2, 220 + diff * 160);
  const chasmX  = x0 + bankIn;
  const farBank = chasmX + chasmW;

  B.floor(x0, bankIn);
  B.floor(farBank, Math.max(150, (x0 + w) - farBank));

  /* ---- 2 · stepping stones across the chasm ---- */
  /* count and width are deterministic functions of difficulty */
  const stones = 2 + Math.round(diff * 2);          /* 2 .. 4 */
  const stoneW = Math.round(92 - diff * 22);        /* 92 .. 70 */
  const slot   = chasmW / (stones + 1);

  let placed = 0;
  for(let i=0;i<stones;i++){
    const sx = chasmX + slot * (i + 1) - stoneW / 2;
    /* one height for every stone. The old version alternated by 34
       units, which read as a wobble rather than a route — and the
       stones sit over a chasm, so the clearance rule never fires
       and the height has to be chosen here. */
    const sy = 400;
    if(B.plat(sx, sy, stoneW, 20)){
      placed++;
      /* a gem on every other stone, at a fixed offset */
      if(i % 2 === 0) B.gem(sx + stoneW/2, sy - 44);
    }
  }

  /* ---- 3 · the lava fills the chasm, top to bottom ---- */
  /* If no stone survived validation the chasm would be uncrossable,
     so the pool is only poured when there is at least one. */
  if(placed > 0){
    /* the pool is poured INTO the void: its surface sits just below
       the ground line and it runs far past the bottom of the screen,
       so there is no floor inside it and nothing hangs in the air */
    B.lava(chasmX, chasmW);
  }

  return x0 + w;
}

/* 6 · CORRIDOR — a low ceiling forces careful jumps */
function segCorridor(B, x0, w, diff, rnd){
  B.floor(x0, w);
  const blocks = 1 + Math.floor(diff*2);
  const span = w - 320;
  if(span > 0){
    for(let i=0;i<blocks;i++){
      const cx = x0 + 160 + (span/blocks)*i + rnd()*40;
      const cw = 160 + rnd()*80;
      B.ceil(cx, 210 + rnd()*40, cw);
      if(rnd() > 0.4) B.spike(cx + cw*0.5 - 30, 60);
    }
  }
  if(rnd() > 0.5) B.gem(x0 + w*0.5, 430);
  return x0 + w;
}

/* 7 · MOVER — a wide chasm crossed on moving platforms.
   ---------------------------------------------------------
   BUG FIX: the old version placed the mover BEFORE the landing
   floor. `mover()` reserves its whole sweep corridor, so if the
   landing floor was already there the mover was silently
   rejected — and because a floor still got added, the
   "did this segment produce anything?" check in buildLevel saw
   progress and never fell back. Result: mover segments that
   contained no movers at all.
   Now: land first, then place the mover inside the empty chasm,
   and try a second one if the first is refused.
   --------------------------------------------------------- */
function segMover(B, x0, w, diff, rnd){
  const chasm = Math.min(w - 380, 250 + diff*110);
  const startX = x0;
  const endX   = x0 + 150 + chasm;

  /* both banks first, so the mover has a corridor to live in */
  B.floor(startX, 150);
  B.floor(endX, Math.max(160, (x0 + w) - endX));

  const axis = rnd() > 0.5 ? 'x' : 'y';
  const dist = axis === 'x' ? Math.round(chasm*0.30) : 70;
  const speed = 1.1 + diff*0.7;

  /* place inside the gap, away from both banks */
  const mx = startX + 150 + chasm*0.34;
  const placed = B.mover(mx, 420, 92, axis, dist, speed);

  /* a second mover makes the crossing feel like a route, not a
     single lucky jump — but only if there is room for it */
  if(placed && chasm > 300){
    const mx2 = startX + 150 + chasm*0.68;
    B.mover(mx2, 400, 84, rnd() > 0.5 ? 'x' : 'y', axis==='x'?60:70, speed*0.9);
  }

  if(rnd() > 0.5) B.gem(mx + 46, 340);

  /* a hazard on the far bank so the landing is not free */
  if(diff > 0.5) B.spike(endX + 30, 55);

  return x0 + w;
}

/* =========================================================
   8 · CRUMBLE — a chain of fragile stones over a void.
   ---------------------------------------------------------
   These stones are VISIBLE from the start and look exactly like
   the solid ground either side of them (see `drawCrumb` in
   game.js — it renders through the same `drawPlatBody` routine).
   The only tell is that they give way shortly after you land.

   The fuse is deliberately short and fixed: 0.35s. Long enough to
   register the stone under your feet, short enough that standing
   still is not an option. `TUNE.FUSE_MIN` clamps it, so it can
   never drop below the fairness floor.

   `respawn` alternates: every other stone comes back after a
   cooldown. That keeps the chain from being memorised as a fixed
   shape without ever becoming unfair.
   ========================================================= */
function segCrumble(B, x0, w, diff, rnd){
  B.floor(x0, 140);
  B.floor(x0 + w - 140, 140);

  const count = 3 + Math.floor(diff*2);
  const span  = w - 280;
  const step  = span / count;

  /* =========================================================
     DETERMINISTIC FUSE — no coin flips.
     ---------------------------------------------------------
     The old version rolled `fuse = 0.95 - diff*0.55 + rnd()*0.10`
     and `respawn = rnd() > 0.5` per platform. Two consequences:

       · the same chain had a different rhythm on every seed, so
         a player could not learn it — only survive it
       · the jitter could push a fuse below the fairness floor on
         the hardest levels, producing a platform that vanished
         before the player had time to register it

     The fuse is now a pure function of difficulty, identical for
     every platform in the chain. What changes across the chain is
     the HEIGHT, which is a fixed wave — so the route reads as a
     designed shape, and the only variable is how fast the player
     has to be.

     `respawn` alternates deterministically: every other platform
     comes back. That is still a real decision (you cannot assume
     the one you just broke is gone), but it is a predictable one.
     ========================================================= */
  /* one height, one width — the chain reads as a designed path.
     The fuse is SHORT and identical for every stone: 0.35s. */
  const CHAIN_Y    = 420;
  const CHAIN_W    = 76;
  const CHAIN_FUSE = 0.35;

  for(let i=0;i<count;i++){
    const cx = x0 + 140 + i*step + (step - CHAIN_W)/2;
    const respawn = (i % 2 === 1);
    if(B.crumb(cx, CHAIN_Y, CHAIN_W, CHAIN_FUSE, respawn)){
      if(i % 2 === 0) B.gem(cx + CHAIN_W/2, CHAIN_Y - 44);
    }
  }

  if(diff > 0.6) B.fire(x0 + w - 200, 60, 1.5);

  return x0 + w;
}

/* =========================================================
   9 · SAW RUN — a corridor of spinning blades.
   ---------------------------------------------------------
   The blades patrol the FLOOR LINE, so the safe route is a
   rhythm of short hops. Each blade gets its own phase offset so
   the gaps never line up — the player has to read the pattern,
   not memorise a single beat.
   ========================================================= */
function segSawRun(B, x0, w, diff, rnd){
  B.floor(x0, w);

  /* =========================================================
     A level-1 saw run is ONE slow blade over open ground: the
     player can see it, walk up to it, and learn the rhythm.
     A level-25 saw run is four fast blades, some of them on the
     vertical, over a floor that is no longer continuous.
     The count, the travel and the speed all scale — the mechanic
     itself never changes, which is what keeps it fair.
     ========================================================= */
  const count = 1 + Math.floor(diff * 4);        /* 1 .. 5 */
  const span  = w - 260;
  if(span <= 0) return x0 + w;

  /* =========================================================
     DETERMINISTIC LAYOUT
     ---------------------------------------------------------
     The old version placed blades at `x0 + 130 + (span/count)*i
     + rnd()*30` — a random nudge that made two blades in the same
     run overlap on some seeds and sit far apart on others. That
     is the "randomness" the design brief objects to.

     Blades are now placed on an EVEN grid with a fixed inset, so
     the spacing is always the same and always readable. The only
     thing difficulty changes is how many blades there are and how
     fast they move — never where the gaps are.

     The old "carve a gap by laying a second floor" block is gone.
     It was a bug: `B.floor()` ADDS ground, it does not remove it.
     On a saw run that already had a floor, the extra floors just
     stacked on top of it and did nothing except confuse the
     hazard-placement validation.
     ========================================================= */
  const inset = 130;
  const usable = span - inset * 2;
  const gap = count > 1 ? usable / (count - 1) : 0;

  for(let i=0;i<count;i++){
    const sx = x0 + inset + gap * i;

    /* =========================================================
       NO VERTICAL BLADE IN THE OPENING STRETCH
       ---------------------------------------------------------
       A vertical blade drops from above. If one of them patrols
       the first stretch of a level, the player meets it from
       underneath — they are walking, it arrives in their head, and
       there was nothing on screen to read. The first blade of any
       run is therefore ALWAYS horizontal, so the player sees it
       sliding along the floor before they see one that falls.
       ========================================================= */
    const firstBlade = (i === 0);
    const axis = (!firstBlade && diff > 0.55 && i % 3 === 2) ? 'y' : 'x';

    /* travel and speed scale cleanly with difficulty */
    const dist = axis === 'x'
      ? Math.round(60 + diff * 70)
      : Math.round(45 + diff * 50);
    const spd = 0.8 + diff * 1.6;

    /* blades hover just above the floor — low enough to matter */
    const sy = TUNE.GROUND_Y - TUNE.SAW_R - 26 - diff * 14;

    if(B.saw(sx, sy, TUNE.SAW_R, axis, dist, spd)){
      /* one gem per blade, at a fixed offset — a reward for
         threading the gap, not a lottery */
      if(i % 2 === 0) B.gem(sx, sy - 70);
    }
  }

  /* a gem reward for threading the blades cleanly */
  if(rnd() > 0.5) B.gem(x0 + w * 0.5, TUNE.GROUND_Y - 150);

  return x0 + w;
}

/* =========================================================
   10 · NAIL GAUNTLET — dense nails, floor and ceiling.
   ---------------------------------------------------------
   The floor rows force a precise jump; the ceiling rows force
   the player to stay LOW. Placing both in the same stretch is
   what turns a corridor into a gauntlet.
   ========================================================= */
function segNailGauntlet(B, x0, w, diff, rnd){
  B.floor(x0, w);

  /* =========================================================
     DETERMINISTIC LAYOUT
     ---------------------------------------------------------
     Floor rows and ceiling slabs sit on fixed grids with a fixed
     inset. The only things difficulty changes are how many there
     are, how wide they are, and how low the ceiling slabs hang.
     A player who learns level 3's nail gauntlet can read level
     18's on sight — the pattern is the same, the density is not.
     ========================================================= */

  /* ---- floor rows on a fixed grid ---- */
  const rows  = 2 + Math.floor(diff * 3);
  const span  = w - 260;
  const inset = 130;
  const step  = rows > 1 ? (span - inset) / (rows - 1) : 0;
  const rowW  = Math.round(46 + diff * 34);

  for(let i=0;i<rows;i++){
    const nx = x0 + inset + step * i;
    B.nail(nx, rowW, 1);
  }

  /* ---- ceiling slabs on a fixed grid, hung above the gaps ---- */
  if(diff > 0.30){
    const slabs = 1 + Math.floor(diff * 2);
    const cspan = w - 340;
    const cstep = slabs > 1 ? cspan / (slabs - 1) : 0;
    const cw    = 150;
    /* the slab drops as difficulty rises — 300 → 240 */
    const cy    = Math.round(300 - diff * 60);

    for(let i=0;i<slabs;i++){
      const cx = x0 + 170 + cstep * i;
      B.ceil(cx, cy, cw);
      /* the nails hang from the middle of the slab, always */
      B.nail(cx + 12, cw - 24, -1);
    }
  }

  /* one gem, at the centre — a reward for reading the whole run */
  B.gem(x0 + w * 0.5, TUNE.GROUND_Y - 130);
  return x0 + w;
}


/* =========================================================
   12 · CRUSHER HALL — stones that drop from the ceiling.
   ---------------------------------------------------------
   The player must cross a floor while stones fall in sequence.
   The slabs are placed FIRST so the crushers have a ceiling to
   hang from, and the drop corridors never overlap.
   ========================================================= */
function segCrusherHall(B, x0, w, diff, rnd){
  B.floor(x0, w);

  /* =========================================================
     SLAB FIRST, STONE SECOND — ALWAYS.
     ---------------------------------------------------------
     THE INVISIBLE-TRAP BUG THIS FIXES
     ---------------------------------
     The old version placed the ceiling with `B.ceil(cx, 200 +
     rnd()*30, cw)` and then the stone with `B.crusher(cx + cw*0.5
     - 35, 228 + rnd()*20, ...)`.

     Two things were wrong with that:

       1. The stone's y was hard-coded to 228 while the ceiling's y
          was random between 200 and 230. When the ceiling landed
          near 230, its underside was at 258 — BELOW the stone. The
          stone was then floating in mid-air with no anchor, and
          `B.ceil` could also silently fail (returning false) while
          the crusher was placed anyway.

       2. Nothing verified that the ceiling actually covered the
          stone's x. A slab 150 wide with a stone offset by 35 could
          end up with the stone hanging off its edge.

     The result was a hazard with no visible anchor: a stone that
     appeared out of nothing and killed the player on a level where
     they had no reason to look up. That is the invisible trap.

     THE FIX
     -------
       · the slab is laid first and its return value is checked
       · the stone's y is DERIVED from the slab's underside, not
         hard-coded — so it always hangs from it
       · the stone is centred under the slab, so it is always
         covered
       · every dimension is a function of difficulty, not a coin
     ========================================================= */
  const slabs = 2 + Math.floor(diff * 2);
  const span  = w - 320;
  const inset = 160;
  const step  = slabs > 1 ? (span - inset) / (slabs - 1) : 0;

  const slabW  = 170;
  const slabY  = Math.round(200 + diff * 10);
  const stoneW = 70;

  for(let i=0;i<slabs;i++){
    const cx = x0 + inset + step * i;

    /* 1 · the ceiling the stone will hang from.
           If it cannot be placed, skip the stone entirely —
           a crusher without a ceiling is the invisible trap. */
    if(!B.ceil(cx, slabY, slabW)) continue;

    /* 2 · the stone, hanging directly under the slab's centre */
    const stoneX = cx + (slabW - stoneW) / 2;
    const stoneY = slabY + TUNE.CEIL_H + 4;

    B.crusher(stoneX, stoneY, stoneW,
              110 + diff * 90,        /* drop: 110 → 200 */
              1.1 + diff * 1.5);      /* speed: 1.1 → 2.6 */
  }

  /* a floor hazard between the drop zones — only once the player
     has met a crusher on its own */
  if(diff > 0.40) B.nail(x0 + w * 0.5 - 30, 60, 1);

  /* one gem, centred */
  B.gem(x0 + w * 0.5, TUNE.GROUND_Y - 120);

  return x0 + w;
}

/* =========================================================
   13 · GAUNTLET — everything at once.
   ---------------------------------------------------------
   The late-game showpiece: saws, nails, risers and a crusher in
   one continuous stretch. Only unlocked at very high difficulty.
   ========================================================= */
/* =========================================================
   13 · GAUNTLET — a fixed, readable sequence.
   ---------------------------------------------------------
   The old version scattered saws and nails with `rnd()` offsets,
   so the "sequence" was different on every seed and the player
   could never learn it. This version lays out a FIXED rhythm:

       saw → nails → saw → riser → crusher → saw

   at fixed fractions of the segment width. Difficulty changes
   how fast the blades move and how deep the stone drops — never
   the order. A player who has met each hazard separately can
   read the whole run the first time they see it.
   ========================================================= */
function segGauntlet(B, x0, w, diff, rnd){
  B.floor(x0, w);

  const sawY = TUNE.GROUND_Y - TUNE.SAW_R - 30;

  /* 1 · saw at 0.14 */
  B.saw(x0 + w * 0.14, sawY, TUNE.SAW_R, 'x',
        70 + diff * 40, 1.2 + diff * 1.0);

  /* 2 · nail row at 0.28 */
  B.nail(x0 + w * 0.28, 50 + diff * 30, 1);

  /* 3 · saw at 0.40 — a vertical blade, but never the first thing
         the player meets in the run (see segSawRun) */
  B.saw(x0 + w * 0.40, sawY, TUNE.SAW_R, 'y',
        60 + diff * 40, 1.3 + diff * 1.0);


  /* 5 · crusher, with its own slab, at 0.70 */
  const cx = x0 + w * 0.70;
  if(B.ceil(cx - 85, 200, 170)){
    B.crusher(cx - 35, 200 + TUNE.CEIL_H + 4, 70,
              130 + diff * 70, 1.5 + diff * 1.1);
  }

  /* 6 · closing saw at 0.86 */
  B.saw(x0 + w * 0.86, sawY, TUNE.SAW_R, 'x',
        60 + diff * 40, 1.4 + diff * 1.0);

  /* one gem, at the centre of the run */
  B.gem(x0 + w * 0.5, TUNE.GROUND_Y - 170);
  return x0 + w;
}

/* =========================================================
   SEGMENT REGISTRY — unlockAt drives the difficulty curve.
   ---------------------------------------------------------
   The new families are gated so the player meets them in a
   deliberate order: nails → saws → risers → crushers →
   gauntlet. Each unlockAt is a *difficulty* threshold, not a
   level number, so a late level is dense with them and an
   early one is not.
   ========================================================= */
/* =========================================================
   SEGMENT REGISTRY
   ---------------------------------------------------------
   DESIGN RULE — every hazard, every level.

   The previous table gated each family behind a high `unlockAt`,
   which meant level 1 had no saws, no nails, no risers and no
   crushers at all. A player could finish a third of the game
   without ever meeting the mechanics the game is built around.

   The new rule is the opposite: EVERY family is available from
   the first level, and what scales is INTENSITY, not presence.

     · `unlockAt` is now a soft gate — it is the difficulty at
       which the family starts appearing, and every value is low
       enough that level 1 already qualifies for all of them.
     · The segment functions themselves read `diff` and scale
       count, speed, fuse and travel. A level-1 saw is one slow
       blade over flat ground; a level-25 saw is four fast ones
       over a chain of gaps.
     · `weight` in `pickSegment` still favours the gentle
       segments at low difficulty, so level 1 is not a meat
       grinder — it is a level that TEACHES every hazard safely.

   That is the difference between "hard" and "unfair": the player
   meets each mechanic early, in a survivable form, and the same
   mechanic gets crueller as they get better.
   ========================================================= */

/* =========================================================
   SET-PIECE A · THE FRAGILE BRIDGE
   ---------------------------------------------------------
   Hand-authored, identical on every seed: a chain of fragile
   stones with ONE safe island in the middle and a slow blade
   sweeping above it. The player has to decide where to breathe,
   which is a thing no generated segment ever asks for.
   ========================================================= */
function segBridge(B, x0, w, diff, rnd){
  B.floor(x0, 160);
  B.floor(x0 + w - 160, 160);

  const span   = Math.max(240, w - 320);
  const crumbW = 70;
  /* the chain is sized to the span, and the spacing is always wider
     than a stone plus its validation pad — otherwise every other
     stone is silently refused and the "bridge" becomes a plain gap */
  const count  = Math.max(3, Math.min(7, Math.floor((span - 40) / (crumbW + 34))));
  const step   = span / (count + 1);
  const Y      = 430;
  const mid    = Math.floor(count / 2);

  for(let i = 0; i < count; i++){
    const cx = x0 + 160 + step * (i + 1) - crumbW / 2;

    if(i === mid){
      if(B.plat(cx - 24, Y, crumbW + 52, 22)) B.gem(cx + crumbW/2, Y - 46);
      continue;
    }

    B.crumb(cx, Y, crumbW, 0.52, (i % 2 === 1));
    if(i === 1 || i === count - 2) B.gem(cx + crumbW/2, Y - 52);
  }

  /* one blade over the whole crossing — high enough to read, low
     enough to matter when you jump */
  B.saw(x0 + w * 0.5, 320, TUNE.SAW_R, 'x', 90, 0.9 + diff * 0.5);

  return x0 + w;
}

/* =========================================================
   SET-PIECE B · THE GATE
   ---------------------------------------------------------
   A slab low enough to stop a full jump, a floor spike beneath it,
   and no way round either. Two of these in a row teach the player
   the difference between jumping OVER something and passing
   UNDER it — the one lesson a flat corridor can never teach.
   ========================================================= */
function segGate(B, x0, w, diff, rnd){
  B.floor(x0, w);

  const gates = 2 + Math.floor(diff * 2);
  const span  = Math.max(200, w - 380);
  const step  = gates > 1 ? span / (gates - 1) : 0;
  const gateW = 170;

  for(let i = 0; i < gates; i++){
    const gx = x0 + 190 + step * i;

    /* slab first, then the floor row under it — a jump that the low
       ceiling turns into a scrape */
    if(!B.ceil(gx, 236, gateW)) continue;
    B.spike(gx + gateW * 0.5 - 26, 54 + diff * 14);
  }

  B.gem(x0 + w * 0.5, TUNE.GROUND_Y - 118);
  return x0 + w;
}

const SEGMENTS = {
  run        : { fn:segRun,         minW:440, unlockAt:0.00 },
  gap        : { fn:segGap,         minW:540, unlockAt:0.00 },
  stairs     : { fn:segStairs,      minW:500, unlockAt:0.02 },
  island     : { fn:segIsland,      minW:580, unlockAt:0.05 },
  nails      : { fn:segNailGauntlet,minW:600, unlockAt:0.08 },
  saws       : { fn:segSawRun,      minW:620, unlockAt:0.10 },
  corridor   : { fn:segCorridor,    minW:520, unlockAt:0.12 },
  mover      : { fn:segMover,       minW:580, unlockAt:0.15 },
  lava       : { fn:segLava,        minW:620, unlockAt:0.18 },
  crumble    : { fn:segCrumble,     minW:580, unlockAt:0.18 },
  /* `rise` is deliberately absent. The erupting stone (riser) is
     not part of the game: a surface that gives way under you is
     already covered by the fragile stone above, and the fragile
     stone is visible from the start instead of erupting out of the
     floor when you approach. The engine support for `risers` is
     untouched, so re-adding this line brings it back. */

  crushers   : { fn:segCrusherHall, minW:640, unlockAt:0.25 },
  gauntlet   : { fn:segGauntlet,    minW:700, unlockAt:0.30 },

  /* ---- hand-authored set-pieces ---- */
  bridge     : { fn:segBridge,      minW:720, unlockAt:0.10 },
  gate       : { fn:segGate,        minW:700, unlockAt:0.16 }
};

/* =========================================================
   SEGMENT PICKER
   ---------------------------------------------------------
   Two rules keep the mix healthy:
     1. never the same template twice in a row
     2. a template that has just unlocked gets a BOOST for a
        short window, so the player actually meets the new
        mechanic instead of it being lost in the shuffle
   `run` and `gap` stay weighted up so a level always breathes.
   ========================================================= */
/* =========================================================
   WORLD SIGNATURE
   ---------------------------------------------------------
   `diff` says HOW HARD a level is. It never said WHAT KIND of
   hard — so five worlds were five tints of one level. Each world
   now leans on its own families, and the multipliers are gentle
   enough that nothing is ever impossible, only characteristic.
   ========================================================= */
const WORLD_BIAS = [
  /* 0 · CLAY HOUSE — learning: floor, gaps, fragile stones */
  { run:1.6, gap:1.5, crumble:1.8, stairs:1.1, island:0.9,
    nails:0.35, saws:0.35, crushers:0.20, mover:0.45, lava:0.40,
    corridor:0.60, gauntlet:0.15, bridge:1.4, gate:0.5 },

  /* 1 · OLD MOSQUE — indoors: low ceilings, nails, stairs */
  { corridor:1.9, gate:1.7, nails:1.8, stairs:1.4, island:0.8,
    run:0.9, gap:0.9, crumble:0.7, saws:0.7, mover:0.6, lava:0.4,
    crushers:0.4, gauntlet:0.3, bridge:0.6 },

  /* 2 · THE MARKET — things that move */
  { mover:2.0, lava:1.7, gap:1.4, saws:0.9, island:0.9,
    run:0.9, stairs:0.6, corridor:0.6, nails:0.7, crumble:0.8,
    crushers:0.5, gauntlet:0.4, bridge:1.0, gate:0.8 },

  /* 3 · RUINED COURT — things that fall */
  { saws:1.9, crushers:1.9, crumble:1.4, bridge:1.3, gauntlet:1.0,
    run:0.8, gap:0.9, stairs:0.5, island:0.7, nails:0.9,
    mover:0.6, lava:0.6, corridor:0.7, gate:0.9 },

  /* 4 · LANTERN TOWER — everything, at height, no rest */
  { gauntlet:2.0, saws:1.5, crushers:1.4, mover:1.3, lava:1.2,
    stairs:1.1, bridge:1.2, gate:1.2, crumble:1.0, nails:1.0,
    corridor:0.9, run:0.6, gap:0.8, island:0.7 }
];

function pickSegment(diff, rnd, last, world){
  const pool = [];
  for(const k in SEGMENTS){
    const s = SEGMENTS[k];
    if(diff < s.unlockAt) continue;
    if(k === last) continue;

    let weight = 1;

    /* ---------------------------------------------------------
       BREATHING ROOM SHRINKS WITH DIFFICULTY
       ---------------------------------------------------------
       `run` and `gap` used to be permanently weighted up, which
       meant a late level was still mostly open floor. Their
       weight now decays as difficulty rises, so the back half of
       the game is genuinely dense.
       --------------------------------------------------------- */
    if(k === 'run') weight = 1.6 - diff * 1.1;      /* 1.60 .. 0.50 */
    if(k === 'gap') weight = 1.4 - diff * 0.9;      /* 1.40 .. 0.50 */

    /* a freshly unlocked mechanic is pushed forward for a while */
    const sinceUnlock = diff - s.unlockAt;
    if(s.unlockAt > 0 && sinceUnlock < 0.25){
      weight += 2.2 * (1 - sinceUnlock / 0.25);
    }

    /* the hazard families never vanish once unlocked */
    if(k === 'mover' || k === 'lava') weight += 0.8;
    if(k === 'nails' || k === 'saws') weight += 0.6;
    if(k === 'rise'  || k === 'crushers') weight += 0.5;
    if(k === 'gauntlet') weight += 0.9;

    /* ---- the world's own signature ---- */
    const bias = (WORLD_BIAS[world] || {})[k];
    if(bias !== undefined) weight *= bias;

    /* a weight can never go negative — clamp before the draw */
    if(weight < 0.15) weight = 0.15;

    pool.push({ k:k, w:weight });
  }
  if(!pool.length) return 'run';
  let total = 0;
  for(let i=0;i<pool.length;i++) total += pool[i].w;
  let r = rnd()*total;
  for(let i=0;i<pool.length;i++){
    r -= pool[i].w;
    if(r <= 0) return pool[i].k;
  }
  return pool[pool.length-1].k;
}

/* =========================================================
   LEVEL LENGTH
   ---------------------------------------------------------
   25 levels, no-death run ≈ 20 minutes total.
   At 320 u/s with ~65% effective speed (jumps, pauses,
   corrections): 1200s * 320 * 0.65 ≈ 250,000 units.
   Per level: 8,400 → 11,600, averaging ~10,000.
   ========================================================= */
function levelWidth(index){
  const t = index / 24;
  return Math.round(8400 + t*3200);
}

/* =========================================================
   LEVEL ASSEMBLY
   ========================================================= */
function buildLevel(index){
  const wd  = levelWidth(index);
  const rnd = seedRand((0x9E3779B9 ^ ((index+1)*2654435761)) >>> 0);
  const B   = new Builder();

  /* =========================================================
     DIFFICULTY CURVE
     ---------------------------------------------------------
     The old curve was linear: 0.08 + (index/24)*0.80. Level 1
     sat at 0.08 — which already unlocked stairs, islands and
     corridors — and level 25 only reached 0.88. The gap between
     the first and last level was 0.80 spread over 24 levels, so
     no single level ever felt like a step up.

     The new curve is convex (^1.35) and starts lower, so:
       · level  1  → 0.10   (only run / gap / stairs)
       · level  5  → 0.22
       · level 10  → 0.38
       · level 15  → 0.55
       · level 20  → 0.74
       · level 25  → 0.98

     The last level is now genuinely the hardest thing in the
     game, and the new hazard families arrive in a readable order.
     ========================================================= */
  const baseDiff = Math.min(0.98, 0.10 + Math.pow(index / 24, 1.35) * 0.88);

  /* 25 levels, five per world, in order — so the world of a level is
     its own index divided by five, and `pickSegment` can lean on it */
  const worldIdx = Math.min(4, Math.floor(index / 5));

  let x = 0;
  let lastSeg = null;
  let segCount = 0;

  while(x < wd - 760){
    const progress = x / wd;
    const diff = Math.min(0.95, Math.max(0.05, baseDiff + (progress-0.5)*0.22));

    /* =========================================================
       PACING — every fourth segment is a set-piece.
       ---------------------------------------------------------
       A weighted random draw gives you density, never rhythm: a
       level is a soup with no shape and nothing to remember. One
       authored moment in the middle of each stretch fixes that,
       and it costs nothing at runtime — the pieces are ordinary
       segments that the rest of the pipeline already validates.
       ========================================================= */
    let name;
    const pieces = ['bridge','gate'].filter(function(k){
      return diff >= SEGMENTS[k].unlockAt;
    });

    if(segCount > 0 && segCount % 4 === 2 && pieces.length){
      name = pieces[Math.floor(rnd() * pieces.length)];
      if(name === lastSeg && pieces.length > 1){
        name = pieces[(pieces.indexOf(name) + 1) % pieces.length];
      }
    } else {
      name = pickSegment(diff, rnd, lastSeg, worldIdx);
    }

    const spec = SEGMENTS[name];
    const segW = spec.minW + rnd()*(spec.minW*0.6);

    const beforePlats = B.plats.length;
    const stopX = spec.fn(B, x, segW, diff, rnd);

    if(B.plats.length === beforePlats){
      segRun(B, x, 440, diff, rnd);
      x += 440;
    } else {
      x = stopX;
    }

    lastSeg = name;
    segCount++;
    if(segCount % 3 === 0) B.cpCandidate(x - 70);
  }

  /* =========================================================
     HAZARD & MECHANIC GUARANTEE
     ---------------------------------------------------------
     The segment picker is probabilistic, so a level could — and
     did — end up with no fires, no movers, or no spikes at all.
     This pass runs AFTER the level is assembled and tops up any
     category that came out below its quota. It never removes
     anything, only adds, and every addition still goes through
     the same validation as the normal placement path.
     ========================================================= */
  /* =========================================================
     QUOTA — the guaranteed minimum of every hazard family.
     ---------------------------------------------------------
     A probabilistic segment picker can, and did, produce a level
     with no fires at all. The quota pass runs AFTER assembly and
     tops up any family that came out short. It only ever ADDS,
     and every addition goes through the same validation as the
     normal placement path, so it cannot create an unfair spot.

     The four new families are gated on the same difficulty
     thresholds as their segments, so an early level never gets a
     crusher it has not been taught.
     ========================================================= */
  /* =========================================================
     QUOTA — the guaranteed minimum of every hazard family.
     ---------------------------------------------------------
     EVERY family has a floor of at least ONE, at every
     difficulty. A level that happens to roll gentle segments
     still gets topped up with one saw, one nail row, one riser
     and — from the second world on — one crusher, so the player
     never goes a whole level without meeting the mechanics.

     The counts then scale with difficulty. The progression is
     deliberately gentle at the bottom (1 of each) and dense at
     the top (up to 8 spikes, 5 saws, 6 nail rows, 6 risers,
     4 crushers), which is what makes level 25 feel like a
     different game from level 1 without changing the rules.
     ========================================================= */
  const QUOTA = function(diff){
    return {
      spikes  : 3 + Math.round(diff * 5),        /* 3 .. 8  */
      fires   : 1 + Math.round(diff * 5),        /* 1 .. 6  */
      movers  : 1 + Math.round(diff * 2),        /* 1 .. 3  */
      lavas   : 1 + Math.round(diff * 2),        /* 1 .. 3  */
      nails   : 1 + Math.round(diff * 5),        /* 1 .. 6  */
      saws    : 1 + Math.round(diff * 4),        /* 1 .. 5  */
      crushers: 1 + Math.round(diff * 3)         /* 1 .. 4  */
    };
  };
  const quota = QUOTA(baseDiff);

  /* =========================================================
     TOP-UP PASS
     ---------------------------------------------------------
     Scans the level for a legal spot and adds one more of the
     requested category. Every placement still goes through the
     normal validation, so nothing here can create an unfair
     obstacle.
     Movers get an extra rule: a moving platform must span a
     GAP, not hover over solid floor. A mover above continuous
     ground is pure decoration — the player just walks under it.
     ========================================================= */
  /* =========================================================
     TOP-UP PASS — deterministic, spaced, and never invisible.
     ---------------------------------------------------------
     Three rules, in this order, for every candidate position:

       1. SPACING  — `_nearHazard` refuses anything within 140
                     units of an existing hazard. This is what
                     stops the pass from producing clusters.
       2. CONTEXT  — each family has its own preconditions: a
                     saw needs flat floor, a riser needs a void,
                     a crusher needs a ceiling, a mover needs a
                     chasm. A hazard placed without its context
                     is the invisible trap.
       3. SIZE     — every dimension is a function of `baseDiff`,
                     not of `r()`. The same level always produces
                     the same top-ups.

     The `r()` calls that remain are for SCAN OFFSET only — they
     decide where the search starts, never what gets built.
     ========================================================= */
  const topUp = function(kind, attemptSeed){
    const r = seedRand(attemptSeed >>> 0);
    const step = 90;
    for(let pass = 0; pass < 4; pass++){
      const offset = pass === 0 ? 0 : r()*step;
      /* the scan starts clear of the spawn zone: nothing lethal is
         allowed in the player's first 700 units (see inSpawnZone) */
      for(let tx = 820 + offset; tx < wd - 500; tx += step){

        /* ---- 1 · spacing ---- */
        if(B._nearHazard(tx, 80, 140)) continue;

        if(kind === 'spike'){
          if(B.spike(tx, 50 + baseDiff * 12)) return true;
        }
        else if(kind === 'fire'){
          if(B.fire(tx, 60, 1.4 + baseDiff * 0.8)) return true;
        }
        else if(kind === 'lava'){
          /* a top-up pool must be a chasm pool: no floor under it.
             `B.lava` re-checks the pit mouth itself, so nothing is
             poured across walkable ground. */
          const g = B.groundUnder(tx + 65, 300);
          if(g) continue;
          if(B.lava(tx, 130)) return true;
        }
        else if(kind === 'mover'){
          /* a mover must span a gap, not hover over solid floor */
          const mw = 90;
          if(B.groundUnder(tx + mw/2, 300)) continue;
          if(B.mover(tx, 415, mw, 'x', 65, 1.2 + baseDiff * 0.7)) return true;
        }
        else if(kind === 'nail'){
          /* floor rows only in the top-up — a ceiling row needs a
             ceiling, and top-ups must not invent geometry */
          if(B.nail(tx, 46 + baseDiff * 34, 1)) return true;
        }
        else if(kind === 'saw'){
          /* a saw needs a continuous floor to patrol over */
          const g = B.groundUnder(tx + 40, 300);
          if(!g) continue;
          const sy = TUNE.GROUND_Y - TUNE.SAW_R - 28 - baseDiff * 14;
          if(B.saw(tx, sy, TUNE.SAW_R, 'x',
                   70 + baseDiff * 50, 1.2 + baseDiff * 0.9)) return true;
        }
        /* ---- riser branch removed with the mechanic itself.
                `Builder.prototype.riser` no longer exists, so the old
                branch would have thrown a TypeError the moment the
                top-up pass reached it. ---- */
        else if(kind === 'crusher'){
          /* =========================================================
             THE CRUSHER QUOTA COULD NEVER BE FILLED (part 2)
             ---------------------------------------------------------
             The previous fix derived the stone's y from an existing
             ceiling — which was correct, but it assumed a ceiling
             was there. Only two segment templates ever lay one
             (`crushers` and `gauntlet`), so on most levels the loop
             found `anchor === null` at every candidate and gave up.
             Result: 0 falling stones on all 25 levels.

             A top-up is now allowed to BUILD ITS OWN SLAB. The slab
             is placed first, its return value is checked, and the
             stone's y is derived from its underside — the same rule
             the authored crushers obey, so the stone always hangs
             from something visible.
             ========================================================= */
          const slabW = 150;
          const stoneW = 70;
          const slabX = tx - (slabW - stoneW) / 2;
          const slabY = Math.round(200 + baseDiff * 10);

          /* an existing ceiling under which the stone can hang */
          const sxc = tx + stoneW/2;
          let anchor = null;
          for(let ci=0; ci<B.ceils.length; ci++){
            const cc = B.ceils[ci];
            if(sxc < cc[0] + 8 || sxc > cc[0] + cc[2] - 8) continue;
            const bottom = cc[1] + cc[3];
            if(anchor === null || bottom > anchor) anchor = bottom;
          }

          if(anchor !== null){
            if(B.crusher(tx, anchor, stoneW,
                         110 + baseDiff * 90, 1.1 + baseDiff * 1.5)) return true;
          } else {
            /* no ceiling — lay one, then hang the stone from it */
            if(!B.ceil(slabX, slabY, slabW)) continue;
            if(B.crusher(tx, slabY + TUNE.CEIL_H + 4, stoneW,
                         110 + baseDiff * 90, 1.1 + baseDiff * 1.5)) return true;
            /* the stone was refused — take the slab back out so the
               level does not end up with a ceiling and no reason */
            B.ceils.pop();
          }
        }
      }
    }
    return false;
  };/*
[/OLD]
      }
    }
    return false;
  };*/

  /* `single` is the singular name `topUp` understands */
  const FAMILIES = [
    { kind:'spikes',   single:'spike'   },
    { kind:'fires',    single:'fire'    },
    { kind:'movers',   single:'mover'   },
    { kind:'lavas',    single:'lava'    },
    { kind:'nails',    single:'nail'    },
    { kind:'saws',     single:'saw'     },

    { kind:'crushers', single:'crusher' }
  ];
  const arrays = {
    spikes:B.spikes, fires:B.fires, movers:B.movers, lavas:B.lavas,
    nails:B.nails,   saws:B.saws,   crushers:B.crushers
  };

  for(let k = 0; k < FAMILIES.length; k++){
    const kind   = FAMILIES[k].kind;
    const single = FAMILIES[k].single;
    const want   = quota[kind] || 0;
    const have   = arrays[kind].length;
    for(let n = have; n < want; n++){
      /* up to 4 attempts per missing hazard, each with a fresh seed —
         a single failed sweep no longer abandons the whole family */
      let placed = false;
      for(let attempt = 0; attempt < 4 && !placed; attempt++){
        placed = topUp(single,
                       0xC0FFEE ^ ((index+1)*7919) ^ (n*104729) ^
                       (k*15485863) ^ (attempt*2654435761));
      }
      if(!placed) break;
    }
  }

  /* --- guaranteed solid goal pad --- */
  const padX = wd - 340;
  B.floor(padX, 340);
  const goal = [padX + 220, TUNE.GROUND_Y - 70];

  /* =========================================================
     REAL SURFACES — captured before `ensureGround` runs
     ---------------------------------------------------------
     This is the set of surfaces the player can actually stand on
     by design. Traps are placed against this list, never against
     the synthetic floors that `ensureGround` adds.
     ========================================================= */
  const realSurfaces = [];
  for(let i=0;i<B.plats.length;i++){
    const p = B.plats[i];
    if(p[2] < 120) continue;
    realSurfaces.push({
      x: p[0], y: p[1], w: p[2],
      main: (p[1] === TUNE.GROUND_Y)
    });
  }

  /* --- a final checkpoint just before the door --- */
  B.cpCandidate(padX + 50);

  /* =========================================================
     SPAWN STRIP ONLY
     ---------------------------------------------------------
     This used to be `B.ensureGround(0, wd)` — the whole level.

     That was a catastrophic over-correction. It filled EVERY void
     at y = 500, which meant:
       · every `gap` segment was bridged
       · every `mover` chasm was paved over
       · every `island` void became flat ground
       · every `lava` pool had a floor laid across it

     The level became a corridor. You could hold right and win.

     The original bug was only ever about the SPAWN: `segStairs`
     lays its landing floor at `x0 + w*0.80`, so a level that
     opened with a stairs segment left the player standing over
     nothing. Filling the first 260 units fixes that completely
     and leaves the rest of the level exactly as designed.
     ========================================================= */
     B.ensureGround(0, 260);

   /* =========================================================
      SPAWN PAD — the guarantee that ends the whole class of bug.
      ---------------------------------------------------------
      THE BUG THIS FIXES
      ------------------
      A level could open with a segment whose first solid ground
      does not start at x = 0:

        segStairs  → landing floor at x0 + w*0.80   (400..640)
        segIsland  → B.floor(x0, 130)               (0..130 only)
        segCrumble → B.floor(x0, 140)
        segLava    → B.floor(x0, 150)
        segMover   → B.floor(x0, 150)
        segRiseFall→ B.floor(x0, 150)

      `ensureGround(0, 260)` was meant to cover that, but it walks
      the strip in 40-unit steps and only tests platforms sitting
      exactly on y = 500. Three things could therefore slip through:

        · a gap narrower than the sampling step, straddling a probe
        · a floating platform over the spawn being counted as ground
          when the player would land on it and immediately slide off
        · the strip ending at 260 while the player box is 26 wide
          and the camera starts at 42% — the first frame of the
          level could still be over air

      This function does not sample. It asks the exact question the
      physics asks: "is there a solid top under the player's whole
      footprint, at or below the spawn height, that they can stand
      on?" If the answer is no, it lays a pad that is guaranteed to
      be wide enough and tall enough that the answer becomes yes.

      It runs LAST, after every segment and every top-up, so no
      later placement can undo it. It only ever adds geometry.
      ========================================================= */
   B.ensureSpawnPad();


  /* =========================================================
     CHECKPOINT VALIDATION
     1. must sit on real solid ground
     2. never on a fragile platform
     3. clear of hazards on both sides
     4. spaced at least CP_SPACING apart
     ========================================================= */
  const cps = [];
  const cand = B.cpCandidates.slice().sort(function(a,b){ return a-b; });
  let lastCpX = -1e9;

  /* =========================================================
     A CHECKPOINT IS A PROMISE OF SAFETY
     ---------------------------------------------------------
     The window was 90 units forward and 120 back. In a level this
     dark the lantern reaches roughly 400, so a flame 150 units away
     LOOKS like it is standing on the checkpoint — that is the
     screenshot, and it is not a rendering bug, it is the geometry.

     There was a second, worse hole: when every authored candidate
     was filtered out, the level fell back to a hard-coded checkpoint
     at x = 950 that was never tested against anything at all. It
     could land in a fire with no test standing in its way.

     Both paths now run through `cpBlocked`, the window is nearly
     three times wider each way, and the fallback is chosen by
     SEARCHING for a safe spot instead of assuming one.
     ========================================================= */
  const CP_FWD = 220, CP_BACK = 170;

  const cpBlocked = function(px){
    let bad = false;
    const chk = function(hx, hw){
      if(px + CP_FWD > hx && px - CP_BACK < hx + hw) bad = true;
    };
    for(let k=0;k<B.spikes.length;k++)   chk(B.spikes[k][0],   B.spikes[k][2]);
    for(let k=0;k<B.fires.length;k++)    chk(B.fires[k][0],    B.fires[k][2]);
    for(let k=0;k<B.lavas.length;k++)    chk(B.lavas[k][0],    B.lavas[k][2]);
    for(let k=0;k<B.nails.length;k++)    chk(B.nails[k][0],    B.nails[k][2]);
    for(let k=0;k<B.crushers.length;k++) chk(B.crushers[k][0], B.crushers[k][2]);
    for(let k=0;k<B.saws.length;k++){
      const sw = B.saws[k];
      const wide = (sw.axis === 'x');
      chk(wide ? sw.x - sw.r - sw.dist : sw.x - sw.r,
          wide ? (sw.r + sw.dist) * 2 : sw.r * 2);
    }
    return bad;
  };

  const cpOnCrumb = function(px, topY){
    for(let k=0;k<B.crumbs.length;k++){
      const c = B.crumbs[k];
      if(px >= c[0]-20 && px <= c[0]+c[2]+20 && Math.abs(c[1]-topY) < 20) return true;
    }
    return false;
  };

  for(let i=0;i<cand.length;i++){
    const cx = cand[i];
    if(cx - lastCpX < TUNE.CP_SPACING) continue;

    const g = B.groundUnder(cx, 300);
    if(!g) continue;
    if(cpOnCrumb(cx, g[1])) continue;
    if(cpBlocked(cx)) continue;

    /* -PLAYER_H, not -30: 30 was the height of the pole, so the
       player spawned four units INSIDE the stone on the first frame */
    cps.push([cx, g[1] - TUNE.PLAYER_H]);
    lastCpX = cx;
  }

  /* an early checkpoint so a death in the first stretch is cheap —
     and now it is validated exactly like an authored one */
  if(!cps.length || cps[0][0] > 1500){
    for(let px = 900; px <= 1700; px += 40){
      const g0 = B.groundUnder(px, 300);
      if(!g0 || g0[1] > TUNE.GROUND_Y) continue;
      if(cpOnCrumb(px, g0[1])) continue;
      if(cpBlocked(px)) continue;
      cps.unshift([px, g0[1] - TUNE.PLAYER_H]);
      break;
    }
  }

  /* =========================================================
     OIL — evenly spaced, always on solid ground.
     ---------------------------------------------------------
     THE BUG THIS FIXES — "I NEVER FOUND ANY OIL"
     ---------------------------------------------
     A flask was validated with

         B._hitBox(ox+d-10, g[1]-30, 20, 28, 20)

     `_hitBox` tests against EVERY platform, and the flask sits
     30 units above the floor it is standing on. With a 20-unit
     pad, the test box reaches from `g[1]-50` to `g[1]+18`, which
     overlaps the floor slab itself (top at `g[1]`, bottom at
     `g[1]+40`). So the very ground the flask was standing on
     rejected it — every single time, on every level.

     The result was a game with a draining oil meter, a tutorial
     step that says "pick up the orange flasks", and ZERO flasks
     in all 25 levels.

     The flask now only has to be clear of geometry that is
     genuinely in the way: platforms whose top is ABOVE the flask's
     base. The floor it stands on is not an obstruction.
     ========================================================= */
  const oil = [];
  const oilClear = function(fx, fy){
    /* fy = the flask centre. The flask is 20x28, so its base is
       fy + 14 and its top is fy - 14. */
    const top = fy - 14, bot = fy + 14, left = fx - 10, right = fx + 10;
    for(let i=0;i<B.plats.length;i++){
      const p = B.plats[i];
      if(p[0] >= right || p[0] + p[2] <= left) continue;
      /* a platform whose top is at or below the flask's base is the
         ground it stands on — not an obstruction */
      if(p[1] >= bot - 6) continue;
      if(p[1] + p[3] > top) return false;
    }
    for(let i=0;i<B.ceils.length;i++){
      const c = B.ceils[i];
      if(c[0] >= right || c[0] + c[2] <= left) continue;
      if(c[1] + c[3] > top && c[1] < bot) return false;
    }
    for(let i=0;i<B.crumbs.length;i++){
      const c = B.crumbs[i];
      if(c[0] >= right || c[0] + c[2] <= left) continue;
      if(c[1] + c[3] > top && c[1] < bot) return false;
    }
    return true;
  };

  /* one flask roughly every OIL_STEP units, always on real ground,
     never inside a wall, and never in the spawn zone */
  for(let ox = 700; ox < wd - 420; ox += TUNE.OIL_STEP){
    let placed = false;
    for(let d = 0; d < 320 && !placed; d += 40){
      const fx = ox + d;
      const g = B.groundUnder(fx, 300);
      if(!g) continue;
      if(g[1] > TUNE.GROUND_Y) continue;
      const fy = g[1] - 40;
      if(!oilClear(fx, fy)) continue;
      oil.push([Math.round(fx), Math.round(fy)]);
      placed = true;
    }
    /* a second sweep, walking BACKWARDS from the slot, for the
       stretches where the forward scan runs into a chasm */
    if(!placed){
      for(let d = 40; d <= 320; d += 40){
        const fx = ox - d;
        if(fx < 500) break;
        const g = B.groundUnder(fx, 300);
        if(!g) continue;
        if(g[1] > TUNE.GROUND_Y) continue;
        const fy = g[1] - 40;
        if(!oilClear(fx, fy)) continue;
        oil.push([Math.round(fx), Math.round(fy)]);
        placed = true;
        break;
      }
    }
  }

  /* =========================================================
     GEM CLEANUP — drop any gem buried inside geometry.
     ========================================================= */
  const gems = [];
  for(let i=0;i<B.gems.length;i++){
    const g = B.gems[i];
    if(B._hitBox(g[0]-10, g[1]-10, 20, 20, 4)) continue;
    gems.push(g);
  }

  /* =========================================================
     TRAPS — the only non-deterministic part of a level.
     ---------------------------------------------------------
     `TRAP_SALT` is a number that changes every time the page is
     loaded. Everything else in this file is seeded from the level
     index alone, so the geometry is identical on every device and
     every run — but the traps are not, and that is deliberate.

     The result: a player can learn the route, the timing of the
     platforms and the position of every gem, and still be caught
     out by a dart launcher that was not there last time. Skill
     transfers; memorisation does not.
     ========================================================= */
  return {
    wd         : wd,
    plats      : B.plats,
    ceils      : B.ceils,
    crumbs     : B.crumbs,
    gems       : gems,
    oil        : oil,
    spikes     : B.spikes,
    fires      : B.fires,
    lavas      : B.lavas,
    movers     : B.movers,
    /* ---- new hazard families ---- */
    saws       : B.saws,
    nails      : B.nails,
    crushers   : B.crushers,
    checkpoints: cps,
    goal       : goal,
    /* the spawn y is DERIVED from the geometry, not hard-coded — the
       player starts on top of whatever covers x = 80, so a floating
       stone over the spawn no longer swallows them (see spawnY) */
    spawn      : [80, B.spawnY(80)],
    /* =========================================================
       PAR — the 3-star time limit.
       ---------------------------------------------------------
       A flat `wd / 320 * 2.35` ignored how much work a level
       actually contains. Level 1 has 3 spikes and a few gaps;
       level 25 has 8 spikes, 6 fires, 3 movers, 3 lava pools
       and a chain of fragile platforms. Both got the same
       multiplier, which made a 3-star run on the late levels
       mathematically impossible.
       The allowance now scales with difficulty, and adds a flat
       cost per hazard so dense levels get the time they need.
       ========================================================= */
    /* =========================================================
       PAR — the 3-star time limit.
       ---------------------------------------------------------
       Every hazard family now contributes its own time cost, and
       the base multiplier is tighter than before (2.35 → 1.95) so
       a 3-star run is a real achievement rather than a formality.
       The per-hazard costs are weighted by how much they actually
       slow a competent player down: a saw or a crusher costs more
       than a spike because it forces a wait.
       ========================================================= */
    par        : Math.round(
                   (wd / 320) * (1.95 + baseDiff * 0.85)
                   + (B.spikes.length   * 1.6 +
                      B.fires.length    * 2.0 +
                      B.lavas.length    * 2.8 +
                      B.movers.length   * 3.0 +
                      B.nails.length    * 1.4 +
                                             B.saws.length     * 2.6 +
                       B.crushers.length * 3.0)
                 ),
    diff       : baseDiff
  };
}

/* =========================================================
   THE 25 LEVELS — world, name, and difficulty band.
   ========================================================= */
const LEVEL_META = [
  /* WORLD 1 · CLAY HOUSE · learning */
  { w:'clay',   name:{ar:'أول شرارة',     en:'First Spark'} },
  { w:'clay',   name:{ar:'خطوة فاصلة',    en:'A Separate Step'} },
  { w:'clay',   name:{ar:'سلّم الظلال',   en:'Stair of Shadows'} },
  { w:'clay',   name:{ar:'قنديل معلّق',   en:'Hanging Lamp'} },
  { w:'clay',   name:{ar:'آخر ضوء',       en:'Last Light'} },

  /* WORLD 2 · OLD MOSQUE · intermediate */
  { w:'mosque', name:{ar:'قوس الدخول',    en:'The Arch'} },
  { w:'mosque', name:{ar:'محراب مهجور',   en:'Abandoned Niche'} },
  { w:'mosque', name:{ar:'بئر النور',     en:'Well of Light'} },
  { w:'mosque', name:{ar:'قطعة زجاج',     en:'Shard of Glass'} },
  { w:'mosque', name:{ar:'ساعة الفجر',    en:'Dawn Hour'} },

  /* WORLD 3 · THE MARKET · hard */
  { w:'market', name:{ar:'فوانيس السوق',  en:'Market Lanterns'} },
  { w:'market', name:{ar:'حبل الحرير',    en:'Silk Rope'} },
  { w:'market', name:{ar:'ليل طويل',      en:'Long Night'} },
  { w:'market', name:{ar:'رقصة الظل',     en:'Shadow Dance'} },
  { w:'market', name:{ar:'الفجر',         en:'Daybreak'} },

  /* WORLD 4 · RUINED COURT · very hard */
  { w:'ruins',  name:{ar:'بوابة الرمل',   en:'Gate of Sand'} },
  { w:'ruins',  name:{ar:'قناديل مقلوبة', en:'Inverted Lamps'} },
  { w:'ruins',  name:{ar:'ممر الأشواك',   en:'Corridor of Thorns'} },
  { w:'ruins',  name:{ar:'سقوط حر',       en:'Freefall'} },
  { w:'ruins',  name:{ar:'عين العاصفة',   en:'Eye of the Storm'} },

  /* WORLD 5 · LANTERN TOWER · expert */
  { w:'tower',  name:{ar:'الدرج الأول',   en:'The First Stair'} },
  { w:'tower',  name:{ar:'فانوس مزدوج',   en:'Twin Lanterns'} },
  { w:'tower',  name:{ar:'قمة الظلام',    en:'Dark Summit'} },
  { w:'tower',  name:{ar:'قلب القنديل',   en:'Heart of the Lantern'} },
  { w:'tower',  name:{ar:'الفجر الأخير',  en:'The Last Dawn'} }
];

/* Build all 25 once, at load. */
const LEVELS = LEVEL_META.map(function(meta, i){
  const L = buildLevel(i);
  L.w = meta.w;
  L.name = meta.name;
  L.index = i;
  return L;
});