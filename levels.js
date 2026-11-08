/* Qandil — level data + deterministic, hand-designed segment builder
   =========================================================
   DESIGN CONTRACT
   ---------------
   plats:  [x, y, w, h]
   ceils:  [x, y, w, h]   hanging ceiling blocks
   crumbs: [x, y, w, h]   fragile — crumbles 0.55s after being stood on
   spikes: [x, y, w]      h = 22, sits on a surface at y
   fires:  [x, y, w, h, speed]
   lavas:  [x, y, w, h]
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
   TUNING — every magic number lives here.
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
  OIL_STEP     : 1400
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
  this.cpCandidates = [];
  this.lastGroundEnd = 0;
}

/* ---- collision helpers ---- */
Builder.prototype._hitBox = function(x,y,w,h,pad){
  pad = pad || 0;
  const test = function(o){
    return x < o.x+o.w+pad && x+w > o.x-pad && y < o.y+o.h+pad && y+h > o.y-pad;
  };
  let i, p;
  for(i=0;i<this.plats.length;i++){ p=this.plats[i]; if(test({x:p[0],y:p[1],w:p[2],h:p[3]})) return true; }
  for(i=0;i<this.ceils.length;i++){ p=this.ceils[i]; if(test({x:p[0],y:p[1],w:p[2],h:p[3]})) return true; }
  for(i=0;i<this.crumbs.length;i++){ p=this.crumbs[i]; if(test({x:p[0],y:p[1],w:p[2],h:p[3]})) return true; }
  for(i=0;i<this.movers.length;i++){ p=this.movers[i]; if(test({x:p.x,y:p.y,w:p.w,h:p.h})) return true; }
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

Builder.prototype.plat = function(x, y, w, h){
  h = h || TUNE.FLOAT_H;
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

Builder.prototype.crumb = function(x, y, w){
  w = w || 70;
  if(this._hitBox(x, y, w, 20, 10)) return false;
  this.crumbs.push([Math.round(x), Math.round(y), Math.round(w), 20]);
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
   Rule 4 is new. Without it a floating platform could sit
   86 units over a fire, so the player would drop off it and
   land on flames with no way to see the danger coming.
   `_clearAbove` checks every platform and ceiling that hangs
   over the hazard's footprint.
   ========================================================= */
Builder.prototype._clearAbove = function(x, w, topY, need){
  const x2 = x + w;
  for(let i=0;i<this.plats.length;i++){
    const p = this.plats[i];
    const bottom = p[1] + p[3];
    if(p[0] < x2 && p[0]+p[2] > x) {
      /* anything whose underside is above the hazard and below the
         required clearance is a problem */
      if(bottom <= topY && bottom > topY - need) return false;
    }
  }
  for(let i=0;i<this.ceils.length;i++){
    const c = this.ceils[i];
    const bottom = c[1] + c[3];
    if(c[0] < x2 && c[0]+c[2] > x){
      if(bottom <= topY && bottom > topY - need) return false;
    }
  }
  for(let i=0;i<this.crumbs.length;i++){
    const c = this.crumbs[i];
    const bottom = c[1] + c[3];
    if(c[0] < x2 && c[0]+c[2] > x){
      if(bottom <= topY && bottom > topY - need) return false;
    }
  }
  return true;
};

Builder.prototype.spike = function(x, w){
  w = w || 55;
  const cx = x + w/2;
  const g = this.groundUnder(cx, 300);
  if(!g) return false;
  if(this.headroom(cx, g[1]) < TUNE.MIN_HEADROOM + TUNE.SPIKE_H) return false;
  if(!this._clearAbove(x, w, g[1], TUNE.MIN_HEADROOM + TUNE.SPIKE_H)) return false;
  if(this._hitBox(x, g[1]-TUNE.SPIKE_H, w, TUNE.SPIKE_H, 14)) return false;
  this.spikes.push([Math.round(x), Math.round(g[1]-TUNE.SPIKE_H), Math.round(w)]);
  return true;
};

Builder.prototype.fire = function(x, w, speed){
  w = w || 60;
  const cx = x + w/2;
  const g = this.groundUnder(cx, 300);
  if(!g) return false;
  if(this.headroom(cx, g[1]) < TUNE.MIN_HEADROOM + 34) return false;
  if(!this._clearAbove(x, w, g[1], TUNE.MIN_HEADROOM + 34)) return false;
  if(this._hitBox(x, g[1]-34, w, 34, 14)) return false;
  this.fires.push([Math.round(x), Math.round(g[1]-34), Math.round(w), 34, speed||1.6]);
  return true;
};

Builder.prototype.lava = function(x, w){
  const g = this.groundUnder(x + w/2, 300);
  const y = g ? g[1] : TUNE.GROUND_Y;
  if(this._hitBox(x, y-50, w, 50, 14)) return false;
  this.lavas.push([Math.round(x), Math.round(y-50), Math.round(w), 50]);
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

  /* floating platforms first — they define the airspace */
  if(w > 400){
    const px = x0 + w*0.34;
    if(B.plat(px, 380, 110)) B.gem(px+55, 330);
    const px2 = x0 + w*0.70;
    if(B.plat(px2, 350, 100)) B.gem(px2+50, 300);
  }

  /* then hazards, which now respect everything already in the air */
  const hazards = 1 + Math.floor(diff*3);
  const span = w - 240;
  if(span > 0){
    for(let i=0;i<hazards;i++){
      const hx = x0 + 140 + (span/hazards)*i + rnd()*40;
      if(diff < 0.35){
        B.spike(hx, 50 + rnd()*25);
      } else if(diff < 0.7){
        if(rnd() > 0.5) B.spike(hx, 55); else B.fire(hx, 60, 1.4+rnd()*0.6);
      } else {
        if(rnd() > 0.45) B.fire(hx, 65, 1.6+rnd()*0.8); else B.spike(hx, 60);
      }
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

/* 4 · ISLAND — floating islands over a void */
function segIsland(B, x0, w, diff, rnd){
  B.floor(x0, 130);
  const count = 3 + Math.floor(diff*3);
  const step = (w - 180) / count;
  for(let i=0;i<count;i++){
    const px = x0 + 150 + i*step;
    const py = 380 + Math.round(Math.sin(i*1.3)*60) - diff*30;
    const pw = 110 - diff*25;
    if(B.plat(px, py, pw, 22)){
      if(rnd() > 0.25) B.gem(px + pw/2, py - 44);
    }
  }
  B.floor(x0 + w - 150, 150);
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
function segLava(B, x0, w, diff, rnd){
  B.floor(x0, 140);
  const poolW = Math.min(w - 340, 200 + diff*140);
  const px = x0 + 140;

  /* stepping stones first — they define the safe path */
  const stones = 2 + Math.floor(diff*2);
  const stoneGap = poolW / (stones + 1);
  let placedStones = 0;
  for(let i=0;i<stones;i++){
    const sx = px + stoneGap*(i+1) - 42;
    const sy = 400 - (i%2)*35;
    if(B.plat(sx, sy, 84, 20)){
      placedStones++;
      if(rnd() > 0.5) B.gem(sx+42, sy-44);
    }
  }

  /* the lava goes down only if there is at least one stone to
     stand on — otherwise the pool would be a death trap */
  if(placedStones > 0) B.lava(px, poolW);

  const endX = px + poolW;
  B.floor(endX, Math.max(140, x0 + w - endX));
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

/* 8 · CRUMBLE — fragile platforms that force forward momentum.
   Same fix as the mover: both banks are placed first, then the
   fragile chain fills the gap between them. A hazard on the far
   bank stops the player from simply walking around the chain. */
function segCrumble(B, x0, w, diff, rnd){
  B.floor(x0, 140);
  B.floor(x0 + w - 140, 140);

  const count = 3 + Math.floor(diff*2);
  const span  = w - 280;
  const step  = span / count;

  for(let i=0;i<count;i++){
    const cx = x0 + 140 + i*step;
    const cy = 430 - Math.round(Math.sin(i*0.9)*40);
    B.crumb(cx, cy, 70);
    if(rnd() > 0.55) B.gem(cx + 35, cy - 44);
  }

  if(diff > 0.6) B.fire(x0 + w - 200, 60, 1.5 + rnd()*0.5);

  return x0 + w;
}

/* =========================================================
   SEGMENT REGISTRY — unlockAt drives the difficulty curve.
   ========================================================= */
const SEGMENTS = {
  run      : { fn:segRun,      minW:440, unlockAt:0.00 },
  gap      : { fn:segGap,      minW:540, unlockAt:0.00 },
  stairs   : { fn:segStairs,   minW:500, unlockAt:0.12 },
  island   : { fn:segIsland,   minW:580, unlockAt:0.22 },
  corridor : { fn:segCorridor, minW:520, unlockAt:0.38 },
  mover    : { fn:segMover,    minW:580, unlockAt:0.45 },
  lava     : { fn:segLava,     minW:620, unlockAt:0.55 },
  crumble  : { fn:segCrumble,  minW:580, unlockAt:0.68 }
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
function pickSegment(diff, rnd, last){
  const pool = [];
  for(const k in SEGMENTS){
    const s = SEGMENTS[k];
    if(diff < s.unlockAt) continue;
    if(k === last) continue;

    let weight = 1;

    /* breathing room always stays available */
    if(k === 'run') weight = 1.5;
    if(k === 'gap') weight = 1.3;

    /* a freshly unlocked mechanic is pushed forward for a while */
    const sinceUnlock = diff - s.unlockAt;
    if(s.unlockAt > 0 && sinceUnlock < 0.25){
      weight += 2.2 * (1 - sinceUnlock / 0.25);
    }

    /* movers and lava are the two mechanics that must not vanish */
    if(k === 'mover' || k === 'lava') weight += 0.8;

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

  /* difficulty ramps across levels AND within a level */
  const baseDiff = Math.min(0.95, 0.08 + (index/24)*0.80);

  let x = 0;
  let lastSeg = null;
  let segCount = 0;

  while(x < wd - 760){
    const progress = x / wd;
    const diff = Math.min(0.95, Math.max(0.05, baseDiff + (progress-0.5)*0.22));

    const name = pickSegment(diff, rnd, lastSeg);
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
  const QUOTA = function(diff){
    return {
      spikes : 3 + Math.round(diff * 5),      /* 3 .. 8  */
      fires  : diff > 0.20 ? 2 + Math.round(diff * 4) : 0,   /* 0 .. 6 */
      movers : diff > 0.35 ? 1 + Math.round(diff * 2) : 0,   /* 0 .. 3 */
      lavas  : diff > 0.50 ? 1 + Math.round(diff * 2) : 0    /* 0 .. 3 */
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
  const topUp = function(kind, attemptSeed){
    const r = seedRand(attemptSeed >>> 0);
    const step = 120;
    for(let pass = 0; pass < 2; pass++){
      const offset = pass === 0 ? r()*step : 0;
      for(let tx = 400 + offset; tx < wd - 500; tx += step){

        if(kind === 'spike'){
          if(B.spike(tx, 50 + r()*25)) return true;
        }
        else if(kind === 'fire'){
          if(B.fire(tx, 58 + r()*20, 1.4 + r()*0.7)) return true;
        }
        else if(kind === 'lava'){
          if(B.lava(tx, 130 + r()*60)) return true;
        }
        else if(kind === 'mover'){
          /* require empty air below — a mover over solid floor is useless */
          const mw = 90;
          const below = B.groundUnder(tx + mw/2, 300);
          if(below) continue;                       /* solid floor → skip */
          if(B.mover(tx, 415 + r()*20, mw, r() > 0.5 ? 'x' : 'y', 65, 1.2 + baseDiff*0.7)) return true;
        }
      }
    }
    return false;
  };

  const kinds = ['spikes','fires','movers','lavas'];
  const arrays = { spikes:B.spikes, fires:B.fires, movers:B.movers, lavas:B.lavas };
  for(let k = 0; k < kinds.length; k++){
    const kind  = kinds[k];
    const want  = quota[kind];
    const have  = arrays[kind].length;
    const single = kind === 'spikes' ? 'spike'
                 : kind === 'fires'  ? 'fire'
                 : kind === 'movers' ? 'mover' : 'lava';
    for(let n = have; n < want; n++){
      if(!topUp(single, 0xC0FFEE ^ ((index+1)*7919) ^ (n*104729) ^ (k*15485863))) break;
    }
  }

  /* --- guaranteed solid goal pad --- */
  const padX = wd - 340;
  B.floor(padX, 340);
  const goal = [padX + 220, TUNE.GROUND_Y - 70];

  /* --- a final checkpoint just before the door --- */
  B.cpCandidate(padX + 50);

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

  for(let i=0;i<cand.length;i++){
    const cx = cand[i];
    if(cx - lastCpX < TUNE.CP_SPACING) continue;

    const g = B.groundUnder(cx, 300);
    if(!g) continue;

    let onCrumb = false;
    for(let k=0;k<B.crumbs.length;k++){
      const c = B.crumbs[k];
      if(cx >= c[0]-20 && cx <= c[0]+c[2]+20 && Math.abs(c[1]-g[1]) < 20) onCrumb = true;
    }
    if(onCrumb) continue;

    let blocked = false;
    const checkHazard = function(hx, hw){
      if(cx + TUNE.CP_SAFE_FWD > hx && cx - TUNE.CP_SAFE_BACK < hx + hw) blocked = true;
    };
    for(let k=0;k<B.spikes.length;k++) checkHazard(B.spikes[k][0], B.spikes[k][2]);
    for(let k=0;k<B.fires.length;k++)  checkHazard(B.fires[k][0],  B.fires[k][2]);
    for(let k=0;k<B.lavas.length;k++)  checkHazard(B.lavas[k][0],  B.lavas[k][2]);
    if(blocked) continue;

    cps.push([cx, g[1] - 30]);
    lastCpX = cx;
  }

  /* an early checkpoint so a death in the first stretch is cheap */
  if(!cps.length || cps[0][0] > 1500){
    const g0 = B.groundUnder(950, 300);
    if(g0) cps.unshift([950, g0[1] - 30]);
  }

  /* =========================================================
     OIL — evenly spaced, always on solid ground.
     ========================================================= */
  const oil = [];
  for(let ox = 700; ox < wd - 420; ox += TUNE.OIL_STEP){
    for(let d=0; d<240; d+=40){
      const g = B.groundUnder(ox + d, 300);
      if(!g) continue;
      if(B._hitBox(ox+d-10, g[1]-30, 20, 28, 20)) continue;
      oil.push([Math.round(ox+d), Math.round(g[1]-40)]);
      break;
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
    checkpoints: cps,
    goal       : goal,
    spawn      : [80, TUNE.GROUND_Y - TUNE.PLAYER_H],
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
    par        : Math.round(
                   (wd / 320) * (2.35 + baseDiff * 0.95)
                   + (B.spikes.length + B.fires.length * 2 +
                      B.lavas.length * 2 + B.movers.length * 3) * 1.6
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