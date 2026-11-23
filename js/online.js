"use strict";
/* VOVA: RUN RUN RUN — online rooms + supporters (Firebase Realtime Database, optional) */
let db = null, fbReady = false, fbTried = false, serverOffset = 0;
let room = null, meRef = null, playersRef = null, others = {}, myEmote = "", myEmoteT = 0;
let supRef = null, supCodeWatched = "";
const ROOT = "vovarun/rooms", SUP_ROOT = "vovarun/supporters";
const now = () => Date.now() + serverOffset;
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
async function initFirebase() {
  if (fbTried) return fbReady; fbTried = true;
  const cfg = window.FIREBASE_CONFIG; if (!cfg || !cfg.databaseURL) return false;
  try {
    if (!window.firebase || !firebase.database) {
      await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
      await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js");
    }
    firebase.initializeApp(cfg); db = firebase.database();
    db.ref(".info/serverTimeOffset").on("value", s => serverOffset = s.val() || 0);
    fbReady = true;
  } catch (e) { console.warn("Firebase failed", e); fbReady = false; }
  return fbReady;
}
// supporter code: stable per player (travels with the save code)
function supCode() {
  let h = 2166136261; for (const c of S.pid) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 6; i++) { s += A[h % 32]; h = (Math.floor(h / 32) ^ Math.imul(h, 2654435761)) >>> 0; }
  return "VR-" + s;
}
async function watchSupporter() {
  if (!(await initFirebase())) return;
  const code = supCode(); if (code === supCodeWatched) return;
  if (supRef) supRef.off(); supCodeWatched = code;
  supRef = db.ref(SUP_ROOT + "/" + code);
  supRef.on("value", s => { const was = S.sup; S.sup = s.exists(); if (S.sup && !was) { bannerShow("💖 THANK YOU! 💖", "Supporter badge unlocked", 3); save(); } if (typeof renderSupport === "function") renderSupport(); }, () => {});
}
function othersList() { const t = now(); return Object.entries(others).filter(([k, p]) => k !== S.pid && p && t - (p.ts || 0) < 20000 && isFinite(p.pos)).map(([k, p]) => p).slice(0, 7); }
// Teammates are replayed from the positions they actually sent (no guessing ahead),
// ~0.25 s in the past, interpolating between their last two packets → smooth AND exact.
const ghosts = {}, INTERP_DELAY = 250;
function updateGhosts() {
  const t = now(), seen = new Set();
  Object.entries(others).forEach(([k, p]) => {
    if (k === S.pid || !p || t - (p.ts || 0) > 20000 || !isFinite(p.pos)) return;
    seen.add(k);
    let g = ghosts[k];
    if (!g) g = ghosts[k] = {buf: []};
    const last = g.buf[g.buf.length - 1];
    if (!last || p.ts !== last.t || p.pos !== last.pos) {
      if (last && p.ts <= last.t) g.buf.length = 0;        // clock jump / rejoin: start fresh
      g.buf.push({t: p.ts || t, pos: p.pos, y: p.y ?? 0.5});
      if (g.buf.length > 40) g.buf.splice(0, g.buf.length - 40);
    }
    const rt = t - INTERP_DELAY, buf = g.buf;
    let pos = buf[buf.length - 1].pos, y = buf[buf.length - 1].y;
    if (rt <= buf[0].t) { pos = buf[0].pos; y = buf[0].y; }
    else for (let i = buf.length - 1; i > 0; i--) {
      const A = buf[i - 1], B = buf[i];
      if (rt >= A.t && rt <= B.t) { const f = B.t > A.t ? (rt - A.t) / (B.t - A.t) : 1; pos = A.pos + (B.pos - A.pos) * f; y = A.y + (B.y - A.y) * f; break; }
    }
    g.dp = Math.max(0, pos); g.dy = y; g.p = p; g.v = p.v || speedOf(p.level || 1);
  });
  for (const k in ghosts) if (!seen.has(k)) delete ghosts[k];
  let i = 0; for (const k in ghosts) ghosts[k].i = i++;
}
function ghostList() { return Object.values(ghosts).filter(g => g.p).slice(0, 7); }
function myPacket() {
  return {name: S.name || "Vova", level: S.level, pos: S.pos, vel: myVel, v: effSpeed(),
    lg: Math.round(lgOf(Math.min(S.pos, EDGE)) * 1000) / 1000, run: heroMoving, mv: S.pos >= EDGE, uni: S.uni || 0,
    y: Math.round(hero.wy * 1000) / 1000, f: heroFace, sup: !!S.sup, ch: (S.ch || []).length,
    emote: myEmote || "", et: myEmoteT || 0, ts: firebase.database.ServerValue.TIMESTAMP};
}
async function openRooms(from) {
  openPanel("rooms", from); $("err").textContent = "";
  hide("roomOff"); hide("roomOut"); hide("roomIn");
  const ok = await initFirebase();
  if (!ok) { show("roomOff"); return; }
  if (room) { show("roomIn"); renderRoom(); } else { show("roomOut"); listRooms(); }
}
async function listRooms() {
  const box = $("rList"); box.textContent = "Loading…";
  try {
    const snap = await db.ref(ROOT).once("value"); const t = now(); const rows = [];
    snap.forEach(r => {
      const pl = r.child("players").val() || {}; const n = Object.values(pl).filter(p => t - (p.ts || 0) < 20000).length;
      const meta = r.child("meta").val() || {};
      if (n === 0) { if (t - (meta.created || 0) > 10 * 60000) r.ref.remove().catch(() => {}); return; }
      if (n < 8) rows.push({code: r.key, n, name: meta.name || r.key});
    });
    box.innerHTML = "";
    if (!rows.length) { box.textContent = "No open rooms right now — create one!"; return; }
    rows.slice(0, 20).forEach(r => { const d = el("div", "rl"); d.appendChild(el("span", "", r.name)); d.appendChild(el("b", "", r.code + " · " + r.n + "/8")); d.onclick = () => joinRoom(r.code); box.appendChild(d); });
  } catch (e) { box.textContent = "Couldn't load rooms. Check your Firebase rules."; }
}
function genCode() { const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
async function createRoom() {
  $("err").textContent = "Creating…";
  try {
    let code = genCode();
    for (let i = 0; i < 5; i++) { const ex = await db.ref(ROOT + "/" + code + "/meta").once("value"); if (!ex.exists()) break; code = genCode(); }
    await db.ref(ROOT + "/" + code + "/meta").set({name: (S.name || "Vova") + "'s room", created: firebase.database.ServerValue.TIMESTAMP});
    await joinRoom(code);
  } catch (e) { $("err").textContent = "Couldn't create room: " + (e.message || e); }
}
async function joinRoom(code) {
  code = (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (!code) { $("err").textContent = "Type a room code."; return; }
  $("err").textContent = "Joining…";
  try {
    if (room) await leaveRoom();
    const snap = await db.ref(ROOT + "/" + code).once("value");
    if (!snap.exists()) { $("err").textContent = "Room " + code + " not found."; return; }
    const pl = snap.child("players").val() || {}; const t = now();
    const n = Object.entries(pl).filter(([k, p]) => k !== S.pid && t - (p.ts || 0) < 20000).length;
    if (n >= 8) { $("err").textContent = "Room is full (8/8)."; return; }
    room = code; meRef = db.ref(ROOT + "/" + code + "/players/" + S.pid);
    await meRef.onDisconnect().remove();
    await meRef.set(myPacket());
    playersRef = db.ref(ROOT + "/" + code + "/players");
    playersRef.on("value", s => { others = s.val() || {}; if (!$("rooms").classList.contains("hidden")) renderRoom(); });
    $("err").textContent = "";
    hide("roomOut"); show("roomIn"); renderRoom();
    bannerShow("JOINED ROOM " + code, "Run back or forward to your friends — arrows show where they are", 3);
  } catch (e) { room = null; $("err").textContent = "Couldn't join: " + (e.message || e); }
}
async function leaveRoom() {
  if (!room) return;
  const code = room; room = null;
  try {
    if (playersRef) playersRef.off(); if (meRef) { await meRef.onDisconnect().cancel(); await meRef.remove(); }
    const s = await db.ref(ROOT + "/" + code + "/players").once("value");
    if (!s.exists()) await db.ref(ROOT + "/" + code).remove();
  } catch (e) {}
  others = {}; meRef = playersRef = null;
}
function renderRoom() {
  $("rCodeShow").textContent = room || "";
  const box = $("rPlayers"); box.innerHTML = "";
  const addRow = (p, col, me) => {
    const r = el("div", "pl"); const c = el("div", "c"); c.style.background = col; r.appendChild(c);
    r.appendChild(el("div", "n", (p.sup ? "💖 " : "") + (p.name || "?") + (me ? " (you)" : "")));
    const pos = p.pos || 0, ph = phaseOf(lgOf(Math.min(pos, EDGE)), pos >= EDGE), known = ph <= S.phase;
    const where = "Lv " + p.level + " · " + (known ? PHASES[ph].ic + " " + PHASES[ph].n : "❓ somewhere you haven't been");
    r.appendChild(el("div", "z", where + (p.run ? " 🏃" : " 💤")));
    if (!me && pos <= S.maxPos) { const go = el("button", "btn sm green", "➜ Go"); go.style.cssText = "width:auto;margin:0;padding:4px 10px"; go.onclick = () => { S.pos = pos; save(); pushRoom(); bannerShow("➜ " + p.name, "Warped to your friend!", 2); closePanel("rooms"); }; r.appendChild(go); }
    box.appendChild(r);
  };
  addRow({name: S.name, level: S.level, pos: S.pos, run: heroMoving, sup: S.sup}, "#ff4d6d", true);
  othersList().forEach((p, i) => addRow(p, PCOL[i % 8], false));
}
function sendEmote(e) { myEmote = e; myEmoteT = now(); pushRoom(); }
let lastSentMoving = null, lastSentPos = 0;
function pushRoom() {
  if (!room || !meRef) return;
  lastSentMoving = heroMoving; lastSentPos = S.pos;
  meRef.update(myPacket()).catch(() => {});
}
// send right away when you start/stop or warp, so friends see the exact spot
function needPushNow() { return room && (heroMoving !== lastSentMoving || Math.abs(S.pos - lastSentPos) > Math.max(1, Math.abs(lastSentPos) * 0.5) && !heroMoving); }
function roomMult() {
  let n = 0; const t = now();
  for (const k in others) { if (k === S.pid) continue; const p = others[k]; if (p && p.run && t - (p.ts || 0) < 6000) n++; }
  return Math.min(0.35, n * 0.05);
}
