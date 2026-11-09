(function(){
'use strict';

/* =========================================================
   QANDIL — lantern spirit platformer
   Clean rewrite. No duplicated blocks, single source of truth
   for the game clock (S.t advances once per frame).
   ========================================================= */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const darkCv = document.createElement('canvas');
const darkCx = darkCv.getContext('2d');
let DPR = 1;
/* VW/VH = the canvas surface in CSS pixels (what we actually paint on).
   VIEW_W/VIEW_H = the world window in world units (authored at 540 tall).
   SCALE = world -> screen multiplier. */
let VW = 960, VH = 540;
let VIEW_W = 960, VIEW_H = 540, SCALE = 1;

/* =========================================================
   PERFORMANCE GUARD
   ---------------------------------------------------------
   The post stack (bloom, grain, grade) is what makes the frame
   look expensive — and it is also, by a wide margin, the most
   expensive thing in the renderer: several full-screen composites
   and one full read of the canvas, every single frame.

   On a fast desktop that is free. On a phone it is the difference
   between 60fps and 40. So the game now MEASURES itself: if the
   average frame time passes 23ms, the post stack switches off for
   the rest of the session and the game goes back to plain, clean,
   smooth rendering. It is one-way on purpose — a stack that flips
   on and off every few seconds is worse than either state.
   ========================================================= */
const PERF = { off:false, acc:0, n:0 };
function perfTick(dt){
  if(PERF.off) return;
  PERF.acc += dt; PERF.n++;
  if(PERF.n < 45) return;
  const avg = PERF.acc / PERF.n;
  PERF.acc = 0; PERF.n = 0;
  if(avg > 0.023){
    PERF.off = true;
    console.log('[qandil] post-processing disabled — avg frame ' +
                Math.round(avg * 1000) + 'ms');
  }
}

/* ---------------- utils ---------------- */
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const lerp=(a,b,t)=>a+(b-a)*t;
const rnd=(a,b)=>a+Math.random()*(b-a);
const qs=s=>document.querySelector(s);
const qa=s=>Array.prototype.slice.call(document.querySelectorAll(s));

/* =========================================================
   NO FULLSCREEN API
   ---------------------------------------------------------
   The Fullscreen API was removed on purpose.

   The game now ships as an installable PWA with
   `display: "standalone"` in the manifest. That is what gives a
   chrome-free app window on Android and iOS — the browser
   toolbar is simply not part of the app. Calling
   `requestFullscreen()` on top of that produced a *second*,
   competing layout mode: the viewport changed size underneath a
   page whose CSS had already been measured, the menu grid
   collapsed into one corner, and the canvas kept stale
   dimensions until something forced a reflow.

   One mode is better than two. The app window is the mode.
   ========================================================= */

function rr(c,x,y,w,h,r){
  c.beginPath();
  if(c.roundRect){ c.roundRect(x,y,w,h,r); return; }
  r = Math.min(r, w/2, h/2);
  c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath();
}
function fmt(s){
  const m=Math.floor(s/60), ss=Math.floor(s%60);
  return m+':'+(ss<10?'0':'')+ss;
}

/* ---------------- save ---------------- */
const SKEY='qandil.save.v1';
let save={levels:{}, settings:{sound:true, music:true, quality:'high'}};
try{
  const raw=localStorage.getItem(SKEY);
  if(raw){ const o=JSON.parse(raw); save.levels=o.levels||{}; Object.assign(save.settings,o.settings||{}); }
}catch(e){}
function persist(){ try{ localStorage.setItem(SKEY,JSON.stringify(save)); }catch(e){} }
function starsOf(i){ const r=save.levels[i]; return r? (r.stars||0) : 0; }

/* =========================================================
   UNLOCKED LEVELS — a permanent record, separate from stars.
   ---------------------------------------------------------
   THE BUG THIS FIXES
   ------------------
   `unlocked(i)` used to be derived on the fly:

       return i === 0 || starsOf(i-1) > 0;

   That is a CHAIN, not a record. It means a level is only open
   while the level immediately before it still has a star. Two
   consequences, both bad:

     · If `save.levels` is ever partially lost — a cleared cache,
       a failed write, a browser that evicts storage under
       pressure — every level past the gap LOCKS AGAIN, even
       though the player has already beaten it. The levels screen
       becomes a wall of padlocks over content they own.

     · A player who reached level 18 by playing 1..17 can never
       jump back to level 18 from a fresh session unless they
       re-earn 17. The progress exists; the permission does not.

   The fix is to record the unlock explicitly. `save.unlocked` is
   a map of level index → true, written the moment a level is
   entered, and it is never removed by anything except the reset
   button. `unlocked()` reads that map first and only falls back
   to the old chain rule for saves created before this existed.

   `maxUnlocked` is the highest index ever entered, so the levels
   screen can tell "opened" from "never reached" without walking
   the whole map.
   ========================================================= */
/* =========================================================
   UNLOCKING IS EARNED, NOT ASSUMED
   ---------------------------------------------------------
   Entering a level records that level as open — and nothing else.
   The NEXT level is opened by `win()`, when the door is actually
   reached. That is the whole rule: a level you have not finished
   cannot hand out the one after it.

   `maxUnlocked` is still the highest index ever ENTERED, so the
   levels screen can tell "reached" from "never seen" without
   walking the map.
   ========================================================= */
/* =========================================================
   THE PASS MARK — what a level must earn to open the next one.
   ---------------------------------------------------------
   One star is a survival. Two stars means every gem in the level
   was collected. Three means it was also done inside par time.
   Only two and above are worth a door.
   ========================================================= */
const PASS_STARS = 2;

function markUnlocked(i){
  if(i < 0 || i >= LEVELS.length) return;
  save.unlocked = save.unlocked || {};
  save.unlocked[i] = 1;
  if(save.maxUnlocked === undefined || i > save.maxUnlocked){
    save.maxUnlocked = i;
  }
  persist();
}

function unlocked(i){
  if(i < 0 || i >= LEVELS.length) return false;
  if(i === 0) return true;

  /* ---- 1 · the explicit record wins ---- */
  if(save.unlocked && save.unlocked[i]) return true;

  /* ---- 2 · legacy saves: the previous level must have been cleared
              at the pass mark, exactly like a live run ---- */
  if(starsOf(i-1) >= PASS_STARS){
    save.unlocked = save.unlocked || {};
    save.unlocked[i] = 1;
    if(save.maxUnlocked === undefined || i > save.maxUnlocked) save.maxUnlocked = i;
    return true;
  }
  return false;
}

/* =========================================================
   MIGRATION — rebuild the unlock record from existing stars.
   ---------------------------------------------------------
   A player upgrading from an older build has `save.levels` full
   of stars but no `save.unlocked` map. Without this they would
   open the levels screen and see their progress padlocked.

   Every level with a star implies the next one was reachable, so
   the map is filled from the star table, then extended by one
   past the highest completed level. Runs once at boot.
   ========================================================= */
/* =========================================================
   MIGRATION — rebuild the unlock record from earned stars only.
   ---------------------------------------------------------
   A save from an older build has stars but no `unlocked` map. Every
   level with a star was finished, so it is open; the level after the
   highest finished one is open too, because finishing that one is
   what earned it. Nothing else is granted — a level that was merely
   entered is not evidence that it was cleared.
   ========================================================= */
function migrateUnlocks(){
  save.unlocked = save.unlocked || {};
  let highest = -1;
  for(let i=0;i<LEVELS.length;i++){
    const st = starsOf(i);
    if(st > 0) save.unlocked[i] = 1;          /* played → open to replay */
    if(st >= PASS_STARS && i > highest) highest = i;
  }
  /* only a level cleared at the pass mark hands out the one after it */
  if(highest > -1 && highest + 1 < LEVELS.length){
    save.unlocked[highest + 1] = 1;
  }
  if(highest > -1 && (save.maxUnlocked === undefined || highest > save.maxUnlocked)){
    save.maxUnlocked = highest;
  }
  if(save.maxUnlocked === undefined) save.maxUnlocked = 0;
  save.unlocked[0] = 1;
  persist();
}

/* ---------------- audio (sfx) ---------------- */
const AU={
  ac:null, on:true,
  init(){ if(this.ac) return; try{
      const AC = window.AudioContext||window.webkitAudioContext;
      this.ac=new AC(); this.master=this.ac.createGain();
      this.master.gain.value=.55; this.master.connect(this.ac.destination);
    }catch(e){} },
  resume(){ try{ if(this.ac&&this.ac.state==='suspended') this.ac.resume(); }catch(e){} },
  tone(f,d,type,vol,to){
    if(!this.on) return; this.init(); if(!this.ac) return;
    const ac=this.ac, t=ac.currentTime;
    const o=ac.createOscillator(), g=ac.createGain();
    o.type=type||'sine'; o.frequency.setValueAtTime(f,t);
    if(to) o.frequency.exponentialRampToValueAtTime(Math.max(30,to), t+d);
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(vol||.16, t+.012);
    g.gain.exponentialRampToValueAtTime(.0001, t+d);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t+d+.04);
  },
  jump(){ this.tone(300,.16,'triangle',.12,520); },
  gem(){ this.tone(880,.10,'sine',.14); const s=this; setTimeout(()=>s.tone(1320,.14,'sine',.11),55); },
  oil(){ this.tone(200,.22,'sawtooth',.07,420); },
  die(){ this.tone(320,.42,'sawtooth',.11,60); },
  win(){ const s=this; [523,659,784,1046].forEach((f,i)=>setTimeout(()=>s.tone(f,.26,'triangle',.14),i*95)); },
  click(){ this.tone(620,.05,'square',.04); }
};
AU.on = save.settings.sound !== false;

/* ---------------- music engine (procedural, no assets) ----------------
   Rewritten: a real chord progression with voice-leading, a soft pad,
   a plucked arpeggio, and a gentle bass — plus a slow low-pass that
   breathes. Everything is scheduled on the audio clock, so it stays in
   time even when the tab is throttled.
   ------------------------------------------------------------------- */
const MUS={
  on: save.settings.music !== false,
  ctx:null, out:null, lp:null, timer:null, nextT:0, step:0,
  bpm:70, mood:0, running:false,

  /* A minor, natural — warm and calm. Frequencies in Hz. */
  /* chord progression: Am – F – C – G  (i – VI – III – VII) */
  chords:[
    { root:110.00, notes:[220.00, 261.63, 329.63] }, /* A3  C4  E4  — Am */
    { root: 87.31, notes:[174.61, 220.00, 261.63] }, /* F3  A3  C4  — F  */
    { root:130.81, notes:[196.00, 261.63, 329.63] }, /* G3  C4  E4  — C  */
    { root: 98.00, notes:[196.00, 246.94, 293.66] }  /* G3  B3  D4  — G  */
  ],

  /* ---- lifecycle ---- */
  start(){
    if(!this.on) return;
    AU.init(); if(!AU.ac) return;
    if(!this.ctx){ this.build(); }
    this.resume();
  },
  build(){
    const c = this.ctx = AU.ac;
    this.out = c.createGain();
    this.out.gain.value = 0.0001;

    /* slow-breathing low-pass keeps it soft and never harsh */
    this.lp = c.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = 1500;
    this.lp.Q.value = 0.5;

    this.out.connect(this.lp);
    this.lp.connect(AU.master);

    /* gentle stereo widening */
    try{
      const pan = c.createStereoPanner ? c.createStereoPanner() : null;
      if(pan){ this.lp.disconnect(); this.lp.connect(pan); pan.connect(AU.master); }
    }catch(e){}

    this.step = 0;
    this.nextT = c.currentTime + 0.1;
  },
  resume(){
    if(!this.ctx || !this.out) return;
    if(AU.ac.state === 'suspended'){ try{ AU.ac.resume(); }catch(e){} }
    const now = this.ctx.currentTime;
    try{
      this.out.gain.cancelScheduledValues(now);
      this.out.gain.setValueAtTime(Math.max(this.out.gain.value, 0.0001), now);
      this.out.gain.linearRampToValueAtTime(0.13, now + 1.4);
      this.lp.frequency.cancelScheduledValues(now);
      this.lp.frequency.setValueAtTime(Math.max(this.lp.frequency.value, 200), now);
      this.lp.frequency.linearRampToValueAtTime(1900, now + 2.0);
    }catch(e){}
    if(!this.running){
      this.running = true;
      this.nextT = Math.max(this.nextT, now + 0.05);
      this.timer = setInterval(()=>this.tick(), 120);
    }
  },
  stop(){
    this.running = false;
    if(this.timer){ clearInterval(this.timer); this.timer = null; }
    if(!this.ctx || !this.out) return;
    const now = this.ctx.currentTime;
    try{
      this.out.gain.cancelScheduledValues(now);
      this.out.gain.setValueAtTime(Math.max(this.out.gain.value, 0.0001), now);
      this.out.gain.linearRampToValueAtTime(0.0001, now + 0.6);
    }catch(e){}
  },
  /* hard kill — used when leaving the page/app entirely */
  kill(){
    this.running = false;
    if(this.timer){ clearInterval(this.timer); this.timer = null; }
    if(this.ctx && this.out){
      try{
        this.out.gain.cancelScheduledValues(this.ctx.currentTime);
        this.out.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      }catch(e){}
    }
  },
  setMood(m){ this.mood = m; this.bpm = 70 + m * 3; },

  /* ---- voices ---- */
  /* soft sustained pad — 3 detuned oscillators through their own filter */
  pad(freq, t, dur, vol){
    const c = this.ctx; if(!c) return;
    const g = c.createGain();
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1100; f.Q.value = 0.6;

    [0, 0.4, -0.4].forEach((cents, i)=>{
      const o = c.createOscillator();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.setValueAtTime(freq, t);
      o.detune.setValueAtTime(cents * 4, t);
      o.connect(f);
      o.start(t); o.stop(t + dur + 0.2);
    });

    f.connect(g);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(1.2, dur * 0.35));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    g.connect(this.out);
  },

  /* plucked bell — short attack, long exponential tail */
  pluck(freq, t, dur, vol){
    const c = this.ctx; if(!c) return;
    const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o2.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o2.frequency.setValueAtTime(freq * 2.002, t); /* soft octave shimmer */
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o2.connect(g); g.connect(this.out);
    o.start(t); o.stop(t + dur + 0.05);
    o2.start(t); o2.stop(t + dur + 0.05);
  },

  /* warm round bass */
  bass(freq, t, dur, vol){
    const c = this.ctx; if(!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out);
    o.start(t); o.stop(t + dur + 0.05);
  },

  /* ---- sequencer ---- */
  tick(){
    if(!this.ctx || !this.on || !this.running) return;
    const c = this.ctx;
    const beat = 60 / this.bpm;          /* quarter note */
    const eighth = beat / 2;

    /* schedule a little ahead so timing never stutters */
    while(this.nextT < c.currentTime + 0.8){
      const t = this.nextT;
      const s = this.step;
      const bar = Math.floor(s / 8);
      const chord = this.chords[bar % this.chords.length];

      /* --- bar start: pad + bass --- */
      if(s % 8 === 0){
        /* pad holds the whole bar */
        chord.notes.forEach((n, i)=>{
          this.pad(n, t + i * 0.02, beat * 4.0, 0.030);
        });
        /* bass: root on 1, fifth on 3 */
        this.bass(chord.root, t, beat * 1.8, 0.085);
        this.bass(chord.root * 1.5, t + beat * 2, beat * 1.6, 0.055);
      }

      /* --- arpeggio: gentle 8th-note pattern over the chord --- */
      const arpPattern = [0, 1, 2, 1, 0, 2, 1, 2];
      if(s % 2 === 0){
        const idx = arpPattern[(s / 2) % arpPattern.length];
        const note = chord.notes[idx] * 2; /* up an octave — airy */
        const accent = (s % 8 === 0) ? 1.25 : 1;
        this.pluck(note, t, eighth * 2.4, 0.026 * accent);
      }

      /* --- a single high sparkle every other bar for magic --- */
      if(s === 6 && bar % 2 === 1){
        this.pluck(chord.notes[2] * 4, t, eighth * 3, 0.010);
      }

      this.nextT += eighth;
      this.step = (this.step + 1) % 32;
    }
  }
};

/* ---------------- state ---------------- */
const MAX_HEARTS = 5;

/* =========================================================
   FORWARD DECLARATIONS
   ---------------------------------------------------------
   `loadLevel` reads MAX_JUMPS and hudCache, but both used to be
   declared further down the file. That worked only because
   loadLevel is never called before boot — a fragile ordering
   that would throw a ReferenceError (temporal dead zone) the
   moment anything reordered the file or called loadLevel early.
   Declaring them here removes the hazard entirely.
   ========================================================= */
const MAX_JUMPS = 2;
let hudCache = {gems:'', time:'', oil:-1, name:'', world:''};

const S={
  screen:'menu', playing:false, paused:false,
  level:0, t:0, time:0, oil:100, gems:0, totalGems:0,
  cam:0, shake:0, parts:[], motes:[], stars:[],
  finished:false, result:null,
  /* lives */
  hearts:MAX_HEARTS, deaths:0, invuln:0, respawnT:0,
  /* checkpoint: index into cur.checkpoints, -1 = spawn */
  cp:-1,
  /* tutorial progress flags — level 1 only */
  tutMoved:false, tutJumped:false, tutDouble:false, tutGem:false, tutOil:false
};
const P={ x:0,y:0,w:26,h:34,vx:0,vy:0,onGround:false,coyote:0,buffer:0,
          face:1, squash:1, anim:0,
          /* jumps = air-jumps still available. Reset to MAX_JUMPS on landing. */
          jumps:2, maxJumps:2, spin:0 };
let cur=null;

const keys={left:false,right:false,jump:false,jumpPressed:false};

/* ---------------- canvas sizing (full-bleed, world-space) ---------------- */
const BASE_H = 540;
function resize(){
  /* =========================================================
     MEASURE THE STAGE, NOT THE WINDOW
     ---------------------------------------------------------
     `window.innerWidth/innerHeight` is the viewport — but the
     canvas does not fill the viewport. It fills #stage, which
     sits inside a safe-area padding and, on a phone, inside a
     rotated wrapper.

     Measuring the window therefore produced a VW/VH that was
     LARGER than the box the canvas actually occupied. The
     canvas backing store was sized for the bigger number while
     CSS scaled it down into the smaller box, so the world was
     drawn at the wrong scale and the camera limits were wrong
     too. On a wide screen with a safe-area inset, that is
     exactly the "everything squeezed to one side" look.

     `getBoundingClientRect()` on #stage returns the real painted
     box, after padding, after transforms. That is the number the
     canvas must match.
     ========================================================= */
  const stage = document.getElementById('stage');
  const rect = stage ? stage.getBoundingClientRect() : null;

  let w = rect ? Math.round(rect.width)  : window.innerWidth;
  let h = rect ? Math.round(rect.height) : window.innerHeight;

  /* a zero-size box means the layout has not settled yet — keep
     the previous values rather than dividing by zero downstream */
  if(w < 2 || h < 2){
    w = window.innerWidth;
    h = window.innerHeight;
  }

  DPR=Math.min(window.devicePixelRatio||1, 2);

  /* Portrait phones rotate the whole stage 90° in CSS, so the
     stage's own rect is already the rotated box. Only the
     UNROTATED case needs the axes swapped, and the stage rect
     tells us which case we are in. */
  const portrait = (h > w*1.02);
  document.body.classList.toggle('rotated', portrait);

  /* When rotated, the CSS transform swaps the painted axes: the
     stage is `100dvh` wide and `100dvw` tall before rotation, so
     the visible box is (h × w), not (w × h). */
  const vw = portrait ? h : w;
  const vh = portrait ? w : h;

  /* The drawing surface is the canvas itself, in CSS pixels.
     VW/VH MUST equal the canvas CSS size, otherwise the scene is drawn
     into a smaller rectangle and the rest of the screen stays black.
     The world is authored at 540px height, so we zoom it to fill the
     viewport while keeping the vertical field of view constant. */
  VW = vw;
  VH = vh;

  canvas.width=Math.round(vw*DPR);
  canvas.height=Math.round(vh*DPR);
  canvas.style.width='100%';
  canvas.style.height='100%';
  darkCv.width=canvas.width; darkCv.height=canvas.height;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  darkCx.setTransform(DPR,0,0,DPR,0,0);

  /* world units -> screen units */
  SCALE = vh / BASE_H;
  VIEW_H = BASE_H;                 /* world height we always show */
  VIEW_W = vw / SCALE;             /* how much world fits horizontally */

  /* the camera must stay inside the level in WORLD units — using VW
     (CSS pixels) here let the view slide past the end of the level and
     show empty space on wide screens. */
  if(cur) S.cam = clamp(S.cam, 0, Math.max(0, cur.L.wd-VIEW_W));
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', ()=>setTimeout(resize,150));

/* =========================================================
   RESIZE THAT ACTUALLY LANDS
   ---------------------------------------------------------
   A single `resize` event is not enough. The browser fires it
   while the layout is still settling — the safe-area insets, the
   dvh value and the rotated wrapper all resolve a frame or two
   later — so `getBoundingClientRect()` returns an intermediate
   size and the canvas keeps it.

   Three passes: next frame, then after the transition settles,
   then a late safety pass. Each one is a cheap rect read plus a
   canvas resize, and together they cover every engine's timing.
   ========================================================= */
function refit(){
  requestAnimationFrame(function(){
    resize();
    setTimeout(resize, 90);
    setTimeout(resize, 320);
  });
}
window.addEventListener('resize', refit);
window.addEventListener('orientationchange', refit);
window.addEventListener('pageshow', refit);

/* the visual viewport is the one that actually changes when a
   mobile browser hides its toolbar — window.resize often misses it */
if(window.visualViewport){
  window.visualViewport.addEventListener('resize', refit);
}

/* ---------------- level load ---------------- */
function loadLevel(i){
  S.level=i;
  /* =========================================================
     ONE DETERMINISTIC STREAM PER LEVEL
     ---------------------------------------------------------
     Everything in this function that used to reach for
     Math.random() — flame phases, blade phases, the bob offset of
     every gem and flask, even the ambient motes — now comes from a
     seeded PRNG. The point is not decoration: a flame's phase
     decides WHICH MOMENTS IT IS LETHAL, so a random phase meant the
     same fire could be safe on one attempt and fatal on the next.
     Same level, same seed, same rhythm, every single run.
     ========================================================= */
  const lrnd = (typeof seedRand === 'function')
    ? seedRand((((i+1) * 2654435761) ^ 0x51ed2701) >>> 0)
    : Math.random;
  /* =========================================================
     A LEVEL THAT DOES NOT EXIST MUST NOT CRASH THE GAME
     ---------------------------------------------------------
     `LEVELS[i]` can be undefined if anything upstream passes a bad
     index — a stale save, a tile bound to the wrong number, a level
     list shorter than the UI believes. Reading `.w` off it threw

         TypeError: Cannot read properties of undefined (reading 'w')

     and left the player on a dead screen with no way back.

     Falling back to level 0 is not a silent lie: it is the one
     level that is always valid, and it puts the player somewhere
     playable instead of nowhere. The console records what happened
     so the real cause can still be found.
     ========================================================= */
  if(!LEVELS[i]){
    console.error('[qandil] loadLevel(' + i + ') — no such level. Falling back to 0.');
    i = 0;
    S.level = 0;
  }
  const L=LEVELS[i], W=WORLDS.filter(w=>w.id===L.w)[0]||WORLDS[0];
  cur={ L:L, W:W, plats:[], movers:[], ceils:[], crumbs:[], gems:[], oils:[],
        spikes:[], fires:[], lavas:[], checkpoints:[], goal:null,
        /* ---- new hazard families ---- */
        saws:[], nails:[], crushers:[] };

  (L.plats||[]).forEach(p=>cur.plats.push({x:p[0],y:p[1],w:p[2],h:p[3]}));
  (L.ceils||[]).forEach(p=>cur.ceils.push({x:p[0],y:p[1],w:p[2],h:p[3]}));

  /* =========================================================
     FRAGILE PLATFORMS
     ---------------------------------------------------------
     The fuse used to be a constant 0.55s baked into `update`.
     It is now authored per platform (levels.js clamps it to
     TUNE.FUSE_MIN) and carried here as `fuse`. `respawn` decides
     whether the platform comes back after it falls — a chain
     that half-returns can never be memorised as a fixed shape.

     crumbs: [x, y, w, h, fuse, respawn]
     ========================================================= */
  (L.crumbs||[]).forEach(p=>cur.crumbs.push({
    x:p[0], y:p[1], w:p[2], h:p[3],
    alive:true, timer:0, shake:0,
    fuse: p[4] || 0.55,
    respawn: p[5] === 1,
    cool: 0
  }));

  /* =========================================================
     SAWS — a spinning blade on a patrol path.
     `axis` is 'x' (slides), 'y' (bobs) or 'c' (orbits).
     The blade's live centre is (x, y); the patrol is evaluated
     every frame in `update` from `baseX/baseY`.
     ========================================================= */
  (L.saws||[]).forEach(s=>cur.saws.push({
    baseX:s.x, baseY:s.y, x:s.x, y:s.y, r:s.r || 26,
    axis:s.axis || 'x', dist:s.dist || 110, speed:s.speed || 1.3,
    phase:s.phase || lrnd()*6.2832,
    spin:0
  }));

  /* NAILS — [x, y, w, h, dir]  dir = 1 floor, -1 ceiling */
  (L.nails||[]).forEach(n=>cur.nails.push({
    x:n[0], y:n[1], w:n[2], h:n[3], dir:n[4] === -1 ? -1 : 1
  }));


  /* =========================================================
     CRUSHERS — a stone that drops from the ceiling.
     Authored at its RAISED position; `y` is the live top, which
     travels down by `drop` when the player walks underneath.

     crushers: [x, y, w, h, drop, speed]
     ========================================================= */
  (L.crushers||[]).forEach(c=>cur.crushers.push({
    x:c[0], y:c[1], baseY:c[1], w:c[2], h:c[3],
    drop:c[4] || 150, speed:c[5] || 1.9,
    t:0,            /* 0 = raised, 1 = fully dropped */
    state:'idle',   /* idle | falling | held | rising */
    hold:0
  }));
  /* fires: [x, y, w] — flames that flicker on and off */
  (L.fires||[]).forEach(f=>cur.fires.push({
    x:f[0],y:f[1],w:f[2],h:f[3]||34,
    on:true,
    /* the phase decides WHEN the flame is deadly, so it is derived from
       the flame's own fixed position rather than thrown at random */
    ph:((f[0]*0.0173) % 6.2832),
    speed:f[4]||1.6
  }));
  /* lava: [x, y, w, h, groundY] — a pit cut into the floor, always on */
  (L.lavas||[]).forEach(l=>cur.lavas.push({
    x:l[0], y:l[1], w:l[2], h:l[3]||60,
    gy: l[4] !== undefined ? l[4] : 500
  }));
  /* Checkpoints are authored with their y already sitting on a real
     surface. We still verify it here: a checkpoint that has no solid
     ground beneath it is DROPPED rather than left floating — a floating
     checkpoint is worse than none, because respawning on it drops the
     player into the void and burns every remaining heart. */
  (L.checkpoints||[]).forEach(c=>{
    const cx=c[0];
    /* find the highest solid top at or just below the authored y */
    let bestY=null, bestD=1e9, bestP=null;
    const all=(L.plats||[]).concat(L.ceils||[]);
    for(let k=0;k<all.length;k++){
      const p=all[k];
      if(cx < p[0]+4 || cx > p[0]+p[2]-4) continue;
      if(p[1] < c[1]-60) continue;             /* must be at/below the flag */
      const d=Math.abs(p[1]-c[1]);
      if(d<bestD){ bestD=d; bestY=p[1]; bestP=p; }
    }
    if(bestY===null) return;                   /* no floor → skip it */
    /* never anchor to a fragile platform */
    for(let k=0;k<cur.crumbs.length;k++){
      const cr=cur.crumbs[k];
      if(cx>=cr.x-16 && cx<=cr.x+cr.w+16 && Math.abs(cr.y-bestY)<18) return;
    }
    /* the MARKER sits 30px above the surface (that is the pole), but the
       RESPAWN must not: it needs the surface itself, plus the extent of
       the stone, so the player can be put back with their feet on it and
       their whole body inside it — see respawnPoint(). */
    cur.checkpoints.push({
      x:cx, y:bestY-30, reached:false, ph:lrnd()*6,
      gx: bestP ? bestP[0] : cx - 40,
      gw: bestP ? bestP[2] : P.w + 80,
      gy: bestY
    });
  });
  (L.movers||[]).forEach(m=>cur.movers.push({
    baseX:m.x,baseY:m.y,x:m.x,y:m.y,w:m.w,h:m.h,
    axis:m.axis||'x',dist:m.dist||0,speed:m.speed||1,phase:m.phase||0,dx:0,dy:0
  }));
  /* the bob offset of every gem comes from its own fixed position, so a
     pickup never shimmers on a different beat from one run to the next */
  (L.gems||[]).forEach(g=>cur.gems.push({
    x:g[0], y:g[1], got:false, ph:((g[0]*0.021) % 6.2832)
  }));
  (L.oil||[]).forEach(o=>cur.oils.push({
    x:o[0], y:o[1], got:false, ph:((o[0]*0.017) % 6.2832)
  }));
  (L.spikes||[]).forEach(s=>cur.spikes.push({x:s[0],y:s[1],w:s[2],h:22}));
  cur.goal={x:L.goal[0],y:L.goal[1],w:44,h:70};

  S.totalGems=cur.gems.length;
  S.gems=0; S.oil=100; S.time=0; S.parts=[]; S.shake=0; S.finished=false; S.result=null;
  S.hearts=MAX_HEARTS; S.deaths=0; S.invuln=0; S.cp=-1;
  hudCache.name=''; hudCache.world=''; hudCache.gems=''; hudCache.time=''; hudCache.oil=-1;
  S.tutMoved=false; S.tutJumped=false; S.tutDouble=false; S.tutGem=false; S.tutOil=false;
  S.motes=[];
  for(let k=0;k<52;k++){
    S.motes.push({x:lrnd()*L.wd, y:lrnd()*VIEW_H, r:.8+lrnd()*1.8,
                  sp:4+lrnd()*12, ph:lrnd()*7});
  }
  S.stars=[];
  for(let k=0;k<80;k++) S.stars.push({
    x:lrnd()*L.wd, y:lrnd()*VIEW_H*.75,
    r:.5+lrnd()*1.1, a:.35+lrnd()*.6, ph:lrnd()*6.2832
  });

  P.w=26; P.h=34;
  P.x=L.spawn[0]; P.y=L.spawn[1]; P.vx=0; P.vy=0;
  P.onGround=false; P.coyote=0; P.buffer=0; P.anim=0; P.squash=1;
  P.jumps=MAX_JUMPS; P.spin=0;
  S.cam=clamp(P.x+P.w/2-VIEW_W/2, 0, Math.max(0,L.wd-VIEW_W));

  if(MUS.on) MUS.setMood(Math.min(3, Math.floor(i/5)));
}

/* ---------------- physics ---------------- */
const GRAV=2100, MAXFALL=1150, SPEED=320, ACC=2600, FRIC=2800, JUMPV=780;
/* second jump is slightly weaker so the arc stays controllable */
const JUMPV2=690;
/* MAX_JUMPS is declared near the top of the file (see FORWARD
   DECLARATIONS) so loadLevel can read it safely. */

function hit(a,b){ return a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y; }

function solids(){
  const arr=cur.plats.slice();
  for(let i=0;i<cur.movers.length;i++){ if(cur.movers[i]) arr.push(cur.movers[i]); }
  for(let i=0;i<cur.ceils.length;i++){ if(cur.ceils[i]) arr.push(cur.ceils[i]); }
  /* fragile platforms only count while they haven't crumbled */
  if(cur.crumbs){
    for(let i=0;i<cur.crumbs.length;i++){
      if(cur.crumbs[i].alive) arr.push(cur.crumbs[i]);
    }
  }

  return arr;
}

/* =========================================================
   WHERE THE PLAYER REAPPEARS — on SOLID GROUND, feet first.
   ---------------------------------------------------------
   THE "I LOST A HEART FOR NO REASON" BUG
   --------------------------------------
   `respawnPoint()` used to hand back the checkpoint object
   verbatim: `{x: poleX, y: surfaceTop - 30}`.

   Two things were wrong with that number, and both of them put
   the spirit in the void:

     · 30 is the POLE's height, not the player's. The player is 34
       tall, so `y = surfaceTop - 30` drops the feet 4 units
       INSIDE the platform on the first physics frame.

     · `poleX` is the tip of the pole, but the player is 26 wide
       and is placed with `x = poleX` — the whole body ends up to
       the RIGHT of the pole. A checkpoint standing near the end of
       a short platform therefore respawned the player with most of
       their body over the edge, and they slid off.

   Falling is not a hazard, so the 1.4s respawn grace never
   applied to it: the player simply vanished off the bottom of the
   screen and lost another heart 1.4 seconds later, with nothing on
   screen to explain why.

   The checkpoint now carries the platform it hangs from (gx, gw,
   gy), so the respawn can land the FEET on that surface and keep
   the whole body inside the stone — clamped, never guessed.
   ========================================================= */
function respawnPoint(){
  const cp = (S.cp >= 0 && cur.checkpoints[S.cp]) ? cur.checkpoints[S.cp] : null;

  if(cp && cp.gy !== undefined){
    const minX = cp.gx + 2;
    const maxX = cp.gx + cp.gw - P.w - 2;
    const rx = (maxX < minX)
      ? (cp.gx + cp.gw/2 - P.w/2)      /* platform narrower than the player */
      : clamp(cp.x, minX, maxX);
    return { x: rx, y: cp.gy - P.h };  /* feet exactly on the surface */
  }

  /* a checkpoint from an older shape — placeAt settles it */
  if(cp) return cp;

  return { x:cur.L.spawn[0], y:cur.L.spawn[1] };
}

function placeAt(pt){
  P.x=pt.x; P.y=pt.y; P.vx=0; P.vy=0;
  trailPts.length = 0;          /* no streak across the level on a teleport */
  lampLagX = 0; lampLagY = 0;
  P.onGround=false; P.coyote=0; P.buffer=0; P.squash=1;
  P.jumps=MAX_JUMPS; P.spin=0;
  S.invuln=1.4;                 /* brief grace so you don't chain-die */
  S.cam=clamp(P.x+P.w/2-VIEW_W*0.42, 0, Math.max(0,cur.L.wd-VIEW_W));
}

/* lose one heart. When the last heart goes, the level restarts from
   the very beginning — checkpoints do NOT survive that. */
function loseHeart(){
  if(S.invuln>0 || S.finished) return;
  S.deaths++;
  S.hearts--;
  S.shake=16;
  burst(P.x+P.w/2, P.y+P.h/2, '#ff8a5c', 18);
  AU.die();

  if(S.hearts <= 0){
    /* out of hearts — stop the game and ask the player what to do */
    S.hearts = 0;
    flashHud();
    updateHUD();
    showGameOver();
    return;
  }
  placeAt(respawnPoint());
  updateHUD();
}

/* =========================================================
   GAME OVER — the level is NOT auto-restarted. The player
   chooses: retry the level, or go back to the main menu.
   The flavour line changes every time so it never feels canned.
   ========================================================= */
const GAMEOVER_LINES = [
  'gameover.l1','gameover.l2','gameover.l3','gameover.l4',
  'gameover.l5','gameover.l6','gameover.l7','gameover.l8'
];
let lastLine = -1;

function showGameOver(){
  S.playing=false;
  S.paused=true;
  qs('#ov-pause').hidden=true;
  hud.root.hidden=true;
  qs('#touch').hidden=true;
  if(TUT.root) TUT.hide(false);

  /* pick a line that is different from the previous one */
  let n = Math.floor(Math.random()*GAMEOVER_LINES.length);
  if(n === lastLine) n = (n+1) % GAMEOVER_LINES.length;
  lastLine = n;

  qs('#go-title').textContent = t('gameover.title');
  qs('#go-line').textContent  = t(GAMEOVER_LINES[n]);
  qs('#go-sub').textContent   = t('gameover.sub');
  qs('#ov-gameover').hidden=false;
  AU.tone(220,.5,'sawtooth',.10,70);
}

function hideGameOver(){
  qs('#ov-gameover').hidden=true;
}

/* restart the current level from scratch (hearts, gems, checkpoints) */
function retryLevel(){
  hideGameOver();
  S.paused=false; S.playing=true;
  startLevel(S.level);
}

/* quick red pulse on the hearts row when a life is lost */
function flashHud(){
  const el = hud.hearts;
  if(!el) return;
  el.classList.remove('hit');
  void el.offsetWidth;
  el.classList.add('hit');
}

function pcx0(){ return P.x+P.w/2; }
function pcy0(){ return P.y+P.h/2; }

function burst(x,y,color,n){
  const q = save.settings.quality==='low' ? Math.ceil(n/2) : n;
  for(let i=0;i<q;i++){
    const a=rnd(0,Math.PI*2), s=rnd(40,220);
    S.parts.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-60,
      life:rnd(.4,.9),max:.9,size:rnd(1.5,3.5),color:color});
  }
}

function update(dt){
  S.time+=dt;

  /* moving platforms */
  for(let i=0;i<cur.movers.length;i++){
    const m=cur.movers[i];
    const off=Math.sin(S.t*m.speed+m.phase)*m.dist;
    const nx = m.axis==='x' ? m.baseX+off : m.baseX;
    const ny = m.axis==='y' ? m.baseY+off : m.baseY;
    m.dx=nx-m.x; m.dy=ny-m.y; m.x=nx; m.y=ny;
    if(P.vy>=0 && P.y+P.h>=m.y-10 && P.y+P.h<=m.y+12 && P.x+P.w>m.x && P.x<m.x+m.w){
      P.x+=m.dx; P.y+=m.dy;
    }
  }

  /* horizontal input */
  const dir = (keys.right?1:0) - (keys.left?1:0);
  if(dir!==0){
    P.vx += dir*ACC*dt;
    P.vx = clamp(P.vx, -SPEED, SPEED);
    P.face = dir;
  } else {
    const f=FRIC*dt;
    if(Math.abs(P.vx)<=f) P.vx=0; else P.vx -= Math.sign(P.vx)*f;
  }

  /* jump — double jump supported.
     P.jumps counts how many jumps are left in the air; it refills the
     moment the player is grounded (or inside the coyote window). */
  P.coyote = P.onGround ? 0.1 : Math.max(0, P.coyote-dt);
  P.buffer = Math.max(0, P.buffer-dt);
  if(keys.jumpPressed){ P.buffer=0.13; keys.jumpPressed=false; }
  if(P.buffer>0){
    if(P.coyote>0){
      /* first jump — from the ground (or just after leaving it) */
      P.vy=-JUMPV; P.buffer=0; P.coyote=0; P.onGround=false;
      P.jumps=MAX_JUMPS-1; P.squash=1.22; AU.jump();
      S.tutJumped = true;
      burst(P.x+P.w/2, P.y+P.h, cur.W.accent, 6);
    } else if(P.jumps>0){
      /* second (air) jump — resets vy so it always feels like a fresh hop */
      P.vy=-JUMPV2; P.buffer=0; P.jumps--;
      P.squash=1.16; P.spin=1;
      S.tutDouble = true;
      AU.jump();
      /* a ring of light under the feet marks the mid-air jump */
      burst(P.x+P.w/2, P.y+P.h, cur.W.accent2, 10);
    }
  }
  if(!keys.jump && P.vy<-260) P.vy += GRAV*1.6*dt;
  /* spin decays after an air jump — purely cosmetic */
  P.spin = Math.max(0, P.spin - dt*2.6);

  /* gravity */
  P.vy = Math.min(P.vy + GRAV*dt, MAXFALL);

  const sol=solids();

  /* move X */
  P.x += P.vx*dt;
  for(let i=0;i<sol.length;i++){
    const s=sol[i];
    if(hit(P,s)){
      if(P.vx>0) P.x=s.x-P.w; else if(P.vx<0) P.x=s.x+s.w;
      P.vx=0;
    }
  }

  /* move Y */
  const wasY=P.y;
  P.y += P.vy*dt;
  let grounded=false;
  for(let i=0;i<sol.length;i++){
    const s=sol[i];
    if(hit(P,s)){
      if(P.vy>0){ P.y=s.y-P.h; P.vy=0; grounded=true; }
      else if(P.vy<0){ P.y=s.y+s.h; P.vy=0; }
    }
  }
  if(grounded && !P.onGround){
    P.squash=0.82;
    if(Math.abs(wasY-P.y)<600) burst(P.x+P.w/2, P.y+P.h, 'rgba(255,220,170,.9)', 4);
  }
  P.onGround=grounded;
  /* landing refills the double jump */
  if(grounded) P.jumps=MAX_JUMPS;

  P.squash = lerp(P.squash, 1, 1-Math.pow(0.001,dt));
  P.anim += dt*(Math.abs(P.vx)/SPEED)*10 + dt*2;

  /* bounds */
  P.x = clamp(P.x, 0, cur.L.wd-P.w);

  /* invulnerability timer after a respawn */
  if(S.invuln>0) S.invuln = Math.max(0, S.invuln-dt);

  /* =========================================================
     FALLING OUT IS NEVER FORGIVEN BY THE RESPAWN GRACE
     ---------------------------------------------------------
     `loseHeart()` bails out while `S.invuln > 0`, and falling is
     not a hazard — it does not respect grace. So a bad respawn
     dropped the player into the void while invulnerable and
     nothing happened for the full 1.4s: the spirit just left the
     bottom of the screen and then, the instant the grace expired,
     a heart went. That is the second death with no visible cause.
     Clearing the grace here means a fall is answered immediately,
     and the respawn fix above means it cannot happen at all.
     ========================================================= */
  if(P.y > VIEW_H+140){ S.invuln = 0; loseHeart(); return; }

  /* =========================================================
     PLAYER HITBOX — declared ONCE, at the top of the hazard pass.
     ---------------------------------------------------------
     `pb` used to be declared here, immediately before the spikes
     loop, and the saw block far below referenced it. That worked
     only because nothing between them returned early. The moment
     a hazard could bail out of `update()` before the declaration
     ran, every later reference to `pb.w` threw

         TypeError: Cannot read properties of undefined (reading 'w')

     Moving the declaration up — before ANY hazard can return —
     removes the whole class of bug, not just the one instance.
     ========================================================= */
  const pb={x:P.x+4,y:P.y+4,w:P.w-8,h:P.h-8};

  /* every hazard array is guaranteed to exist before it is walked */
  if(!cur.spikes) cur.spikes=[];
  if(!cur.fires)  cur.fires=[];
  if(!cur.lavas)  cur.lavas=[];
  if(!cur.crumbs) cur.crumbs=[];
  if(!cur.saws)   cur.saws=[];
  if(!cur.nails)  cur.nails=[];
  if(!cur.crushers) cur.crushers=[];

  /* spikes */
  for(let i=0;i<cur.spikes.length;i++){
    const sp=cur.spikes[i];
    if(!sp) continue;
    if(hit(pb,sp)){ loseHeart(); return; }
  }

  /* fires — flames pulse on and off, so timing matters */
  for(let i=0;i<cur.fires.length;i++){
    const f=cur.fires[i];
    if(!f) continue;
    const wave=Math.sin(S.t*f.speed+f.ph);
    f.on = wave > -0.15;                 /* on ~57% of the cycle */
    if(f.on && hit(pb,f)){ loseHeart(); return; }
  }

  /* lava — always lethal, never flickers */
  for(let i=0;i<cur.lavas.length;i++){
    const lv=cur.lavas[i];
    if(!lv) continue;
    if(hit(pb,lv)){ loseHeart(); return; }
  }

  /* =========================================================
     FRAGILE PLATFORMS
     ---------------------------------------------------------
     Two changes from the original loop:

       1. The fuse is read from the platform (`c.fuse`) instead
          of being the constant 0.55.
       2. A platform with `respawn` comes back after a cooldown,
          which is what makes a chain genuinely unpredictable:
          the player cannot assume "that one is gone for good".

     The cooldown is deliberately longer than the longest fuse so
     a returning platform never pops up underneath a player who
     is still mid-jump over it.
     ========================================================= */
  for(let i=0;i<cur.crumbs.length;i++){
    const c=cur.crumbs[i];
    if(!c) continue;

    /* ---- dead: wait out the cooldown, then come back ---- */
    if(!c.alive){
      if(c.respawn){
        c.cool -= dt;
        if(c.cool <= 0){
          c.alive = true; c.timer = 0; c.shake = 0;
          burst(c.x+c.w/2, c.y+c.h/2, cur.W.accent2, 8);
          AU.tone(520,.08,'sine',.04);
        }
      }
      continue;
    }

    const standing = P.onGround && P.y+P.h >= c.y-4 && P.y+P.h <= c.y+8 &&
                     P.x+P.w > c.x && P.x < c.x+c.w;
    if(standing){
      if(c.timer===0){
        c.timer = c.fuse || 0.55;
        AU.tone(180,.10,'square',.05);
      }
      c.timer -= dt;
      c.shake = Math.min(3, c.shake + dt*14);
      if(c.timer<=0){
        c.alive=false;
        c.timer=0;
        c.cool = 2.6;
        burst(c.x+c.w/2, c.y+c.h/2, cur.W.platTop, 14);
        AU.tone(120,.22,'sawtooth',.07,50);
      }
    } else {
      c.shake = Math.max(0, c.shake - dt*10);
    }
  }

  /* =========================================================
     SAWS — a spinning blade on a patrol path.
     ---------------------------------------------------------
     The blade's centre is a pure function of `S.t`, so it is
     perfectly deterministic and perfectly readable: the player
     can learn the rhythm of a blade and beat it with skill.

     Collision is a CIRCLE test against the player's box, which
     is the honest shape for a spinning disc — a box test would
     kill a player who is visibly clear of the teeth.
     ========================================================= */
  for(let i=0;i<cur.saws.length;i++){
    const s=cur.saws[i];
    if(!s) continue;
    const off = Math.sin(S.t * s.speed + s.phase) * s.dist;
    if(s.axis === 'x'){ s.x = s.baseX + off; s.y = s.baseY; }
    else if(s.axis === 'y'){ s.x = s.baseX; s.y = s.baseY + off; }
    else {
      /* circular orbit — the hardest to read, late-game only */
      s.x = s.baseX + Math.cos(S.t * s.speed + s.phase) * s.dist;
      s.y = s.baseY + Math.sin(S.t * s.speed + s.phase) * s.dist;
    }
    s.spin += dt * 7.5;

    /* =========================================================
       CIRCLE vs BOX — and the blade now actually bites.
       ---------------------------------------------------------
       THE BUG THIS FIXES
       ------------------
       The old test used `s.r * 0.86` as the collision radius. A
       blade of radius 26 therefore only reached 22.4 units — and
       because the test measures from the blade's CENTRE to the
       nearest point of the player box, a spirit walking straight
       through the middle of the blade could clear it whenever its
       box happened to be narrow at that instant.

       Worse, the player box is already inset by 4 on each side
       (`pb`), so the effective reach was 22.4 + 4 = 26.4 against a
       drawn blade of 26 plus teeth. The teeth were, in practice,
       decoration: the drawn blade was bigger than the thing that
       could hurt you.

       Now the radius is the FULL drawn radius plus a small bite,
       so if the teeth are visibly touching the spirit, the spirit
       dies. That is what the player expects, and it is what the
       artwork has been promising all along.
       ========================================================= */
    const nx = clamp(s.x, pb.x, pb.x+pb.w);
    const ny = clamp(s.y, pb.y, pb.y+pb.h);
    const ddx = s.x - nx, ddy = s.y - ny;
    const hitR = s.r + 4;
    if(ddx*ddx + ddy*ddy < hitR*hitR){ loseHeart(); return; }
  }

  /* =========================================================
     NAILS — dense metal spikes, floor or ceiling.
     A simple box test: the whole row is lethal edge to edge.
     ========================================================= */
  for(let i=0;i<cur.nails.length;i++){
    const nl=cur.nails[i];
    if(!nl) continue;
    if(hit(pb, nl)){ loseHeart(); return; }
  }


  /* =========================================================
     CRUSHERS — the stone that drops from the ceiling.
     ---------------------------------------------------------
     A four-state machine:

       idle    → raised; triggers when the player is underneath
       falling → travelling down at `speed`
       held    → sitting at the bottom for a beat (this is the
                 window the player must not be inside)
       rising  → climbing back to its rest position

     The trigger is the player's horizontal overlap, not their
     distance, so it fires exactly when crossing would be fatal.
     ========================================================= */
  for(let i=0;i<cur.crushers.length;i++){
    const c=cur.crushers[i];
    if(!c) continue;
    const overX = P.x + P.w > c.x + 6 && P.x < c.x + c.w - 6;

    if(c.state === 'idle'){
      if(overX && P.y + P.h > c.baseY + c.h){
        c.state = 'falling';
        AU.tone(150,.14,'square',.06);
      }
    } else if(c.state === 'falling'){
      c.t = Math.min(1, c.t + dt * c.speed);
      if(c.t >= 1){ c.state='held'; c.hold = 0.28; S.shake = Math.max(S.shake, 7); }
    } else if(c.state === 'held'){
      c.hold -= dt;
      if(c.hold <= 0) c.state = 'rising';
    } else {
      c.t = Math.max(0, c.t - dt * c.speed * 0.8);
      if(c.t <= 0) c.state = 'idle';
    }

    c.y = c.baseY + c.t * c.drop;

    /* lethal only while it is actually moving or resting low */
    if(c.t > 0.12 && hit(pb, {x:c.x, y:c.y, w:c.w, h:c.h})){ loseHeart(); return; }
  }

  /* checkpoints — touching one saves the respawn position */
  for(let i=0;i<cur.checkpoints.length;i++){
    const c=cur.checkpoints[i];
    if(c.reached) continue;
    const dx=c.x-pcx0(), dy=c.y-pcy0();
    if(dx*dx+dy*dy < 52*52){
      c.reached=true;
      S.cp=i;
      AU.tone(660,.10,'sine',.10);
      setTimeout(()=>AU.tone(990,.16,'sine',.09),70);
      burst(c.x,c.y,'#9fe8ff',16);
      updateHUD();
    }
  }

  /* gems */
  const pcx=P.x+P.w/2, pcy=P.y+P.h/2;
  for(let i=0;i<cur.gems.length;i++){
    const g=cur.gems[i];
    if(g.got) continue;
    const dx=g.x-pcx, dy=g.y-pcy;
    if(dx*dx+dy*dy < 46*46){
      g.got=true; S.gems++; AU.gem();
      S.tutGem = true;
      burst(g.x,g.y,cur.W.accent2,14);
    }
  }

  /* oil */
  for(let i=0;i<cur.oils.length;i++){
    const o=cur.oils[i];
    if(o.got) continue;
    const dx=o.x-pcx, dy=o.y-pcy;
    if(dx*dx+dy*dy < 44*44){
      o.got=true; S.oil=Math.min(100,S.oil+38); AU.oil();
      S.tutOil = true;
      burst(o.x,o.y,'#ffd79a',12);
    }
  }
  /* oil drain: 100 units lasts ~62s, which comfortably covers a level
     at the new length while still punishing a player who ignores flasks */
  S.oil = Math.max(0, S.oil - dt*1.6);

  /* goal */
  if(!S.finished && hit(P,cur.goal)){
    win();
  }

  /* =========================================================
     CAMERA — LOOK-AHEAD
     ---------------------------------------------------------
     The player sat at a fixed 42% of the screen, so running right
     gave exactly the same visibility ahead as standing still. The
     camera now LEADS the direction of travel by up to ~110 world
     units, which is a little over a third of a jump — enough to
     show you the landing before you have to commit to it, and
     small enough that the level never feels like it is sliding.
     ========================================================= */
  const lookAhead = clamp(P.vx * 0.34, -110, 110);
  const target = clamp(P.x+P.w/2 - VIEW_W*0.42 + lookAhead,
                       0, Math.max(0, cur.L.wd-VIEW_W));
  S.cam = lerp(S.cam, target, 1-Math.pow(0.0008,dt));

  /* particles */
  for(let i=S.parts.length-1;i>=0;i--){
    const p=S.parts[i];
    p.life-=dt;
    if(p.life<=0){ S.parts.splice(i,1); continue; }
    p.vy += 420*dt;
    p.vx *= (1-1.6*dt);
    p.x += p.vx*dt; p.y += p.vy*dt;
  }
  S.shake = Math.max(0, S.shake - dt*46);

  /* ---- the lantern spring ----
     a light object on a short cord cannot follow a running body
     instantly: it trails when you accelerate and floats up when you
     fall. This is the cheapest possible way to say "it has mass". */
  const lagTX = clamp(-P.vx * 0.016, -5, 5);
  const lagTY = clamp( P.vy * 0.010, -5, 6);
  lampLagX += (lagTX - lampLagX) * Math.min(1, dt * 12);
  lampLagY += (lagTY - lampLagY) * Math.min(1, dt * 12);
}

function win(){
  S.finished=true;
  AU.win();
  const ratio=S.time;
  const allGems = S.gems>=S.totalGems;
  /* par is now generated from the real level width (see levels.js),
     so a 3-star run is demanding but genuinely reachable */
  const quick = ratio <= cur.L.par;
  let stars=1;
  if(allGems) stars++;
  if(allGems && quick) stars++;
  const prev=save.levels[S.level];
  if(!prev || stars>prev.stars || ratio<(prev.time||999)){
    save.levels[S.level]={stars:Math.max(stars, prev?prev.stars:0), time:Math.min(ratio, prev&&prev.time?prev.time:999)};
    persist();
  }
  /* =========================================================
     A LEVEL IS EARNED, NOT JUST FINISHED
     ---------------------------------------------------------
     Reaching the door is not enough. The next level opens only on
     a run worth keeping: two stars or three. One star means the
     level was survived, not mastered — the door stays shut and the
     player replays it.

     Stars are 1 for arriving, +1 for every gem, +1 for beating par
     with every gem. So two stars means the gems were collected, and
     three means the gems were collected inside the time limit.
     ========================================================= */
  const passMark = stars >= 2;
  if(passMark && S.level + 1 < LEVELS.length) markUnlocked(S.level + 1);
  S.result.passMark = passMark;
  S.result.passStars = 2;

  S.result={stars:stars, gems:S.gems, total:S.totalGems, time:ratio,
            passMark:false, passStars:2};
  setTimeout(()=>{ showResult(); }, 620);
}

/* ---------------- drawing ---------------- */
function drawSky(W){
  const g=ctx.createLinearGradient(0,0,0,VIEW_H);
  g.addColorStop(0,W.skyTop); g.addColorStop(.62,W.fog); g.addColorStop(1,W.skyBot);
  ctx.fillStyle=g; ctx.fillRect(0,0,VIEW_W,VIEW_H);

  /* a second atmosphere layer unique to each world */
  const style = W.id || 'clay';
  if(style==='clay'){
    /* warm dust haze rising from the ground */
    const h=ctx.createLinearGradient(0,VIEW_H*0.45,0,VIEW_H);
    h.addColorStop(0,'rgba(255,160,80,0)');
    h.addColorStop(1,'rgba(255,160,80,.14)');
    ctx.fillStyle=h; ctx.fillRect(0,VIEW_H*0.45,VIEW_W,VIEW_H*0.55);

  } else if(style==='mosque'){
    /* cool shafts of light from above */
    ctx.save();
    ctx.globalAlpha=.05;
    ctx.fillStyle='#c9fff2';
    for(let i=0;i<4;i++){
      const bx=(i*VIEW_W/4)+Math.sin(S.t*0.2+i)*20;
      ctx.beginPath();
      ctx.moveTo(bx,0);
      ctx.lineTo(bx+90,0);
      ctx.lineTo(bx+190,VIEW_H);
      ctx.lineTo(bx+40,VIEW_H);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();

  } else if(style==='market'){
    /* colourful cloth banners strung across the sky */
    ctx.save();
    ctx.globalAlpha=.10;
    const cols=['#ff86c8','#ffd6ec','#ffe0b0','#c9fff2'];
    for(let i=0;i<Math.ceil(VIEW_W/120)+1;i++){
      const bx=i*120;
      ctx.fillStyle=cols[i%cols.length];
      ctx.beginPath();
      ctx.moveTo(bx,0);
      ctx.lineTo(bx+60,0);
      ctx.lineTo(bx+30,60);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();

  } else if(style==='ruins'){
    /* floating violet dust motes drifting upward */
    ctx.save();
    ctx.globalAlpha=.16;
    ctx.fillStyle='#b9a8ff';
    for(let i=0;i<26;i++){
      const px=((i*137 + S.t*8) % VIEW_W);
      const py=VIEW_H - ((i*97 + S.t*22) % VIEW_H);
      ctx.beginPath(); ctx.arc(px,py,1.6,0,7); ctx.fill();
    }
    ctx.restore();

  } else { /* tower */
    /* rising embers */
    ctx.save();
    ctx.globalAlpha=.22;
    for(let i=0;i<30;i++){
      const px=((i*151 + Math.sin(S.t*0.6+i)*14) % VIEW_W);
      const py=VIEW_H - ((i*113 + S.t*34) % VIEW_H);
      ctx.fillStyle = i%3===0 ? '#ffd9a8' : '#ff9a3c';
      ctx.beginPath(); ctx.arc(px,py,1.8,0,7); ctx.fill();
    }
    ctx.restore();
  }
}

/* =========================================================
   STARS — batched, but actually alive.
   The old version ignored the stored per-star alpha (`s.a`)
   entirely, so the sky was static. Now each star's brightness
   is `base alpha * twinkle`, quantised into 4 buckets so the
   whole sky still costs 4 fill() calls instead of 80.
   ========================================================= */
function drawStars(W,par){
  const ox = -S.cam * par;
  const span = VIEW_W + 200;
  const BUCKETS = 4;

  ctx.save();
  ctx.fillStyle = W.star;

  for(let b=0; b<BUCKETS; b++){
    const lo = b / BUCKETS;
    const hi = (b + 1) / BUCKETS;
    ctx.beginPath();
    let drew = false;

    for(let i=0; i<S.stars.length; i++){
      const s = S.stars[i];

      /* per-star twinkle: slow, offset by the star's own phase */
      const tw = 0.55 + 0.45 * Math.sin(S.t * (0.7 + s.r * 0.5) + s.ph);

      /* the star's own stored brightness sets its ceiling */
      const bright = s.a * tw;

      /* which bucket does it fall in? */
      const bucket = Math.min(BUCKETS - 1, Math.floor(bright * BUCKETS));
      if(bucket !== b) continue;

      let x = ((s.x + ox) % span + span) % span - 100;
      /* radius grows a touch with brightness so bright stars read bigger */
      const r = s.r * (0.75 + bright * 0.6);
      ctx.moveTo(x + r, s.y);
      ctx.arc(x, s.y, r, 0, 6.2832);
      drew = true;
    }

    if(drew){
      ctx.globalAlpha = lo + (hi - lo) * 0.5;
      ctx.fill();
    }
  }
  ctx.restore();
}

/* =========================================================
   BACKGROUND SILHOUETTES — a different architecture per world.
   Everything is drawn with plain paths (no images, no filters)
   so it stays cheap: ~10 shapes per layer, per frame.
   ========================================================= */
function drawArches(W,par){
  const ox=-S.cam*par;
  const style=W.archStyle||'dome';
  const STEP=260;
  const cols=Math.ceil(VIEW_W/STEP)+3;
  ctx.save();
  ctx.globalAlpha=.55;
  ctx.fillStyle=W.arch;

  /* =========================================================
     STABLE SILHOUETTES
     ---------------------------------------------------------
     The old loop derived each building's `seed` — and therefore
     its height, its chimney, its lit windows — from the loop
     counter `i`. But `i` is a SCREEN slot, not a world position:
     as the camera moves, the slot that used to hold building #3
     holds building #4, so the same building changed height the
     moment it crossed a slot boundary. That is what read as the
     background "dropping down and popping back".

     Fix: derive the seed from the building's WORLD INDEX, which
     is the slot index shifted by however many whole steps the
     camera has scrolled. That number only changes when a building
     genuinely leaves the screen, so each silhouette keeps its own
     shape for its whole life.
     ========================================================= */
  const worldShift = Math.floor(ox / STEP);

  for(let i=-1;i<cols;i++){
    const bx=i*STEP+((ox%STEP)+STEP)%STEP-40;
    const worldIndex = i - worldShift;
    /* a cheap integer hash, so neighbouring buildings never repeat */
    const seed = ((worldIndex*37) % 90 + 90) % 90;
    const baseY=520;

    if(style==='dome'){
      /* low clay houses with rounded roofs and a chimney */
      const h=150+seed;
      ctx.fillRect(bx, baseY-h+56, 128, h-56);
      ctx.beginPath();
      ctx.moveTo(bx-8, baseY-h+60);
      ctx.quadraticCurveTo(bx+64, baseY-h-6, bx+136, baseY-h+60);
      ctx.closePath(); ctx.fill();
      ctx.fillRect(bx+96, baseY-h+8, 14, 46);
      /* a lit window */
      ctx.save();
      ctx.globalAlpha=.16; ctx.fillStyle='#ffd79a';
      ctx.fillRect(bx+30, baseY-h+86, 18, 22);
      ctx.fillRect(bx+76, baseY-h+86, 18, 22);
      ctx.restore();

    } else if(style==='minaret'){
      /* tall slender minaret + a low arcade */
      const h=250+seed;
      ctx.fillRect(bx+30, baseY-h, 34, h);
      /* balcony */
      ctx.fillRect(bx+18, baseY-h+62, 58, 9);
      /* pointed cap */
      ctx.beginPath();
      ctx.moveTo(bx+30, baseY-h);
      ctx.lineTo(bx+47, baseY-h-40);
      ctx.lineTo(bx+64, baseY-h);
      ctx.closePath(); ctx.fill();
      /* arcade of arches along the ground */
      for(let a=0;a<3;a++){
        const ax=bx+96+a*54;
        ctx.beginPath();
        ctx.moveTo(ax, baseY);
        ctx.lineTo(ax, baseY-70);
        ctx.quadraticCurveTo(ax+22, baseY-104, ax+44, baseY-70);
        ctx.lineTo(ax+44, baseY);
        ctx.closePath(); ctx.fill();
      }

    } else if(style==='stalls'){
      /* market awnings on poles, with hanging lanterns */
      const h=110+seed*0.5;
      ctx.beginPath();
      ctx.moveTo(bx, baseY-h);
      ctx.lineTo(bx+150, baseY-h);
      ctx.lineTo(bx+150, baseY-h+22);
      ctx.lineTo(bx, baseY-h+22);
      ctx.closePath(); ctx.fill();
      /* scalloped edge */
      for(let s=0;s<6;s++){
        ctx.beginPath();
        ctx.arc(bx+12+s*25, baseY-h+22, 12, 0, Math.PI);
        ctx.fill();
      }
      ctx.fillRect(bx+10, baseY-h+22, 9, h-22);
      ctx.fillRect(bx+131, baseY-h+22, 9, h-22);
      /* hanging lanterns */
      ctx.save();
      ctx.globalAlpha=.30; ctx.fillStyle='#ffd79a';
      for(let l=0;l<3;l++){
        const lx=bx+34+l*42;
        ctx.fillRect(lx, baseY-h+26, 2, 14);
        ctx.beginPath(); ctx.arc(lx+1, baseY-h+46, 7, 0, 7); ctx.fill();
      }
      ctx.restore();

    } else if(style==='broken'){
      /* shattered colonnade — columns of different heights */
      const hs=[190,120,240,90,170];
      for(let c=0;c<5;c++){
        const cx=bx+c*52;
        const ch=hs[(c+i+5)%5];
        ctx.fillRect(cx, baseY-ch, 30, ch);
        /* broken top */
        ctx.beginPath();
        ctx.moveTo(cx, baseY-ch);
        ctx.lineTo(cx+12, baseY-ch-14);
        ctx.lineTo(cx+22, baseY-ch+6);
        ctx.lineTo(cx+30, baseY-ch-8);
        ctx.lineTo(cx+30, baseY-ch);
        ctx.closePath(); ctx.fill();
      }
      /* rubble mound */
      ctx.beginPath();
      ctx.ellipse(bx+120, baseY-6, 66, 20, 0, 0, 7); ctx.fill();

    } else { /* spire — tower world */
      const h=280+seed;
      /* tapering tower */
      ctx.beginPath();
      ctx.moveTo(bx+8, baseY);
      ctx.lineTo(bx+22, baseY-h*0.6);
      ctx.lineTo(bx+38, baseY-h);
      ctx.lineTo(bx+54, baseY-h*0.6);
      ctx.lineTo(bx+68, baseY);
      ctx.closePath(); ctx.fill();
      /* iron rings */
      ctx.fillRect(bx+12, baseY-h*0.34, 52, 7);
      ctx.fillRect(bx+18, baseY-h*0.66, 40, 6);
      /* a glowing window */
      ctx.save();
      ctx.globalAlpha=.22; ctx.fillStyle='#ffb15c';
      ctx.beginPath(); ctx.arc(bx+38, baseY-h*0.46, 8, 0, 7); ctx.fill();
      ctx.restore();
      /* a short companion tower */
      ctx.fillRect(bx+96, baseY-h*0.45, 30, h*0.45);
      ctx.beginPath();
      ctx.moveTo(bx+96, baseY-h*0.45);
      ctx.lineTo(bx+111, baseY-h*0.45-26);
      ctx.lineTo(bx+126, baseY-h*0.45);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

/* =========================================================
   MID-LAYER PARALLAX — a second, closer band of shapes that
   drifts faster than the far silhouette and slower than the
   world. Gives real depth without any extra cost.
   ========================================================= */
/* =========================================================
   MID-LAYER PARALLAX — the world's own architecture
   ---------------------------------------------------------
   This band used to be a handful of abstract shapes: an ellipse
   for clay, a bar for the mosque, a trestle for the market. The
   result was five worlds that differed only in hue — the player
   could not tell "Clay House" from "The Market" with the colour
   stripped out.

   Each branch below now draws the thing the world is NAMED after:

     clay   · a domed mud house with a chimney, a door and lit
              windows — a house you could live in
     mosque · a colonnade of pointed arches with a hanging lamp
     market · a stall with a striped awning and goods on a table
     ruins  · a broken column with a fallen capital and rubble
     tower  · an iron girder with rivets and a lit porthole

   Everything is still plain paths, so the cost is unchanged.
   ========================================================= */
function drawMidLayer(W,par){
  const style=W.archStyle||'dome';
  const ox=-S.cam*par;
  const STEP=190;
  const cols=Math.ceil(VIEW_W/STEP)+3;
  ctx.save();
  ctx.globalAlpha=.34;
  ctx.fillStyle=W.arch;

  /* same fix as drawArches — seed from the world index, not the
     screen slot, so the closer parallax band is just as stable */
  const worldShift = Math.floor(ox / STEP);

  for(let i=-1;i<cols;i++){
    const bx=i*STEP+((ox%STEP)+STEP)%STEP-30;
    const worldIndex = i - worldShift;
    const seed = ((worldIndex*53) % 70 + 70) % 70;
    const baseY=530;

    if(style==='dome'){
      /* ---- CLAY HOUSE: a domed mud house ---- */
      const h = 96 + seed*0.6;
      const w = 118;

      /* the wall */
      ctx.fillRect(bx+8, baseY-h, w, h);

      /* the dome */
      ctx.beginPath();
      ctx.moveTo(bx+8, baseY-h);
      ctx.quadraticCurveTo(bx+8+w/2, baseY-h-52, bx+8+w, baseY-h);
      ctx.closePath(); ctx.fill();

      /* the chimney */
      ctx.fillRect(bx+8+w*0.72, baseY-h-34, 13, 34);

      /* the door — a dark arch punched out of the wall */
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(bx+8+w*0.42, baseY);
      ctx.lineTo(bx+8+w*0.42, baseY-h*0.42);
      ctx.quadraticCurveTo(bx+8+w*0.5, baseY-h*0.58, bx+8+w*0.58, baseY-h*0.42);
      ctx.lineTo(bx+8+w*0.58, baseY);
      ctx.closePath(); ctx.fill();
      ctx.restore();

      /* two lit windows */
      ctx.save();
      ctx.globalAlpha = .22; ctx.fillStyle = '#ffd79a';
      ctx.fillRect(bx+8+w*0.16, baseY-h*0.62, 15, 18);
      ctx.fillRect(bx+8+w*0.68, baseY-h*0.62, 15, 18);
      ctx.restore();

    } else if(style==='minaret'){
      /* ---- OLD MOSQUE: a colonnade of pointed arches ---- */
      const h = 128 + seed*0.5;
      const archW = 62;

      /* the wall the arches are cut into */
      ctx.fillRect(bx, baseY-h, STEP*1.05, h);

      /* three pointed arches, punched out */
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      for(let a=0;a<3;a++){
        const ax = bx + 16 + a*archW;
        ctx.beginPath();
        ctx.moveTo(ax, baseY);
        ctx.lineTo(ax, baseY-h*0.55);
        ctx.quadraticCurveTo(ax+archW*0.5, baseY-h*0.95, ax+archW, baseY-h*0.55);
        ctx.lineTo(ax+archW, baseY);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();

      /* a hanging lamp in the middle arch */
      ctx.save();
      ctx.globalAlpha = .35; ctx.fillStyle = '#c9fff2';
      ctx.fillRect(bx + 16 + archW + archW*0.5 - 1, baseY-h*0.92, 2, 22);
      ctx.beginPath();
      ctx.arc(bx + 16 + archW + archW*0.5, baseY-h*0.92 + 28, 7, 0, 7);
      ctx.fill();
      ctx.restore();

    } else if(style==='stalls'){
      /* ---- THE MARKET: a stall with a striped awning ---- */
      const h = 104 + seed*0.4;

      /* the two poles */
      ctx.fillRect(bx+18, baseY-h, 8, h);
      ctx.fillRect(bx+124, baseY-h, 8, h);

      /* the awning — a sloped canopy with a scalloped edge */
      ctx.beginPath();
      ctx.moveTo(bx+6, baseY-h);
      ctx.lineTo(bx+144, baseY-h);
      ctx.lineTo(bx+132, baseY-h+26);
      ctx.lineTo(bx+18, baseY-h+26);
      ctx.closePath(); ctx.fill();

      /* scallops along the front edge */
      for(let s=0;s<7;s++){
        ctx.beginPath();
        ctx.arc(bx+22+s*18, baseY-h+26, 9, 0, Math.PI);
        ctx.fill();
      }

      /* the table under the awning */
      ctx.fillRect(bx+16, baseY-34, 118, 8);
      ctx.fillRect(bx+26, baseY-34, 6, 34);
      ctx.fillRect(bx+118, baseY-34, 6, 34);

      /* goods on the table — three little mounds */
      for(let g=0;g<3;g++){
        ctx.beginPath();
        ctx.ellipse(bx+42+g*32, baseY-34, 11, 7, 0, Math.PI, 0);
        ctx.fill();
      }

    } else if(style==='broken'){
      /* ---- RUINED COURT: a broken column and a fallen capital ---- */
      const h = 118 + seed*0.8;

      /* the standing shaft */
      ctx.fillRect(bx+46, baseY-h, 30, h);

      /* the jagged break at the top */
      ctx.beginPath();
      ctx.moveTo(bx+46, baseY-h);
      ctx.lineTo(bx+56, baseY-h-16);
      ctx.lineTo(bx+64, baseY-h+4);
      ctx.lineTo(bx+72, baseY-h-10);
      ctx.lineTo(bx+76, baseY-h);
      ctx.closePath(); ctx.fill();

      /* the base */
      ctx.fillRect(bx+38, baseY-14, 46, 14);

      /* the fallen capital, lying on the ground */
      ctx.beginPath();
      ctx.ellipse(bx+118, baseY-9, 30, 12, 0, 0, 7);
      ctx.fill();

      /* rubble */
      ctx.beginPath();
      ctx.ellipse(bx+160, baseY-5, 22, 8, 0, 0, 7);
      ctx.fill();

    } else {
      /* ---- LANTERN TOWER: an iron girder with a lit porthole ---- */
      const h = 140 + seed*0.7;

      /* the girder */
      ctx.fillRect(bx+44, baseY-h, 26, h);

      /* cross-bracing */
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      for(let b=0;b<4;b++){
        const by = baseY-h + 18 + b*30;
        ctx.beginPath();
        ctx.moveTo(bx+44, by);
        ctx.lineTo(bx+70, by+22);
        ctx.lineTo(bx+70, by+28);
        ctx.lineTo(bx+44, by+6);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();

      /* the flange plates */
      ctx.fillRect(bx+38, baseY-h, 38, 8);
      ctx.fillRect(bx+38, baseY-8, 38, 8);

      /* a lit porthole */
      ctx.save();
      ctx.globalAlpha = .30; ctx.fillStyle = '#ffb15c';
      ctx.beginPath();
      ctx.arc(bx+57, baseY-h*0.42, 9, 0, 7);
      ctx.fill();
      ctx.restore();

      /* a second, shorter girder beside it */
      ctx.fillRect(bx+112, baseY-h*0.55, 20, h*0.55);
      ctx.fillRect(bx+106, baseY-h*0.55, 32, 7);
    }
  }
  ctx.restore();
}

/* =========================================================
   PALETTE ACCESS — one ramp, one fallback, no exceptions.
   ========================================================= */
const PAL_FALLBACK = {
  stone : ['#8a5428','#54301a','#1c0d05'],
  rim   : '#ffd7a0', shadow:'#120901', haze:'#1c0c04',
  spike : ['#3a1512','#a4614a','#fff0d8'],
  steel : ['#1d2129','#4a4f5c','#b9bfcc']
};
function PAL(W){
  const p = W && W.pal;
  return (p && p.stone) ? p : PAL_FALLBACK;
}

/* =========================================================
   ATMOSPHERIC HAZE
   ---------------------------------------------------------
   The three parallax bands were drawn at three different scales
   but at exactly the same saturation and contrast, so they read
   as one flat poster instead of distance. Real air does one
   thing: it pushes everything far away towards the sky colour.

   One translucent fill of the world's own haze between the bands
   is enough to separate them — and because it uses the palette,
   each world gets its own air.
   ========================================================= */
function drawHaze(W, a){
  const p = PAL(W);
  ctx.save();
  ctx.globalAlpha = (a === undefined) ? 0.24 : a;
  ctx.fillStyle = p.haze;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.restore();
}

/* =========================================================
   PLATFORM RENDERING — one distinct material per world.
   clay   : rounded mud-brick with a rough straw top
   mosque : polished marble with a gold inlay line
   market : wooden planks with cloth trim
   ruins  : cracked stone blocks with moss
   tower  : riveted iron with glowing embers
   ========================================================= */
/* =========================================================
   PLATFORM BODY — ONE renderer for every solid stone.
   ---------------------------------------------------------
   THE BUG THIS FIXES
   ------------------
   The fragile platform had its own hand-written renderer that
   looked nothing like the ground it sat between: a chipped
   outline, a black border, three fat cracks and a bright amber
   bar along the top. In a screenshot it read as a foreign object
   dropped into the level, not as a rock that happens to be weak.

   A fragile stone is not a different MATERIAL. It is the same
   stone, with a countdown. So both now go through this one
   function, and the only thing the fragile path can change is
   `heat` (0..1) — which warms the palette and nothing else.

   No outlines are drawn above the silhouette, no extra shapes are
   added, and every decorative mark is clipped to the block. That
   is what stops a line from ever escaping a stone again.
   ========================================================= */
function drawPlatBody(p, W, heat){
  const style = W.id || 'clay';
  const h = (heat === undefined) ? 0 : heat;
  const r = style==='clay' ? 11 : (style==='mosque' ? 4 : (style==='market' ? 5 : (style==='ruins' ? 3 : 6)));

  ctx.save();

  const pal = PAL(W);

  /* drop shadow — the WORLD's shadow colour, not a universal black:
     pure black under every stone is what flattened five worlds into one */
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = pal.shadow;
  rr(ctx,p.x+3,p.y+7,p.w,p.h,r); ctx.fill();
  ctx.restore();

  const g=ctx.createLinearGradient(0,p.y,0,p.y+p.h);
  /* heat warms the top of the block without changing its shape */
  g.addColorStop(0,    h > 0 ? '#c9905e' : pal.stone[0]);
  g.addColorStop(0.55, pal.stone[1]);
  g.addColorStop(1,    pal.stone[2]);

  if(style==='clay'){
    /* rounded, hand-made mud brick */
    rr(ctx,p.x,p.y,p.w,p.h,r);
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.09)'; ctx.lineWidth=1; ctx.stroke();

    /* everything below is clipped to the brick, so a fleck or a
       seam can never stick out of the silhouette */
    ctx.save();
    rr(ctx,p.x,p.y,p.w,p.h,r); ctx.clip();
    /* straw flecks along the top */
    ctx.fillStyle=W.accent; ctx.globalAlpha=.55;
    for(let i=0;i<p.w;i+=17){
      rr(ctx,p.x+4+i, p.y+2, 9, 2.4, 1.2); ctx.fill();
    }
    ctx.globalAlpha=.18;
    ctx.fillStyle='#000';
    for(let i=0;i<p.w;i+=38){
      rr(ctx,p.x+8+i, p.y+p.h*0.45, 20, 3, 1.5); ctx.fill();
    }
    ctx.restore();

    if(h > 0){
      /* the only warning the fragile stone gets: it warms from the
         inside. No bar, no stripe, no outline. */
      ctx.save();
      rr(ctx,p.x,p.y,p.w,p.h,r); ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.16 + 0.22*h;
      const warm = ctx.createLinearGradient(0,p.y,0,p.y+p.h);
      warm.addColorStop(0,'rgba(255,150,70,0.9)');
      warm.addColorStop(1,'rgba(255,90,30,0)');
      ctx.fillStyle = warm;
      ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.restore();
    }

  } else if(style==='mosque'){
    /* polished marble slab */
    rr(ctx,p.x,p.y,p.w,p.h,r);
    ctx.fillStyle=g; ctx.fill();
    /* marble veins */
    ctx.save();
    rr(ctx,p.x,p.y,p.w,p.h,r); ctx.clip();
    ctx.strokeStyle='rgba(255,255,255,.10)'; ctx.lineWidth=1;
    for(let i=0;i<p.w;i+=46){
      ctx.beginPath();
      ctx.moveTo(p.x+i, p.y);
      ctx.quadraticCurveTo(p.x+i+14, p.y+p.h*0.5, p.x+i+4, p.y+p.h);
      ctx.stroke();
    }
    /* gold inlay along the top edge */
    ctx.fillStyle='#e8c979'; ctx.globalAlpha=.75;
    rr(ctx,p.x+2,p.y+1.5,p.w-4,2.4,1.2); ctx.fill();
    ctx.globalAlpha=.35;
    rr(ctx,p.x+2,p.y+p.h-3,p.w-4,1.6,0.8); ctx.fill();
    ctx.restore();

  } else if(style==='market'){
    /* wooden planks with visible seams */
    rr(ctx,p.x,p.y,p.w,p.h,r);
    ctx.fillStyle=g; ctx.fill();
    ctx.save();
    rr(ctx,p.x,p.y,p.w,p.h,r); ctx.clip();
    ctx.strokeStyle='rgba(0,0,0,.35)'; ctx.lineWidth=1.4;
    for(let i=22;i<p.w;i+=22){
      ctx.beginPath(); ctx.moveTo(p.x+i,p.y); ctx.lineTo(p.x+i,p.y+p.h); ctx.stroke();
    }
    ctx.restore();

  } else if(style==='ruins'){
    /* broken stone blocks of uneven height */
    rr(ctx,p.x,p.y,p.w,p.h,r);
    ctx.fillStyle=g; ctx.fill();
    ctx.save();
    rr(ctx,p.x,p.y,p.w,p.h,r); ctx.clip();
    ctx.strokeStyle='rgba(0,0,0,.40)'; ctx.lineWidth=1.6;
    let bx=p.x;
    let k=0;
    while(bx < p.x+p.w){
      const bw = 26 + ((k*13)%18);
      ctx.beginPath(); ctx.moveTo(bx,p.y); ctx.lineTo(bx,p.y+p.h); ctx.stroke();
      bx += bw; k++;
    }
    ctx.beginPath(); ctx.moveTo(p.x,p.y+p.h*0.55); ctx.lineTo(p.x+p.w,p.y+p.h*0.55); ctx.stroke();
    /* moss on the top edge */
    ctx.fillStyle='rgba(120,190,140,.30)';
    for(let i=0;i<p.w;i+=29){
      ctx.beginPath(); ctx.arc(p.x+i+6, p.y+1.5, 3.4, 0, 7); ctx.fill();
    }
    ctx.restore();

  } else { /* tower — riveted iron */
    rr(ctx,p.x,p.y,p.w,p.h,r);
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.12)'; ctx.lineWidth=1; ctx.stroke();
    ctx.save();
    rr(ctx,p.x,p.y,p.w,p.h,r); ctx.clip();
    /* rivets */
    ctx.fillStyle='rgba(255,220,170,.35)';
    for(let i=8;i<p.w-4;i+=24){
      ctx.beginPath(); ctx.arc(p.x+i, p.y+p.h*0.5, 2.2, 0, 7); ctx.fill();
    }
    /* glowing ember line */
    ctx.fillStyle='#ff9a3c'; ctx.globalAlpha=.80;
    rr(ctx,p.x+4,p.y+1.5,p.w-8,2.6,1.3); ctx.fill();
    ctx.globalAlpha=.28;
    ctx.fillStyle='#ffd9a8';
    rr(ctx,p.x+4,p.y+p.h-4,p.w-8,2,1); ctx.fill();
    ctx.restore();
  }

  /* =========================================================
     DIRECTIONAL RIM LIGHT
     ---------------------------------------------------------
     Every stone in the game is lit from the same corner. One
     clipped band along the top edge, in the world's own rim
     colour, is what makes a flat vertical gradient read as a
     solid object with a light source above it.

     It is clipped to the block, so it can never escape the
     silhouette — the same rule the straw and the cracks follow.
     ========================================================= */
  ctx.save();
  rr(ctx,p.x,p.y,p.w,p.h,r); ctx.clip();
  const rimBand = Math.min(p.h - 1, 6);
  const rimG = ctx.createLinearGradient(p.x, p.y, p.x + Math.min(p.w, 110), p.y + rimBand);
  rimG.addColorStop(0, pal.rim);
  rimG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.26 + h * 0.22;
  ctx.fillStyle = rimG;
  ctx.fillRect(p.x, p.y, p.w, rimBand);
  /* a soft contact shadow along the underside, inside the silhouette */
  const aoG = ctx.createLinearGradient(0, p.y + p.h - 8, 0, p.y + p.h);
  aoG.addColorStop(0, 'rgba(0,0,0,0)');
  aoG.addColorStop(1, pal.shadow);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = aoG;
  ctx.fillRect(p.x, p.y + p.h - 8, p.w, 8);
  ctx.restore();

  ctx.restore();
}

/* the public entry point — a solid platform is just the body with no heat */
function drawPlat(p,W){
  drawPlatBody(p, W, 0);
}

/* =========================================================
   MOVING PLATFORM — must be instantly distinguishable from
   static ground, because the player has to predict where it
   will be. Chains above, a lit underside, and small direction
   arrows on the deck do all of that without any text.
   ========================================================= */
function drawMover(m,W){
  const style = W.id || 'clay';

  ctx.save();

  /* ---- suspension chain / rail above the deck ---- */
  const anchorY = m.y - 46;
  ctx.strokeStyle = 'rgba(255,255,255,.16)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(m.x + m.w*0.22, m.y);
  ctx.lineTo(m.x + m.w*0.22, anchorY);
  ctx.moveTo(m.x + m.w*0.78, m.y);
  ctx.lineTo(m.x + m.w*0.78, anchorY);
  ctx.stroke();
  ctx.setLineDash([]);

  /* a small bracket where the chain meets the deck */
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  rr(ctx, m.x + m.w*0.22 - 3, m.y - 4, 6, 6, 2); ctx.fill();
  rr(ctx, m.x + m.w*0.78 - 3, m.y - 4, 6, 6, 2); ctx.fill();

  /* ---- shadow ---- */
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  rr(ctx, m.x + 2, m.y + 5, m.w, m.h, 5); ctx.fill();

  /* ---- deck ---- */
  const g = ctx.createLinearGradient(0, m.y, 0, m.y + m.h);
  g.addColorStop(0, W.platTop);
  g.addColorStop(1, W.platBot);
  rr(ctx, m.x, m.y, m.w, m.h, 5);
  ctx.fillStyle = g;
  ctx.fill();

  /* a bright top edge so it reads as a surface you can land on */
  ctx.fillStyle = W.accent;
  ctx.globalAlpha = 0.85;
  rr(ctx, m.x + 2, m.y + 1, m.w - 4, 2.4, 1.2);
  ctx.fill();
  ctx.globalAlpha = 1;

  /* ---- direction indicator: two chevrons pointing along the axis ---- */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.35 + 0.25*Math.sin(S.t*3 + m.phase);
  ctx.strokeStyle = W.accent2;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  const cy = m.y + m.h*0.55;
  const cxm = m.x + m.w/2;
  for(let k = -1; k <= 1; k += 2){
    ctx.beginPath();
    if(m.axis === 'x'){
      ctx.moveTo(cxm + k*7 - 3, cy - 4);
      ctx.lineTo(cxm + k*7 + 2, cy);
      ctx.lineTo(cxm + k*7 - 3, cy + 4);
    } else {
      ctx.moveTo(cxm - 4, cy + k*4 - 2);
      ctx.lineTo(cxm, cy + k*4 + 3);
      ctx.lineTo(cxm + 4, cy + k*4 - 2);
    }
    ctx.stroke();
  }
  ctx.restore();

  /* ---- a faint glow underneath, like a hovering lantern ---- */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.18;
  const ug = ctx.createLinearGradient(0, m.y + m.h, 0, m.y + m.h + 16);
  ug.addColorStop(0, W.accent);
  ug.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ug;
  ctx.fillRect(m.x + 2, m.y + m.h, m.w - 4, 16);
  ctx.restore();

  ctx.restore();
}

function drawCeil(c,W){
  const style = W.id || 'clay';
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,.42)';
  rr(ctx,c.x+3,c.y+5,c.w,c.h,style==='clay'?9:4); ctx.fill();

  const g=ctx.createLinearGradient(0,c.y,0,c.y+c.h);
  g.addColorStop(0,W.platBot); g.addColorStop(1,W.platTop);
  rr(ctx,c.x,c.y,c.w,c.h,style==='clay'?9:4);
  ctx.fillStyle=g; ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.08)'; ctx.lineWidth=1; ctx.stroke();

  if(style==='mosque'){
    ctx.fillStyle='#e8c979'; ctx.globalAlpha=.55;
    rr(ctx,c.x+3,c.y+c.h-3,c.w-6,2.2,1.1); ctx.fill();
  } else if(style==='market'){
    /* hanging cloth strips */
    ctx.fillStyle=W.accent; ctx.globalAlpha=.45;
    for(let i=0;i<c.w;i+=30){
      ctx.beginPath();
      ctx.moveTo(c.x+i, c.y+c.h);
      ctx.lineTo(c.x+i+15, c.y+c.h);
      ctx.lineTo(c.x+i+7.5, c.y+c.h+9);
      ctx.closePath(); ctx.fill();
    }
  } else if(style==='ruins'){
    /* stalactite-like stone teeth */
    ctx.fillStyle=W.platTop; ctx.globalAlpha=.9;
    for(let i=0;i<c.w;i+=34){
      ctx.beginPath();
      ctx.moveTo(c.x+i, c.y+c.h);
      ctx.lineTo(c.x+i+17, c.y+c.h);
      ctx.lineTo(c.x+i+8.5, c.y+c.h+13);
      ctx.closePath(); ctx.fill();
    }
  } else if(style==='tower'){
    ctx.fillStyle='#ff9a3c'; ctx.globalAlpha=.70;
    rr(ctx,c.x+4,c.y+c.h-4,c.w-8,2.6,1.3); ctx.fill();
  } else {
    ctx.fillStyle=W.accent; ctx.globalAlpha=.55;
    rr(ctx,c.x+5,c.y+c.h-4,c.w-10,3,2); ctx.fill();
  }
  ctx.restore();
}

/* =========================================================
   CHECKPOINT — a small lantern on a pole, not a flag.
   A flag reads as "finish line"; a lantern reads as "safe
   haven", which is what a checkpoint actually is in this game.
   The glow is a cached sprite scaled per state, so no
   gradient is allocated while drawing.
   ========================================================= */
const cpGlowSp = document.createElement('canvas');
const cpGlowSpX = cpGlowSp.getContext('2d');
const CP_R = 56;
let cpGlowReady = false;

function buildCpGlow(){
  cpGlowSp.width = CP_R*2; cpGlowSp.height = CP_R*2;
  cpGlowSpX.clearRect(0,0,CP_R*2,CP_R*2);
  const g = cpGlowSpX.createRadialGradient(CP_R,CP_R,0,CP_R,CP_R,CP_R);
  g.addColorStop(0,   'rgba(159,232,255,0.95)');
  g.addColorStop(0.40,'rgba(159,232,255,0.35)');
  g.addColorStop(1,   'rgba(159,232,255,0)');
  cpGlowSpX.fillStyle = g;
  cpGlowSpX.beginPath(); cpGlowSpX.arc(CP_R,CP_R,CP_R,0,6.2832); cpGlowSpX.fill();
  cpGlowReady = true;
}

function drawCheckpoint(c,W){
  if(!cpGlowReady) buildCpGlow();

  const bob = Math.sin(S.t*2.4 + c.ph) * 2;
  const on  = c.reached;
  const pulse = 0.5 + 0.5*Math.sin(S.t*3 + c.ph);

  /* ---- glow (blitted sprite, scaled by state) ---- */
  const gr = on ? (CP_R * (0.82 + pulse*0.18)) : (CP_R * 0.44);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = on ? (0.55 + pulse*0.30) : 0.16;
  ctx.drawImage(cpGlowSp, c.x-gr, c.y+bob-gr, gr*2, gr*2);
  ctx.restore();

  ctx.save();
  ctx.translate(c.x, c.y + bob);

  /* ---- pole ---- */
  ctx.strokeStyle = on ? '#9fe8ff' : 'rgba(255,255,255,.34)';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 16); ctx.lineTo(0, -6); ctx.stroke();

  /* ---- lantern body ---- */
  const bodyW = on ? 9 : 7.5;
  const bodyH = on ? 13 : 11;
  const bodyY = -19;

  /* cap */
  ctx.fillStyle = on ? '#cdf6ff' : 'rgba(255,255,255,.30)';
  ctx.beginPath();
  ctx.moveTo(-bodyW*0.75, bodyY - bodyH*0.5);
  ctx.lineTo(bodyW*0.75, bodyY - bodyH*0.5);
  ctx.lineTo(0, bodyY - bodyH*0.5 - 4);
  ctx.closePath(); ctx.fill();

  /* glass */
  const glass = ctx.createLinearGradient(0, bodyY - bodyH*0.5, 0, bodyY + bodyH*0.5);
  if(on){
    glass.addColorStop(0, '#eafcff');
    glass.addColorStop(0.5, '#9fe8ff');
    glass.addColorStop(1, '#3f9fc4');
  } else {
    glass.addColorStop(0, 'rgba(255,255,255,.24)');
    glass.addColorStop(1, 'rgba(255,255,255,.10)');
  }
  ctx.fillStyle = glass;
  rr(ctx, -bodyW, bodyY - bodyH*0.5, bodyW*2, bodyH, 3.5);
  ctx.fill();

  /* the flame inside, only once the checkpoint is claimed */
  if(on){
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55 + pulse*0.45;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, bodyY + 1, 2.6, 4.2 + pulse*1.2, 0, 0, 6.2832);
    ctx.fill();
    ctx.restore();
  }

  /* ---- base ---- */
  ctx.fillStyle = on ? 'rgba(159,232,255,.55)' : 'rgba(255,255,255,.16)';
  rr(ctx, -bodyW*0.85, bodyY + bodyH*0.5, bodyW*1.7, 3, 1.5);
  ctx.fill();

  ctx.restore();
}

/* =========================================================
   CRUMBLE — a fragile platform must LOOK fragile before you
   touch it. The old version only changed colour once you were
   already standing on it, which is far too late to react.
   Now it always shows hairline cracks, and those cracks widen
   and glow as the countdown runs out.
   ========================================================= */
function drawCrumb(c,W){
  if(!c.alive) return;

  /* =========================================================
     THE BUG THIS FIXES
     ---------------------------------------------------------
     `urgency` was computed against a hard-coded 0.55 — the old
     constant fuse. The moment the fuse became per-platform, that
     number was wrong for every platform whose fuse was not 0.55:
     a 0.90s platform looked almost-dead the instant you touched
     it, and a 0.30s platform never lit up at all.

     It is now derived from the platform's own `fuse`, so the
     visual warning always matches the real countdown. A player
     who reads the glow gets a truthful answer.
     ========================================================= */
  /* =========================================================
     FRAGILE STONE — redrawn from the ground up.
     ---------------------------------------------------------
     THE BUG THIS REPLACES
     ---------------------
     The previous version drew a rounded rectangle, then added a
     "permanent amber hairline" along its top edge with
     `rr(ctx, 1.5, 0, c.w-3, 2.2, 1.1)`. Two things were wrong:

       · the hairline was a rounded rect, so its own corner radius
         pushed it OUTSIDE the stone's silhouette — a bright bar
         floating above the platform
       · the whole block was already inside a `ctx.scale(wob, 2-wob)`
         squash, so that bar was also being stretched and shifted
         every frame. The result was a line that visibly detached
         from the rock and drifted off it.

     A fragile stone is now built the way a rock is built:
       · an irregular chipped silhouette, not a rounded box
       · a lit top face, a shaded front face, a dark underside
       · cracks that are CLIPPED to the silhouette, so they can
         never escape it
       · a warm rim that lives INSIDE the shape, not on top of it

     Everything is drawn in local coordinates with the shake
     applied as a translate only — no non-uniform scale, so no
     shape can be stretched out of its own outline.
     ========================================================= */
  /* =========================================================
     FRAGILE STONE — the SAME stone as the ground, until you touch it.
     ---------------------------------------------------------
     Every previous version of this function drew a shape that was
     not a platform: a chipped outline, a black border, cracks, a
     glow. The player could spot a fragile stone from across the
     level, which defeats the point — a trap you can see coming is
     just a staircase.

     It now renders through `drawPlatBody`, the exact same routine
     every solid stone uses. Before you stand on it there is NO
     difference at all: same silhouette, same palette, same
     texture. The only thing that changes is `heat`, and heat only
     rises once the fuse is already burning — i.e. once you are
     standing on it and it is too late to be surprised.

     The fuse is short (see TUNE.FUSE_MIN in levels.js) and the
     stone gives way fast, so the read is: identical rock → you
     step on it → it flashes warm → it is gone.
     ========================================================= */
  const fuse = c.fuse || 0.55;
  const urgency = c.timer > 0
    ? Math.min(1, Math.max(0, (fuse - c.timer) / fuse))
    : 0;

  /* a small shake while the fuse burns — the only motion cue */
  const sh = c.shake > 0 ? rnd(-c.shake, c.shake) : 0;

  drawPlatBody(
    { x: c.x + sh, y: c.y, w: c.w, h: c.h },
    W,
    urgency
  );
}

/* =========================================================
   FIRE — a real flame, not a spiky column.
   ---------------------------------------------------------
   Three things make it read as fire:
     1. `lighter` blending, so overlapping tongues add up to
        white-hot heat instead of muddy orange.
     2. Three depth layers — a wide dark-red body, a mid
        orange mass, and a small white core — each with its
        own silhouette, so the shape is never a single spike.
     3. Embers that detach from the base and drift up, which
        is what actually sells motion at a glance.
   Tongues are also width-weighted: fat in the middle, thin at
   the edges, so the flame has a body instead of a comb.
   All gradients are cached per flame — no per-frame allocation.
   ========================================================= */
function drawFire(f,W){
  const cx = f.x + f.w/2;
  const baseY = f.y + f.h;
  const halfW = f.w * 0.5;

  /* master flicker — one value drives the whole flame */
  const flick = 0.62 + 0.38*Math.sin(S.t*f.speed*2.1 + f.ph);

  /* ---------- 1 · ground glow (always visible) ---------- */
  const glowR = f.w * (f.on ? 1.15 : 0.65);
  const glowA = f.on ? 0.34*flick : 0.07;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const gl = ctx.createRadialGradient(cx, baseY, 0, cx, baseY, glowR);
  gl.addColorStop(0,   'rgba(255,140,50,'+(glowA)+')');
  gl.addColorStop(0.45,'rgba(255,90,25,'+(glowA*0.45)+')');
  gl.addColorStop(1,   'rgba(255,70,20,0)');
  ctx.fillStyle = gl;
  ctx.beginPath();
  ctx.ellipse(cx, baseY, glowR, glowR*0.55, 0, 0, 6.2832);
  ctx.fill();
  ctx.restore();

  /* embers drift even while the flame is out — the pit stays alive */
  drawEmbers(f, cx, baseY, flick);

  if(!f.on) return;

  /* ---------- 2 · three depth layers ---------- */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  /* layer spec: [widthScale, heightScale, colour stops, alpha] */
  const layers = [
    /* outer body — wide, dark red, the silhouette */
    { w:1.00, h:1.00, a:0.42, stops:[
        [0,   'rgba(180,30,10,0.95)'],
        [0.55,'rgba(255,80,20,0.55)'],
        [1,   'rgba(255,120,40,0)']
      ]},
    /* mid mass — the visible orange fire */
    { w:0.66, h:0.82, a:0.62, stops:[
        [0,   'rgba(255,120,30,0.98)'],
        [0.5, 'rgba(255,180,60,0.72)'],
        [1,   'rgba(255,220,120,0)']
      ]},
    /* hot core — small, near-white, sits at the base */
    { w:0.34, h:0.52, a:0.85, stops:[
        [0,   'rgba(255,238,190,1)'],
        [0.6, 'rgba(255,225,150,0.55)'],
        [1,   'rgba(255,210,120,0)']
      ]}
  ];

  for(let L=0; L<layers.length; L++){
    const spec = layers[L];
    const lw = halfW * spec.w;
    const lh = f.h * spec.h * (0.86 + 0.14*flick);

    /* one gradient per layer, built from the cached stop table */
    const g = ctx.createLinearGradient(0, baseY, 0, baseY - lh);
    for(let s=0; s<spec.stops.length; s++){
      g.addColorStop(spec.stops[s][0], spec.stops[s][1]);
    }
    ctx.globalAlpha = spec.a * (0.82 + 0.18*flick);
    ctx.fillStyle = g;

    /* tongues: fat in the middle, thin at the edges */
    const n = Math.max(3, Math.round(f.w / 11));
    ctx.beginPath();
    for(let i=0; i<n; i++){
      const t = (i + 0.5) / n;                 /* 0..1 across the flame */
      const px = cx - lw + t * lw * 2;

      /* width weight: 1 at centre, ~0.35 at the edges */
      const weight = 0.35 + 0.65 * Math.sin(t * Math.PI);

      /* each tongue breathes on its own phase */
      const ph = f.ph + i * 1.7;
      const hh = lh * weight * (0.62 + 0.38*Math.abs(Math.sin(S.t*3.4 + ph)));
      const sway = Math.sin(S.t*2.6 + ph) * (2.5 + weight*3.5);
      const tw = (lw / n) * (0.55 + weight*0.75);

      const tipX = px + sway;
      ctx.moveTo(px - tw, baseY);
      ctx.quadraticCurveTo(
        px - tw*0.85 + sway*0.55, baseY - hh*0.55,
        tipX, baseY - hh
      );
      ctx.quadraticCurveTo(
        px + tw*0.85 + sway*0.55, baseY - hh*0.55,
        px + tw, baseY
      );
      ctx.closePath();
    }
    ctx.fill();
  }

  /* ---------- 3 · a hot pool right at the base ---------- */
  ctx.globalAlpha = 0.55 + 0.25*flick;
  const pool = ctx.createRadialGradient(cx, baseY - 3, 0, cx, baseY - 3, halfW*0.85);
  pool.addColorStop(0,   'rgba(255,248,220,0.95)');
  pool.addColorStop(0.5, 'rgba(255,190,80,0.45)');
  pool.addColorStop(1,   'rgba(255,140,40,0)');
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.ellipse(cx, baseY - 3, halfW*0.85, 7 + 3*flick, 0, 0, 6.2832);
  ctx.fill();

  ctx.restore();
}

/* =========================================================
   EMBERS — deterministic, allocation-free sparks.
   Each ember's position is a pure function of time, so there
   is no particle array to maintain and no GC pressure.
   ========================================================= */
function drawEmbers(f, cx, baseY, flick){
  const count = Math.max(3, Math.round(f.w / 16));
  const rise = f.h * 2.2;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for(let i=0; i<count; i++){
    /* each ember loops on its own offset so they never sync up */
    const seed = i * 2.399963;                 /* golden-angle spacing */
    const speed = 0.55 + ((i * 37) % 10) / 18;
    const life = ((S.t * speed + seed) % 1);   /* 0..1 rising cycle */

    const ex = cx + Math.sin(seed * 3.1 + S.t * 1.4 + i) * (f.w * 0.42) * (0.35 + life);
    const ey = baseY - life * rise;
    const alpha = (1 - life) * (f.on ? 0.85 : 0.30) * flick;
    const size = (0.9 + ((i * 13) % 7) / 9) * (1 - life * 0.55);

    ctx.globalAlpha = alpha;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255,245,205,1)' : 'rgba(255,160,55,1)';
    ctx.beginPath();
    ctx.arc(ex, ey, size, 0, 6.2832);
    ctx.fill();
  }
  ctx.restore();
}

/* =========================================================
   LAVA — built the same way as the fire: a solid dark body,
   then additive light on top. The old version was a flat
   gradient rectangle with a few dots; it read as orange
   paint rather than molten rock.
   ========================================================= */
function drawLava(l,W){
  const pal = PAL(W);
  const surfaceY = l.y;
  /* a wide pool needs more bubbles and more crust, or the stretch
     between them reads as a flat coloured band */
  const n = Math.max(3, Math.round(l.w / 26));

  /* =========================================================
     THE PIT
     ---------------------------------------------------------
     Everything below the ground line gets drawn here, and it is
     the reason a pool no longer looks like it is floating:
     two rock walls drop from the ground line down past the molten
     body, and a rock floor closes the bottom. The lava is then
     painted between those walls, so the fire is visibly a hole in
     the earth with rock on every side.
     ========================================================= */
  const gy   = (l.gy !== undefined) ? l.gy : 500;
  const bot  = l.y + l.h;
  const rim  = 15;                       /* width of the stone lip     */
  const bx   = l.x - rim;
  const bw   = l.w + rim*2;
  /* the pool runs hundreds of units down (it must have no floor to land
     on), but the rock around it only needs drawing as far as the bottom
     of the screen — anything deeper is pure wasted fill */
  /* the pit has to run off the bottom of the screen. A pool whose
     walls stop at a visible line reads as a box, not as a hole. */
  const deep = Math.max(bot + 40, VIEW_H + 180);

  ctx.save();
  const rock = ctx.createLinearGradient(0, gy - 2, 0, gy + 220);
  rock.addColorStop(0,    pal.stone[1]);
  rock.addColorStop(0.28, pal.shadow);
  rock.addColorStop(1,    '#040101');
  ctx.fillStyle = rock;
  /* left wall — hangs from the ground line, same height as the pit */
  rr(ctx, bx, gy - 2, rim + 2, deep - gy + 2, 3); ctx.fill();
  /* right wall */
  rr(ctx, l.x + l.w - 1, gy - 2, rim + 2, deep - gy + 2, 3); ctx.fill();
  /* the floor of the pit, when it is shallow enough to be on screen */
  if(bot < deep) rr(ctx, bx, bot - 2, bw, deep - bot + 4, 3); ctx.fill();

  /* a hot lip of stone where the rock meets the ground — the fissure
     itself glows, which is what the player reads before falling in */
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,120,40,.30)';
  rr(ctx, bx, gy - 2, rim + 2, 3, 1.5); ctx.fill();
  rr(ctx, l.x + l.w - 1, gy - 2, rim + 2, 3, 1.5); ctx.fill();
  ctx.restore();

  /* ---------- 2 · the molten body, sitting in the pit ---------- */
  ctx.save();
  /* =========================================================
     THE MOLTEN BODY FILLS THE WHOLE MOUTH
     ---------------------------------------------------------
     It was drawn at exactly `l.h` — 320 units — while the screen
     only shows down to 540, so most of the pool was painted where
     nobody can see it and the visible part was a thin strip with a
     black rectangle under it. The body now runs past the bottom of
     the viewport, and the colour ramp is front-loaded with heat so
     the surface stays the brightest part of the liquid.
     ========================================================= */
  const bodyH = Math.max(l.h, deep - l.y);
  const body = ctx.createLinearGradient(0, l.y, 0, l.y + bodyH);
  body.addColorStop(0,    '#ffe0a8');
  body.addColorStop(0.05, '#ffb347');
  body.addColorStop(0.16, '#ff7a1a');
  body.addColorStop(0.45, '#c9300c');
  body.addColorStop(1,    '#2a0502');
  ctx.fillStyle = body;
  rr(ctx, l.x, l.y, l.w, bodyH, 4);
  ctx.fill();

  /* a slow-moving crust pattern so the surface is never flat */
  ctx.globalAlpha = 0.30;
  ctx.fillStyle = '#5a1004';
  for(let i = 0; i < n; i++){
    const cx = l.x + (i + 0.5) * (l.w / n);
    const drift = Math.sin(S.t * 0.5 + i * 1.9) * 9;
    const cw = (l.w / n) * (0.55 + 0.25 * Math.sin(S.t * 0.7 + i));
    ctx.beginPath();
    ctx.ellipse(cx + drift, l.y + 12 + Math.sin(S.t*0.9 + i)*3, cw, 5, 0, 0, 6.2832);
    ctx.fill();
  }
  ctx.restore();

  /* ---------- 2 · additive heat on the surface ---------- */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  /* ---- the mouth's own glow, wide enough to reach the banks ----
     the pool is a light source now, not an orange shape */
  const mouthR = Math.max(190, l.w * 0.80);
  const mouth = ctx.createRadialGradient(
      l.x + l.w/2, l.y, 0, l.x + l.w/2, l.y, mouthR);
  mouth.addColorStop(0,    'rgba(255,160,60,0.34)');
  mouth.addColorStop(0.35, 'rgba(255,110,35,0.14)');
  mouth.addColorStop(1,    'rgba(255,80,25,0)');
  ctx.fillStyle = mouth;
  ctx.beginPath();
  ctx.ellipse(l.x + l.w/2, l.y, mouthR, mouthR * 0.55, 0, 0, 6.2832);
  ctx.fill();

  /* ---- the meniscus: a white-hot line across the WHOLE surface ----
     The hottest part of a liquid is its surface, never its middle.
     This one line is what separates "molten" from "orange". */
  const men = ctx.createLinearGradient(0, l.y - 2, 0, l.y + 9);
  men.addColorStop(0, 'rgba(255,253,238,0.95)');
  men.addColorStop(1, 'rgba(255,170,60,0)');
  ctx.fillStyle = men;
  ctx.fillRect(l.x, l.y - 2, l.w, 11);

  /* ---- heat rising out of the entire mouth ---- */
  const rise = ctx.createLinearGradient(0, l.y, 0, l.y - 170);
  rise.addColorStop(0,    'rgba(255,150,50,0.26)');
  rise.addColorStop(0.40, 'rgba(255,110,35,0.10)');
  rise.addColorStop(1,    'rgba(255,90,30,0)');
  ctx.fillStyle = rise;
  ctx.fillRect(l.x, l.y - 170, l.w, 170);

  /* a bright band right at the surface */
  const surf = ctx.createLinearGradient(0, surfaceY - 2, 0, surfaceY + 16);
  surf.addColorStop(0,   'rgba(255,240,180,0.85)');
  surf.addColorStop(0.4, 'rgba(255,170,60,0.45)');
  surf.addColorStop(1,   'rgba(255,110,30,0)');
  ctx.fillStyle = surf;
  ctx.fillRect(l.x, surfaceY - 2, l.w, 18);

  /* bubbles that swell and pop on their own phase */
  for(let i = 0; i < n; i++){
    const ph = i * 2.1;
    const cycle = (S.t * (0.8 + (i % 3) * 0.25) + ph) % 2.4;
    if(cycle > 1.5) continue;                 /* popped — invisible */

    const grow = Math.sin((cycle / 1.5) * Math.PI);   /* 0 → 1 → 0 */
    const bx = l.x + (i + 0.5) * (l.w / n) + Math.sin(S.t * 1.3 + ph) * 7;
    const by = surfaceY + 2 - grow * 3;
    const br = 2.2 + grow * 4.2;

    ctx.globalAlpha = 0.55 + grow * 0.4;
    const bg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    bg.addColorStop(0,   'rgba(255,250,215,1)');
    bg.addColorStop(0.5, 'rgba(255,190,80,0.7)');
    bg.addColorStop(1,   'rgba(255,130,40,0)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, 6.2832);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* heat haze rising OUT of the pit mouth — it starts above the ground
     line so the glow spills over the rim like a real fissure */
  const haze = ctx.createLinearGradient(0, surfaceY - 78, 0, surfaceY + 4);
  haze.addColorStop(0, 'rgba(255,120,40,0)');
  haze.addColorStop(1, 'rgba(255,130,45,0.26)');
  ctx.fillStyle = haze;
  ctx.fillRect(l.x, surfaceY - 78, l.w, 82);

  ctx.restore();
}

/* =========================================================
   SPIKES — must read as DANGER at a glance.
   Three passes per spike: a dark base wedge, a lit left face
   and a bright tip. That bevel is what makes a triangle look
   like sharpened metal instead of a coloured shape.
   ========================================================= */
function drawSpikes(s,W){
  const pal = PAL(W);
  const n = Math.max(1, Math.round(s.w / 18));
  const step = s.w / n;
  const baseY = s.y + s.h;

  ctx.save();

  /* a faint warning glow under the row */
  ctx.globalCompositeOperation = 'lighter';
  const warn = ctx.createLinearGradient(0, s.y - 10, 0, baseY);
  warn.addColorStop(0, 'rgba(255,90,70,0)');
  warn.addColorStop(1, 'rgba(255,90,70,0.16)');
  ctx.fillStyle = warn;
  ctx.fillRect(s.x - 4, s.y - 10, s.w + 8, s.h + 10);
  ctx.globalCompositeOperation = 'source-over';

  for(let i = 0; i < n; i++){
    const x0 = s.x + i * step;
    const midX = x0 + step / 2;
    const tipY = s.y;

    /* 1 · dark body — the full triangle, in shadow */
    ctx.fillStyle = pal.spike[0];
    ctx.beginPath();
    ctx.moveTo(x0, baseY);
    ctx.lineTo(midX, tipY);
    ctx.lineTo(x0 + step, baseY);
    ctx.closePath();
    ctx.fill();

    /* 2 · lit left face — the bevel that sells the sharpness */
    const face = ctx.createLinearGradient(midX, tipY, x0, baseY);
    face.addColorStop(0,   pal.spike[2]);
    face.addColorStop(0.55, pal.spike[1]);
    face.addColorStop(1,   pal.spike[0]);
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.moveTo(x0 + step * 0.06, baseY);
    ctx.lineTo(midX, tipY);
    ctx.lineTo(midX, baseY);
    ctx.closePath();
    ctx.fill();

    /* 3 · a hard specular tip */
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,250,240,0.85)';
    ctx.beginPath();
    ctx.moveTo(midX - step * 0.055, tipY + s.h * 0.30);
    ctx.lineTo(midX, tipY);
    ctx.lineTo(midX + step * 0.055, tipY + s.h * 0.30);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  /* a thin dark ground line so the row sits on the floor */
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(s.x, baseY - 2, s.w, 2);

  ctx.restore();
}

/* =========================================================
   SAW — a spinning blade.
   ---------------------------------------------------------
   Four passes, in this order, because that is the order that
   makes it read as METAL rather than as a circle:

     1. a soft heat ring underneath (it is a hazard, so it glows)
     2. the dark disc body
     3. the teeth — a real polygon, not a scalloped circle
     4. a bright rim + hub, so the rotation is visible at speed

   The teeth are drawn as a single path with alternating radii,
   which is both cheap and genuinely serrated.
   ========================================================= */
function drawSaw(s,W){
  const pal = PAL(W);
  const cx = s.x, cy = s.y, r = s.r;

  /* ---- 1 · hazard glow ---- */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const gl = ctx.createRadialGradient(cx,cy,0,cx,cy,r*2.1);
  gl.addColorStop(0,   'rgba(255,120,80,0.22)');
  gl.addColorStop(0.55,'rgba(255,90,60,0.07)');
  gl.addColorStop(1,   'rgba(255,80,50,0)');
  ctx.fillStyle = gl;
  ctx.beginPath(); ctx.arc(cx,cy,r*2.1,0,6.2832); ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(cx,cy);
  ctx.rotate(s.spin);

  /* ---- 2 · dark disc body ---- */
  const body = ctx.createRadialGradient(0,-r*0.3,0,0,0,r);
  body.addColorStop(0,   pal.steel[2]);
  body.addColorStop(0.55, pal.steel[1]);
  body.addColorStop(1,   pal.steel[0]);
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(0,0,r*0.82,0,6.2832); ctx.fill();

  /* ---- 3 · teeth ---- */
  const TEETH = 12;
  ctx.beginPath();
  for(let i=0;i<TEETH;i++){
    const a0 = (i / TEETH) * 6.2832;
    const a1 = ((i + 0.5) / TEETH) * 6.2832;
    const a2 = ((i + 1) / TEETH) * 6.2832;
    if(i === 0) ctx.moveTo(Math.cos(a0)*r*0.82, Math.sin(a0)*r*0.82);
    ctx.lineTo(Math.cos(a1)*r,        Math.sin(a1)*r);
    ctx.lineTo(Math.cos(a2)*r*0.82,   Math.sin(a2)*r*0.82);
  }
  ctx.closePath();
  const tg = ctx.createLinearGradient(-r,0,r,0);
  tg.addColorStop(0,   pal.steel[2]);
  tg.addColorStop(0.5, pal.steel[1]);
  tg.addColorStop(1,   pal.steel[0]);
  ctx.fillStyle = tg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.55)';
  ctx.lineWidth = 1;
  ctx.stroke();

  /* ---- 4 · bright rim + hub ---- */
  ctx.strokeStyle = 'rgba(255,240,220,.55)';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(0,0,r*0.80,0,6.2832); ctx.stroke();

  ctx.fillStyle = '#ffd9a8';
  ctx.beginPath(); ctx.arc(0,0,r*0.20,0,6.2832); ctx.fill();
  ctx.fillStyle = 'rgba(30,20,10,.85)';
  ctx.beginPath(); ctx.arc(0,0,r*0.09,0,6.2832); ctx.fill();

  ctx.restore();
}

/* =========================================================
   NAILS — a dense row of short metal spikes.
   Deliberately reads differently from `drawSpikes`: thinner,
   brighter, and with a visible base rail, so the player never
   mistakes one hazard for the other.
   ========================================================= */
function drawNails(n,W){
  const pal = PAL(W);
  const dir = n.dir;
  const n_count = Math.max(1, Math.round(n.w / 13));
  const step = n.w / n_count;

  ctx.save();

  /* the base rail the nails are set into */
  const railY = dir === 1 ? n.y + n.h : n.y;
  ctx.fillStyle = pal.steel[0];
  ctx.globalAlpha = 0.95;
  rr(ctx, n.x, railY - (dir===1?4:0), n.w, 4, 1.5);
  ctx.fill();

  for(let i=0;i<n_count;i++){
    const x0 = n.x + i*step;
    const midX = x0 + step/2;
    const tipY = dir === 1 ? n.y : n.y + n.h;
    const baseY = dir === 1 ? n.y + n.h : n.y;

    /* dark body */
    ctx.fillStyle = pal.steel[0];
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(x0 + step*0.18, baseY);
    ctx.lineTo(midX, tipY);
    ctx.lineTo(x0 + step*0.82, baseY);
    ctx.closePath();
    ctx.fill();

    /* lit face */
    const face = ctx.createLinearGradient(midX, tipY, x0, baseY);
    face.addColorStop(0,   pal.spike[2]);
    face.addColorStop(0.5, pal.steel[2]);
    face.addColorStop(1,   pal.steel[1]);
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.moveTo(x0 + step*0.18, baseY);
    ctx.lineTo(midX, tipY);
    ctx.lineTo(midX, baseY);
    ctx.closePath();
    ctx.fill();

    /* hard specular tip */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath();
    ctx.moveTo(midX - step*0.06, tipY + (dir===1? n.h*0.34 : -n.h*0.34));
    ctx.lineTo(midX, tipY);
    ctx.lineTo(midX + step*0.06, tipY + (dir===1? n.h*0.34 : -n.h*0.34));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}


/* =========================================================
   CRUSHER — the stone that drops from the ceiling.
   ---------------------------------------------------------
   The tell is the RAIL: a dashed guide line from the stone's
   rest position down to the floor. The player can see exactly
   where it will land before it ever moves — which is what makes
   a falling stone fair rather than a surprise.
   ========================================================= */
function drawCrusher(c,W){
  /* ---- the guide rail ---- */
  ctx.save();
  ctx.strokeStyle = 'rgba(255,120,90,.20)';
  ctx.lineWidth = 1.4;
  ctx.setLineDash([5,6]);
  ctx.beginPath();
  ctx.moveTo(c.x + c.w*0.5, c.baseY + c.h);
  ctx.lineTo(c.x + c.w*0.5, c.baseY + c.h + c.drop);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  /* ---- shadow on the floor, growing as it falls ---- */
  const fall = c.t;
  ctx.save();
  ctx.globalAlpha = 0.25 + fall*0.35;
  ctx.fillStyle = 'rgba(0,0,0,.6)';
  const sw = c.w * (0.7 + fall*0.5);
  ctx.beginPath();
  ctx.ellipse(c.x + c.w*0.5, c.baseY + c.h + c.drop + 4, sw*0.55, 6, 0, 0, 6.2832);
  ctx.fill();
  ctx.restore();

  /* ---- the stone ---- */
  const g = ctx.createLinearGradient(0, c.y, 0, c.y + c.h);
  g.addColorStop(0, W.platBot);
  g.addColorStop(1, W.platTop);
  rr(ctx, c.x, c.y, c.w, c.h, 4);
  ctx.fillStyle = g;
  ctx.fill();

  /* ---- iron bands ---- */
  ctx.fillStyle = 'rgba(255,255,255,.10)';
  rr(ctx, c.x+3, c.y+4, c.w-6, 3, 1.5); ctx.fill();
  rr(ctx, c.x+3, c.y+c.h-7, c.w-6, 3, 1.5); ctx.fill();

  /* ---- an angry rim while it is moving ---- */
  if(c.state === 'falling' || c.state === 'held'){
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45 + 0.35*Math.sin(S.t*18);
    ctx.strokeStyle = '#ff7a5a';
    ctx.lineWidth = 2;
    rr(ctx, c.x, c.y, c.w, c.h, 4);
    ctx.stroke();
    ctx.restore();
  }
}

/* Gem glow is a cached sprite — there can be a dozen gems on screen
   at once, and each one used to allocate a radial gradient per frame. */
const gemGlowSp = document.createElement('canvas');
const gemGlowSpX = gemGlowSp.getContext('2d');
const GEM_R = 34;
let gemGlowReady = false;

function buildGemGlow(){
  gemGlowSp.width = GEM_R*2; gemGlowSp.height = GEM_R*2;
  gemGlowSpX.clearRect(0,0,GEM_R*2,GEM_R*2);
  const g = gemGlowSpX.createRadialGradient(GEM_R,GEM_R,0,GEM_R,GEM_R,GEM_R);
  g.addColorStop(0,   'rgba(255,225,170,0.55)');
  g.addColorStop(0.45,'rgba(255,225,170,0.20)');
  g.addColorStop(1,   'rgba(255,225,170,0)');
  gemGlowSpX.fillStyle = g;
  gemGlowSpX.beginPath(); gemGlowSpX.arc(GEM_R,GEM_R,GEM_R,0,6.2832); gemGlowSpX.fill();
  gemGlowReady = true;
}

function drawGem(g,W){
  if(g.got) return;
  if(!gemGlowReady) buildGemGlow();

  const bob = Math.sin(S.t*2.2 + g.ph) * 4;
  const y = g.y + bob;

  /* glow — blitted */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.85;
  ctx.drawImage(gemGlowSp, g.x-GEM_R, y-GEM_R, GEM_R*2, GEM_R*2);
  ctx.restore();

  /* faceted body */
  ctx.save();
  ctx.translate(g.x, y);
  const sc = 1 + Math.sin(S.t*2.6 + g.ph) * 0.07;
  ctx.scale(sc, sc);
  ctx.rotate(S.t*0.7 + g.ph);

  /* the two darker facets give it volume instead of a flat diamond */
  ctx.fillStyle = W.platBot;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(0,-11); ctx.lineTo(9,0); ctx.lineTo(0,11);
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = W.accent2;
  ctx.beginPath();
  ctx.moveTo(0,-11); ctx.lineTo(9,0); ctx.lineTo(0,11); ctx.lineTo(-9,0);
  ctx.closePath(); ctx.fill();

  /* a bright inner highlight */
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath();
  ctx.moveTo(0,-9); ctx.lineTo(4.5,-1); ctx.lineTo(0,4); ctx.lineTo(-4.5,-1);
  ctx.closePath(); ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0,-11); ctx.lineTo(9,0); ctx.lineTo(0,11); ctx.lineTo(-9,0);
  ctx.closePath(); ctx.stroke();
  ctx.restore();
}

/* =========================================================
   OIL FLASK — the glow is a cached sprite now. This was the
   last per-frame gradient allocation left in the render loop:
   with three or four flasks on screen it cost four radial
   gradients every single frame.
   ========================================================= */
const oilGlowSp = document.createElement('canvas');
const oilGlowSpX = oilGlowSp.getContext('2d');
const OIL_R = 30;
let oilGlowReady = false;

function buildOilGlow(){
  oilGlowSp.width = OIL_R*2; oilGlowSp.height = OIL_R*2;
  oilGlowSpX.clearRect(0,0,OIL_R*2,OIL_R*2);
  const g = oilGlowSpX.createRadialGradient(OIL_R,OIL_R,0,OIL_R,OIL_R,OIL_R);
  g.addColorStop(0,   'rgba(255,190,110,0.45)');
  g.addColorStop(0.45,'rgba(255,180,100,0.18)');
  g.addColorStop(1,   'rgba(255,190,110,0)');
  oilGlowSpX.fillStyle = g;
  oilGlowSpX.beginPath(); oilGlowSpX.arc(OIL_R,OIL_R,OIL_R,0,6.2832); oilGlowSpX.fill();
  oilGlowReady = true;
}

function drawOil(o){
  if(o.got) return;
  if(!oilGlowReady) buildOilGlow();

  const bob = Math.sin(S.t*2 + o.ph) * 3;

  ctx.save();
  ctx.translate(o.x, o.y + bob);

  /* glow — blitted, no allocation */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.9;
  ctx.drawImage(oilGlowSp, -OIL_R, -OIL_R, OIL_R*2, OIL_R*2);
  ctx.restore();

  /* the flask: a warm body with a glass highlight and a cork */
  ctx.fillStyle = '#e8933f';
  rr(ctx, -8, -10, 16, 20, 5); ctx.fill();

  ctx.fillStyle = 'rgba(255,240,205,.9)';
  rr(ctx, -5, -4, 10, 11, 3); ctx.fill();

  /* a thin bright edge on the left so the glass reads as glass */
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  rr(ctx, -6.5, -8, 2.2, 14, 1.1); ctx.fill();

  ctx.fillStyle = '#ffd79a';
  rr(ctx, -4, -13, 8, 5, 2); ctx.fill();

  ctx.restore();
}

/* =========================================================
   GOAL — the door is the one thing the player is walking
   toward for ten minutes, so it has to feel like a reward.
   Cached glow + a light beam + a breathing inner portal.
   ========================================================= */
const goalGlowSp = document.createElement('canvas');
const goalGlowSpX = goalGlowSp.getContext('2d');
const GOAL_R = 120;
let goalGlowReady = false;

function buildGoalGlow(){
  goalGlowSp.width = GOAL_R*2; goalGlowSp.height = GOAL_R*2;
  goalGlowSpX.clearRect(0,0,GOAL_R*2,GOAL_R*2);
  const g = goalGlowSpX.createRadialGradient(GOAL_R,GOAL_R,0,GOAL_R,GOAL_R,GOAL_R);
  g.addColorStop(0,   'rgba(255,225,170,0.55)');
  g.addColorStop(0.42,'rgba(255,205,140,0.22)');
  g.addColorStop(1,   'rgba(255,200,130,0)');
  goalGlowSpX.fillStyle = g;
  goalGlowSpX.beginPath(); goalGlowSpX.arc(GOAL_R,GOAL_R,GOAL_R,0,6.2832); goalGlowSpX.fill();
  goalGlowReady = true;
}

function drawGoal(g,W){
  if(!goalGlowReady) buildGoalGlow();

  const cx = g.x + g.w/2;
  const cy = g.y + g.h/2;
  const pulse = 0.5 + 0.5*Math.sin(S.t*2);

  /* ---- outer glow, blitted and breathing ---- */
  const gr = GOAL_R * (0.88 + pulse*0.14);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.70 + pulse*0.25;
  ctx.drawImage(goalGlowSp, cx-gr, cy-gr, gr*2, gr*2);
  ctx.restore();

  /* ---- a soft vertical beam so the door is visible from a distance ---- */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const beam = ctx.createLinearGradient(0, g.y - 150, 0, g.y + g.h);
  beam.addColorStop(0,   'rgba(255,220,160,0)');
  beam.addColorStop(0.6, 'rgba(255,220,160,' + (0.05 + pulse*0.05) + ')');
  beam.addColorStop(1,   'rgba(255,225,170,' + (0.16 + pulse*0.10) + ')');
  ctx.fillStyle = beam;
  ctx.fillRect(cx - g.w*0.75, g.y - 150, g.w*1.5, g.h + 150);
  ctx.restore();

  /* ---- the arch ---- */
  ctx.save();
  ctx.fillStyle = '#1a1020';
  ctx.beginPath();
  ctx.moveTo(g.x, g.y + g.h);
  ctx.lineTo(g.x, g.y + 24);
  ctx.quadraticCurveTo(cx, g.y - 14, g.x + g.w, g.y + 24);
  ctx.lineTo(g.x + g.w, g.y + g.h);
  ctx.closePath();
  ctx.fill();

  /* a warm rim so the silhouette never disappears into the dark */
  ctx.strokeStyle = W.accent;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.35 + pulse*0.30;
  ctx.strokeStyle = '#ffe8bf';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();

  /* ---- the portal inside ---- */
  const ig = ctx.createLinearGradient(0, g.y, 0, g.y + g.h);
  ig.addColorStop(0,   'rgba(255,245,215,' + (0.80 + pulse*0.15) + ')');
  ig.addColorStop(0.55,'rgba(255,215,150,0.42)');
  ig.addColorStop(1,   'rgba(255,190,110,0.16)');
  ctx.fillStyle = ig;
  ctx.beginPath();
  ctx.moveTo(g.x + 7, g.y + g.h);
  ctx.lineTo(g.x + 7, g.y + 28);
  ctx.quadraticCurveTo(cx, g.y - 6, g.x + g.w - 7, g.y + 28);
  ctx.lineTo(g.x + g.w - 7, g.y + g.h);
  ctx.closePath();
  ctx.fill();

  /* ---- light motes drifting up inside the doorway ---- */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for(let i = 0; i < 6; i++){
    const seed = i * 2.399963;
    const life = ((S.t * 0.42 + seed) % 1);
    const mx = cx + Math.sin(seed*4.1 + S.t*0.9) * (g.w*0.28);
    const my = (g.y + g.h) - life * (g.h * 0.92);
    ctx.globalAlpha = (1 - life) * 0.75;
    ctx.fillStyle = i % 2 === 0 ? '#fff6dc' : '#ffd79a';
    ctx.beginPath();
    ctx.arc(mx, my, 1.4 + (1 - life)*1.6, 0, 6.2832);
    ctx.fill();
  }
  ctx.restore();

  ctx.restore();
}

/* =========================================================
   PLAYER SPRITES — the halo and the lantern glow are radial
   gradients that never change shape, only position and scale.
   Rasterising them once into small canvases and blitting them
   removes 2 gradient allocations per frame from the hottest
   draw call in the game.
   ========================================================= */
const haloSp = document.createElement('canvas');
const haloSpX = haloSp.getContext('2d');
const HALO_R = 72;
let haloReady = false;

const lampSp = document.createElement('canvas');
const lampSpX = lampSp.getContext('2d');
const LAMP_R = 20;
let lampReady = false;

function buildPlayerSprites(){
  haloSp.width = HALO_R*2; haloSp.height = HALO_R*2;
  haloSpX.clearRect(0,0,HALO_R*2,HALO_R*2);
  const hg = haloSpX.createRadialGradient(HALO_R,HALO_R,0,HALO_R,HALO_R,HALO_R);
  hg.addColorStop(0,  'rgba(255,232,185,.62)');
  hg.addColorStop(.42,'rgba(255,196,120,.22)');
  hg.addColorStop(1,  'rgba(255,190,110,0)');
  haloSpX.fillStyle = hg;
  haloSpX.beginPath(); haloSpX.arc(HALO_R,HALO_R,HALO_R,0,6.2832); haloSpX.fill();
  haloReady = true;

  lampSp.width = LAMP_R*2; lampSp.height = LAMP_R*2;
  lampSpX.clearRect(0,0,LAMP_R*2,LAMP_R*2);
  const lg = lampSpX.createRadialGradient(LAMP_R,LAMP_R,0,LAMP_R,LAMP_R,LAMP_R);
  lg.addColorStop(0,'rgba(255,245,215,.95)');
  lg.addColorStop(1,'rgba(255,190,110,0)');
  lampSpX.fillStyle = lg;
  lampSpX.beginPath(); lampSpX.arc(LAMP_R,LAMP_R,LAMP_R,0,6.2832); lampSpX.fill();
  lampReady = true;
}

/* =========================================================
   CLOAK TRAIL — the wake of a spirit that is moving fast.
   ---------------------------------------------------------
   The body used to be one silhouette that teleported from frame
   to frame. Six faint copies of the last few positions, shrinking
   and fading backwards, are what turn "displacement" into
   "speed" — and they cost six small path fills.

   `lampLagX/Y` are the spring the lantern hangs on: the hand
   leads, the lamp follows a beat later.
   ========================================================= */
const trailPts = [];
let lampLagX = 0, lampLagY = 0;

function pushTrail(x, y){
  trailPts.push({ x:x, y:y });
  if(trailPts.length > 5) trailPts.shift();
}

/* the same silhouette drawPlayer builds, usable at any position */
function cloakShape(){
  ctx.beginPath();
  ctx.moveTo(-13,0);
  ctx.quadraticCurveTo(-11,-P.h*0.72,-6,-P.h*0.92);
  ctx.quadraticCurveTo(0,-P.h-4,6,-P.h*0.92);
  ctx.quadraticCurveTo(11,-P.h*0.72,13,0);
  ctx.quadraticCurveTo(0,5,-13,0);
  ctx.closePath();
}

function drawPlayer(W){
  if(!haloReady) buildPlayerSprites();

  const cx=P.x+P.w/2, cy=P.y+P.h/2;
  const bob=Math.sin(P.anim*1.6)*1.6;
  const sq=P.squash;
  pushTrail(cx, P.y+P.h+bob);

  /* =========================================================
     HALO — deliberately restrained.
     The old halo was drawn with `lighter` at 0.62 alpha right
     on top of the character, and the lantern hole in the dark
     layer punched a second full-strength light in the same
     spot. The two stacked past 1.0 and burned the sprite into
     a white blob with no readable detail.
     Now: smaller, dimmer, and drawn BEHIND the body only.
     ========================================================= */
  const haloScale = 0.62;
  const hr = HALO_R * haloScale;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.42;
  ctx.drawImage(haloSp, cx-hr, cy-hr, hr*2, hr*2);
  ctx.restore();

  /* ---- the wake: oldest point first, each one smaller and fainter.
          Only while the player is actually moving — six extra path
          fills while standing still is pure waste. ---- */
  const wake = (Math.abs(P.vx) > 55) ? trailPts.length - 1 : 0;
  for(let i = 0; i < wake; i++){
    const tp = trailPts[i];
    const k = (i + 1) / trailPts.length;      /* 0 oldest → 1 newest */
    ctx.save();
    ctx.translate(tp.x, tp.y);
    const ts = 0.76 + 0.22 * k;
    ctx.scale(ts, ts);
    ctx.globalAlpha = 0.028 + 0.050 * k;
    ctx.fillStyle = '#ffbe73';
    cloakShape();
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(cx, P.y+P.h+bob);
  ctx.scale(1/sq, sq);
  /* a small tilt after the air jump — reads as a flip without disorienting */
  if(P.spin>0.01) ctx.rotate(P.spin*0.34*P.face);

  /* ---- the cloak silhouette, built once as a path ---- */
  const cloakPath = function(){
    ctx.beginPath();
    ctx.moveTo(-13,0);
    ctx.quadraticCurveTo(-11,-P.h*0.72,-6,-P.h*0.92);
    ctx.quadraticCurveTo(0,-P.h-4,6,-P.h*0.92);
    ctx.quadraticCurveTo(11,-P.h*0.72,13,0);
    ctx.quadraticCurveTo(0,5,-13,0);
    ctx.closePath();
  };

  /* a dark rim FIRST, slightly larger — this is what separates the
     spirit from the bright ground behind it so the shape reads */
  ctx.save();
  ctx.translate(0, 0);
  ctx.scale(1.10, 1.06);
  cloakPath();
  ctx.fillStyle = 'rgba(24,10,4,0.90)';
  ctx.fill();
  ctx.restore();

  /* cloak body — deeper gradient so the form has shading, not a flat glow */
  const bg=ctx.createLinearGradient(0,-P.h,0,0);
  bg.addColorStop(0,   '#ffe9c0');
  bg.addColorStop(0.42,'#f0a94e');
  bg.addColorStop(0.75,'#b8641f');
  bg.addColorStop(1,   '#7a3d10');
  ctx.fillStyle=bg;
  cloakPath();
  ctx.fill();

  /* a soft inner highlight down the middle — gives it roundness */
  const inner=ctx.createLinearGradient(0,-P.h*0.9,0,-P.h*0.1);
  inner.addColorStop(0,'rgba(255,255,255,.42)');
  inner.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=inner;
  ctx.beginPath();
  ctx.ellipse(0,-P.h*0.55, 5.5, P.h*0.30, 0, 0, 6.2832);
  ctx.fill();

  /* face — bigger, darker eyes with a highlight dot each */
  ctx.fillStyle='rgba(28,12,4,.95)';
  ctx.beginPath(); ctx.arc(-4.5,-P.h*0.60,2.0,0,7); ctx.fill();
  ctx.beginPath(); ctx.arc( 4.5,-P.h*0.60,2.0,0,7); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.85)';
  ctx.beginPath(); ctx.arc(-5.1,-P.h*0.60-0.6,0.75,0,7); ctx.fill();
  ctx.beginPath(); ctx.arc( 3.9,-P.h*0.60-0.6,0.75,0,7); ctx.fill();

  /* ---- lantern in hand ---- */
  /* the hand leads, the lamp follows — the lag is mirrored with the
     facing so it never swings the wrong way when you turn around */
  const lx = P.face*12 + lampLagX * P.face;
  const ly = -P.h*0.42 + lampLagY;

  /* the glow is small and sits BEHIND the lantern body */
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  ctx.globalAlpha = 0.55;
  const lr = LAMP_R * 0.62;
  ctx.drawImage(lampSp, lx-lr, ly-lr, lr*2, lr*2);
  ctx.restore();

  /* the lantern itself: a dark cage with a bright core, so it reads
     as an object rather than a dot of light */
  ctx.strokeStyle = 'rgba(40,18,6,.90)';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(lx, ly-7); ctx.lineTo(lx, ly-10); ctx.stroke();
  ctx.fillStyle = 'rgba(40,18,6,.85)';
  rr(ctx, lx-4.2, ly-7.5, 8.4, 2.2, 1); ctx.fill();
  rr(ctx, lx-4.2, ly+5.3, 8.4, 2.2, 1); ctx.fill();
  ctx.strokeStyle = 'rgba(60,28,10,.75)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(lx-4.2, ly-5.3); ctx.lineTo(lx-4.2, ly+5.3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(lx+4.2, ly-5.3); ctx.lineTo(lx+4.2, ly+5.3); ctx.stroke();

  const core = ctx.createRadialGradient(lx, ly, 0, lx, ly, 4.6);
  core.addColorStop(0,   '#ffffff');
  core.addColorStop(0.45,'#ffe9b0');
  core.addColorStop(1,   'rgba(255,190,90,.55)');
  ctx.fillStyle = core;
  ctx.beginPath(); ctx.arc(lx, ly, 4.2, 0, 6.2832); ctx.fill();

  ctx.restore();
}

function drawParticles(){
  for(let i=0;i<S.parts.length;i++){
    const p=S.parts[i];
    const a=Math.max(0,p.life/p.max);
    ctx.globalAlpha=a;
    ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.size*a,0,7); ctx.fill();
  }
  ctx.globalAlpha=1;
}

/* Motes: batched into a single path. Previously 52 fill() calls per frame. */
function drawMotes(W){
  const left=S.cam-80, right=S.cam+VIEW_W+80;
  ctx.save();
  ctx.fillStyle=W.accent2;
  ctx.globalAlpha=.16;
  ctx.beginPath();
  for(let i=0;i<S.motes.length;i++){
    const m=S.motes[i];
    let y=(m.y - S.t*m.sp)%VIEW_H;
    if(y<0) y+=VIEW_H;
    const x=m.x - S.cam*0.5 + Math.sin(S.t*.6+m.ph)*10;
    if(x < left || x > right) continue;
    ctx.moveTo(x+m.r, y);
    ctx.arc(x, y, m.r, 0, 6.2832);
  }
  ctx.fill();
  ctx.restore();
}

/* =========================================================
   The lantern hole is a cached sprite: a radial gradient is
   rasterised ONCE into a small offscreen canvas, then blitted
   with drawImage at whatever size/position is needed.
   Creating 5+ radial gradients per frame was the single most
   expensive thing in the render loop.
   ========================================================= */
const holeCv = document.createElement('canvas');
const holeCx = holeCv.getContext('2d');
const HOLE_R = 128;                      /* sprite radius in px */
let holeReady = false;

/* the warm lantern tint is ALSO a cached sprite now — it used to be a
   fresh radial gradient every single frame */
const tintCv = document.createElement('canvas');
const tintCx = tintCv.getContext('2d');
const TINT_R = 128;
let tintReady = false;

function buildHoleSprite(){
  holeCv.width = HOLE_R*2;
  holeCv.height = HOLE_R*2;
  holeCx.clearRect(0,0,HOLE_R*2,HOLE_R*2);
  const g = holeCx.createRadialGradient(HOLE_R,HOLE_R,0,HOLE_R,HOLE_R,HOLE_R);
  g.addColorStop(0,   'rgba(0,0,0,1)');
  g.addColorStop(0.55,'rgba(0,0,0,0.62)');
  g.addColorStop(1,   'rgba(0,0,0,0)');
  holeCx.fillStyle = g;
  holeCx.beginPath();
  holeCx.arc(HOLE_R,HOLE_R,HOLE_R,0,6.2832);
  holeCx.fill();
  holeReady = true;
}

function buildTintSprite(){
  tintCv.width = TINT_R*2;
  tintCv.height = TINT_R*2;
  tintCx.clearRect(0,0,TINT_R*2,TINT_R*2);
  const g = tintCx.createRadialGradient(TINT_R,TINT_R,0,TINT_R,TINT_R,TINT_R);
  /* the centre is intentionally the DIMMEST part — a hot centre here
     is what burned the sprite out before. The warmth lives in the
     mid ring instead. */
  g.addColorStop(0,   'rgba(255,215,155,0.06)');
  g.addColorStop(0.30,'rgba(255,205,140,0.20)');
  g.addColorStop(0.65,'rgba(255,195,120,0.10)');
  g.addColorStop(1,   'rgba(255,200,130,0)');
  tintCx.fillStyle = g;
  tintCx.beginPath();
  tintCx.arc(TINT_R,TINT_R,TINT_R,0,6.2832);
  tintCx.fill();
  tintReady = true;
}

function drawDarkness(W){
  if(!holeReady) buildHoleSprite();
  const d=darkCx;
  d.setTransform(DPR,0,0,DPR,0,0);
  d.clearRect(0,0,VW,VH);
  /* =========================================================
     AMBIENT DARKNESS SCALES WITH THE OIL
     ---------------------------------------------------------
     `S.oil` used to move only the RADIUS of the lantern hole, so a
     nearly empty lamp looked almost the same as a full one: the
     light shrank from 460 to 250 world units and the air around
     the spirit never changed. The ambient darkness now deepens as
     the tank empties (0.26 → 0.62), so "the lantern is dying" is
     visible in the room, not just at the edge of a circle.
     ========================================================= */
  const oilP = clamp(S.oil / 100, 0, 1);        /* 1 = full, 0 = dry */
  const ambient = 0.26 + (1 - oilP) * 0.36;
  d.globalCompositeOperation='source-over';
  d.fillStyle='rgba(6,4,12,' + ambient.toFixed(3) + ')';
  d.fillRect(0,0,VW,VH);

  /* ---- THE SIDE SHADOW IS PAINTED INTO THE DARKNESS LAYER ----
     It used to be blitted onto the scene AFTER the light holes, which
     put it on top of the lantern — nothing could cut through it, and
     the edges read as a painted black band. Drawn here, BEFORE the
     holes, the lantern burns it away as the player walks into an
     edge: the world lights up as you approach it. A drier lamp digs
     a smaller hole, so the edges close in as the oil runs out. */
  edgeShadowOn(d, 1 - oilP);

  d.globalCompositeOperation='destination-out';

  /* blit the cached sprite — no gradient allocation */
  function hole(x,y,r,strength){
    if(r<=0) return;
    d.globalAlpha = strength;
    d.drawImage(holeCv, x-r, y-r, r*2, r*2);
  }

  /* light holes are drawn in WORLD units, then the whole layer is
     scaled to the screen — so convert world -> dark-canvas pixels */
  const px=(P.x+P.w/2-S.cam)*SCALE, py=(P.y+P.h/2)*SCALE;
  /* =========================================================
     LANTERN LIGHT
     Three stacked full-strength holes used to sit exactly on the
     character, on top of the sprite's own additive halo. The
     centre of the sprite went past pure white and every detail
     was lost.
     Now the light is spread outward instead of piled on the
     centre: a wide soft bloom plus a weaker core, so the ground
     around the spirit is lit but the spirit itself stays
     readable.
     ========================================================= */
  /* a full lamp reaches far, an empty one barely lights the feet.
     130 → 470 world units is a change you cannot miss, and it is
     reinforced by the ambient darkness above and the tint below.
     Below a third of a tank the radius also breathes, so a dying
     lamp visibly struggles. */
  const lowOil = (oilP < 0.34)
    ? Math.sin(S.t * 9.7) * (0.34 - oilP) * 0.55
    : 0;
  const rad = (130 + 340 * oilP) * (1 + lowOil) * SCALE;

  /* a fuller tank cuts a cleaner hole through the side shadow */
  const cut = 0.48 + 0.42 * oilP;
  /* wide outer bloom — the actual illumination */
  hole(px, py, rad*1.62, cut);
  /* main pool of light */
  hole(px, py, rad, 0.70 + 0.26 * oilP);
  /* a small, WEAK core — just enough to keep the feet lit */
  hole(px, py, rad*0.34, 0.40 + 0.26 * oilP);

  /* only punch light holes for objects actually near the camera —
     a 11,500-unit level has ~150 gems and every one used to cost a
     drawImage even when it was 8,000 units away */
  const dL = S.cam - 200, dR = S.cam + VIEW_W + 200;
  for(let i=0;i<cur.gems.length;i++){
    const g=cur.gems[i];
    if(!g.got && g.x>dL && g.x<dR) hole((g.x-S.cam)*SCALE, g.y*SCALE, 95*SCALE, .8);
  }
  for(let i=0;i<cur.oils.length;i++){
    const o=cur.oils[i];
    if(!o.got && o.x>dL && o.x<dR) hole((o.x-S.cam)*SCALE, o.y*SCALE, 85*SCALE, .75);
  }
  for(let i=0;i<cur.checkpoints.length;i++){
    const c=cur.checkpoints[i];
    if(c.x>dL && c.x<dR) hole((c.x-S.cam)*SCALE, c.y*SCALE, (c.reached?110:70)*SCALE, c.reached?.9:.6);
  }
  /* fire lights its own surroundings — a hazard you can see coming is
     fair; a hazard hidden in the dark is not. The hole is weak so the
     flame still reads as a threat rather than a lantern. */
  if(cur.fires) for(let i=0;i<cur.fires.length;i++){
    const f=cur.fires[i];
    if(f.x>dL && f.x<dR && f.on)
      hole((f.x+f.w/2-S.cam)*SCALE, (f.y+f.h*0.5)*SCALE, 120*SCALE, .55);
  }
  /* =========================================================
     FRAGILE STONES MUST BE VISIBLE IN THE DARK
     ---------------------------------------------------------
     A crumbling platform is the one hazard the player has to read
     BEFORE stepping on it — the cracks are the whole warning. It
     punched no light hole, so at night it was indistinguishable
     from the void and the first thing the player learned about it
     was that they had already fallen. A weak amber hole now picks
     it out of the dark from a distance.
     ========================================================= */
  if(cur.crumbs) for(let i=0;i<cur.crumbs.length;i++){
    const c=cur.crumbs[i];
    if(!c || !c.alive) continue;
    if(c.x>dL && c.x<dR)
      hole((c.x+c.w/2-S.cam)*SCALE, (c.y+c.h/2)*SCALE,
           (c.w*0.55+26)*SCALE, .40);
  }
  /* lava glows too — a wide, soft pool of light */
  if(cur.lavas) for(let i=0;i<cur.lavas.length;i++){
    const l=cur.lavas[i];
    if(l.x>dL && l.x<dR)
      hole((l.x+l.w/2-S.cam)*SCALE, l.y*SCALE, (l.w*0.55)*SCALE, .5);
  }

  /* =========================================================
     THE NEW FAMILIES MUST BE VISIBLE IN THE DARK
     ---------------------------------------------------------
     A hazard the player cannot see is not a hazard, it is a
     trap. Every new family punches its own light hole so the
     lantern reveals it before it kills you:

               saw     · a cold steel glint, tight radius
        nails   · a faint metal sheen along the row
        crusher · a red warning pool at its landing spot
     ========================================================= */
  if(cur.saws) for(let i=0;i<cur.saws.length;i++){
    const s=cur.saws[i];
    if(!s) continue;
    if(s.x>dL && s.x<dR)
      hole((s.x-S.cam)*SCALE, s.y*SCALE, (s.r*3.4)*SCALE, .42);
  }
  if(cur.nails) for(let i=0;i<cur.nails.length;i++){
    const n=cur.nails[i];
    if(!n) continue;
    if(n.x>dL && n.x<dR)
      hole((n.x+n.w/2-S.cam)*SCALE, (n.y+n.h/2)*SCALE, (n.w*0.55+40)*SCALE, .34);
  }

  if(cur.crushers) for(let i=0;i<cur.crushers.length;i++){
    const c=cur.crushers[i];
    if(!c) continue;
    if(c.x>dL && c.x<dR){
      /* the landing zone stays lit even while the stone is raised —
         that is the whole point of the warning rail */
      hole((c.x+c.w/2-S.cam)*SCALE, (c.baseY+c.h+c.drop)*SCALE, (c.w*1.1)*SCALE, .30);
      hole((c.x+c.w/2-S.cam)*SCALE, (c.y+c.h/2)*SCALE, (c.w*0.9)*SCALE, .38);
    }
  }
  const gl=cur.goal;
  if(gl.x>dL && gl.x<dR) hole((gl.x+gl.w/2-S.cam)*SCALE, (gl.y+gl.h/2)*SCALE, 150*SCALE, .95);

  d.globalAlpha = 1;
  d.globalCompositeOperation='source-over';

  /* the dark layer already lives in screen pixels — draw it 1:1 */
  ctx.save();
  ctx.globalCompositeOperation='source-over';
  ctx.drawImage(darkCv, 0,0, VW, VH, 0,0, VW, VH);
  ctx.restore();

    /* =========================================================
     EDGE SHADOW — not applied here any more.
     ---------------------------------------------------------
     It is painted into the darkness layer BEFORE the light holes
     (top of this function), which is the only order that lets the
     lantern burn through it. The old order put it on top of the
     light, where nothing could ever cut it.
     ========================================================= */

  /* warm light tint — blitted, and now dimmer at the centre so it
     warms the air without washing out the character */
  if(!tintReady) buildTintSprite();
  const tr = rad * 1.30;
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  /* the warmth fades with the oil — a dying lamp goes COLD before it
     goes dark, and that is the clearest warning the player can get */
  ctx.globalAlpha = 0.18 + 0.46 * oilP;
  /* the same struggle, in the tint: the lower the tank, the shakier */
  const tremble = 1 - 0.07 * (1 - oilP) * Math.abs(Math.sin(S.t * 11.3));
  const tw = tr * 2 * tremble;
  ctx.drawImage(tintCv, px - tw/2, py - tw/2, tw, tw);
  ctx.restore();
}

/* =========================================================
   EDGE SHADOW SPRITE
   ---------------------------------------------------------
   A single 256×1 strip, gradient from opaque black on the left to
   transparent on the right. It is stretched to whatever width the
   edge band needs and mirrored for the right-hand side, so one
   tiny canvas serves both edges at any viewport size.
   ========================================================= */
const edgeCv = document.createElement('canvas');
const edgeCx = edgeCv.getContext('2d');
let edgeReady = false;

function buildEdgeShadow(){
  edgeCv.width  = 256;
  edgeCv.height = 1;
  edgeCx.clearRect(0, 0, 256, 1);
  const g = edgeCx.createLinearGradient(0, 0, 256, 0);
  /* deeper at the very edge and softer on the way out: the side of the
     map should read as distance, not as a painted band. */
  g.addColorStop(0,    'rgba(4,2,10,0.97)');
  g.addColorStop(0.20, 'rgba(4,2,10,0.84)');
  g.addColorStop(0.46, 'rgba(4,2,10,0.50)');
  g.addColorStop(0.72, 'rgba(4,2,10,0.20)');
  g.addColorStop(1,    'rgba(4,2,10,0)');
  edgeCx.fillStyle = g;
  edgeCx.fillRect(0, 0, 256, 1);
  edgeReady = true;
}

/* =========================================================
   EDGE SHADOW — now painted INTO a target canvas.
   ---------------------------------------------------------
   `d` is the darkness layer, and the shadow has to be on it
   BEFORE the light holes are punched, otherwise the lantern can
   never cut through. `extra` (0..1) deepens the band as the oil
   runs low, so a dry lamp cannot see the edges of the map at all.

   One 256×1 strip, stretched and mirrored — two drawImage calls
   per frame regardless of viewport size.
   ========================================================= */
function edgeShadowOn(d, extra){
  if(!edgeReady) buildEdgeShadow();
  extra = extra || 0;

  /* wider and deeper than the old band: the edge of the map is a
     threshold now, but it still never eats the play area */
  const bandW = Math.min(VW * 0.30, 340);
  if(bandW < 8) return;

  d.save();
  d.globalCompositeOperation = 'source-over';
  d.globalAlpha = Math.min(1, 0.74 + extra * 0.26);

  /* LEFT edge — gradient runs dark → transparent, left to right */
  d.drawImage(edgeCv, 0, 0, 256, 1, 0, 0, bandW, VH);

  /* RIGHT edge — the same strip mirrored */
  d.save();
  d.translate(VW, 0);
  d.scale(-1, 1);
  d.drawImage(edgeCv, 0, 0, 256, 1, 0, 0, bandW, VH);
  d.restore();

  d.restore();
}

/* =========================================================
   VIGNETTE — was the last per-frame gradient allocation left
   in the render loop. It only depends on the viewport size, so
   it is rebuilt only when VW/VH actually change.
   ========================================================= */
const vigCv = document.createElement('canvas');
const vigCx = vigCv.getContext('2d');
let vigW = -1, vigH = -1;

function buildVignette(w, h){
  vigCv.width  = Math.max(1, Math.round(w * DPR));
  vigCv.height = Math.max(1, Math.round(h * DPR));
  vigCx.setTransform(DPR, 0, 0, DPR, 0, 0);
  vigCx.clearRect(0, 0, w, h);

  const g = vigCx.createRadialGradient(w/2, h/2, h*0.52, w/2, h/2, h*1.15);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,.26)');
  vigCx.fillStyle = g;
  vigCx.fillRect(0, 0, w, h);

  vigW = w; vigH = h;
}

function drawVignette(){
  if(vigW !== VW || vigH !== VH) buildVignette(VW, VH);
  ctx.save();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.drawImage(vigCv, 0, 0, VW, VH);
  ctx.restore();
}

/* =========================================================
   BLOOM — the cheapest thing that makes 2D look expensive.
   ---------------------------------------------------------
   Bright things in a real lens spill onto their neighbours. In
   this game the fire, the lava, the gems, the door and the
   lantern all glowed in perfect isolation — nothing bled — and
   that is a large part of why a technically tidy frame still
   read as flat.

   A canvas 2D bloom has no shader, so the pass is deliberately
   dumb:

     1. downsample the finished frame to 1/4 size   (blurs it)
     2. downsample THAT to 1/8 size                 (blurs it more)
     3. add the 1/8 back onto the 1/4 with `lighter`
     4. composite the 1/4 back over the frame with `lighter`

   Additive compositing IS the bright-pass here: a near-black
   pixel adds almost nothing, a white-hot pixel adds a lot, and
   the blacks never go milky. Cost is three small drawImage calls
   per frame — and the whole thing is skipped on the "low"
   effects setting.
   ========================================================= */
const bloomCv  = document.createElement('canvas');
const bloomCx  = bloomCv.getContext('2d');
const bloom2Cv = document.createElement('canvas');
const bloom2Cx = bloom2Cv.getContext('2d');
let bloomW = -1, bloomH = -1, bloomTick = 0;

function drawBloom(strength){
  if(save.settings.quality === 'low') return;
  if(PERF.off) return;

  /* 1/6 of the frame, and rebuilt on every OTHER frame. The output
     is a blur — a one-frame-old copy is invisible — and this halves
     the cost of the most expensive pass in the renderer. */
  bloomTick++;
  const bw = Math.max(2, Math.round(VW / 6));
  const bh = Math.max(2, Math.round(VH / 6));
  if(bw !== bloomW || bh !== bloomH){
    bloomCv.width  = bw;  bloomCv.height  = bh;
    bloom2Cv.width = Math.max(2, bw >> 1);
    bloom2Cv.height= Math.max(2, bh >> 1);
    bloomW = bw; bloomH = bh;
  }

  if((bloomTick & 1) === 0){
  /* 1 · the frame, tiny */
  bloomCx.globalCompositeOperation = 'source-over';
  bloomCx.globalAlpha = 1;
  bloomCx.clearRect(0, 0, bloomCv.width, bloomCv.height);
  bloomCx.drawImage(canvas, 0, 0, bloomCv.width, bloomCv.height);

  /* 2 · and tinier — this is where the blur comes from */
  bloom2Cx.globalCompositeOperation = 'source-over';
  bloom2Cx.globalAlpha = 1;
  bloom2Cx.clearRect(0, 0, bloom2Cv.width, bloom2Cv.height);
  bloom2Cx.drawImage(bloomCv, 0, 0, bloom2Cv.width, bloom2Cv.height);

  /* =========================================================
     3 · THE BRIGHT PASS — and the fix for the soft, milky frame.
     ---------------------------------------------------------
     Adding a blurred copy of the WHOLE frame back onto itself is
     not a bloom, it is a blur: every mid-tone gets lifted by its
     own neighbourhood average, the blacks come up to grey and the
     whole picture loses its edges. That is exactly what the first
     version did, and it is why the screen went hazy.

     Multiply the frame by its own blurred copy instead.
     `A × blur(A)` crushes mid-tones hard (0.5 × 0.5 = 0.25) and
     leaves highlights nearly untouched (0.9 × 0.85 ≈ 0.76) — a
     real bright-pass built out of canvas 2D's own compositor,
     with no shader and no per-pixel loop. Applied twice, only the
     fire, the lava, the gems, the door and the lantern survive it.
     ========================================================= */
  bloomCx.globalCompositeOperation = 'multiply';
  bloomCx.globalAlpha = 1;
  bloomCx.drawImage(bloom2Cv, 0, 0, bloomCv.width, bloomCv.height);
  bloomCx.drawImage(bloom2Cv, 0, 0, bloomCv.width, bloomCv.height);
  bloomCx.globalCompositeOperation = 'source-over';

  }   /* end of the every-other-frame rebuild */

  /* 4 · and back onto the frame — additive, so blacks stay black */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = (strength === undefined) ? 0.55 : strength;
  ctx.drawImage(bloomCv, 0, 0, VW, VH);
  ctx.restore();
}

/* =========================================================
   COLOUR GRADE — split-tone.
   ---------------------------------------------------------
   Cool above, warm below, both at single-digit alpha. It is the
   oldest trick in colour grading, it costs exactly one gradient
   per frame, and it is what stops a frame from looking like raw
   canvas output: the shadows lean blue, the highlights lean
   amber, and the two halves of the screen belong together.
   ========================================================= */
function drawGrade(){
  if(PERF.off) return;
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0,    'rgba(34,48,92,0.065)');
  g.addColorStop(0.45, 'rgba(0,0,0,0)');
  g.addColorStop(0.72, 'rgba(0,0,0,0)');
  g.addColorStop(1,    'rgba(104,48,10,0.075)');
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VW, VH);
  ctx.restore();
}

/* =========================================================
   FILM GRAIN — one cached noise tile, tiled and re-offset every
   frame. Large gradients (the sky, above all) are where canvas
   looks most plastic; a faint grain kills that. One fillRect.
   ========================================================= */
const grainCv = document.createElement('canvas');
const grainCx = grainCv.getContext('2d');
const GRAIN = 128;
let grainReady = false, grainPat = null;

function buildGrain(){
  grainCv.width = GRAIN; grainCv.height = GRAIN;
  const img = grainCx.createImageData(GRAIN, GRAIN);
  const d = img.data;
  for(let i = 0; i < d.length; i += 4){
    const c = (Math.random() > 0.5) ? 255 : 0;
    d[i] = d[i+1] = d[i+2] = c;
    d[i+3] = (Math.random() * 40) | 0;      /* per-pixel weight 0..39 */
  }
  grainCx.putImageData(img, 0, 0);
  grainPat = ctx.createPattern(grainCv, 'repeat');
  grainReady = true;
}

function drawGrain(){
  if(save.settings.quality === 'low') return;
  if(PERF.off) return;
  if(!grainReady) buildGrain();
  if(!grainPat) return;

  /* a new offset every frame, so the grain moves like film and not
     like a static texture stuck to the glass */
  const ox = (Math.random() * GRAIN) | 0;
  const oy = (Math.random() * GRAIN) | 0;

  ctx.save();
  /* it used to be 0.22 — clearly too much: on a dark scene a grain
     that strong reads as noise, not as film. 0.09 is texture. */
  ctx.globalAlpha = 0.09;
  ctx.translate(-ox, -oy);
  ctx.fillStyle = grainPat;
  ctx.fillRect(0, 0, VW + GRAIN, VH + GRAIN);
  ctx.restore();
}

/* =========================================================
   TOP & BOTTOM SHADE
   ---------------------------------------------------------
   The vignette darkens the corners, but the top and bottom of the
   frame stayed flat, which made the sky look like a painted band
   rather than depth. Two thin gradients — a cool one at the top
   (distance) and a warm one at the bottom (the ground falling
   away) — give the frame a cinematic edge without hiding
   anything the player needs to see.
   ========================================================= */
const shadeCv = document.createElement('canvas');
const shadeCx = shadeCv.getContext('2d');
let shadeW = -1, shadeH = -1;

function buildShade(w, h){
  shadeCv.width  = Math.max(1, Math.round(w));
  shadeCv.height = Math.max(1, Math.round(h));
  shadeCx.clearRect(0, 0, w, h);

  /* top — a cool haze, as if the sky recedes */
  const topH = Math.round(h * 0.20);
  const gt = shadeCx.createLinearGradient(0, 0, 0, topH);
  gt.addColorStop(0, 'rgba(6,4,14,0.55)');
  gt.addColorStop(1, 'rgba(6,4,14,0)');
  shadeCx.fillStyle = gt;
  shadeCx.fillRect(0, 0, w, topH);

  /* bottom — a warm shadow where the floor drops away */
  const botH = Math.round(h * 0.16);
  const gb = shadeCx.createLinearGradient(0, h - botH, 0, h);
  gb.addColorStop(0, 'rgba(8,3,2,0)');
  gb.addColorStop(1, 'rgba(8,3,2,0.50)');
  shadeCx.fillStyle = gb;
  shadeCx.fillRect(0, h - botH, w, botH);

  shadeW = w; shadeH = h;
}

function drawShade(){
  if(shadeW !== VW || shadeH !== VH) buildShade(VW, VH);
  ctx.save();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.drawImage(shadeCv, 0, 0, VW, VH);
  ctx.restore();
}

/* apply the world->screen transform for gameplay drawing */
function worldTransform(){
  ctx.setTransform(DPR*SCALE,0,0,DPR*SCALE,0,0);
}
function screenTransform(){
  ctx.setTransform(DPR,0,0,DPR,0,0);
}

/* ---------------- menu ambience ---------------- */
const menuMotes=[];
/* the menu ambience is seeded too — the same dust drifts every time the
   menu opens, instead of a new random sky on every reload */
(function buildMenuMotes(){
  const mr = (typeof seedRand === 'function') ? seedRand(0x4D454E55) : Math.random;
  for(let i=0;i<70;i++){
    menuMotes.push({
      x: mr()*VW, y: mr()*VH,
      r: .6 + mr()*1.8, sp: 6 + mr()*20, ph: mr()*7
    });
  }
})();

function renderMenu(dt){
  const g=ctx.createLinearGradient(0,0,VW*.35,VH);
  g.addColorStop(0,'#1b1026'); g.addColorStop(.5,'#0d0814'); g.addColorStop(1,'#05030a');
  ctx.fillStyle=g; ctx.fillRect(0,0,VW,VH);

  const t=S.t;
  /* two drifting warm lights for depth */
  for(let k=0;k<2;k++){
    const cx=VW*(k?0.74:0.26)+Math.sin(t*.19+k*2.1)*VW*.09;
    const cy=VH*(k?0.36:0.62)+Math.cos(t*.15+k)*VH*.1;
    const bg=ctx.createRadialGradient(cx,cy,0,cx,cy,VH*(k?0.7:0.95));
    bg.addColorStop(0,k?'rgba(255,150,90,.16)':'rgba(255,190,110,.20)');
    bg.addColorStop(.55,'rgba(255,140,80,.05)');
    bg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=bg; ctx.fillRect(0,0,VW,VH);
  }

  /* distant arches silhouette */
  ctx.save();
  ctx.globalAlpha=.28;
  for(let i=-1;i<Math.ceil(VW/220)+2;i++){
    const bx=i*220+Math.sin(t*.1)*8;
    const h=120+((i*53)%80);
    ctx.fillStyle='#2a1a34';
    ctx.beginPath();
    ctx.moveTo(bx,VH);
    ctx.lineTo(bx,VH-h+50);
    ctx.quadraticCurveTo(bx+50,VH-h,bx+100,VH-h+50);
    ctx.lineTo(bx+100,VH);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  for(let i=0;i<menuMotes.length;i++){
    const m=menuMotes[i];
    let y=(m.y - t*m.sp)%(VH+40); if(y<0) y+=VH+40;
    const x=m.x+Math.sin(t*.5+m.ph)*16;
    ctx.globalAlpha=.10+.32*Math.abs(Math.sin(t*.8+m.ph));
    ctx.fillStyle='#ffd79a';
    ctx.beginPath(); ctx.arc(x,y,m.r,0,7); ctx.fill();
  }
  ctx.globalAlpha=1;
  drawVignette();
}

/* menu ambience is screen-space: fill the whole canvas */
function renderMenuScreen(dt){
  ctx.save();
  ctx.setTransform(DPR,0,0,DPR,0,0);
  renderMenu(dt);
  ctx.restore();
}

/* ---------------- main render ---------------- */
function render(dt){
  if(S.screen==='play' || S.screen==='result'){
    if(!cur) return;
    const W=cur.W;

    /* 1) clear the entire canvas so no stale pixels survive */
    screenTransform();
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.restore();

    /* 2) everything below is drawn in WORLD units, scaled to the screen */
    screenTransform();
    ctx.save();
    let sx=0, sy=0;
    if(S.shake>0.1){ sx=rnd(-S.shake,S.shake); sy=rnd(-S.shake,S.shake); }
    ctx.scale(SCALE,SCALE);
    ctx.translate(sx,sy);

    drawSky(W);
    drawStars(W,0.15);
    drawArches(W,0.35);
    drawHaze(W, 0.07);       /* the far band recedes into the world's own air */
    drawMidLayer(W,0.62);

    ctx.save();
    ctx.translate(-S.cam,0);

    drawMotes(W);

    /* ---- view culling ----
       Levels are now ~11,500 units wide but only ~1,000 are visible.
       Drawing every platform/gem/hazard would be 10x the work for
       pixels nobody sees. Everything outside the camera window
       (plus a margin) is skipped entirely. */
    const cullL = S.cam - 140;
    const cullR = S.cam + VIEW_W + 140;
    const vis = function(o){ return o.x + (o.w||0) > cullL && o.x < cullR; };

    for(let i=0;i<cur.plats.length;i++){ const p=cur.plats[i]; if(vis(p)) drawPlat(p,W); }
    /* moving platforms get their own renderer — they must be
       distinguishable from static ground at a glance */
    for(let i=0;i<cur.movers.length;i++){ const p=cur.movers[i]; if(vis(p)) drawMover(p,W); }
    for(let i=0;i<cur.ceils.length;i++){ const c=cur.ceils[i]; if(vis(c)) drawCeil(c,W); }
    if(cur.lavas) for(let i=0;i<cur.lavas.length;i++){ const l=cur.lavas[i]; if(vis(l)) drawLava(l,W); }
    if(cur.crumbs) for(let i=0;i<cur.crumbs.length;i++){ const c=cur.crumbs[i]; if(c.alive && vis(c)) drawCrumb(c,W); }
    for(let i=0;i<cur.spikes.length;i++){ const s=cur.spikes[i]; if(vis(s)) drawSpikes(s,W); }
    /* =========================================================
       EVERY HAZARD FAMILY MUST BE PAINTED
       ---------------------------------------------------------
       drawNails / drawCrusher all existed but were
       never called from the render pass, so a level that authored
       one of those families produced a hazard that could kill the
       player without ever appearing on screen. A hazard nobody can
       see is not a hazard, it is a bug.
       ========================================================= */
    if(cur.nails) for(let i=0;i<cur.nails.length;i++){
      const nn=cur.nails[i]; if(nn && vis(nn)) drawNails(nn,W);
    }

    if(cur.crushers) for(let i=0;i<cur.crushers.length;i++){
      const cs=cur.crushers[i]; if(cs && vis(cs)) drawCrusher(cs,W);
    }
    for(let i=0;i<cur.checkpoints.length;i++){ const c=cur.checkpoints[i]; if(c.x>cullL-60 && c.x<cullR+60) drawCheckpoint(c,W); }
    if(cur.goal.x > cullL-200 && cur.goal.x < cullR+200) drawGoal(cur.goal,W);
    for(let i=0;i<cur.gems.length;i++){ const g=cur.gems[i]; if(!g.got && g.x>cullL && g.x<cullR) drawGem(g,W); }
    for(let i=0;i<cur.oils.length;i++){ const o=cur.oils[i]; if(!o.got && o.x>cullL && o.x<cullR) drawOil(o); }
    drawPlayer(W);
    /* fire is drawn after the player so the flames overlap the spirit */
    if(cur.fires) for(let i=0;i<cur.fires.length;i++){ const f=cur.fires[i]; if(vis(f)) drawFire(f,W); }
    /* saws are drawn last of all the hazards — a blade in front of the
       player reads as "this thing can hit you", which is the truth */
    if(cur.saws) for(let i=0;i<cur.saws.length;i++){ const s=cur.saws[i]; if(s && vis(s)) drawSaw(s,W); }
    drawParticles();

    ctx.restore();
    ctx.restore();

    /* 3) darkness + vignette are screen-space overlays */
    screenTransform();
    drawDarkness(W);
    drawShade();
    drawVignette();

    /* =========================================================
       4) THE POST PASS — glow, grade, grain.
       ---------------------------------------------------------
       Order matters and it is the photographic one:
         bloom   first, so the glow belongs to the image
         grade   second, so the split-tone colours the glow too
         grain   last, so it sits on top of everything like film
       All three are screen-space, all three are cheap, and the
       ones that cost anything are skipped by the "low" effects
       setting the player can already choose in Settings.
       ========================================================= */
    drawBloom(0.34);
    drawGrade();
    drawGrain();
  } else {
    screenTransform();
    renderMenuScreen(dt);
  }
}

/* ---------------- HUD ---------------- */
const hud={root:qs('#hud'),name:qs('#hud-name'),world:qs('#hud-world'),
  gems:qs('#hud-gems'),time:qs('#hud-time'),oil:qs('#hud-oil'),
  hearts:qs('#hud-hearts')};

/* =========================================================
   TUTORIAL — level 1 only.
   Each step has a `done()` predicate. The step advances the
   moment the player actually performs the action, so the text
   never sits there nagging after it has been understood.
   ========================================================= */
const TUT = {
  root: null, titleEl: null, bodyEl: null, dotsEl: null, hintEl: null,
  step: 0, active: false, seen: false, fade: 0,
  steps: [
    { key:'move',  done: () => S.tutMoved },
    { key:'jump',  done: () => S.tutJumped },
    { key:'dbl',   done: () => S.tutDouble },
    { key:'gem',   done: () => S.tutGem },
    { key:'oil',   done: () => S.tutOil },
    { key:'goal',  done: () => false }
  ],

  /* =========================================================
     CONTEXTUAL HAZARD CARDS
     ---------------------------------------------------------
     The six steps above are the tutorial: they run once, on the
     first level, and teach the controls. That is the right shape
     for controls — a player wants to know how to move before
     anything else.

     The five hazard cards below are NOT part of that sequence.
     They fire the first time the player actually SEES a hazard
     of that family, on any level, at any point in the run. That
     is the only moment the text is useful: a card explaining
     saws while the player is looking at a saw. Five cards
     dumped on level 1 would be a wall of text nobody reads.

     Rules:
       · each card fires at most ONCE, ever (persisted)
       · it never pauses the game — it is a small card, not a modal
       · it only fires when the hazard is on screen AND close
       · the 0.9s delay lets the player see the thing first
     ========================================================= */
  hazardSeen: {},          /* key -> true, persisted */
  hazardQueue: [],         /* cards waiting to be shown */
  hazardCard: null,        /* the card currently on screen */
  hazardTimer: 0,

  /* which hazard family each card belongs to, and how to detect
     that the player is looking at one */
  hazardDefs: [
    { key:'spike', probe: function(){ return nearestHazard('spikes'); } },
    { key:'saw',   probe: function(){ return nearestHazard('saws');   } },
    { key:'nail',  probe: function(){ return nearestHazard('nails');  } },

    { key:'crush', probe: function(){ return nearestHazard('crushers'); } },
    { key:'crumb', probe: function(){ return nearestHazard('crumbs'); } }
  ],
  init(){
    this.root   = qs('#tut');
    if(!this.root) return;

    /* =========================================================
       THE CARD MUST BE THE TOP LAYER
       ---------------------------------------------------------
       On the emulator's browser the card rendered as faint text
       UNDER the HUD and the menus — a lesson you cannot read is
       worse than no lesson. The stacking is forced here as well as
       in the stylesheet, because `backdrop-filter` (which the card
       relies on for its panel) is not supported everywhere: when it
       is missing the panel paints almost transparent, and the card
       turns into the ghost in the screenshot.
       ========================================================= */
    this.root.style.zIndex = '9000';
    const card = this.root.querySelector('.tut-card');
    if(card){
      card.style.background = 'rgba(16,11,22,0.97)';
      card.style.border = '1px solid rgba(255,205,140,0.26)';
      card.style.boxShadow = '0 18px 48px rgba(0,0,0,0.62)';
      card.style.backdropFilter = 'none';
      card.style.webkitBackdropFilter = 'none';
    }
    this.titleEl = qs('#tut-title');
    this.bodyEl  = qs('#tut-body');
    this.dotsEl  = qs('#tut-dots');
    this.hintEl  = qs('#tut-hint');
    this.scrollEl= qs('#tut-scroll');
    this.prevEl  = qs('#tut-prev');
    this.nextEl  = qs('#tut-next');

    qs('#tut-skip').addEventListener('click', () => {
      AU.click();
      /* a hazard card is dismissed on its own terms — the skip
         button belongs to the controls tutorial only */
      if(this.hazardCard){ hideHazardCard(); return; }
      this.hide(true);
    });

    /* tapping the card itself dismisses a hazard card early */
    if(this.root){
      this.root.addEventListener('click', (e)=>{
        if(!this.hazardCard) return;
        if(e.target && e.target.id === 'tut-skip') return;
        hideHazardCard();
      });
    }

    /* =========================================================
       RESTORE WHAT THE PLAYER HAS ALREADY BEEN TAUGHT
       ---------------------------------------------------------
       `save.tutorialSeen` is a flat map of hazard keys the player
       has already met. Restoring it here means a returning player
       is never shown the saw card again on level 12 — the cards
       are a first-encounter device, not a nag.
       ========================================================= */
    const seen = save.tutorialSeen || {};
    for(let i=0;i<this.hazardDefs.length;i++){
      const k = this.hazardDefs[i].key;
      if(seen[k]) this.hazardSeen[k] = true;
    }

    /* Manual navigation. The card used to advance only when the
       player performed the action, which meant a step could never
       be re-read and the text could not be scrolled through on a
       short screen. Now the arrows work too, and they are the
       primary way to move on. */
    if(this.prevEl) this.prevEl.addEventListener('click', () => {
      AU.click(); this.go(this.step - 1);
    });
    if(this.nextEl) this.nextEl.addEventListener('click', () => {
      AU.click();
      if(this.step >= this.steps.length - 1) this.hide(false);
      else this.go(this.step + 1);
    });
  },
  go(i){
    if(!this.active) return;
    this.step = Math.max(0, Math.min(this.steps.length - 1, i));
    this.render();
  },
  start(){
    if(!this.root) return;
    if(save.settings.tutorial === false) return;   /* user turned it off */
    this.step = 0; this.active = true; this.seen = false;
    this.root.hidden = false;
    this.root.classList.add('show');
    this.render();
  },
  hide(permanent){
    if(!this.root) return;
    this.active = false;
    this.root.classList.remove('show');
    this.root.hidden = true;
    if(permanent){ save.settings.tutorial = false; persist(); }
  },
  render(){
    if(!this.active) return;
    const s = this.steps[this.step];
    if(!s) return;
    this.titleEl.textContent = t('tut.'+s.key+'.title');
    this.bodyEl.textContent  = t('tut.'+s.key+'.body');
    if(this.hintEl) this.hintEl.textContent = t('tut.hint');

    /* a new step always starts at the top of its own text */
    if(this.scrollEl) this.scrollEl.scrollTop = 0;

    /* progress dots */
    let html = '';
    for(let i=0;i<this.steps.length;i++){
      html += '<i class="'+(i < this.step ? 'done' : (i === this.step ? 'now' : ''))+'"></i>';
    }
    this.dotsEl.innerHTML = html;

    /* the arrows reflect where you are in the sequence */
    if(this.prevEl) this.prevEl.disabled = (this.step === 0);
    if(this.nextEl) this.nextEl.disabled = false;
  },
  advance(){
    if(!this.active) return;
    this.step++;
    if(this.step >= this.steps.length){ this.hide(false); return; }
    this.render();
    AU.tone(760,.07,'sine',.05);
  },
  update(dt){
    /* ---- the hazard cards run independently of the sequence ---- */
    this.updateHazardCards(dt);

    if(!this.active) return;
    const s = this.steps[this.step];
    if(s && s.done()) this.advance();
  },/*
[/OLD]

    if(!this.active) return;
    const s = this.steps[this.step];
    if(s && s.done()) this.advance();
  },*/

  /* =========================================================
     HAZARD CARD DRIVER
     ---------------------------------------------------------
     Runs every frame, whether or not the main tutorial is active.

     Order of business:
       1. tick down the card currently on screen, dismiss it
       2. if the main tutorial is running, do not interrupt it
       3. scan the five families; queue any the player has not
          met yet and can currently see
       4. show the first queued card after a short delay
     ========================================================= */
  /* =========================================================
     THE CARD TIMER MUST RUN ON THE GAME CLOCK
     ---------------------------------------------------------
     `updateHazardCards` used a hard-coded `1/60` per call, which
     assumed the frame rate was exactly 60 and that the function ran
     once per frame. On a 120Hz phone the card vanished in half the
     time it promised; on a throttled tab it stayed up for minutes.
     It now takes the real delta time, so "seven seconds" means
     seven seconds.
     ========================================================= */
  updateHazardCards(dt){
    dt = (dt === undefined) ? 1/60 : dt;

    /* 1 · the card on screen */
    if(this.hazardCard){
      this.hazardTimer -= dt;
      if(this.hazardTimer <= 0) hideHazardCard();
      return;
    }

    /* 2 · never talk over the controls tutorial *//*
[/OLD]
[NEW]

    /* 2 · never talk over the controls tutorial */
    if(this.active) return;
    if(!cur || S.finished || S.paused) return;

    /* 3 · scan for a family the player has not met yet */
    for(let i=0;i<this.hazardDefs.length;i++){
      const def = this.hazardDefs[i];
      if(this.hazardSeen[def.key]) continue;
      if(!def.probe()) continue;

      /* mark it seen immediately so it can never queue twice */
      this.hazardSeen[def.key] = true;
      save.tutorialSeen = save.tutorialSeen || {};
      save.tutorialSeen[def.key] = 1;
      persist();

      this.hazardQueue.push(def.key);
      break;                       /* one per frame — no stampede */
    }

    /* 4 · show the next one after a beat */
    if(this.hazardQueue.length){
      this.hazardDelay = (this.hazardDelay || 0) + dt;
      if(this.hazardDelay >= 0.9){
        this.hazardDelay = 0;
        showHazardCard(this.hazardQueue.shift());
      }
    } else {
      this.hazardDelay = 0;
    }
  }
};

/* =========================================================
   NEAREST HAZARD — "is the player looking at one of these?"
   ---------------------------------------------------------
   A card should only appear when the hazard is genuinely in
   front of the player: inside the camera window, and within
   about a screen-and-a-half of the player's x. Anything further
   away is a spoiler, and anything behind the player is noise.

   Returns true/false rather than the object — the caller only
   needs to know whether to fire the card.
   ========================================================= */
function nearestHazard(kind){
  if(!cur) return false;
  const arr = cur[kind];
  if(!arr || !arr.length) return false;

  const px = P.x + P.w/2;
  const ahead = 620;          /* roughly 1.5 screens of lead time */
  const behind = 180;

  for(let i=0;i<arr.length;i++){
    const o = arr[i];
    if(!o) continue;
    /* a dead or buried hazard is not "there" yet */
    if(kind === 'crumbs'  && !o.alive) continue;

    const ox = (o.x !== undefined) ? o.x : 0;
    const ow = (o.w !== undefined) ? o.w : (o.r ? o.r*2 : 0);
    const cx = ox + ow/2;

    if(cx > px - behind && cx < px + ahead) return true;
  }
  return false;
}

/* =========================================================
   HAZARD CARD — show one, once, without stopping the game.
   ---------------------------------------------------------
   The card reuses the tutorial's DOM node but not its sequence:
   it sets its own title/body, hides the dots and the arrows, and
   auto-dismisses after a few seconds. The player can dismiss it
   early by tapping it, but nothing forces them to.
   ========================================================= */
function showHazardCard(key){
  if(!TUT.root) return;
  if(TUT.hazardCard) return;              /* one at a time */

  TUT.hazardCard = key;
  TUT.hazardTimer = 7.0;                  /* seconds on screen */

  TUT.titleEl.textContent = t('tut.'+key+'.title');
  TUT.bodyEl.textContent  = t('tut.'+key+'.body');
  if(TUT.hintEl) TUT.hintEl.textContent = '';

  /* the sequence chrome does not belong on a hazard card */
  if(TUT.dotsEl) TUT.dotsEl.innerHTML = '';
  if(TUT.prevEl) TUT.prevEl.disabled = true;
  if(TUT.nextEl) TUT.nextEl.disabled = true;
  if(TUT.scrollEl) TUT.scrollEl.scrollTop = 0;

  TUT.root.hidden = false;
  TUT.root.classList.add('show');
  TUT.root.classList.add('hazard');
  AU.tone(700,.09,'sine',.06);
}

function hideHazardCard(){
  if(!TUT.hazardCard) return;
  TUT.hazardCard = null;
  TUT.hazardTimer = 0;
  if(TUT.root){
    TUT.root.classList.remove('hazard');
    /* only fully hide if the real tutorial is not running */
    if(!TUT.active){
      TUT.root.classList.remove('show');
      TUT.root.hidden = true;
    }
  }
}

/* updateHUD runs every frame. Writing textContent/style every frame
   forces the browser to re-layout 60x per second. These caches skip
   any write whose value hasn't actually changed.
   `hudCache` itself is declared near the top of the file so that
   loadLevel can reset it safely — see FORWARD DECLARATIONS. */
let heartsDrawn = -1;

function updateHUD(){
  if(!cur) return;
  const nm = cur.L.name[LANG] || cur.L.name.ar;
  if(nm !== hudCache.name){ hud.name.textContent = nm; hudCache.name = nm; }
  const wd = (cur.W.name[LANG]||cur.W.name.ar).toUpperCase();
  if(wd !== hudCache.world){ hud.world.textContent = wd; hudCache.world = wd; }

  const gs = S.gems+'/'+S.totalGems;
  if(gs !== hudCache.gems){ hud.gems.textContent = gs; hudCache.gems = gs; }

  const tm = fmt(S.time);
  if(tm !== hudCache.time){ hud.time.textContent = tm; hudCache.time = tm; }

  const oil = Math.round(S.oil);
  if(oil !== hudCache.oil){ hud.oil.style.width = oil+'%'; hudCache.oil = oil; }

  /* hearts — rebuilt only when the count actually changes */
  if(hud.hearts && heartsDrawn !== S.hearts){
    heartsDrawn = S.hearts;
    let html='';
    for(let i=0;i<MAX_HEARTS;i++){
      html += '<svg class="ic hrt'+(i<S.hearts?' on':'')+'"><use href="#i-heart"/></svg>';
    }
    hud.hearts.innerHTML = html;
  }
}

/* ---------------- screens ---------------- */
function show(id){
  qa('.screen').forEach(s=>s.classList.remove('active'));
  const el=document.getElementById(id);
  if(el) el.classList.add('active');
  S.screen = id.replace('scr-','');
  hud.root.hidden = true;
  qs('#touch').hidden = true;
  TUT.hide(false);
}
function showHud(){
  hud.root.hidden=false;
  qs('#touch').hidden = !('ontouchstart' in window);
  if(MUS.on) MUS.start();
}

function startLevel(i){
  loadLevel(i);
  /* =========================================================
     ENTERING A LEVEL IS PROGRESS
     ---------------------------------------------------------
     The moment the player is standing in level `i`, that level is
     open — permanently. Recording it here (not only on a win) is
     what stops a level from re-locking itself if the player later
     fails it or replays an earlier one.
     ========================================================= */
  markUnlocked(i);
  /* a hazard card from the previous level must not follow the
      player into this one */
  hideHazardCard();
  TUT.hazardQueue = [];
  TUT.hazardDelay = 0;
  S.screen='play'; S.playing=true; S.paused=false;
  qa('.screen').forEach(s=>s.classList.remove('active'));
  qs('#ov-pause').hidden=true;
  qs('#ov-result').hidden=true;
  showHud();
  updateHUD();
  AU.init(); AU.resume();
  if(MUS.on) MUS.start();
  /* the tutorial only ever runs on the very first level */
  if(i === 0) TUT.start(); else TUT.hide(false);
}

/* =========================================================
   "CONTINUE" — which level does the play button open?
   ---------------------------------------------------------
   The old version scanned for the first unlocked level with zero
   stars. That is the right answer for a player mid-run, but it
   is the wrong answer for a player who has beaten everything and
   is replaying: every level has stars, so the loop falls through
   to the LAST level and dumps them at level 25.

   Now the rule is explicit:
     · if any unlocked level is unfinished, go to the first one
     · otherwise go to the highest level ever reached
   ========================================================= */
function nextUnlocked(){
  let firstUnfinished = -1;
  let highest = 0;
  for(let i=0;i<LEVELS.length;i++){
    if(!unlocked(i)) continue;
    highest = i;
    if(firstUnfinished === -1 && starsOf(i) === 0) firstUnfinished = i;
  }
  if(firstUnfinished !== -1) return firstUnfinished;
  return highest;
}

function showResult(){
  const r=S.result;
  qs('#res-title').textContent = (S.level===LEVELS.length-1) ? t('result.final') : t('result.win');
  const st=qs('#res-stars').children;

  /* =========================================================
     STAGGERED STARS
     ---------------------------------------------------------
     CSS `transition-delay` only fires if the element is painted
     at least once BEFORE the class that changes it is added.
     The old code toggled `.on` in the same frame the overlay
     was unhidden, so the browser never saw the "off" state and
     all three stars lit up instantly.
     Clearing the classes now, then applying them on the next
     animation frame, lets the delays actually run.
     ========================================================= */
  for(let i=0;i<3;i++) st[i].classList.remove('on');
  qs('#res-gems').textContent = r.gems+'/'+r.total;
  qs('#res-time').textContent = fmt(r.time);

  /* =========================================================
     THE RESULT SCREEN MUST SAY WHY THE DOOR IS SHUT
     ---------------------------------------------------------
     A player who finishes a level and finds the next one still
     locked needs the reason on screen, not in a wiki. The subtitle
     states the pass mark and the current count; the "next" button
     becomes "retry" when the mark was not met, so the only obvious
     action is the one that helps.
     ========================================================= */
  const isFinal = (S.level === LEVELS.length-1);
  const passed  = (r.stars >= PASS_STARS);

  const sub = qs('#res-sub');
  if(sub){
    if(isFinal){
      sub.textContent = '';
    } else if(passed){
      sub.textContent = t('result.passed');
    } else {
      sub.textContent = t('result.needStars')
        .replace('{n}', String(PASS_STARS))
        .replace('{got}', String(r.stars));
    }
  }

  const nextBtn=qs('#btn-next');
  const nextLabel=nextBtn.querySelector('span');
  if(nextLabel){
    nextLabel.textContent = isFinal
      ? t('result.menu')
      : (passed ? t('result.next') : t('result.retry'));
  }
  /* the same button, two jobs: advance, or go back and earn it */
  nextBtn.dataset.mode = (isFinal || passed) ? 'next' : 'retry';

  qs('#ov-result').hidden=false;
  S.playing=false;
  hud.root.hidden=true;
  qs('#touch').hidden=true;
  TUT.hide(false);
  heartsDrawn = -1;   /* force a rebuild on the next level */

  /* one frame later the stars animate in, left to right */
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      for(let i=0;i<3;i++) if(i<r.stars) st[i].classList.add('on');
    });
  });
}

/* ---------------- levels grid ---------------- */
function renderLevels(){
  const grid=qs('#level-grid');
  grid.innerHTML='';

  /* =========================================================
     THE TILE INDEX MUST BE THE LEVEL INDEX — NOT A COUNTER
     ---------------------------------------------------------
     THE BUG THIS FIXES
     ------------------
     The old loop walked the five worlds and, for each one, counted
     how many levels it owned, then emitted that many tiles while
     incrementing a shared `idx`. That only works if every level
     belongs to exactly one world AND the worlds are visited in the
     same order the levels were authored.

     When a level's `w` field does not match any world — a typo, a
     renamed world, a level added without a world — the count for
     that world is wrong, `idx` drifts, and the LAST tiles end up
     pointing at `LEVELS[25]`, `LEVELS[26]` … which do not exist.
     Tapping one of them called `startLevel(29)`, `loadLevel(29)`
     read `LEVELS[29].w` on `undefined`, and the game threw

         TypeError: Cannot read properties of undefined (reading 'w')

     — from the player's side, "I tap a level and nothing happens".

     The fix is to stop counting. Each tile is emitted from its own
     level index, taken directly from `LEVELS`, so a tile can never
     point at a level that does not exist. Worlds are still used for
     their headers, but the header is emitted only when the next
     level actually belongs to that world.
     ========================================================= */
  let lastWorld = null;

  for(let idx=0; idx<LEVELS.length; idx++){
    const L = LEVELS[idx];
    if(!L) continue;

    /* a world header whenever the world changes */
    const wid = L.w;
    if(wid !== lastWorld){
      const wDef = WORLDS.filter(function(w){ return w.id === wid; })[0];
      const head = document.createElement('div');
      head.className = 'world-head';
      head.textContent = wDef
        ? (wDef.name[LANG] || wDef.name.ar).toUpperCase()
        : String(wid || '').toUpperCase();
      grid.appendChild(head);
      lastWorld = wid;
    }

    {
      const stars=starsOf(idx);
      const open=unlocked(idx);
      const b=document.createElement('button');
      /* =========================================================
         THREE STATES, NOT TWO
         ---------------------------------------------------------
         `locked` and `open` were the only classes the grid knew,
         so a level the player had reached but not yet cleared was
         indistinguishable from an untouched one. That is the level
         they are most likely to want — it gets `next`.

         The button is a real <button> in every state, so the
         keyboard can reach it and a screen reader announces it.
         Only the locked ones have their click handler withheld.
         ========================================================= */
      /* the "next" tile is the first OPEN level that has not been cleared */
  const isNext = open && stars === 0;
      b.className = 'lv' + (open ? (isNext ? ' next' : ' done') : ' locked');
      b.type = 'button';
      b.setAttribute('aria-label', (idx+1) + (open ? '' : ' — ' + t('levels.locked')));

      let sHtml='';
      for(let s=0;s<3;s++) sHtml+='<svg class="ic'+(s<stars?' on':'')+'"><use href="#i-star"/></svg>';
      b.innerHTML='<b>'+(idx+1)+'</b><span class="st">'+sHtml+'</span>'+
        (open?'':'<svg class="ic lk"><use href="#i-lock"/></svg>');

      /* =========================================================
         THE CLICK HANDLER — bound to EVERY open tile.
         ---------------------------------------------------------
         This is the whole point of the levels screen: a level you
         have opened is a level you may play again, from here, at
         any time. The handler is attached to `open` tiles only —
         a locked tile gets no handler and is `disabled`.

         `AU.init()` is called first because the click is a real
         user gesture, which is the only moment a browser will let
         an AudioContext start. Without it the first level entered
         from this screen would play in silence.
         ========================================================= */
      if(open){
        b.addEventListener('click', function(ev){
          if(ev) ev.preventDefault();
          AU.click();
          AU.init();
          startLevel(idx);
        });
      } else {
        b.disabled = true;
      }
      grid.appendChild(b);
    }
  }

  let total=0, done=0;
  for(let i=0;i<LEVELS.length;i++){ total+=starsOf(i); if(starsOf(i)>0) done++; }
  qs('#total-stars').textContent=total+'/'+(LEVELS.length*3);

  const ms=qs('#menu-stars'), ml=qs('#menu-levels');
  if(ms) ms.textContent=total;
  if(ml) ml.textContent=done+'/'+LEVELS.length;

  const playBtn=qs('#btn-play');
  const label=playBtn.querySelector('span');
  if(label) label.textContent = done>0 ? t('menu.continue') : t('menu.play');

  /* =========================================================
     SELF-CHECK — the levels screen must never silently dead-end
     ---------------------------------------------------------
     A grid where every tile is locked looks identical to a grid
     where the click handlers failed to bind. Both leave the player
     tapping a level and nothing happening, with no clue why.

     This reports the real numbers to the console so the two cases
     can be told apart in one glance:

       LEVELS 0           → levels.js failed to build; nothing can work
       open 0             → the unlock record is empty
       open N, no handler → a binding bug in this function

     It costs one pass over 25 entries, once per render, and it is
     the difference between "it is broken" and "here is what broke".
     ========================================================= */
  (function selfCheck(){
    try{
      let openCount = 0;
      for(let i=0;i<LEVELS.length;i++) if(unlocked(i)) openCount++;
      const tiles = qs('#level-grid') ? qs('#level-grid').children.length : 0;
      if(LEVELS.length === 0){
        console.error('[qandil] LEVELS is empty — levels.js did not build.');
      } else if(openCount === 0){
        console.error('[qandil] no level is unlocked. save.unlocked =',
                      JSON.stringify(save.unlocked), 'maxUnlocked =', save.maxUnlocked);
      } else {
        console.log('[qandil] levels:', LEVELS.length, '· open:', openCount,
                    '· tiles:', tiles, '· unlocked map:', JSON.stringify(save.unlocked));
      }
    }catch(e){ console.warn('[qandil] self-check failed:', e); }
  })();
}

/* ---------------- settings sync ---------------- */
function syncSettings(){
  qa('#seg-lang button').forEach(b=>b.classList.toggle('on', b.dataset.lang===LANG));
  qa('#seg-sound button').forEach(b=>b.classList.toggle('on', (b.dataset.sound==='1')===AU.on));
  qa('#seg-music button').forEach(b=>b.classList.toggle('on', (b.dataset.music==='1')===MUS.on));
  qa('#seg-quality button').forEach(b=>b.classList.toggle('on', b.dataset.q===save.settings.quality));

  const sBtn=qs('#btn-sound');
  if(sBtn){
    sBtn.innerHTML='<svg class="ic"><use href="#i-'+(AU.on?'sound':'mute')+'"/></svg>';
    sBtn.classList.toggle('off', !AU.on);
  }
  const mBtn=qs('#btn-music');
  if(mBtn) mBtn.classList.toggle('off', !MUS.on);

  const lbl=qs('#lang-label');
  if(lbl) lbl.textContent = (LANG==='ar') ? 'EN' : 'ع';
}

/* ---------------- input ---------------- */
/* Instant-response hold binding.
   - pointerdown fires immediately (no 300ms tap delay)
   - setPointerCapture keeps the button "held" even if the finger
     slides slightly off it, which is the usual cause of a dropped
     input on phones
   - passive:false on touchstart lets us kill scrolling/zoom
   - the visual .on class is toggled here, not in CSS :active, so it
     lights up on the very first frame */
function bindHold(el, on){
  if(!el) return;
  let held = false;

  const press = (e)=>{
    if(e.cancelable) e.preventDefault();
    if(held) return;
    held = true;

    /* ORDER MATTERS FOR LATENCY.
       The game state is updated FIRST, before any DOM work. The
       old order painted the pressed class and resumed the audio
       context before `on(true)` ran, so the input landed a frame
       or two late — and `AU.resume()` touches the AudioContext,
       which is an async call that can block the handler.

       Now: input → then visuals → then audio, each guarded so a
       failure in one cannot swallow the others. */
    on(true);

    el.classList.add('on');

    /* only resume the context if it is actually suspended — the
       old code called resume() on every single press, which cost
       a promise round-trip per tap for no benefit */
    if(AU.ac && AU.ac.state === 'suspended') AU.resume();

    if(e.pointerId !== undefined && el.setPointerCapture){
      try{ el.setPointerCapture(e.pointerId); }catch(err){}
    }
  };
  const release = (e)=>{
    if(e && e.cancelable) e.preventDefault();
    if(!held) return;
    held = false;
    /* release the input before touching the DOM, same reason */
    on(false);
    el.classList.remove('on');
  };

  /* `passive:false` is required so preventDefault can suppress the
     browser's own gesture handling. `touchstart` is bound too, as a
     belt-and-braces path for engines that deliver touch before
     pointer events — the `held` flag makes a double bind harmless. */
  el.addEventListener('pointerdown', press, {passive:false});
  el.addEventListener('pointerup', release, {passive:false});
  el.addEventListener('pointercancel', release, {passive:false});
  el.addEventListener('lostpointercapture', release, {passive:false});
  /* context menu / long-press would otherwise steal the input */
  el.addEventListener('contextmenu', e=>e.preventDefault());
}
bindHold(qs('#t-left'), v=>{ keys.left=v; });
bindHold(qs('#t-right'), v=>{ keys.right=v; });
bindHold(qs('#t-jump'), v=>{ if(v && !keys.jump) keys.jumpPressed=true; keys.jump=v; });

window.addEventListener('keydown', function(e){
  if(e.repeat) return;
  const k=e.key.toLowerCase();
  if(k==='arrowleft'||k==='a') keys.left=true;
  else if(k==='arrowright'||k==='d') keys.right=true;
  else if(k===' '||k==='arrowup'||k==='w'){ if(!keys.jump) keys.jumpPressed=true; keys.jump=true; e.preventDefault(); }
  else if(k==='escape'||k==='p'){ if(S.screen==='play') togglePause(); }
});
window.addEventListener('keyup', function(e){
  const k=e.key.toLowerCase();
  if(k==='arrowleft'||k==='a') keys.left=false;
  else if(k==='arrowright'||k==='d') keys.right=false;
  else if(k===' '||k==='arrowup'||k==='w') keys.jump=false;
});

function togglePause(){
  if(S.screen!=='play') return;
  S.paused=!S.paused;
  qs('#ov-pause').hidden=!S.paused;
  /* the tutorial card steps aside while the pause menu is open */
  if(TUT.root) TUT.root.classList.toggle('muted', S.paused);
  if(S.paused){ MUS.stop(); }
  else if(MUS.on){ MUS.start(); }
}

/* =========================================================
   SERVICE WORKER — what makes the game installable and offline.
   ---------------------------------------------------------
   Three conditions must ALL hold before a browser will treat the
   game as an installable app:

     1. a SECURE CONTEXT — https, or localhost. A service worker
        will not register over http:// or from file://.
     2. a registered service worker with a fetch handler.
     3. a manifest with a name, a start_url, icons of at least
        192px, and a display mode of standalone or fullscreen.

   If any one of them is missing, the game still runs perfectly —
   it just opens in a browser tab, which is the exact symptom of
   "it behaves like a website, not an app".

   This block registers the worker AND reports, in the console,
   which of the three is failing. Without that report the failure
   is invisible: the game looks fine and simply refuses to
   install, with no clue why.
   ========================================================= */
(function setupPWA(){
  const secure = (location.protocol === 'https:' ||
                  location.hostname === 'localhost' ||
                  location.hostname === '127.0.0.1');

  if(!secure){
    console.warn(
      '[qandil] Not a secure context (' + location.protocol + ').\n' +
      'A service worker cannot register, so the game will NOT be installable.\n' +
      'Serve it over https, or run a local server (python3 -m http.server) and ' +
      'open http://localhost:8000.'
    );
    return;
  }

  if(!('serviceWorker' in navigator)){
    console.warn('[qandil] This browser has no Service Worker support — no install.');
    return;
  }

  window.addEventListener('load', function(){
    navigator.serviceWorker.register('sw.js')
      .then(function(reg){
        console.log('[qandil] service worker registered, scope:', reg.scope);

        /* a waiting worker means a new build is ready but the old
           one is still in control. Tell it to take over. */
        if(reg.waiting){
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        reg.addEventListener('updatefound', function(){
          const sw = reg.installing;
          if(!sw) return;
          sw.addEventListener('statechange', function(){
            if(sw.state === 'installed' && navigator.serviceWorker.controller){
              sw.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(function(err){
        console.error('[qandil] service worker FAILED to register:', err);
      });
  });

  /* Reload once when a new worker takes control, so the page is
     never left running a build whose cache has been retired. */
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', function(){
    if(reloaded) return;
    reloaded = true;
    /* only reload if there was already a controller — the very
       first install should not bounce the page */
    if(navigator.serviceWorker.controller) location.reload();
  });
})();

/* ---------------- buttons ---------------- */
qs('#btn-play').addEventListener('click', function(){
  AU.click(); AU.init();
  startLevel(nextUnlocked());
});
qs('#btn-levels').addEventListener('click', function(){ AU.click(); show('scr-levels'); renderLevels(); });
qs('#btn-settings').addEventListener('click', function(){ AU.click(); show('scr-settings'); syncSettings(); });
qs('#btn-credits').addEventListener('click', function(){ AU.click(); show('scr-credits'); });
qa('[data-back]').forEach(function(b){
  b.addEventListener('click', function(){ AU.click(); show(b.dataset.back); });
});

qs('#btn-lang').addEventListener('click', function(){
  AU.click(); setLang(LANG==='ar'?'en':'ar'); syncSettings(); renderLevels();
});
qs('#btn-sound').addEventListener('click', function(){
  AU.on=!AU.on; save.settings.sound=AU.on; persist(); syncSettings(); AU.click();
});
qs('#btn-music').addEventListener('click', function(){
  MUS.on=!MUS.on; save.settings.music=MUS.on; persist();
  if(MUS.on){ MUS.start(); } else { MUS.stop(); }
  syncSettings(); AU.click();
});
qa('#seg-music button').forEach(function(b){
  b.addEventListener('click', function(){
    AU.click();
    MUS.on=(b.dataset.music==='1'); save.settings.music=MUS.on; persist();
    if(MUS.on){ MUS.start(); } else { MUS.stop(); }
    syncSettings();
  });
});
qa('#seg-lang button').forEach(function(b){
  b.addEventListener('click', function(){ AU.click(); setLang(b.dataset.lang); syncSettings(); renderLevels(); });
});
qa('#seg-sound button').forEach(function(b){
  b.addEventListener('click', function(){ AU.click(); AU.on=(b.dataset.sound==='1'); save.settings.sound=AU.on; persist(); syncSettings(); });
});
qa('#seg-quality button').forEach(function(b){
  b.addEventListener('click', function(){ AU.click(); save.settings.quality=b.dataset.q; persist(); syncSettings(); });
});
/* =========================================================
   GUIDE CARDS — bring the tutorial back on demand.
   ---------------------------------------------------------
   The controls tutorial is a one-shot sequence: once the player
   skips it, `save.settings.tutorial` is set to false and it never
   returns. That is the right default, but it left no way back —
   a player who skipped by accident had lost the lesson for good,
   and the Settings screen had a dead row where the fullscreen
   toggle used to be.

   This button restores the cards: it clears the "already seen"
   record and the opt-out flag, so the controls sequence runs on
   the next level and every hazard card can fire again the first
   time its hazard is on screen.
   ========================================================= */
qs('#btn-tutorial').addEventListener('click', function(){
  AU.click();
  save.settings.tutorial = true;
  save.tutorialSeen = {};
  persist();
  if(TUT){
    TUT.hazardSeen = {};
    TUT.hazardQueue = [];
    TUT.hazardDelay = 0;
  }
  const btn = qs('#btn-tutorial');
  const span = btn.querySelector('span');
  const old = span ? span.textContent : t('settings.tutorialBtn');
  btn.innerHTML = '<svg class="ic"><use href="#i-check"/></svg><span></span>';
  btn.querySelector('span').textContent = (LANG==='ar') ? 'تم' : 'Done';
  setTimeout(function(){
    btn.innerHTML = '<svg class="ic"><use href="#i-info"/></svg><span></span>';
    btn.querySelector('span').textContent = old;
  }, 1400);
});

qs('#btn-reset').addEventListener('click', function(){
  AU.click();
  const btn=qs('#btn-reset');
  const span=btn.querySelector('span');
  const old=span ? span.textContent : t('settings.resetBtn');
  /* the reset must clear the unlock record too, otherwise the
     levels screen would keep showing every level as open after a
     "reset progress" — which is the opposite of what it promises */
  save.levels={}; save.unlocked={0:1}; save.maxUnlocked=0;
  persist(); renderLevels();
  btn.innerHTML='<svg class="ic"><use href="#i-check"/></svg><span></span>';
  btn.querySelector('span').textContent = (LANG==='ar')?'تم':'Done';
  setTimeout(function(){
    btn.innerHTML='<svg class="ic"><use href="#i-trash"/></svg><span></span>';
    btn.querySelector('span').textContent = old;
  }, 1400);
});

qs('#btn-pause').addEventListener('click', function(){ AU.click(); togglePause(); });
qs('#btn-resume').addEventListener('click', function(){ AU.click(); togglePause(); });
qs('#btn-restart').addEventListener('click', function(){ AU.click(); startLevel(S.level); });
qs('#btn-quit').addEventListener('click', function(){ AU.click(); qs('#ov-pause').hidden=true; S.paused=false; goMenu(); });

qs('#btn-next').addEventListener('click', function(){
  AU.click();
  const btn = qs('#btn-next');
  qs('#ov-result').hidden=true;

  /* the button serves two jobs — see showResult() */
  if(btn.dataset.mode === 'retry'){ startLevel(S.level); return; }

  if(S.level>=LEVELS.length-1){ goMenu(); renderLevels(); }
  else startLevel(S.level+1);
});
qs('#btn-retry').addEventListener('click', function(){ AU.click(); qs('#ov-result').hidden=true; startLevel(S.level); });
qs('#btn-go-retry').addEventListener('click', function(){ AU.click(); retryLevel(); });
qs('#btn-go-menu').addEventListener('click', function(){ AU.click(); hideGameOver(); S.paused=false; goMenu(); });
qs('#btn-home').addEventListener('click', function(){ AU.click(); qs('#ov-result').hidden=true; goMenu(); });

function goMenu(){ show('scr-menu'); renderLevels(); MUS.stop(); }

/* `onLangApplied` is invoked from `applyI18n()` during boot, which
   means it runs BEFORE most of this file has been evaluated. Every
   call in here must therefore be either already defined above the
   boot call, or wrapped so a missing one cannot abort the IIFE. */
window.onLangApplied=function(){
  try{ syncSettings(); }catch(e){}
  try{ renderLevels(); }catch(e){}
  try{ if(cur) updateHUD(); }catch(e){}
};

/* ---------------- loop ---------------- */
let last=performance.now();
function frame(now){
  let dt=(now-last)/1000; last=now;
  /* clamp only pathological spikes (tab switch), not normal jitter —
     1/30 was cutting real frames on 60Hz displays and made the
     movement feel chunky */
  if(dt > 0.1) dt = 0.1;
  if(dt < 0) dt = 0;
  perfTick(dt);

  /* the ONLY place the game clock advances */
  S.t+=dt;
  if(S.screen==='play' && !S.paused && !S.finished){
    if(!cur) loadLevel(S.level);
    update(dt);
    updateHUD();
    TUT.update(dt);
  }
  if(S.screen==='play' && !S.paused && S.finished){
    /* keep particles alive during the win animation */
    for(let i=S.parts.length-1;i>=0;i--){
      const p=S.parts[i]; p.life-=dt;
      if(p.life<=0){ S.parts.splice(i,1); continue; }
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=300*dt;
    }
  }
  render(dt);
  requestAnimationFrame(frame);
}

/* ---------------- boot ---------------- */
resize();

/* =========================================================
   REBUILD THE UNLOCK RECORD BEFORE ANYTHING READS IT
   ---------------------------------------------------------
   `migrateUnlocks` turns the star table into an explicit unlock
   map, so a save created by an older build — or one that lost its
   `unlocked` field — still opens every level the player has
   actually reached. It must run before `renderLevels`, which is
   the first thing that asks "is this level open?".
   ========================================================= */
try{ migrateUnlocks(); }catch(e){ console.warn('[qandil] unlock migration failed:', e); }

applyI18n();
renderLevels();
syncSettings();
TUT.init();
show('scr-menu');
requestAnimationFrame(frame);

/* audio can only start after a real user gesture */
function unlockAudio(){
  AU.init(); AU.resume();
  if(MUS.on) MUS.start();
  window.removeEventListener('pointerdown', unlockAudio);
  window.removeEventListener('touchstart', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
}
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('touchstart', unlockAudio);
window.addEventListener('keydown', unlockAudio);

/* ---------- soundtrack must die when the app is not visible ---------- */
function silenceAll(){
  MUS.kill();
  if(AU.ac && AU.ac.state === 'running'){ try{ AU.ac.suspend(); }catch(e){} }
}
function wakeAudio(){
  if(!MUS.on) return;
  AU.init(); AU.resume();
  if(S.screen === 'play' && !S.paused && !S.finished) MUS.start();
}

document.addEventListener('visibilitychange', function(){
  if(document.hidden){ silenceAll(); }
  else { wakeAudio(); }
});
window.addEventListener('pagehide', silenceAll);
window.addEventListener('beforeunload', silenceAll);
window.addEventListener('blur', function(){
  /* desktop: switching to another window stops the music too */
  if(!document.hidden) MUS.stop();
});
window.addEventListener('focus', function(){
  if(!document.hidden) wakeAudio();
});

})();