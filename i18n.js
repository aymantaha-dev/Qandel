/* =========================================================
   QANDEL — internationalisation
   ---------------------------------------------------------
   Two flat key/value tables, one per language, and three
   small functions:

     t(key)         look up a string in the active language
     applyI18n()    walk the DOM and translate every element
                    that carries `data-i18n` or `data-i18n-aria`
     setLang(code)  switch the language, persist the choice,
                    and re-apply

   Arabic is the default. Switching language flips the whole
   layout to RTL — the menu grid, the sheet headers, the level
   grid, the padding sides, the button sheen — because
   `applyI18n` sets `document.documentElement.dir` and the
   stylesheet keys off it.
   ========================================================= */

const I18N = {
  ar: {
    "app.title":"قنديل","app.subtitle":"رحلة النور",
    "menu.play":"ابدأ الرحلة","menu.continue":"أكمل الرحلة","menu.levels":"المراحل",
    "menu.settings":"الإعدادات","menu.credits":"عن اللعبة",
    "menu.stars":"نجمة","menu.levelsDone":"مرحلة",
    "levels.title":"المراحل","levels.locked":"مقفلة",
    "settings.title":"الإعدادات","settings.lang":"اللغة","settings.sound":"المؤثرات الصوتية",
    "settings.music":"الموسيقى",
    "settings.on":"تشغيل","settings.off":"إيقاف","settings.quality":"جودة التأثيرات",
    "settings.high":"عالية","settings.low":"خفيفة","settings.reset":"تصفير التقدّم",
    "settings.resetBtn":"مسح","settings.tutorial":"بطاقة التعليم","settings.tutorialBtn":"إظهار",
    "settings.done":"تم",
    "tut.prev":"السابق","tut.next":"التالي",
    "touch.left":"يسار","touch.right":"يمين","touch.jump":"قفز",
    "pause.title":"توقف مؤقت","pause.resume":"متابعة","pause.restart":"إعادة","pause.menu":"القائمة",
    "result.win":"أحسنت!","result.gems":"الجواهر","result.time":"الوقت",
    "result.next":"المرحلة التالية","result.retry":"إعادة","result.menu":"القائمة",
    "result.passed":"أُنجزت بامتياز — المرحلة التالية مفتوحة.",
    "result.needStars":"تحتاج {n} نجوم لفتح المرحلة التالية. جمعتَ {got} — أعد المحاولة واجمع كل الجواهر.",
    "result.final":"أنهيت الرحلة!",
    "credits.title":"عن اللعبة",
    "credits.body":"قنديل لعبة ألغاز ومنصّات. تلعب بدور روح قنديل صغيرة تعيد النور إلى بيوت مظلمة. اجمع الجواهر، واحفظ زيت قنديلك، وتجنّب الفخاخ حتى تبلغ الباب المضيء.\n\nخمسة عوالم، وخمس وعشرون مرحلة، وثلاث نجوم لكل مرحلة.\n\n── الفخاخ ──\n\n• الأشواك — صفوف حمراء على الأرض، لمسة واحدة تقتلك.\n• النار — ألسنة برتقالية تُشعِل وتنطفئ بإيقاع منتظم؛ اعبر وقت الانطفاء.\n• الحمم — بحيرات برتقالية سائلة لا تنطفئ؛ اعبرها على الحجارة.\n• المنشار — قرص معدني دوّار يتحرك على مسار ثابت أفقيًا أو عموديًا.\n• المسامير — صفوف قصيرة كثيفة، أرضية أو معلّقة من السقف.\n• الحجر الساقط — حجر معلّق في السقف يهوي عند مرورك تحته، ثم يرتفع من جديد؛ الخط المتقطع على الأرض يخبرك بمكان سقوطه.\n• المنصات المتفتتة — تتفتت بعد مدة متفاوتة؛ الشقوق تلمع قبل الانهيار.\n• المنصات المتحركة — تعبر فوق الفراغات؛ تحركها منتظم وقابل للحفظ.\n\nكل فخ يظهر من المرحلة الأولى بشكل بسيط وسهل، ثم تزداد سرعته وعدده وحدّته مع تقدّمك — حتى المرحلة الخامسة والعشرين حيث كل شيء في أقصى حالاته. القواعد لا تتغير أبدًا: كل فخ مرئي قبل أن يقتلك.\n\nصناعة: Trex · Kivode",

    "gameover.title":"نفدت القلوب",
    "gameover.sub":"تعود المرحلة إلى بدايتها، وتُصفَّر الجواهر ونقاط الحفظ.",
    "gameover.retry":"إعادة المرحلة","gameover.menu":"القائمة الرئيسية",
    "gameover.l1":"انطفأ القنديل، لكن الشرارة باقية فيك. حاول مرة أخرى.",
    "gameover.l2":"خمسة قلوب مضت. خسرتَ هذه الجولة، لا المعركة.",
    "gameover.l3":"الطريق طويل وضوؤك قصير. خذ نفسًا وعد أقوى.",
    "gameover.l4":"كل انطفاءة تُعلّمك أين يجب أن يكون النور.",
    "gameover.l5":"لم تبلغ الباب هذه المرة. ما زال ينتظرك.",
    "gameover.l6":"الأشواك لا ترحم، لكنك أذكى منها.",
    "gameover.l7":"نفد الزيت ونفدت القلوب، ولم ينفد العزم.",
    "gameover.l8":"عدتَ إلى البداية، وهي خير مكانٍ تتعلّم منه.",

    "tut.label":"تعليمات","tut.skip":"تخطّي","tut.hint":"تلميح: استخدم أسهم لوحة المفاتيح أو أزرار الشاشة",
    "tut.warning":" · تحذير",
    "tut.move.title":"١ · التحرّك",
    "tut.move.body":"أنت روح القنديل. اضغط السهم الأيمن أو الأيسر — أو أزرار الشاشة — لتسير. القنديل في يدك هو ضوؤك الوحيد، وكلما سِرتَ كشف الضوءُ طريقك.",
    "tut.jump.title":"٢ · القفز",
    "tut.jump.body":"اضغط مسافة (Space) أو السهم الأعلى لتقفز. اضغطها وأنت واقف على الأرض — القفزة من الأرض متاحة دائمًا.",
    "tut.dbl.title":"٣ · القفزة المزدوجة",
    "tut.dbl.body":"وأنت في الهواء، اضغط مسافة مرة أخرى قبل أن تهبط — لديك قفزتان متتاليتان. استخدمها للوصول إلى المنصات العالية، وتتجدد فور لمس الأرض.",
    "tut.gem.title":"٤ · جمع الجواهر",
    "tut.gem.body":"الجواهر المضيئة هي ما يمنحك النجوم — كلما جمعت أكثر، زادت نجومك. اقترب من الجوهرة والمسها.",
    "tut.oil.title":"٥ · الحفاظ على الزيت",
    "tut.oil.body":"زيت القنديل ينفد مع الوقت، وكلما نقص ضاق ضوؤك. التقط قوارير الزيت البرتقالية لاستعادة النور كاملًا.",
    "tut.spike.title":"٦ · الأشواك والنار",
    "tut.spike.body":"الأشواك الحمراء على الأرض تقتلك بلمسة واحدة — اقفز فوقها. النار البرتقالية تُشعِل وتنطفئ بإيقاع منتظم: راقب الإيقاع واعبر في اللحظة التي تنطفئ فيها. الحمم البرتقالية السائلة لا تنطفئ أبدًا — اعبرها على الحجارة فقط.",
    "tut.saw.title":"٧ · المنشار",
    "tut.saw.body":"قرص معدني دوّار يتحرك على مسار ثابت: أفقيًا على الأرض، أو عموديًا صعودًا ونزولًا. حركته منتظمة وقابلة للحفظ — راقب أقصى نقطة يصلها، واعبر بعد أن يمرّ. لا تحاول القفز فوقه وهو قادم نحوك.",
    "tut.nail.title":"٨ · المسامير",
    "tut.nail.body":"صفوف قصيرة كثيفة من المسامير المعدنية اللامعة. النوع الأرضي يُقفز فوقه بسهولة، والنوع المعلّق من السقف يجبرك على البقاء منخفضًا — لا تقفز تحته. لاحظ الفرق: المسامير أنحف وألمع من الأشواك.",
    "tut.crumb.title":"٩ · المنصات المتفتتة",
    "tut.crumb.body":"منصات متشققة تتفتت بعد لحظة قصيرة من الوقوف عليها — والمدة تختلف من منصة لأخرى. الشقوق تلمع برتقاليًا قبل الانهيار: تلك هي إشارتك للقفز. لا تنتظر، فالعدّ يبدأ فور لمس قدمك.",
    "tut.crush.title":"الحجر الساقط",
    "tut.crush.body":"حجر معلّق في السقف يهوي عليك لحظة مرورك تحته، ثم يبقى لحظة، ثم يصعد من جديد. الخط المتقطّع على الأرض يخبرك بمكان سقوطه بالظبط — اعبر بعد أن يرتفع، لا وهو نازل.",
    "tut.goal.title":"١٠ · الوصول إلى الباب",
    "tut.goal.body":"الباب المضيء في نهاية المرحلة هو هدفك. ابلغه قبل نفاد الزيت، واحذر كل ما سبق — لمسة واحدة تعيدك إلى نقطة الحفظ. كل مرحلة تقدم لك فخاخًا أكثر وأسرع، لكن القواعد نفسها لا تتغير."
  },
  en: {
    "app.title":"QANDEL","app.subtitle":"Journey of Light",
    "menu.play":"Begin Journey","menu.continue":"Continue","menu.levels":"Levels",
    "menu.settings":"Settings","menu.credits":"About",
    "menu.stars":"stars","menu.levelsDone":"levels",
    "levels.title":"Levels","levels.locked":"Locked",
    "settings.title":"Settings","settings.lang":"Language","settings.sound":"Sound effects",
    "settings.music":"Music",
    "settings.on":"On","settings.off":"Off","settings.quality":"Effects quality",
    "settings.high":"High","settings.low":"Low","settings.reset":"Reset progress",
    "settings.resetBtn":"Clear","settings.tutorial":"Guide cards","settings.tutorialBtn":"Show",
    "settings.done":"Done",
    "tut.prev":"Previous","tut.next":"Next",
    "touch.left":"Left","touch.right":"Right","touch.jump":"Jump",
    "pause.title":"Paused","pause.resume":"Resume","pause.restart":"Restart","pause.menu":"Menu",
    "result.win":"Well done!","result.gems":"Gems","result.time":"Time",
    "result.next":"Next Level","result.retry":"Retry","result.menu":"Menu",
    "result.passed":"Cleared with honours — the next level is open.",
    "result.needStars":"You need {n} stars to open the next level. You earned {got} — retry and collect every gem.",
    "result.final":"Journey complete!",
    "credits.title":"About",
    "credits.body":"Qandel is a light-driven puzzle platformer. You are a small lantern spirit bringing light back to dark, abandoned houses. Collect gems, keep your lamp oiled, avoid the hazards, and reach the glowing door.\n\nFive worlds, twenty-five levels, three stars each.\n\n── The hazards ──\n\n• Spikes — red rows on the ground; one touch kills.\n• Fire — orange flames that light and die on a steady rhythm; cross while they are out.\n• Lava — molten orange pools that never go out; cross on the stones.\n• Saws — a spinning metal disc on a fixed path, sliding or bobbing.\n• Nails — short dense rows, on the floor or hanging from the ceiling.\n• Falling stones — a stone hangs from the ceiling and drops when you pass under it, then climbs back; the dashed rail on the floor shows where it will land.\n• Fragile platforms — crumble after a variable delay; the cracks glow before they give way.\n• Moving platforms — carry you over voids; their motion is regular and learnable.\n\nEvery hazard appears from the very first level in its simplest form, then gains speed, count and severity as you progress — until level twenty-five, where everything is at its most extreme. The rules never change: every hazard is visible before it can kill you.\n\nMade by Trex · Kivode",

    "gameover.title":"Out of hearts",
    "gameover.sub":"The level restarts from scratch — gems and checkpoints reset",
    "gameover.retry":"Retry level","gameover.menu":"Main menu",
    "gameover.l1":"The lantern went out… but the spark is still in you. Try again.",
    "gameover.l2":"Five hearts gone. Darkness won this round, not the war.",
    "gameover.l3":"Long road, short light. Breathe, then come back stronger.",
    "gameover.l4":"Every time you go dark, you learn where the light should be.",
    "gameover.l5":"You didn't reach the door this time. It's still waiting.",
    "gameover.l6":"Spikes and thorns don't forgive. But you're smarter than them.",
    "gameover.l7":"Oil gone, hearts gone. Resolve isn't.",
    "gameover.l8":"Back to the start… and the start is always the best place to learn.",

    "tut.label":"Guide","tut.skip":"Skip","tut.hint":"Tip: try the arrow keys or the on-screen buttons",
    "tut.warning":" · Warning",
    "tut.move.title":"1 · Move",
    "tut.move.body":"You are a lantern spirit. Press the left or right arrow — or the on-screen buttons — to walk. The lantern in your hand is your only light, and it reveals the path as you go.",
    "tut.jump.title":"2 · Jump",
    "tut.jump.body":"Press Space or the up arrow to jump. Press it while standing on the ground — the ground jump is always available.",
    "tut.dbl.title":"3 · Double jump",
    "tut.dbl.body":"While in the air, press Space again before you land — you get two jumps in a row. Use it to reach high platforms. It refills the moment you touch the ground.",
    "tut.gem.title":"4 · Collect gems",
    "tut.gem.body":"The glowing gems are what earn you stars — the more you collect, the more stars you get. Move close and touch one.",
    "tut.oil.title":"5 · Keep your oil",
    "tut.oil.body":"Lamp oil drains over time, and the lower it gets the tighter your light becomes. Pick up the orange oil flasks to refill it.",
    "tut.spike.title":"6 · Spikes, fire & lava",
    "tut.spike.body":"Red spikes on the ground kill in one touch — jump over them. Orange fire lights and dies on a steady rhythm: read the beat and cross while it is out. Molten lava never goes out — cross it on the stones only.",
    "tut.saw.title":"7 · Saws",
    "tut.saw.body":"A spinning metal disc on a fixed path — sliding along the floor, or bobbing up and down. Its motion is regular and learnable: watch the far end of its travel, and cross after it passes. Never jump into it while it is coming at you.",
    "tut.nail.title":"8 · Nails",
    "tut.nail.body":"Short, dense rows of bright metal spikes. The floor kind is a simple hop; the ceiling kind forces you to stay low — never jump under it. Note the difference: nails are thinner and shinier than spikes.",
    "tut.crumb.title":"9 · Fragile platforms",
    "tut.crumb.body":"Cracked platforms that crumble a short moment after you stand on them — and the moment differs from platform to platform. The cracks glow orange just before they give way: that is your signal to jump. Do not wait; the countdown starts the instant your feet touch.",
    "tut.crush.title":"The falling stone",
    "tut.crush.body":"A stone hangs from the ceiling and drops the moment you walk under it, stays down for a beat, then climbs back. The dashed rail on the floor shows exactly where it will land — cross after it rises, not while it is falling.",
    "tut.goal.title":"10 · Reach the door",
    "tut.goal.body":"The glowing door at the end of the level is your goal. Reach it before the oil runs out, and watch everything above — one touch sends you back to the checkpoint. Every level offers more hazards and faster ones, but the rules never change."
  }
};

/* =========================================================
   ACTIVE LANGUAGE
   Read once at load and remembered for the session. If the
   stored value is missing or unreadable, Arabic is chosen.
   ========================================================= */
let LANG = (function(){
  try { return localStorage.getItem('qandel.lang') || 'ar'; } catch(e){ return 'ar'; }
})();

/* =========================================================
   LOOKUP
   Falls back to Arabic when a key is missing in the active
   table, then to the key itself, so a missing translation
   is never a blank screen.
   ========================================================= */
function t(key){
  const d = I18N[LANG] || I18N.ar;
  return d[key] !== undefined ? d[key] : (I18N.ar[key] || key);
}

/* =========================================================
   APPLY
   Three passes, in this order:

     1. document direction — RTL for Arabic, LTR for English
     2. every [data-i18n] element — textContent
     3. every [data-i18n-aria] element — aria-label

   The third pass is what lets a screen reader announce the
   controls in the language the player is actually using.
   Text and aria-label are different attributes; they need
   separate walks.

   The tab title is kept in sync so a bookmark reads the same
   language the player chose.
   ========================================================= */
function applyI18n(){
  document.documentElement.lang = LANG;
  document.documentElement.dir = (LANG === 'ar') ? 'rtl' : 'ltr';

  document.querySelectorAll('[data-i18n]').forEach(function(el){
    const k = el.getAttribute('data-i18n');
    const v = t(k);
    if (v) el.textContent = v;
  });

  document.querySelectorAll('[data-i18n-aria]').forEach(function(el){
    const k = el.getAttribute('data-i18n-aria');
    const v = t(k);
    if (v) el.setAttribute('aria-label', v);
  });

  document.title = t('app.title') + ' · Qandel';

  if (window.onLangApplied) window.onLangApplied();
}

/* =========================================================
   SWITCH
   Persist the choice, then re-apply. Persistence is best-
   effort — a private-browsing session that refuses the
   write simply loses the preference, not the switch.
   ========================================================= */
function setLang(l){
  LANG = l;
  try { localStorage.setItem('qandel.lang', l); } catch(e){}
  applyI18n();
}