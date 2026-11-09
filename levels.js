/* Qandel — level data and deterministic, hand-designed segment builder
   =========================================================
   plats:  [x, y, w, h]
   ceils:  [x, y, w, h]   hanging ceiling blocks
   crumbs: [x, y, w, h, fuse, respawn]  fragile platforms
   spikes: [x, y, w]      h = 22, sits on a surface at y
   fires:  [x, y, w, h, speed]
   lavas:  [x, y, w, h, groundY]  a pit cut into the floor
   movers: {x,y,w,h,axis,dist,speed,phase}
   saws:   {x, y, r, axis, dist, speed, phase}
   nails:  [x, y, w, h, dir]   dir = 1 floor, -1 ceiling
   crushers: [x, y, w, h, drop, speed]
   gems:   [x, y]         centre
   oil:    [x, y]         centre
   goal:   [x, y]         44x70 door, bottom at y+70
   checkpoints: [x, y]    pole base — verified against real geometry

   WORLD GEOMETRY
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
   PALETTE — one colour ramp per world.
   Every renderer in game.js reads its material colours from
   this table through W.pal, so no world carries a hard-coded
   colour of its own.

     stone  · [lit top, body, underside] for every solid slab
     rim    · the single lit edge every stone gets (top-left)
     shadow · the ground shadow under a stone, never pure black
     haze   · the air between the parallax layers
     spike  · [dark base, lit face, specular tip] for danger metal
     steel  · [dark, mid, light] for saws and nails
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

WORLDS.forEach(function(w){ w.pal = PALETTE[w.id] || null; });

/* =========================================================
   TUNING — every magic number lives here.
   Balance passes touch this block and nothing else.
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

  LAVA_DROP    : 22,
  LAVA_DEPTH   : 320,

  MIN_FLOAT_CLEAR : 120,

  SAW_R        : 26,
  SAW_DIST     : 110,
  SAW_SPEED    : 1.3,

  NAIL_H       : 15,
  NAIL_STEP    : 13,

  CRUSH_H      : 26,
  CRUSH_DROP   : 150,
  CRUSH_SPEED  : 1.9,

  FUSE_MIN     : 0.30,
  FUSE_MAX     : 0.95,
  CRUMB_RESPAWN: 2.6
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
   BUILDER — every piece of geometry passes a validation
   call before it is allowed into the level.
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
  this.saws = [];
  this.nails = [];
  this.crushers = [];
  this.cpCandidates = [];
  this.lastGroundEnd = 0;
}

Builder.prototype._hitBox = function(x,y,w,h,pad,skipTop){
  pad = pad || 0;
  const test = function(o){
    if(skipTop !== undefined && Math.abs(o.y - skipTop) < 4) return false;
    return x < o.x+o.w+pad && x+w > o.x-pad && y < o.y+o.h+pad && y+h > o.y-pad;
  };
  let i, p;
  for(i=0;i<this.plats.length;i++){ p=this.plats[i]; if(test({x:p[0],y:p[1],w:p[2],h:p[3]})) return true; }
  for(i=0;i<this.ceils.length;i++){ p=this.ceils[i]; if(test({x:p[0],y:p[1],w:p[2],h:p[3]})) return true; }
  for(i=0;i<this.crumbs.length;i++){ p=this.crumbs[i]; if(test({x:p[0],y:p[1],w:p[2],h:p[3]})) return true; }
  for(i=0;i<this.movers.length;i++){ p=this.movers[i]; if(test({x:p.x,y:p.y,w:p.w,h:p.h})) return true; }
  for(i=0;i<this.crushers.length;i++){ p=this.crushers[i]; if(test({x:p[0],y:p[1],w:p[2],h:p[3]})) return true; }
  return false;
};

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

Builder.prototype.floor = function(x, w){
  if(w < 40) return null;
  const p = [Math.round(x), TUNE.GROUND_Y, Math.round(w), TUNE.GROUND_H];
  this.plats.push(p);
  if(x+w > this.lastGroundEnd) this.lastGroundEnd = x+w;
  return p;
};

/* =========================================================
   ENSURE GROUND
   Walks the strip in 40-unit steps and, wherever no solid
   floor covers the spawn height, lays one. Never removes
   anything, so hand-tuned layouts stay untouched.
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
   SPAWN PAD
   A hard guarantee that the player starts on ground.
   Does not sample: it asks the exact question the physics
   asks, "is there a solid top under the player's whole
   footprint at or below the spawn height?", and lays a pad
   if the answer is no.
   ========================================================= */
Builder.prototype.ensureSpawnPad = function(){
  const SPAWN_X  = 80;
  const PLAYER_W = TUNE.PLAYER_W;
  const padTo    = SPAWN_X + PLAYER_W + 314;

  let covered = false;
  for(let i=0;i<this.plats.length;i++){
    const p = this.plats[i];
    if(Math.abs(p[1] - TUNE.GROUND_Y) > 2) continue;
    if(p[0] <= SPAWN_X && p[0] + p[2] >= SPAWN_X + PLAYER_W){
      covered = true;
      break;
    }
  }

  if(!covered) this.floor(0, padTo);

  return !covered;
};

/* =========================================================
   SPAWN HEIGHT
   Picks the highest solid top that overlaps the spawn
   column by at least half the player width, so the player
   is spawned on top of whatever is there, not inside it.
   ========================================================= */
Builder.prototype.spawnY = function(x, w){
  const SPAWN_X = (x === undefined) ? 80 : x;
  const PW = w || TUNE.PLAYER_W;

  const feetL = SPAWN_X;
  const feetR = SPAWN_X + PW;
  const needOverlap = PW * 0.5;

  let best = null;
  for(let i=0;i<this.plats.length;i++){
    const p = this.plats[i];
    if(p[1] < 70) continue;
    if(p[1] > TUNE.GROUND_Y) continue;
    const overlap = Math.min(p[0] + p[2], feetR) - Math.max(p[0], feetL);
    if(overlap < needOverlap) continue;
    if(!best || p[1] < best) best = p[1];
  }

  const surfaceY = (best === null) ? TUNE.GROUND_Y : best;
  return surfaceY - TUNE.PLAYER_H;
};

/* =========================================================
   FLOATING PLATFORM
   Raises itself until it is at least MIN_FLOAT_CLEAR above
   whatever solid sits beneath, so a floating stone is
   always a step up rather than a shelf bolted to the floor.
   ========================================================= */
Builder.prototype.plat = function(x, y, w, h){
  h = h || TUNE.FLOAT_H;
  if(y < 70) return false;

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

Builder.prototype.saw = function(x, y, r, axis, dist, speed){
  r = r || TUNE.SAW_R;
  axis = axis || 'x';
  dist = dist || TUNE.SAW_DIST;
  speed = speed || TUNE.SAW_SPEED;

  const reachL = axis === 'x' ? x - dist - r : x - r;
  const reachR = axis === 'x' ? x + dist + r : x + r;
  if(this.inSpawnZone(reachL, reachR - reachL)) return false;

  const pad = r + 12;
  const cx0 = axis === 'y' ? x - pad : x - dist - pad;
  const cy0 = axis === 'x' ? y - pad : y - dist - pad;
  const cw  = axis === 'y' ? pad * 2 : dist * 2 + pad * 2;
  const ch  = axis === 'x' ? pad * 2 : dist * 2 + pad * 2;
  if(this._hitBox(cx0, cy0, cw, ch, 6)) return false;

  if(y - r < 60) return false;
  if(y + r > TUNE.GROUND_Y + 20) return false;

  this.saws.push({
    x:Math.round(x), y:Math.round(y), r:Math.round(r),
    axis:axis, dist:Math.round(dist), speed:speed, phase:0
  });
  return true;
};

Builder.prototype.nail = function(x, w, dir){
  w = w || 60;
  dir = dir === -1 ? -1 : 1;
  if(this.inSpawnZone(x, w)) return false;
  const cx = x + w/2;

  if(dir === 1){
    const g = this.groundUnder(cx, 300);
    if(!g) return false;
    if(!this._flatUnder(x, w, g[1])) return false;
    if(this.headroom(cx, g[1]) < TUNE.MIN_HEADROOM) return false;
    if(!this._clearAbove(x, w, g[1], TUNE.MIN_HEADROOM)) return false;
    if(this._hitBox(x, g[1]-TUNE.NAIL_H, w, TUNE.NAIL_H, 14, g[1])) return false;
    this.nails.push([Math.round(x), Math.round(g[1]-TUNE.NAIL_H), Math.round(w), TUNE.NAIL_H, 1]);
    return true;
  }

  let best = null, bestTop = null;
  for(let i=0;i<this.ceils.length;i++){
    const c = this.ceils[i];
    if(cx < c[0] || cx > c[0]+c[2]) continue;
    const bottom = c[1] + c[3];
    if(!best || bottom > best){ best = bottom; bestTop = c[1]; }
  }
  if(best === null) return false;
  if(best > TUNE.GROUND_Y - TUNE.MIN_HEADROOM) return false;
  if(this._hitBox(x, best, w, TUNE.NAIL_H, 14, bestTop)) return false;
  this.nails.push([Math.round(x), Math.round(best), Math.round(w), TUNE.NAIL_H, -1]);
  return true;
};

/* =========================================================
   CRUSHER
   Legal only when a real ceiling hangs above it, the drop
   corridor is clear, and the fall actually reaches the
   floor the player walks on. No ceiling → no crusher.
   ========================================================= */
Builder.prototype.crusher = function(x, y, w, drop, speed){
  w = w || 70;
  drop = drop || TUNE.CRUSH_DROP;
  if(y < 70) return false;
  if(this.inSpawnZone(x, w)) return false;

  let anchor = null;
  const cx = x + w/2;
  for(let i=0;i<this.ceils.length;i++){
    const c = this.ceils[i];
    if(cx < c[0] + 8 || cx > c[0] + c[2] - 8) continue;
    const bottom = c[1] + c[3];
    if(bottom > y + 6) continue;
    if(!anchor || bottom > anchor) anchor = bottom;
  }
  if(anchor === null) return false;

  if(y - anchor > 26) return false;

  if(this._hitBox(x, y, w, TUNE.CRUSH_H + drop, 10)) return false;

  const g = this.groundUnder(cx, y + TUNE.CRUSH_H);
  if(!g) return false;
  const floorY = g[1];
  const bottomAtDrop = y + TUNE.CRUSH_H + drop;
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
   HAZARD CLEARANCE
   A ground hazard is legal only when:
     1. it rests on a real solid surface
     2. it leaves MIN_HEADROOM of clear air above it
     3. nothing is suspended directly over its footprint
   The surface the hazard stands on is never counted as
   "above" it, and any stone high enough up is not either.
   ========================================================= */
Builder.prototype._clearAbove = function(x, w, topY, need){
  const x2 = x + w;
  const counts = function(px, pw, pBottom){
    if(px >= x2 || px + pw <= x) return false;
    if(pBottom > topY) return false;
    if(pBottom <= topY - need) return false;
    return true;
  };
  let i;
  for(i=0;i<this.plats.length;i++){
    const p = this.plats[i];
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
   SPAWN CLEAR ZONE
   Nothing lethal is allowed within the first CLEAR units
   of the level, so no template and no top-up pass can put a
   hazard on the player's doorstep.
   ========================================================= */
Builder.prototype.inSpawnZone = function(x, w){
  w = w || 0;
  const SPAWN_X = 80;
  const CLEAR   = 700;
  return (x + w) < SPAWN_X + CLEAR;
};

/* =========================================================
   FLAT FOOTPRINT GUARD
   A hazard needs the whole footprint on one continuous
   surface at one continuous height. Every 6 units is
   probed, and the far edge is probed explicitly.
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
  if(!this._flatUnder(x, w, g[1])) return false;
  if(this.headroom(cx, g[1]) < TUNE.MIN_HEADROOM) return false;
  if(!this._clearAbove(x, w, g[1], TUNE.MIN_HEADROOM)) return false;
  if(this._hitBox(x, g[1]-34, w, 34, 14, g[1])) return false;
  this.fires.push([Math.round(x), Math.round(g[1]-34), Math.round(w), 34, speed||1.6]);
  return true;
};

/* =========================================================
   LAVA
   A pool is a hole in the earth:
     · the surface sits LAVA_DROP below the ground line
     · the body runs LAVA_DEPTH further down
     · the pit mouth must be genuinely open — no floor, deck
       or fragile stone may cross it
   The pool width is MEASURED by walking outward until the
   floor resumes, so a pool always fills its own chasm.
   ========================================================= */
Builder.prototype.lava = function(x, w){
  if(w < 90) return false;

  const g   = TUNE.GROUND_Y;
  const top = g + TUNE.LAVA_DROP;
  const h   = TUNE.LAVA_DEPTH;

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
  const guardMax = 400;
  let L = x, R = x + w, guard = 0;

  while(L > 0 && guard++ < guardMax && !solidFloorAt(L - step)) L -= step;
  guard = 0;
  while(guard++ < guardMax && !solidFloorAt(R + step)) R += step;

  const px0 = Math.max(0, L);
  const pw  = R - px0;
  if(pw < 90) return false;

  for(let i=0;i<this.lavas.length;i++){
    const o = this.lavas[i];
    if(px0 < o[0] + o[2] && px0 + pw > o[0]) return false;
  }

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
   SPACING GUARD
   Refuses a second hazard inside the same stretch, so a
   level reads as designed rather than clustered.
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
   Each is self-contained and always ends on solid ground.
   ========================================================= */

/* 1 · RUN — continuous floor with ground hazards.
   Floating platforms are placed FIRST so the hazard pass
   can see them and refuse a fire underneath. */
function segRun(B, x0, w, diff, rnd){
  B.floor(x0, w);

  if(w > 400){
    const px = x0 + w*0.52;
    if(B.plat(px, 370, 110)) B.gem(px+55, 320);
  }

  const hazards = 1 + Math.floor(diff*3);
  const span = w - 240;
  const inset = 140;
  const step = hazards > 1 ? (span - inset) / (hazards - 1) : 0;

  for(let i=0;i<hazards;i++){
    const hx = x0 + inset + step * i;
    const useFire = (i % 2 === 1);
    if(useFire){
      B.fire(hx, 60, 1.4 + diff * 0.8);
    } else {
      B.spike(hx, 50 + diff * 12);
    }
  }

  return x0 + w;
}

/* 2 · GAP — floors separated by jumpable gaps. */
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

/* 3 · STAIRS — a rising or falling staircase.
   The flight's total height is derived first, then the
   per-step rise is computed from it, so the flight is
   always complete and reachable. */
function segStairs(B, x0, w, diff, rnd){
  const up = rnd() > 0.45;

  const steps = Math.max(3, Math.floor(w/130));
  const stepW = w / steps;

  const FLOOR_Y = TUNE.GROUND_Y;
  const TOP_Y   = 300;
  const MAX_TOTAL_RISE = FLOOR_Y - TOP_Y;

  const wantRise = 90 + diff * 110;
  const totalRise = Math.min(MAX_TOTAL_RISE, wantRise);

  const rise = totalRise / steps;

  for(let i=0;i<steps;i++){
    const px = x0 + i*stepW;

    const py = up
      ? FLOOR_Y - (i + 1) * rise
      : FLOOR_Y - (steps - i) * rise;

    const cy = Math.max(TOP_Y, Math.min(FLOOR_Y - rise, py));

    if(B.plat(px, cy, stepW*0.72, 22)){
      if(rnd() > 0.35) B.gem(px + stepW*0.36, cy - 46);
    }
  }

  B.floor(x0 + w*0.80, w*0.20 + 60);

  return x0 + w;
}

/* 4 · ISLAND — floating islands over a genuine void.
   Fixed height, fixed size, spaced on a grid; difficulty
   only changes how many there are. */
function segIsland(B, x0, w, diff, rnd){
  B.floor(x0, 130);
  B.floor(x0 + w - 150, 150);

  const count = 3 + Math.floor(diff*3);
  const span  = w - 280;
  const step  = span / count;

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

/* 5 · LAVA CHASM — the pool is the gap.
   Both banks first, the stones second, the pool last.
   Order is load-bearing: the pool reserves its own
   footprint, so it must come after the route across it. */
function segLava(B, x0, w, diff, rnd){
  const bankIn  = 150;
  const chasmW  = Math.min(w - bankIn * 2, 220 + diff * 160);
  const chasmX  = x0 + bankIn;
  const farBank = chasmX + chasmW;

  B.floor(x0, bankIn);
  B.floor(farBank, Math.max(150, (x0 + w) - farBank));

  const stones = 2 + Math.round(diff * 2);
  const stoneW = Math.round(92 - diff * 22);
  const slot   = chasmW / (stones + 1);

  let placed = 0;
  for(let i=0;i<stones;i++){
    const sx = chasmX + slot * (i + 1) - stoneW / 2;
    const sy = 400;
    if(B.plat(sx, sy, stoneW, 20)){
      placed++;
      if(i % 2 === 0) B.gem(sx + stoneW/2, sy - 44);
    }
  }

  if(placed > 0){
    B.lava(chasmX, chasmW);
  }

  return x0 + w;
}

/* 6 · CORRIDOR — a low ceiling forces careful jumps. */
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
   Banks first, mover second: the mover reserves its whole
   sweep corridor, so it cannot be placed after a floor
   inside its path. */
function segMover(B, x0, w, diff, rnd){
  const chasm = Math.min(w - 380, 250 + diff*110);
  const startX = x0;
  const endX   = x0 + 150 + chasm;

  B.floor(startX, 150);
  B.floor(endX, Math.max(160, (x0 + w) - endX));

  const axis = rnd() > 0.5 ? 'x' : 'y';
  const dist = axis === 'x' ? Math.round(chasm*0.30) : 70;
  const speed = 1.1 + diff*0.7;

  const mx = startX + 150 + chasm*0.34;
  const placed = B.mover(mx, 420, 92, axis, dist, speed);

  if(placed && chasm > 300){
    const mx2 = startX + 150 + chasm*0.68;
    B.mover(mx2, 400, 84, rnd() > 0.5 ? 'x' : 'y', axis==='x'?60:70, speed*0.9);
  }

  if(rnd() > 0.5) B.gem(mx + 46, 340);

  if(diff > 0.5) B.spike(endX + 30, 55);

  return x0 + w;
}

/* 8 · CRUMBLE — a chain of fragile stones over a void.
   Fixed height, fixed width, fixed fuse. Only the respawn
   flag alternates — every other stone comes back. */
function segCrumble(B, x0, w, diff, rnd){
  B.floor(x0, 140);
  B.floor(x0 + w - 140, 140);

  const count = 3 + Math.floor(diff*2);
  const span  = w - 280;
  const step  = span / count;

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

/* 9 · SAW RUN — a corridor of spinning blades.
   Even grid, fixed inset. The first blade of a run is
   always horizontal so the player sees it slide before
   they ever see one drop. */
function segSawRun(B, x0, w, diff, rnd){
  B.floor(x0, w);

  const count = 1 + Math.floor(diff * 4);
  const span  = w - 260;
  if(span <= 0) return x0 + w;

  const inset = 130;
  const usable = span - inset * 2;
  const gap = count > 1 ? usable / (count - 1) : 0;

  for(let i=0;i<count;i++){
    const sx = x0 + inset + gap * i;

    const firstBlade = (i === 0);
    const axis = (!firstBlade && diff > 0.55 && i % 3 === 2) ? 'y' : 'x';

    const dist = axis === 'x'
      ? Math.round(60 + diff * 70)
      : Math.round(45 + diff * 50);
    const spd = 0.8 + diff * 1.6;

    const sy = TUNE.GROUND_Y - TUNE.SAW_R - 26 - diff * 14;

    if(B.saw(sx, sy, TUNE.SAW_R, axis, dist, spd)){
      if(i % 2 === 0) B.gem(sx, sy - 70);
    }
  }

  if(rnd() > 0.5) B.gem(x0 + w * 0.5, TUNE.GROUND_Y - 150);

  return x0 + w;
}

/* 10 · NAIL GAUNTLET — dense nails, floor and ceiling.
   Floor rows force a precise jump; ceiling rows force the
   player to stay LOW. */
function segNailGauntlet(B, x0, w, diff, rnd){
  B.floor(x0, w);

  const rows  = 2 + Math.floor(diff * 3);
  const span  = w - 260;
  const inset = 130;
  const step  = rows > 1 ? (span - inset) / (rows - 1) : 0;
  const rowW  = Math.round(46 + diff * 34);

  for(let i=0;i<rows;i++){
    const nx = x0 + inset + step * i;
    B.nail(nx, rowW, 1);
  }

  if(diff > 0.30){
    const slabs = 1 + Math.floor(diff * 2);
    const cspan = w - 340;
    const cstep = slabs > 1 ? cspan / (slabs - 1) : 0;
    const cw    = 150;
    const cy    = Math.round(300 - diff * 60);

    for(let i=0;i<slabs;i++){
      const cx = x0 + 170 + cstep * i;
      B.ceil(cx, cy, cw);
      B.nail(cx + 12, cw - 24, -1);
    }
  }

  B.gem(x0 + w * 0.5, TUNE.GROUND_Y - 130);
  return x0 + w;
}

/* 12 · CRUSHER HALL — stones that drop from the ceiling.
   Slab first, stone second. The stone's y is derived from
   the slab's underside so it always hangs from something
   visible, and its x is centred under the slab so it is
   always covered. */
function segCrusherHall(B, x0, w, diff, rnd){
  B.floor(x0, w);

  const slabs = 2 + Math.floor(diff * 2);
  const span  = w - 320;
  const inset = 160;
  const step  = slabs > 1 ? (span - inset) / (slabs - 1) : 0;

  const slabW  = 170;
  const slabY  = Math.round(200 + diff * 10);
  const stoneW = 70;

  for(let i=0;i<slabs;i++){
    const cx = x0 + inset + step * i;

    if(!B.ceil(cx, slabY, slabW)) continue;

    const stoneX = cx + (slabW - stoneW) / 2;
    const stoneY = slabY + TUNE.CEIL_H + 4;

    B.crusher(stoneX, stoneY, stoneW,
              110 + diff * 90,
              1.1 + diff * 1.5);
  }

  if(diff > 0.40) B.nail(x0 + w * 0.5 - 30, 60, 1);

  B.gem(x0 + w * 0.5, TUNE.GROUND_Y - 120);

  return x0 + w;
}

/* 13 · GAUNTLET — a fixed, readable sequence:
   saw, nails, saw, crusher, saw. Difficulty changes speed
   and drop depth, never the order. */
function segGauntlet(B, x0, w, diff, rnd){
  B.floor(x0, w);

  const sawY = TUNE.GROUND_Y - TUNE.SAW_R - 30;

  B.saw(x0 + w * 0.14, sawY, TUNE.SAW_R, 'x',
        70 + diff * 40, 1.2 + diff * 1.0);

  B.nail(x0 + w * 0.28, 50 + diff * 30, 1);

  B.saw(x0 + w * 0.40, sawY, TUNE.SAW_R, 'y',
        60 + diff * 40, 1.3 + diff * 1.0);

  const cx = x0 + w * 0.70;
  if(B.ceil(cx - 85, 200, 170)){
    B.crusher(cx - 35, 200 + TUNE.CEIL_H + 4, 70,
              130 + diff * 70, 1.5 + diff * 1.1);
  }

  B.saw(x0 + w * 0.86, sawY, TUNE.SAW_R, 'x',
        60 + diff * 40, 1.4 + diff * 1.0);

  B.gem(x0 + w * 0.5, TUNE.GROUND_Y - 170);
  return x0 + w;
}

/* SET-PIECE A · THE FRAGILE BRIDGE
   Hand-authored, identical on every seed: a chain of
   fragile stones with one safe island in the middle and a
   slow blade sweeping above it. */
function segBridge(B, x0, w, diff, rnd){
  B.floor(x0, 160);
  B.floor(x0 + w - 160, 160);

  const span   = Math.max(240, w - 320);
  const crumbW = 70;
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

  B.saw(x0 + w * 0.5, 320, TUNE.SAW_R, 'x', 90, 0.9 + diff * 0.5);

  return x0 + w;
}

/* SET-PIECE B · THE GATE
   A slab low enough to stop a full jump, with a floor row
   beneath it, twice or more in a row. Teaches the player
   the difference between jumping OVER and passing UNDER. */
function segGate(B, x0, w, diff, rnd){
  B.floor(x0, w);

  const gates = 2 + Math.floor(diff * 2);
  const span  = Math.max(200, w - 380);
  const step  = gates > 1 ? span / (gates - 1) : 0;
  const gateW = 170;

  for(let i = 0; i < gates; i++){
    const gx = x0 + 190 + step * i;

    if(!B.ceil(gx, 236, gateW)) continue;
    B.spike(gx + gateW * 0.5 - 26, 54 + diff * 14);
  }

  B.gem(x0 + w * 0.5, TUNE.GROUND_Y - 118);
  return x0 + w;
}

/* =========================================================
   SEGMENT REGISTRY
   Every family is available from the first level. What
   scales with difficulty is intensity — count, speed,
   travel, fuse — not presence.
   ========================================================= */
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

  crushers   : { fn:segCrusherHall, minW:640, unlockAt:0.25 },
  gauntlet   : { fn:segGauntlet,    minW:700, unlockAt:0.30 },

  bridge     : { fn:segBridge,      minW:720, unlockAt:0.10 },
  gate       : { fn:segGate,        minW:700, unlockAt:0.16 }
};

/* =========================================================
   WORLD SIGNATURE
   `diff` says how hard a level is; the world says what
   kind of hard. Each world's weight table leans the
   picker towards its own families.
   ========================================================= */
const WORLD_BIAS = [
  { run:1.6, gap:1.5, crumble:1.8, stairs:1.1, island:0.9,
    nails:0.35, saws:0.35, crushers:0.20, mover:0.45, lava:0.40,
    corridor:0.60, gauntlet:0.15, bridge:1.4, gate:0.5 },

  { corridor:1.9, gate:1.7, nails:1.8, stairs:1.4, island:0.8,
    run:0.9, gap:0.9, crumble:0.7, saws:0.7, mover:0.6, lava:0.4,
    crushers:0.4, gauntlet:0.3, bridge:0.6 },

  { mover:2.0, lava:1.7, gap:1.4, saws:0.9, island:0.9,
    run:0.9, stairs:0.6, corridor:0.6, nails:0.7, crumble:0.8,
    crushers:0.5, gauntlet:0.4, bridge:1.0, gate:0.8 },

  { saws:1.9, crushers:1.9, crumble:1.4, bridge:1.3, gauntlet:1.0,
    run:0.8, gap:0.9, stairs:0.5, island:0.7, nails:0.9,
    mover:0.6, lava:0.6, corridor:0.7, gate:0.9 },

  { gauntlet:2.0, saws:1.5, crushers:1.4, mover:1.3, lava:1.2,
    stairs:1.1, bridge:1.2, gate:1.2, crumble:1.0, nails:1.0,
    corridor:0.9, run:0.6, gap:0.8, island:0.7 }
];

/* =========================================================
   SEGMENT PICKER
   Never repeats a template twice in a row. Boosts a
   template that has just entered the pool. `run` and `gap`
   weights decay with difficulty, so the back half of the
   game is genuinely dense.
   ========================================================= */
function pickSegment(diff, rnd, last, world){
  const pool = [];
  for(const k in SEGMENTS){
    const s = SEGMENTS[k];
    if(diff < s.unlockAt) continue;
    if(k === last) continue;

    let weight = 1;

    if(k === 'run') weight = 1.6 - diff * 1.1;
    if(k === 'gap') weight = 1.4 - diff * 0.9;

    const sinceUnlock = diff - s.unlockAt;
    if(s.unlockAt > 0 && sinceUnlock < 0.25){
      weight += 2.2 * (1 - sinceUnlock / 0.25);
    }

    if(k === 'mover' || k === 'lava') weight += 0.8;
    if(k === 'nails' || k === 'saws') weight += 0.6;
    if(k === 'crushers') weight += 0.5;
    if(k === 'gauntlet') weight += 0.9;

    const bias = (WORLD_BIAS[world] || {})[k];
    if(bias !== undefined) weight *= bias;

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
   LEVEL LENGTH — 8,400 to 11,600 world units across the set.
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

  /* a convex curve: level 1 at 0.10, level 25 at 0.98 */
  const baseDiff = Math.min(0.98, 0.10 + Math.pow(index / 24, 1.35) * 0.88);

  const worldIdx = Math.min(4, Math.floor(index / 5));

  let x = 0;
  let lastSeg = null;
  let segCount = 0;

  while(x < wd - 760){
    const progress = x / wd;
    const diff = Math.min(0.95, Math.max(0.05, baseDiff + (progress-0.5)*0.22));

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
     QUOTA — minimum count of every hazard family, scaled by
     difficulty. Every family has a floor of at least one.
     ========================================================= */
  const QUOTA = function(diff){
    return {
      spikes  : 3 + Math.round(diff * 5),
      fires   : 1 + Math.round(diff * 5),
      movers  : 1 + Math.round(diff * 2),
      lavas   : 1 + Math.round(diff * 2),
      nails   : 1 + Math.round(diff * 5),
      saws    : 1 + Math.round(diff * 4),
      crushers: 1 + Math.round(diff * 3)
    };
  };
  const quota = QUOTA(baseDiff);

  /* =========================================================
     TOP-UP PASS
     Deterministic, spaced, and always anchored to its
     context. Three rules in order: spacing, context, size.
     ========================================================= */
  const topUp = function(kind, attemptSeed){
    const r = seedRand(attemptSeed >>> 0);
    const step = 90;
    for(let pass = 0; pass < 4; pass++){
      const offset = pass === 0 ? 0 : r()*step;
      for(let tx = 820 + offset; tx < wd - 500; tx += step){

        if(B._nearHazard(tx, 80, 140)) continue;

        if(kind === 'spike'){
          if(B.spike(tx, 50 + baseDiff * 12)) return true;
        }
        else if(kind === 'fire'){
          if(B.fire(tx, 60, 1.4 + baseDiff * 0.8)) return true;
        }
        else if(kind === 'lava'){
          const g = B.groundUnder(tx + 65, 300);
          if(g) continue;
          if(B.lava(tx, 130)) return true;
        }
        else if(kind === 'mover'){
          const mw = 90;
          if(B.groundUnder(tx + mw/2, 300)) continue;
          if(B.mover(tx, 415, mw, 'x', 65, 1.2 + baseDiff * 0.7)) return true;
        }
        else if(kind === 'nail'){
          if(B.nail(tx, 46 + baseDiff * 34, 1)) return true;
        }
        else if(kind === 'saw'){
          const g = B.groundUnder(tx + 40, 300);
          if(!g) continue;
          const sy = TUNE.GROUND_Y - TUNE.SAW_R - 28 - baseDiff * 14;
          if(B.saw(tx, sy, TUNE.SAW_R, 'x',
                   70 + baseDiff * 50, 1.2 + baseDiff * 0.9)) return true;
        }
        else if(kind === 'crusher'){
          /* lay a slab first, then hang the stone from its underside */
          const slabW = 150;
          const stoneW = 70;
          const slabX = tx - (slabW - stoneW) / 2;
          const slabY = Math.round(200 + baseDiff * 10);

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
            if(!B.ceil(slabX, slabY, slabW)) continue;
            if(B.crusher(tx, slabY + TUNE.CEIL_H + 4, stoneW,
                         110 + baseDiff * 90, 1.1 + baseDiff * 1.5)) return true;
            B.ceils.pop();
          }
        }
      }
    }
    return false;
  };

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
     REAL SURFACES — captured before the spawn pad is laid.
     Only surfaces the player can actually stand on, at a
     width that supports a foot.
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

  B.cpCandidate(padX + 50);

  /* strip the spawn strip only, not the whole level */
  B.ensureGround(0, 260);
  B.ensureSpawnPad();

  /* =========================================================
     CHECKPOINTS
     1. solid ground only
     2. never on a fragile platform
     3. clear of every lethal family on both sides
     4. spaced at least CP_SPACING apart
     ========================================================= */
  const cps = [];
  const cand = B.cpCandidates.slice().sort(function(a,b){ return a-b; });
  let lastCpX = -1e9;

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

    cps.push([cx, g[1] - TUNE.PLAYER_H]);
    lastCpX = cx;
  }

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
     OIL
     One flask roughly every OIL_STEP units, always on solid
     ground, never inside a wall, never in the spawn zone.
     ========================================================= */
  const oil = [];
  const oilClear = function(fx, fy){
    const top = fy - 14, bot = fy + 14, left = fx - 10, right = fx + 10;
    for(let i=0;i<B.plats.length;i++){
      const p = B.plats[i];
      if(p[0] >= right || p[0] + p[2] <= left) continue;
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

  /* drop any gem buried inside geometry */
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
    saws       : B.saws,
    nails      : B.nails,
    crushers   : B.crushers,
    checkpoints: cps,
    goal       : goal,
    spawn      : [80, B.spawnY(80)],
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
  { w:'clay',   name:{ar:'أول شرارة',     en:'First Spark'} },
  { w:'clay',   name:{ar:'خطوة فاصلة',    en:'A Separate Step'} },
  { w:'clay',   name:{ar:'سلّم الظلال',   en:'Stair of Shadows'} },
  { w:'clay',   name:{ar:'قنديل معلّق',   en:'Hanging Lamp'} },
  { w:'clay',   name:{ar:'آخر ضوء',       en:'Last Light'} },

  { w:'mosque', name:{ar:'قوس الدخول',    en:'The Arch'} },
  { w:'mosque', name:{ar:'محراب مهجور',   en:'Abandoned Niche'} },
  { w:'mosque', name:{ar:'بئر النور',     en:'Well of Light'} },
  { w:'mosque', name:{ar:'قطعة زجاج',     en:'Shard of Glass'} },
  { w:'mosque', name:{ar:'ساعة الفجر',    en:'Dawn Hour'} },

  { w:'market', name:{ar:'فوانيس السوق',  en:'Market Lanterns'} },
  { w:'market', name:{ar:'حبل الحرير',    en:'Silk Rope'} },
  { w:'market', name:{ar:'ليل طويل',      en:'Long Night'} },
  { w:'market', name:{ar:'رقصة الظل',     en:'Shadow Dance'} },
  { w:'market', name:{ar:'الفجر',         en:'Daybreak'} },

  { w:'ruins',  name:{ar:'بوابة الرمل',   en:'Gate of Sand'} },
  { w:'ruins',  name:{ar:'قناديل مقلوبة', en:'Inverted Lamps'} },
  { w:'ruins',  name:{ar:'ممر الأشواك',   en:'Corridor of Thorns'} },
  { w:'ruins',  name:{ar:'سقوط حر',       en:'Freefall'} },
  { w:'ruins',  name:{ar:'عين العاصفة',   en:'Eye of the Storm'} },

  { w:'tower',  name:{ar:'الدرج الأول',   en:'The First Stair'} },
  { w:'tower',  name:{ar:'فانوس مزدوج',   en:'Twin Lanterns'} },
  { w:'tower',  name:{ar:'قمة الظلام',    en:'Dark Summit'} },
  { w:'tower',  name:{ar:'قلب القنديل',   en:'Heart of the Lantern'} },
  { w:'tower',  name:{ar:'الفجر الأخير',  en:'The Last Dawn'} }
];

const LEVELS = LEVEL_META.map(function(meta, i){
  const L = buildLevel(i);
  L.w = meta.w;
  L.name = meta.name;
  L.index = i;
  return L;
});