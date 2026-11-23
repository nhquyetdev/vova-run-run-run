"use strict";
/* VOVA: RUN RUN RUN — v1.1 game logic */
const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove("hidden"), hide = id => $(id).classList.add("hidden");
function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const PCOL = ["#4dd2ff", "#7dff6b", "#ffd84d", "#ff8bd8", "#b38cff", "#ff9f43", "#5effd8", "#ff6b6b"];

/* ---------------- Save (same key as v1.0 — old saves keep working) ---------------- */
const DEFAULT = () => ({ver:3, pid:"", name:"", level:1, xp:0, dist:0, pos:0, maxPos:0, odo:0, team:true, runTime:0, seen:[], phase:0, mv:false, uni:0, mvp:0, uniName:"", uniHue:270,
  auto:false, sound:true, ch:[], sup:false, free:{spd:null, place:null}, created:Date.now()});
let S = DEFAULT();
function validSave(o) { return o && typeof o === "object" && isFinite(o.level) && o.level >= 1 && isFinite(o.dist) && o.dist >= 0 && Array.isArray(o.seen); }
function migrate(o) {
  const s = Object.assign(DEFAULT(), o);
  s.free = Object.assign({spd:null}, o.free || {}); s.ch = Array.isArray(o.ch) ? o.ch : [];
  if (!(o.ver >= 3)) { // v1.0 / v1.1 → v1.2: odometer becomes a real position on the journey
    const far = o.mv ? EDGE + ((o.uni || 0) + (o.mvp || 0)) * UNI_D : (o.dist || 0);
    s.maxPos = far; s.pos = o.mv && o.free && o.free.place != null ? Math.min(o.free.place, far) : far; s.odo = o.dist || 0;
  }
  s.ver = 3; delete s.free.place; delete s.uniName; delete s.uniHue; delete s.mvp;
  s.dist = s.maxPos;
  if (!s.pid) s.pid = localStorage.getItem(PID_KEY) || ("p" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4));
  s.phase = Math.max(s.phase || 0, phaseOf(lgOf(Math.min(s.maxPos, EDGE)), s.maxPos >= EDGE));
  delete s.hype;
  return s;
}
function loadSave() {
  for (const k of [SAVE_KEY, SAVE_BAK]) {
    try { const raw = localStorage.getItem(k); if (!raw) continue; const o = JSON.parse(raw); if (validSave(o)) { S = migrate(o); return; } } catch (e) {}
  }
  S = migrate({});
}
let lastSave = 0;
function save() {
  try { const prev = localStorage.getItem(SAVE_KEY); if (prev) localStorage.setItem(SAVE_BAK, prev); localStorage.setItem(SAVE_KEY, JSON.stringify(S)); localStorage.setItem(PID_KEY, S.pid); } catch (e) {}
  lastSave = performance.now();
}
loadSave();

/* ---------------- Audio ---------------- */
let AC = null;
function beep(freqs, dur = 0.1, type = "square", vol = 0.05) {
  if (!S.sound) return;
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    let t = AC.currentTime;
    for (const f of freqs) { const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + dur + 0.02); t += dur * 0.7; }
  } catch (e) {}
}

/* ---------------- Runtime state ---------------- */
let playing = false, paused = false;
const hero = {wx: 0, wy: 0.5};
let heroFace = 1, heroMoving = false, camX = -innerWidth * 0.1, animT = 0;
let dust = [], dustTimer = 3, particles = [], flash = 0, hintTimer = 0;
let chal = null;
const vovaImg = new Image(); vovaImg.src = "img/vova.png";

let curV = V0, pxm = 1, paceMode = "", paceName = ""; // current speed this frame (after team pace / homing) and pixels per metre
function effSpeed() { return speedOf(S.free.spd ? Math.min(S.free.spd, S.level) : S.level); }
function viewMV() { return S.pos >= EDGE; }
function viewLg() { return lgOf(Math.min(S.pos, EDGE)); }
// Realistic on Earth: Vova is ~1.2 m tall, so 1 m = heroHeight/1.2 px. Faster than ~9 m/s the screen can't keep up → log scale.
function pxpsOf(v) { const ppm = clamp(H * 0.19, 70, 160) / 1.2, v1 = 1000 / ppm; return v <= v1 ? v * ppm : Math.min(1800, 1000 + 130 * Math.log10(v / v1)); }
function pxps() { return pxpsOf(curV); }
function winM(v) { return W * 0.45 * v / pxpsOf(v); } // metres visible on half a screen at speed v
function uniIdx(p) { return Math.max(0, Math.floor((p - EDGE) / UNI_D)); }
function uniName(i) { return "Universe #" + num(i + 1) + ": " + UNI_A[Math.floor(hsh(i, 502) * UNI_A.length)] + " " + UNI_B[Math.floor(hsh(i, 503) * UNI_B.length)]; }
function curUniHue() { return Math.floor(hsh(uniIdx(S.pos), 501) * 360); }
function heroH() { return clamp(H * 0.19, 70, 160) * (0.88 + 0.18 * hero.wy); }
function heroSX() { return W / 2 + (hero.wx - camX); }
function heroSY() { return lerp(bandTop(), bandBot(), hero.wy); }

/* ---------------- Facts / banners ---------------- */
const factQueue = [];
function unlockFact(id, pop = true) { if (S.seen.includes(id)) return; S.seen.push(id); if (pop) factQueue.push(id); }
function pumpFacts(dt) {
  const box = $("facts"), maxCards = W < 700 ? 1 : 2;
  if (box.children.length < maxCards && factQueue.length) {
    const f = ALL_FACTS[factQueue.shift()];
    const c = el("div", "fact " + f.k);
    c.appendChild(el("div", "ic", f.ic));
    c.appendChild(el("div", "tg", f.k === "speed" ? "Speed discovered" : f.k === "place" ? "Distance discovered" : "Multiverse"));
    c.appendChild(el("div", "t", f.t)); c.appendChild(el("div", "x", f.x));
    c._life = 9; c.onclick = () => c.remove(); box.appendChild(c);
    beep(f.k === "speed" ? [880, 1320] : [660, 990], 0.12, "triangle", 0.06);
  }
  for (const c of [...box.children]) { c._life -= dt; if (c._life <= 0) c.remove(); }
}
function bannerShow(bigT, smallT, dur = 2.2) {
  const b = $("banner"); b.innerHTML = "";
  b.appendChild(el("div", "big pop", bigT)); if (smallT) b.appendChild(el("div", "small", smallT)); b._life = dur;
}

/* ---------------- Progress ---------------- */
function gainXP(x) {
  S.xp += x;
  while (S.xp >= needXP(S.level)) { const pv = speedOf(S.level); S.xp -= needXP(S.level); S.level++; onLevelUp(pv); }
}
function onLevelUp(prevV) {
  const v = speedOf(S.level);
  for (const s of SPEEDS) if (s.v > prevV && s.v <= v) unlockFact(s.id);
  bannerShow("LEVEL " + S.level + "!", "You feel faster… " + fmtSpeed(v));
  beep([523, 659, 784, 1047], 0.09, "square", 0.05); flash = 1;
  for (let i = 0; i < 26; i++) particles.push({x: heroSX(), y: heroSY() - heroH() / 2, vx: rnd(-300, 300), vy: rnd(-400, 100), life: 1, c: `hsl(${rnd(30, 60)},100%,60%)`});
  save();
}
function checkPhase() {
  const ph = phaseOf(lgOf(Math.min(S.maxPos, EDGE)), S.maxPos >= EDGE);
  if (ph > S.phase) {
    S.phase = ph; const P = PHASES[ph];
    bannerShow(P.ic + " NEW PHASE " + P.ic, "Phase " + (ph + 1) + ": " + P.n.toUpperCase(), 3.2);
    beep([392, 523, 659, 784], 0.12, "triangle", 0.06);
    if (ph < 7) setTimeout(() => { if (playing) toast("🏆 New challenges unlocked!"); }, 3300);
    buildTicks(); save();
  }
}
function toast(t) { const d = el("div", "toast", t); $("hud").appendChild(d); setTimeout(() => d.remove(), 3000); }
const UNI_A = ["Purple", "Upside-down", "Jelly", "Mirror", "Singing", "Square", "Frozen", "Candy", "Backwards", "Glitter", "Silent", "Tiny", "Fluffy", "Neon", "Paper", "Echo"];
const UNI_B = ["Gravity", "Time", "Light", "Stars", "Cats", "Oceans", "Planets", "Rain", "Clocks", "Moons", "Dragons", "Noodles", "Music", "Galaxies"];
function announceUniverses(n) {
  bannerShow(n > 1 ? "+" + num(n) + " UNIVERSES!" : "UNIVERSE CROSSED!", "Entering " + uniName(uniIdx(S.maxPos)), 2.4);
  beep([392, 523, 659, 784, 1047], 0.1, "triangle", 0.05);
  const mf = MULTI_FACTS.find(f => !S.seen.includes(f.id)); if (mf) unlockFact(mf.id);
  save();
}
function enterMultiverse() {
  if (S.mv) return;
  S.mv = true; S.uni = 0; save();
  const lines = ["You have reached the edge of the observable universe.", "About 93 billion light-years across. Two trillion galaxies, maybe more.", "Total running time: " + fmtTime(S.runTime) + ".", "But Vova doesn't stop…", "🌈 WELCOME TO THE MULTIVERSE 🌈"];
  paused = true; show("cut"); let i = 0;
  const step = () => {
    if (i >= lines.length) { hide("cut"); paused = false; unlockFact("m_0"); checkPhase(); return; }
    const t = $("cutTxt"); t.style.opacity = 0;
    setTimeout(() => { t.textContent = lines[i++]; t.style.opacity = 1; setTimeout(step, 3200); }, 600);
  };
  beep([262, 330, 392, 523, 659, 784, 1047, 1319], 0.18, "sine", 0.05); step();
}

/* ---------------- Input ---------------- */
const keys = new Set();
const stick = {on: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0};
function readInput() {
  let x = 0, y = 0;
  if (keys.has("left")) x -= 1; if (keys.has("right")) x += 1; if (keys.has("up")) y -= 1; if (keys.has("down")) y += 1;
  if (stick.on) { x += stick.dx; y += stick.dy; }
  const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
  if (Math.abs(x) < 0.12 && Math.abs(y) < 0.12) { x = 0; y = 0; if (S.auto && !chal) x = 1; }
  return {x, y};
}
const KEYMAP = {ArrowLeft:"left", a:"left", A:"left", ArrowRight:"right", d:"right", D:"right", ArrowUp:"up", w:"up", W:"up", ArrowDown:"down", s:"down", S:"down"};
addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  if (KEYMAP[e.key]) { e.preventDefault(); keys.add(KEYMAP[e.key]); }
  else if (e.key === "q" || e.key === "Q") { if (playing && !paused) toggleAuto(); }
  else if (e.key === "Escape") { if (playing && !chal) togglePause(); }
  else if (e.key === " ") e.preventDefault();
});
addEventListener("keyup", e => { if (KEYMAP[e.key]) keys.delete(KEYMAP[e.key]); });
const releaseAll = () => { keys.clear(); stick.on = false; save(); };
addEventListener("blur", releaseAll);
document.addEventListener("visibilitychange", () => { if (document.hidden) releaseAll(); });
addEventListener("beforeunload", save);
cv.addEventListener("pointerdown", e => { if (!playing || paused || stick.on) return; stick.on = true; stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.dx = stick.dy = 0; });
addEventListener("pointermove", e => {
  if (!stick.on || e.pointerId !== stick.id) return;
  let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const m = Math.hypot(dx, dy), R0 = 55;
  if (m > R0) { stick.ox += dx * (1 - R0 / m); stick.oy += dy * (1 - R0 / m); dx = e.clientX - stick.ox; dy = e.clientY - stick.oy; }
  stick.dx = dx / R0; stick.dy = dy / R0;
});
const stickUp = e => { if (e.pointerId === stick.id) { stick.on = false; stick.dx = stick.dy = 0; } };
addEventListener("pointerup", stickUp); addEventListener("pointercancel", stickUp);
function toggleAuto() { S.auto = !S.auto; save(); }
$("bAuto").addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); toggleAuto(); });
$("bTeam").addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); S.team = !S.team; save(); toast(S.team ? "🤝 Team pace ON — you'll match slower friends nearby" : "🏃 Team pace OFF — run at your own speed"); });
$("bMenu").onclick = () => { if (chal) quitChallenge(); else togglePause(); };
document.querySelectorAll("#emoteBar button").forEach(b => b.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); sendEmote(b.dataset.e); }));

/* ---------------- Update ---------------- */
// speed this frame: your own speed, slowed to a teammate's pace when you're together,
// boosted when running back toward a teammate somewhere you've already been (and braking as you arrive)
function paceSpeed(dir) {
  let v = effSpeed(); paceMode = "";
  if (!room) return v;
  const mates = ghostList();
  if (S.team) for (const m of mates) if (Math.abs(m.dp - S.pos) < winM(m.v) && m.v < v) { v = m.v; paceMode = "team"; }
  if (dir) {
    let best = null;
    for (const m of mates) { const gap = (m.dp - S.pos) * dir; if (gap > winM(m.v) && (!best || gap < best.gap)) best = {m, gap}; }
    if (best) {
      const canBoost = dir < 0 || best.m.dp <= S.maxPos;
      const vh = canBoost ? Math.max(v, 1.5 * best.gap) : v;
      v = Math.min(vh, 1.5 * best.gap + best.m.v); paceMode = "home"; paceName = best.m.p.name;
    }
  }
  return Math.max(v, 1e-6);
}
function update(dt) {
  const inp = readInput(), mag = Math.min(1, Math.hypot(inp.x, inp.y));
  heroMoving = mag > 0.1;
  if (Math.abs(inp.x) > 0.1) heroFace = Math.sign(inp.x);
  const stunned = chal && chal.stun > 0, hx = stunned ? 0 : inp.x;
  updateGhosts(dt);
  curV = paceSpeed(Math.abs(hx) > 0.1 ? Math.sign(hx) : 0); pxm = pxpsOf(curV) / curV;
  hero.wx += hx * pxps() * dt;
  hero.wy = clamp(hero.wy + inp.y * 1.15 * dt, 0, 1);
  if (heroMoving) {
    hintTimer = 0;
    gainXP(XPS * mag * (1 + roomMult()) * dt);
    const dp = hx * curV * dt;
    S.pos = Math.max(0, S.pos + dp); S.odo += Math.abs(dp);
    if (S.pos > S.maxPos) {
      const prev = S.maxPos; S.maxPos = S.pos; S.dist = S.maxPos;
      for (const l of LANDMARKS) if (l.d > prev && l.d <= S.maxPos) unlockFact(l.id);
      checkPhase();
      if (!S.mv && S.maxPos >= EDGE) enterMultiverse();
      if (S.mv) { const u = uniIdx(S.maxPos); if (u > S.uni) { const n = u - S.uni; S.uni = u; announceUniverses(n); } }
    }
    S.runTime += dt;
    animT += dt * (7 + Math.min(9, S.level / 10));
  } else { hintTimer += dt; animT += dt * 1.5; }
  camX += (hero.wx + heroFace * W * 0.1 - camX) * Math.min(1, dt * 2.5);
  // stardust: fixed in the world, grab it by moving up/down
  dustTimer -= dt;
  if (dustTimer <= 0 && heroMoving && dust.length < 5) { dustTimer = rnd(4, 8); dust.push({x: hero.wx + heroFace * rnd(380, 900), y: Math.random()}); }
  for (const d of dust) {
    const sx = W / 2 + d.x - camX, sy = lerp(bandTop(), bandBot(), d.y);
    if (!d.got && Math.abs(sx - heroSX()) < heroH() * 0.32 && Math.abs(sy - heroSY()) < 30) {
      d.got = true; gainXP(needXP(S.level) * 0.04); beep([1200, 1600], 0.06, "sine", 0.06);
      for (let i = 0; i < 14; i++) particles.push({x: sx, y: sy - 20, vx: rnd(-200, 200), vy: rnd(-250, 50), life: 0.7, c: "#fff27a"});
    }
  }
  dust = dust.filter(d => !d.got && Math.abs(d.x - hero.wx) < 2500);
  // trail particles
  if (heroMoving && Math.random() < dt * (S.level > 30 ? 36 : 14)) {
    const space = viewLg() >= 4.0 || S.mv;
    particles.push({x: heroSX() - heroFace * heroH() * 0.2, y: heroSY() - 4, vx: -heroFace * rnd(40, 160), vy: rnd(-90, -10), life: rnd(0.4, 0.9), c: space ? `hsl(${(animT * 40) % 360},100%,70%)` : "rgba(150,120,85,.8)"});
  }
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt; }
  particles = particles.filter(p => p.life > 0); if (particles.length > 300) particles.splice(0, particles.length - 300);
  flash = Math.max(0, flash - dt * 2);
  if (chal) updateChallenge(dt, inp);
  const b = $("banner"); if (b._life > 0) { b._life -= dt; if (b._life <= 0) b.innerHTML = ""; }
  pumpFacts(dt);
  if (performance.now() - lastSave > 5000) save();
}

/* ---------------- Challenges ---------------- */
const OBS_IC = {earth:"🛰️", moon:"🪨", jupiter:"☄️", sun:"🔥", wd:"☄️", ns:"⚡", bh:"☄️", galaxy:"☄️", universe:"🫧", rocks:"🪨", wind:"💨", pulsar:"⚡"};
function startChallenge(c) {
  hideAllPanels(); show("hud"); paused = false; playing = true;
  chal = {c, state: "count", cd: 3, t: 0, you: 0, rival: 0, p: 0, stun: 0, obs: [], obsT: 1.5, hits: 0};
  S.auto = false; hero.wy = 0.5;
  $("chHud").classList.remove("hidden"); $("chName").textContent = c.ic + " " + c.t;
}
function quitChallenge() { chal = null; $("chHud").classList.add("hidden"); }
function updateChallenge(dt, inp) {
  const c = chal.c;
  if (chal.state === "count") { const before = Math.ceil(chal.cd); chal.cd -= dt; if (Math.ceil(chal.cd) !== before && chal.cd > 0) beep([440], 0.08); if (chal.cd <= 0) { chal.state = "run"; beep([880], 0.15); } return; }
  if (chal.state !== "run") return;
  chal.t += dt; chal.stun = Math.max(0, chal.stun - dt);
  const v = effSpeed(), fwd = inp.x > 0.2 && chal.stun <= 0, ratio = v / c.need;
  if (c.type === "race") {
    if (fwd) chal.you += dt * Math.min(ratio, 1e6) / 10;
    chal.rival += dt / 10;
    if (chal.you >= 1) return endChallenge(true);
    if (chal.rival >= 1) return endChallenge(false);
  } else {
    if (fwd) {
      if (ratio >= 1) chal.p += dt / 8 * Math.min(3, ratio);
      else { const cap = 0.9 * ratio * ratio; chal.p = chal.p < cap ? chal.p + dt / 8 : chal.p - dt * 0.05; }
    } else chal.p -= dt * 0.12;
    chal.p = Math.max(0, chal.p);
    if (chal.p >= 1) return endChallenge(true);
    if (chal.t > 25) return endChallenge(false);
  }
  // obstacles (dodge with up/down)
  const lvl = c.obs || 0;
  if (lvl) {
    chal.obsT -= dt;
    if (chal.obsT <= 0) { chal.obsT = [0, 1.6, 1.1, 0.7][lvl] * rnd(0.7, 1.3); chal.obs.push({x: W + 40, y: Math.random(), sp: rnd(380, 520) + lvl * 80, ic: OBS_IC[c.body] || (S.phase === 0 ? "🪨" : "☄️")}); }
    for (const o of chal.obs) {
      o.x -= o.sp * dt;
      const sy = lerp(bandTop(), bandBot(), o.y);
      if (!o.hit && Math.abs(o.x - heroSX()) < heroH() * 0.28 && Math.abs(sy - heroSY()) < 28) {
        o.hit = true; chal.hits++; flash = 0.6; beep([140, 90], 0.12, "sawtooth", 0.06);
        if (c.type === "race") chal.stun = 0.6; else chal.p = Math.max(0, chal.p - 0.1);
      }
    }
    chal.obs = chal.obs.filter(o => o.x > -60);
  }
}
function endChallenge(win) {
  const c = chal.c; chal.state = "done";
  const first = win && !S.ch.includes(c.id);
  if (first) { S.ch.push(c.id); gainXP(needXP(S.level) * 0.3); }
  save();
  setTimeout(() => {
    quitChallenge();
    $("crTitle").textContent = (win ? "🏆 YOU WIN! " : "💀 Not this time… ") + c.ic;
    $("crName").textContent = c.t;
    const v = effSpeed();
    $("crText").textContent = win ? c.w : (v < c.need ? "Your speed is " + fmtSpeed(v) + ". You need at least " + fmtSpeed(c.need) + ". Level up and come back!" : "You're fast enough — keep holding → (forward) and dodge with ↑↓!");
    $("crReward").textContent = first ? "+ Bonus XP · Medal earned 🏅" : (win ? "Already earned this medal." : "");
    paused = true; show("chResult");
    beep(win ? [523, 659, 784, 1047, 1319] : [300, 200], 0.12, "triangle", 0.06);
  }, 500);
}
function drawChallenge(t) {
  if (!chal) return;
  const c = chal.c, sx = heroSX();
  // big body / effects behind
  if (c.type !== "race") drawChalBody(c, chal.p, t);
  // obstacles
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const o of chal.obs) { const sy = lerp(bandTop(), bandBot(), o.y) - 20; ctx.font = "34px serif"; ctx.fillText(o.ic, o.x, sy); }
  // rival
  if (c.type === "race") {
    const rx = clamp(sx + (chal.rival - chal.you) * W * 1.1, -40, W + 40), ry = lerp(bandTop(), bandBot(), 0.25);
    ctx.font = Math.round(heroH() * 0.7) + "px serif"; ctx.textBaseline = "bottom"; ctx.fillText(c.ic, rx, ry + 10);
  }
  // HUD bar
  const bw = Math.min(520, W - 40), bx = (W - bw) / 2, by = portrait() ? H * 0.3 : 92;
  ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(bx - 10, by - 26, bw + 20, c.type === "race" ? 72 : 52);
  ctx.font = "bold 13px sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#fff";
  if (c.type === "race") {
    const elapsed = chal.rival * c.D / c.need;
    ctx.fillText("🏁 " + fmtDist(c.D) + " race · real time " + fmtTime(elapsed), bx, by - 10);
    for (const [k, val, col, lbl] of [[0, chal.you, "#ff4d6d", "You"], [1, chal.rival, "#ffd84d", c.ic]]) {
      const y = by + k * 20;
      ctx.fillStyle = "rgba(255,255,255,.15)"; ctx.fillRect(bx + 34, y, bw - 34, 12);
      ctx.fillStyle = col; ctx.fillRect(bx + 34, y, (bw - 34) * Math.min(1, val), 12);
      ctx.fillStyle = "#fff"; ctx.fillText(lbl, bx, y + 11);
    }
  } else {
    ctx.fillText((c.type === "escape" ? "🚀 Escape: " : "⏱ Keep up: ") + Math.floor(chal.p * 100) + "%   ·   ⏳ " + Math.max(0, 25 - chal.t).toFixed(0) + " s", bx, by - 10);
    ctx.fillStyle = "rgba(255,255,255,.15)"; ctx.fillRect(bx, by, bw, 14);
    ctx.fillStyle = "#5effa0"; ctx.fillRect(bx, by, bw * Math.min(1, chal.p), 14);
  }
  if (chal.state === "count") {
    ctx.textAlign = "center"; ctx.font = "900 90px sans-serif"; ctx.fillStyle = "#ffd84d"; ctx.strokeStyle = "#a40"; ctx.lineWidth = 6;
    const n = Math.ceil(chal.cd); ctx.strokeText(n, W / 2, H * 0.45); ctx.fillText(n, W / 2, H * 0.45);
    ctx.font = "bold 18px sans-serif"; ctx.fillStyle = "#fff"; ctx.fillText("Hold → (or drag right) to run · ↑↓ to dodge", W / 2, H * 0.45 + 40);
  }
  if (chal.stun > 0) { ctx.textAlign = "center"; ctx.font = "bold 22px sans-serif"; ctx.fillStyle = "#ff6b6b"; ctx.fillText("OUCH!", sx, heroSY() - heroH() - 14); }
}
function drawChalBody(c, p, t) {
  const b = c.body, r = Math.min(W, H) * 0.55 * (1 - p * 0.75), x = -r * 0.25, y = H * 0.62;
  ctx.save();
  if (b === "sunset") { const sy = horizon() + 30 - p * 90; sunDisc(W * 0.9, sy, 34, "rgba(255,170,90,1)"); ctx.fillStyle = `rgba(255,120,60,${0.25 * (1 - p)})`; ctx.fillRect(0, 0, W, H); }
  else if (b === "wind") { ctx.strokeStyle = "rgba(200,230,255,.5)"; ctx.lineWidth = 2; for (let i = 0; i < 30; i++) { const yy = H * hsh(i, 91), xx = mod(W - (t * (0.9 + hsh(i, 92))) - i * 97, W + 200) - 100; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + 80, yy); ctx.stroke(); } }
  else if (b === "doppler") {
    const lx = W * 0.85, ly = H * 0.3; ctx.fillStyle = "#222"; ctx.fillRect(lx - 30, ly - 80, 60, 160); ctx.fillRect(lx - 5, ly + 80, 10, H);
    const hue = lerp(0, 125, Math.min(1, p)); ctx.shadowColor = `hsl(${hue},100%,55%)`; ctx.shadowBlur = 30; ctx.fillStyle = `hsl(${hue},100%,55%)`; ctx.beginPath(); ctx.arc(lx, ly - 45, 22, 0, 7); ctx.fill();
  }
  else if (b === "pulsar") { ctx.translate(W * 0.15, H * 0.35); ctx.rotate(t / 60); ctx.fillStyle = "rgba(160,200,255,.25)"; for (const s of [1, -1]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * 900, -60); ctx.lineTo(s * 900, 60); ctx.closePath(); ctx.fill(); } ctx.fillStyle = "#cfe3ff"; ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.fill(); }
  else if (b === "rocks") { /* obstacles only */ }
  else {
    const cols = {earth:["#4aa3ff", "#14408a"], moon:["#eeeeee", "#77736d"], jupiter:["#e8c39a", "#8a5a3a"], sun:["#fff3b0", "#ff7a1a"], wd:["#ffffff", "#9fc3ff"], ns:["#e0f0ff", "#5a8fff"], galaxy:["#ffe8f8", "#6a3f9a"], universe:["#ffffff", "#7a2cff"], bh:["#000", "#000"]}[b] || ["#fff", "#888"];
    if (b === "bh") {
      ctx.translate(x, y); ctx.scale(1, 0.35); const g = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.6);
      g.addColorStop(0, "rgba(255,200,120,.9)"); g.addColorStop(0.5, "rgba(255,90,40,.5)"); g.addColorStop(1, "rgba(80,0,60,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.6, 0, 7); ctx.fill();
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(255,220,160,.8)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r * 0.58, 0, 7); ctx.stroke();
    } else {
      if (b === "sun" || b === "wd" || b === "ns") { const g2 = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 1.6); g2.addColorStop(0, cols[1] + "aa"); g2.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, 7); ctx.fill(); }
      const g = ctx.createRadialGradient(x + r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
  }
  ctx.restore();
}

/* ---------------- Drawing ---------------- */
function drawVova(x, y, h, face, alpha, running, ph, trail) {
  if (!vovaImg.complete || !vovaImg.naturalWidth) return;
  const bob = running ? Math.abs(Math.sin(animT + ph)) * h * 0.08 : Math.sin(animT * 0.5 + ph) * h * 0.012;
  const tilt = running ? 0.1 + Math.sin((animT + ph) * 2) * 0.04 : 0;
  ctx.save(); ctx.globalAlpha = alpha * 0.25; ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(x, y + 2, h * 0.27, h * 0.05, 0, 0, 7); ctx.fill(); ctx.restore();
  if (trail) for (let i = 3; i >= 1; i--) { ctx.save(); ctx.globalAlpha = 0.1 * (4 - i); ctx.translate(x - face * i * Math.min(24, 6 + S.level * 0.2), y - bob); ctx.scale(face, 1); ctx.rotate(tilt); ctx.drawImage(vovaImg, -h / 2, -h, h, h); ctx.restore(); }
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y - bob); ctx.scale(face, 1); ctx.rotate(tilt);
  const sq = running ? 1 + Math.sin((animT + ph) * 2) * 0.03 : 1;
  ctx.drawImage(vovaImg, -h / 2, -h * sq, h, h * sq); ctx.restore();
}
function nameTag(x, y, txt, col, emote) {
  ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
  const tw = ctx.measureText(txt).width + 10;
  ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(x - tw / 2, y - 16, tw, 16); ctx.fillStyle = col; ctx.fillText(txt, x, y - 2);
  if (emote) { ctx.font = "26px serif"; ctx.fillText(emote, x, y - 18); }
}
function ghostScreen(g) { return {x: heroSX() + (g.dp - S.pos) * pxm, y: lerp(bandTop(), bandBot(), clamp(g.dy, 0, 1))}; }
function draw(t) {
  const lg = viewLg(), mv = viewMV();
  drawWorld(lg, mv, t, pxps(), heroMoving);
  // stardust
  for (const d of dust) {
    const sx = W / 2 + d.x - camX, sy = lerp(bandTop(), bandBot(), d.y) - 20, pul = 1 + 0.15 * Math.sin(t / 120);
    const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, 26 * pul); g.addColorStop(0, "#fffbe0"); g.addColorStop(0.4, "rgba(255,225,77,.9)"); g.addColorStop(1, "rgba(255,200,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, 26 * pul, 0, 7); ctx.fill();
  }
  if (chal) drawChallenge(t);
  // entities sorted by depth
  const ents = [], list = room ? ghostList() : [], now_ = now();
  list.forEach(gh => { const p = gh.p, i = gh.i, g = ghostScreen(gh); ents.push({y: g.y, f: () => {
    const h = clamp(H * 0.19, 70, 160) * (0.88 + 0.18 * gh.dy);
    if (g.x > -80 && g.x < W + 80) { drawVova(g.x, g.y, h, p.f || 1, 0.85, !!p.run, i * 1.7, false); nameTag(g.x, g.y - h - 4, (p.sup ? "💖 " : "") + p.name + " · Lv" + p.level, p.sup ? "#ffd84d" : PCOL[i % 8], p.emote && now_ - (p.et || 0) < 3500 ? p.emote : null); }
  }}); });
  ents.push({y: heroSY(), f: () => {
    drawVova(heroSX(), heroSY(), heroH(), heroFace, 1, heroMoving, 0, heroMoving && curV > 60);
    if (room) nameTag(heroSX(), heroSY() - heroH() - 4, (S.sup ? "💖 " : "") + (S.name || "Vova"), S.sup ? "#ffd84d" : "#fff", myEmote && now_ - myEmoteT < 3500 ? myEmote : null);
  }});
  ents.sort((a, b) => a.y - b.y).forEach(e => e.f());
  for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 4, 4); }
  ctx.globalAlpha = 1;
  // arrows to off-screen friends
  list.forEach(gh => {
    const p = gh.p, i = gh.i, g = ghostScreen(gh); if (g.x >= 0 && g.x <= W) return;
    const left = g.x < 0, ax = left ? 14 : W - 14, ay = bandTop() - 30 - i * 22;
    ctx.font = "bold 13px sans-serif"; ctx.textBaseline = "middle"; ctx.textAlign = left ? "left" : "right";
    const ph = phaseOf(lgOf(Math.min(gh.dp, EDGE)), gh.dp >= EDGE), where = ph <= S.phase ? PHASES[ph].ic + " " + fmtDist(Math.abs(gh.dp - S.pos)) : "❓";
    const txt = left ? "◀ " + p.name + " · " + where : p.name + " · " + where + " ▶";
    const tw = ctx.measureText(txt).width + 12; ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(left ? ax - 4 : ax - tw + 4, ay - 10, tw, 20);
    ctx.fillStyle = PCOL[i % 8]; ctx.fillText(txt, ax + (left ? 2 : -2), ay);
  });
  // joystick
  if (stick.on) {
    ctx.globalAlpha = 0.35; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(stick.ox, stick.oy, 55, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(stick.ox + stick.dx * 55, stick.oy + stick.dy * 55, 24, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  }
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,220,${flash * 0.3})`; ctx.fillRect(0, 0, W, H); }
}

/* ---------------- HUD ---------------- */
function segPct(lg) { return clamp(Math.max(0, lg) / EDGE_LG * 94, 0, 94); }
function buildTicks() {
  const t = $("ticks"); t.innerHTML = "";
  for (let i = 0; i < 8; i++) {
    const a = i < 7 ? segPct(PHASES[i].lg) : 94, b = i < 6 ? segPct(PHASES[i + 1].lg) : i === 6 ? 94 : 100;
    const known = i <= S.phase, e = el("div", "seg" + (known ? " known" : ""), known ? PHASES[i].ic : "❓");
    e.style.left = a + "%"; e.style.width = (b - a) + "%"; e.title = known ? PHASES[i].n : "???"; t.appendChild(e);
  }
}
function pctOf(lg, mv) { return mv ? 97 : segPct(lg); }
let hudT = 0;
function updateHUD(dt) {
  hudT -= dt; if (hudT > 0) return; hudT = 0.1;
  const v = curV, lg = viewLg();
  $("lv").textContent = "Lv " + num(S.level);
  $("xpFill").style.width = (S.xp / needXP(S.level) * 100) + "%";
  const tags = []; if (S.free.spd && S.free.spd < S.level) tags.push("🎚 Lv " + S.free.spd + " pace");
  if (paceMode === "team") tags.push("🤝 team pace"); else if (paceMode === "home" && heroMoving) tags.push("➜ heading to " + paceName);
  $("dialTag").textContent = tags.join(" · ");
  $("spd").textContent = fmtSpeed(v);
  if (viewMV()) {
    const u = uniIdx(S.pos);
    $("cmp").textContent = "≈ " + (v / UNI_D * 60 >= 0.01 ? num(v / UNI_D * 60, 2) : sci(v / UNI_D * 60)) + " universes per minute";
    $("dst").textContent = "Universe #" + num(u + 1) + (S.uni > u ? " (furthest #" + num(S.uni + 1) + ")" : "");
    $("zone").textContent = "📍 " + uniName(u);
    $("next").textContent = S.pos >= S.maxPos - 1 ? "Next universe: " + Math.floor(((S.pos - EDGE) / UNI_D - u) * 100) + "%" : "";
  } else {
    $("cmp").textContent = compareLine(v, S.seen);
    $("dst").textContent = fmtDist(S.pos) + " from home";
    $("zone").textContent = "📍 " + placeName(lg, false);
    const nl = LANDMARKS.find(l => l.d > S.maxPos);
    $("next").textContent = nl ? "Next discovery: ❓ " + fmtDist(nl.d - S.pos) + " away" : "";
  }
  const rm = roomMult();
  $("bonus").textContent = rm > 0 ? "👥 Room bonus +" + Math.round(rm * 100) + "% XP" : "";
  $("hint").classList.toggle("hidden", heroMoving || hintTimer < 1.5 || !!chal);
  $("bAuto").classList.toggle("on", !!S.auto);
  $("bTeam").classList.toggle("hidden", !room); $("bTeam").classList.toggle("on", !!S.team);
  const dots = $("dots"); dots.innerHTML = "";
  if (room) ghostList().forEach(g => { const d = el("div", "dot", (g.p.name || "?")[0].toUpperCase()); d.style.left = pctOf(lgOf(Math.min(g.dp, EDGE)), g.dp >= EDGE) + "%"; d.style.background = PCOL[g.i % 8]; dots.appendChild(d); });
  const me = el("div", "dot me"); me.style.left = pctOf(lg, viewMV()) + "%"; dots.appendChild(me);
  if (room) { $("roomTag").textContent = "👥 Room " + room + " · " + (othersList().length + 1) + "/8"; show("roomTag"); show("emoteBar"); } else { hide("roomTag"); hide("emoteBar"); }
  $("stats").classList.toggle("dim", !!chal);
}

/* ---------------- Screens ---------------- */
const PANELS = ["title", "menu", "rooms", "book", "savep", "how", "sup", "chals", "chIntro", "chResult", "dial"];
function hideAllPanels() { PANELS.forEach(hide); }
let backTo = "title";
function titleInfo() {
  $("nameIn").value = S.name || "";
  const P = PHASES[S.phase];
  $("saveInfo").textContent = S.runTime > 0 ? "💾 Lv " + num(S.level) + " · " + P.ic + " " + P.n + " · " + fmtTime(S.runTime) + " run" : "New runner — start at a tortoise pace 🐢";
}
function cleanName(n) { return (n || "").replace(/[<>]/g, "").trim().slice(0, 16) || "Vova"; }
function startGame() {
  S.name = cleanName($("nameIn").value); save();
  hideAllPanels(); show("hud"); playing = true; paused = false; buildTicks();
  if (!S.seen.includes("s_tortoise")) unlockFact("s_tortoise");
}
function togglePause() {
  paused = !paused; keys.clear(); stick.on = false;
  if (paused) { $("mSound").textContent = "🔊 Sound: " + (S.sound ? "ON" : "OFF"); show("menu"); save(); } else hide("menu");
}
function openPanel(id, from) { backTo = from; hideAllPanels(); show(id); }
function closePanel(id) { hide(id); show(backTo); }
$("bPlay").onclick = startGame;
$("bRooms").onclick = () => { S.name = cleanName($("nameIn").value); save(); openRooms("title"); };
$("bBook1").onclick = () => openBook("title");
$("bHow").onclick = () => openPanel("how", "title");
$("bSave1").onclick = () => openSave("title");
$("bSup1").onclick = () => openSupport("title");
$("howBack").onclick = () => closePanel("how");
$("mResume").onclick = () => togglePause();
$("mChal").onclick = () => openChals("menu");
$("mDial").onclick = () => openDial("menu");
$("mRooms").onclick = () => openRooms("menu");
$("mBook").onclick = () => openBook("menu");
$("mSave").onclick = () => openSave("menu");
$("mSup").onclick = () => openSupport("menu");
$("mSound").onclick = () => { S.sound = !S.sound; $("mSound").textContent = "🔊 Sound: " + (S.sound ? "ON" : "OFF"); save(); };
$("mTitle").onclick = () => { hideAllPanels(); hide("hud"); playing = false; paused = false; save(); titleInfo(); show("title"); };
$("rBack").onclick = () => closePanel("rooms");
$("rRefresh").onclick = () => listRooms();
$("rCreate").onclick = () => createRoom();
$("rJoin").onclick = () => joinRoom($("rCode").value);
$("rLeave").onclick = async () => { await leaveRoom(); hide("roomIn"); show("roomOut"); listRooms(); };

function openBook(from) {
  const list = $("bookList"); list.innerHTML = "";
  const total = Object.keys(ALL_FACTS).length; $("bookCount").textContent = S.seen.filter(id => ALL_FACTS[id]).length + " / " + total;
  const addFact = (f) => { const got = S.seen.includes(f.id), d = el("div", "fb"); d.appendChild(el("div", "t", got ? f.ic + " " + f.t : "❓ ???")); if (got) d.appendChild(el("div", "x", f.x)); list.appendChild(d); };
  for (let ph = 0; ph < 8; ph++) {
    const known = ph <= S.phase;
    list.appendChild(el("div", "grp", known ? PHASES[ph].ic + " " + PHASES[ph].n : "❓ Undiscovered phase"));
    if (!known) continue;
    Object.values(ALL_FACTS).filter(f => f.k !== "speed" && f.ph === ph).forEach(addFact);
  }
  list.appendChild(el("div", "grp", "⚡ Speeds"));
  SPEEDS.forEach(s => addFact(ALL_FACTS[s.id]));
  openPanel("book", from);
}
$("bookBack").onclick = () => closePanel("book");
function openChals(from) {
  const list = $("chList"); list.innerHTML = "";
  const v = effSpeed();
  $("chCount").textContent = S.ch.length + " / " + CHALLENGES.length + " 🏅";
  $("chSpeed").textContent = "Your speed: " + fmtSpeed(v);
  for (let ph = 0; ph < 8; ph++) {
    const known = ph <= S.phase;
    list.appendChild(el("div", "grp", known ? PHASES[ph].ic + " " + PHASES[ph].n : "❓ Undiscovered — keep running"));
    if (!known) continue;
    CHALLENGES.filter(c => c.ph === ph).forEach(c => {
      const r = el("div", "chrow" + (S.ch.includes(c.id) ? " done" : ""));
      r.appendChild(el("div", "ci", c.ic));
      const mid = el("div", "cm"); mid.appendChild(el("div", "ct", c.t)); mid.appendChild(el("div", "cn", "Need " + fmtSpeed(c.need) + (v >= c.need ? " ✔" : " ✖"))); r.appendChild(mid);
      r.appendChild(el("div", "cr", S.ch.includes(c.id) ? "🏅" : "▶"));
      r.onclick = () => openIntro(c); list.appendChild(r);
    });
  }
  openPanel("chals", from);
}
let introC = null;
function openIntro(c) {
  introC = c; const v = effSpeed();
  $("ciTitle").textContent = c.ic + " " + c.t; $("ciText").textContent = c.i;
  $("ciNeed").textContent = (c.type === "race" ? "Rival speed: " : c.type === "escape" ? "Escape velocity: " : "Speed needed: ") + fmtSpeed(c.need);
  $("ciYou").textContent = "Your speed: " + fmtSpeed(v) + (v >= c.need ? "  ✔ fast enough" : "  ✖ too slow (you can still try)");
  $("ciHow").textContent = c.type === "race" ? "Hold → to run. Stop and you lose ground." : "Hold → to climb away. Stop and you fall back.";
  if (c.obs) $("ciHow").textContent += " Dodge obstacles with ↑↓.";
  hide("chals"); show("chIntro");
}
$("ciStart").onclick = () => startChallenge(introC);
$("ciBack").onclick = () => { hide("chIntro"); show("chals"); };
$("chBack").onclick = () => closePanel("chals");
$("crAgain").onclick = () => { hide("chResult"); startChallenge(introC); };
$("crList").onclick = () => { hide("chResult"); paused = true; openChals("menu"); };
$("crRun").onclick = () => { hide("chResult"); paused = false; };
function openDial(from) {
  const sl = $("dialSl"); sl.min = 1; sl.max = S.level; sl.value = S.free.spd || S.level;
  const upd = () => { const L = +sl.value; $("dialV").textContent = "Lv " + L + " pace · " + fmtSpeed(speedOf(L)); };
  sl.oninput = () => { S.free.spd = +sl.value >= S.level ? null : +sl.value; upd(); }; upd();
  const pl = $("dialPlaces"); pl.innerHTML = "";
  const here = phaseOf(viewLg(), viewMV());
  PHASES.forEach((P, i) => {
    if (i > S.phase) { pl.appendChild(el("button", "btn sm gray", "❓ ???")); return; }
    const b = el("button", "btn sm" + (i === here ? " green" : " gray"), P.ic + " " + P.n);
    b.onclick = () => { S.pos = i === 0 ? 0 : i === 7 ? S.maxPos >= EDGE ? Math.max(EDGE, S.pos >= EDGE ? S.pos : EDGE * 1.0001) : EDGE : Math.min(S.maxPos, Math.pow(10, PHASES[i].lg) * 1.001); save(); openDial(from); };
    pl.appendChild(b);
  });
  openPanel("dial", from);
}
$("dialMax").onclick = () => { S.free.spd = null; $("dialSl").value = S.level; $("dialSl").oninput(); save(); };
$("dialBack").onclick = () => { save(); closePanel("dial"); };
function openSave(from) { $("saveCode").value = btoa(unescape(encodeURIComponent(JSON.stringify(S)))); $("loadCode").value = ""; $("sMsg").textContent = ""; openPanel("savep", from); }
$("sCopy").onclick = () => { const t = $("saveCode"); t.select(); try { navigator.clipboard.writeText(t.value); } catch (e) { document.execCommand("copy"); } $("sMsg").textContent = "Copied!"; };
$("sLoad").onclick = () => {
  try { const o = JSON.parse(decodeURIComponent(escape(atob($("loadCode").value.trim())))); if (!validSave(o)) throw 0; S = migrate(o); save(); $("sMsg").textContent = "✅ Loaded! Lv " + S.level; titleInfo(); buildTicks(); watchSupporter(); }
  catch (e) { $("sMsg").textContent = "❌ That code doesn't look right."; }
};
$("sReset").onclick = () => {
  if (!confirm("Reset ALL progress? This can't be undone (unless you copied your save code).")) return;
  const keep = {name: S.name, pid: S.pid, sup: S.sup}; S = migrate(keep); save(); $("sMsg").textContent = "Progress reset."; titleInfo(); buildTicks();
  $("saveCode").value = btoa(unescape(encodeURIComponent(JSON.stringify(S))));
};
$("sBack").onclick = () => closePanel("savep");
function renderSupport() {
  $("supCode").textContent = supCode();
  $("supStatus").textContent = S.sup ? "💖 You're a supporter — thank you! Your name glows gold in rooms." : (fbReady ? "Not linked yet. After supporting, it can take a little while to show up." : (window.FIREBASE_CONFIG ? "Checking…" : "Supporter badges need the online setup (Firebase)."));
}
function openSupport(from) { renderSupport(); watchSupporter().then(renderSupport); openPanel("sup", from); }
$("supCopy").onclick = () => { try { navigator.clipboard.writeText(supCode()); } catch (e) {} $("supCopy").textContent = "Copied!"; setTimeout(() => $("supCopy").textContent = "📋 Copy code", 1500); };
$("supBack").onclick = () => closePanel("sup");

/* ---------------- Main loop ---------------- */
let last = performance.now(), pushTimer = 0;
function frame(t) {
  const dt = Math.min(0.1, (t - last) / 1000); last = t;
  if (playing && !paused) update(dt);
  else if (!playing) { animT += dt * 6; curV = 1.4; pxm = pxpsOf(curV) / curV; camX += pxps() * dt; hero.wx = camX - W * 0.1; heroMoving = true; }
  try { draw(t); } catch (e) { console.error(e); }
  if (playing) updateHUD(dt);
  if (room) { pushTimer -= dt; if (pushTimer <= 0) { pushTimer = heroMoving ? 0.2 : 1.5; pushRoom(); } }
  requestAnimationFrame(frame);
}
resize(); buildTicks(); titleInfo();
if (window.FIREBASE_CONFIG) watchSupporter();
requestAnimationFrame(frame);
window.VOVA = {get S() { return S; }, set S(v) { S = v; }, hero, speedOf, needXP, R, save, CHALLENGES, startChallenge, get chal() { return chal; }};
