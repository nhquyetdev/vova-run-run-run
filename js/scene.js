"use strict";
/* VOVA: RUN RUN RUN — scenery renderer (deterministic: same place always looks the same) */
const cv = document.getElementById("cv"), ctx = cv.getContext("2d");
let W = 0, H = 0, DPR = 1;
function resize() { DPR = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
addEventListener("resize", resize);

// geometry of the running band (you can move up/down inside it)
const portrait = () => H > W;
function bandTop() { return H * (portrait() ? 0.6 : 0.64); }
function bandBot() { return H * (portrait() ? 0.82 : 0.9); }
function horizon() { return bandTop() - H * 0.1; }

// deterministic noise
function hsh(n, s) { const x = Math.sin(n * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); }
function vnoise(x, s) { const i = Math.floor(x), f = x - i, u = (1 - Math.cos(f * Math.PI)) / 2; return hsh(i, s) * (1 - u) + hsh(i + 1, s) * u; }
function fbm(x, s) { return vnoise(x, s) * 0.6 + vnoise(x * 2.1, s + 7) * 0.28 + vnoise(x * 4.3, s + 13) * 0.12; }
const mod = (a, b) => ((a % b) + b) % b;
function lerp(a, b, t) { return a + (b - a) * t; }
function hexRgb(h) { const p = parseInt(h.slice(1), 16); return [(p >> 16) & 255, (p >> 8) & 255, p & 255]; }
function mix(a, b, t) { const A = hexRgb(a), B = hexRgb(b); return `rgb(${lerp(A[0], B[0], t) | 0},${lerp(A[1], B[1], t) | 0},${lerp(A[2], B[2], t) | 0})`; }
function vgrad(y0, y1, stops) { const g = ctx.createLinearGradient(0, y0, 0, y1); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; }

/* ---------- reusable pieces ---------- */
function ridge(p, base, amp, scale, seed, fill, sharp) {
  const off = camX * p;
  ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(-10, H);
  for (let x = -10; x <= W + 10; x += 5) {
    let n = fbm((x + off) / scale, seed);
    if (sharp) n = 1 - Math.abs(n * 2 - 1) * 0.9 + n * 0.4;
    ctx.lineTo(x, base - amp * n);
  }
  ctx.lineTo(W + 10, H); ctx.closePath(); ctx.fill();
}
function snowRidge(p, base, amp, scale, seed, sharp, snowAt = 0.78) {
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, base - amp * snowAt); ctx.clip();
  ridge(p, base, amp, scale, seed, "rgba(245,248,255,0.92)", sharp); ctx.restore();
}
// iterate cells of a parallax layer: f(screenX, cellIndex)
function cells(p, cw, seed, chance, f) {
  const off = camX * p, k0 = Math.floor((off - 250) / cw), k1 = Math.floor((off + W + 250) / cw);
  for (let k = k0; k <= k1; k++) { if (hsh(k, seed) > chance) continue; f(k * cw - off + hsh(k, seed + 1) * cw * 0.5, k); }
}
function cloud(x, y, s, a) {
  ctx.save(); ctx.globalAlpha *= a;
  const puffs = [[0, 0, 34], [32, -14, 30], [62, -4, 28], [-30, 2, 24], [88, 6, 20]];
  for (const [dx, dy, r] of puffs) {
    const g = ctx.createRadialGradient(x + dx * s, y + dy * s - r * s * 0.4, r * s * 0.2, x + dx * s, y + dy * s, r * s);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.75, "rgba(240,245,252,.95)"); g.addColorStop(1, "rgba(220,230,245,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 7); ctx.fill();
  }
  ctx.fillStyle = "rgba(190,205,225,.35)"; ctx.beginPath(); ctx.ellipse(x + 28 * s, y + 18 * s, 70 * s, 10 * s, 0, 0, 7); ctx.fill();
  ctx.restore();
}
function sunDisc(x, y, r, col) {
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 4);
  g.addColorStop(0, col || "rgba(255,250,225,1)"); g.addColorStop(0.25, "rgba(255,240,190,.45)"); g.addColorStop(1, "rgba(255,240,190,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, 7); ctx.fill();
  ctx.fillStyle = "#fffbe8"; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
}
function tree(x, by, s, kind, seed) {
  if (kind === 1) { // coconut palm
    const lean = (hsh(seed, 9) - 0.5) * 30 * s, h = 120 * s;
    ctx.strokeStyle = "#7a5a3a"; ctx.lineWidth = 7 * s; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x, by); ctx.quadraticCurveTo(x + lean * 0.2, by - h * 0.6, x + lean, by - h); ctx.stroke();
    ctx.strokeStyle = "#8d6b48"; ctx.lineWidth = 2 * s;
    for (let i = 1; i < 8; i++) { const t = i / 8, yy = by - h * t, xx = x + lean * t * t; ctx.beginPath(); ctx.moveTo(xx - 3.5 * s, yy); ctx.lineTo(xx + 3.5 * s, yy - 2 * s); ctx.stroke(); }
    const tx = x + lean, ty = by - h;
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (i - 3.5) * 0.42, len = (52 + hsh(seed + i, 3) * 14) * s;
      const ex = tx + Math.cos(a) * len * 1.3, ey = ty + Math.sin(a) * len * 0.45 + len * 0.55;
      ctx.strokeStyle = i % 2 ? "#2f7a33" : "#3e9440"; ctx.lineWidth = 6 * s;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(a) * len * 0.8, ty - 20 * s, ex, ey); ctx.stroke();
    }
    ctx.fillStyle = "#6b4a2a"; ctx.beginPath(); ctx.arc(tx, ty + 4 * s, 6 * s, 0, 7); ctx.fill();
    return;
  }
  if (kind === 2) { // pine
    const h = 90 * s;
    ctx.fillStyle = "#4b3424"; ctx.fillRect(x - 3 * s, by - 14 * s, 6 * s, 14 * s);
    for (let i = 0; i < 4; i++) {
      const w = (34 - i * 7) * s, yb = by - 10 * s - i * h * 0.2, yt = yb - h * 0.38;
      const g = ctx.createLinearGradient(x - w, 0, x + w, 0); g.addColorStop(0, "#1f4d2c"); g.addColorStop(0.55, "#2f6b3c"); g.addColorStop(1, "#173d22");
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w, yb); ctx.lineTo(x, yt); ctx.lineTo(x + w, yb); ctx.closePath(); ctx.fill();
    }
    return;
  }
  // broadleaf
  ctx.fillStyle = "#5b3f2a"; ctx.fillRect(x - 4 * s, by - 34 * s, 8 * s, 34 * s);
  const blobs = [[0, -62, 30], [-22, -48, 22], [22, -46, 24], [-8, -80, 20], [14, -72, 20]];
  const hue = 95 + hsh(seed, 5) * 30;
  for (const [dx, dy, r] of blobs) {
    const g = ctx.createRadialGradient(x + dx * s - r * s * 0.4, by + dy * s - r * s * 0.4, r * s * 0.1, x + dx * s, by + dy * s, r * s);
    g.addColorStop(0, `hsl(${hue},45%,52%)`); g.addColorStop(1, `hsl(${hue},50%,26%)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + dx * s, by + dy * s, r * s, 0, 7); ctx.fill();
  }
}
const WALLS = ["#f2d98c", "#f4e6c8", "#cfe3e8", "#f0c9a8", "#e9e2d0", "#f5d27a"];
function house(x, by, s, seed) {
  const tall = hsh(seed, 21) > 0.55; // Vietnamese tube house vs cottage
  const wall = WALLS[Math.floor(hsh(seed, 22) * WALLS.length)];
  if (tall) {
    const w = 56 * s, h = (110 + hsh(seed, 23) * 50) * s;
    ctx.fillStyle = vgrad(by - h, by, [wall, mix(wall, "#8a7a60", 0.25)]); ctx.fillRect(x - w / 2, by - h, w, h);
    ctx.fillStyle = "rgba(0,0,0,.12)"; ctx.fillRect(x + w / 2 - 6 * s, by - h, 6 * s, h);
    const floors = Math.floor(h / (36 * s));
    for (let f = 0; f < floors; f++) {
      const fy = by - h + 10 * s + f * 36 * s;
      ctx.fillStyle = "#3d5a73"; ctx.fillRect(x - 16 * s, fy, 32 * s, 18 * s);
      ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.fillRect(x - 16 * s, fy, 32 * s, 4 * s);
      if (f > 0) { ctx.fillStyle = "#6b6b6b"; ctx.fillRect(x - 24 * s, fy + 20 * s, 48 * s, 3 * s); ctx.fillStyle = "#3f8f4a"; ctx.fillRect(x - 22 * s, fy + 14 * s, 8 * s, 6 * s); }
    }
    ctx.fillStyle = "#a8432f"; ctx.fillRect(x - w / 2 - 3 * s, by - h - 6 * s, w + 6 * s, 7 * s);
    ctx.fillStyle = "#5a3a28"; ctx.fillRect(x - 12 * s, by - 26 * s, 24 * s, 26 * s);
  } else {
    const w = 96 * s, h = 46 * s;
    ctx.fillStyle = vgrad(by - h, by, [wall, mix(wall, "#8a7a60", 0.3)]); ctx.fillRect(x - w / 2, by - h, w, h);
    // tiled roof
    const rg = ctx.createLinearGradient(0, by - h - 34 * s, 0, by - h); rg.addColorStop(0, "#b4533a"); rg.addColorStop(1, "#7e3424");
    ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(x - w / 2 - 10 * s, by - h); ctx.lineTo(x - w / 2 + 18 * s, by - h - 34 * s); ctx.lineTo(x + w / 2 - 18 * s, by - h - 34 * s); ctx.lineTo(x + w / 2 + 10 * s, by - h); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(60,20,10,.35)"; ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) { const yy = by - h - i * 8.5 * s; ctx.beginPath(); ctx.moveTo(x - w / 2 - 10 * s + i * 7 * s, yy); ctx.lineTo(x + w / 2 + 10 * s - i * 7 * s, yy); ctx.stroke(); }
    ctx.fillStyle = "#5a3a28"; ctx.fillRect(x - 10 * s, by - 30 * s, 20 * s, 30 * s);
    for (const dx of [-32, 22]) { ctx.fillStyle = "#3d5a73"; ctx.fillRect(x + dx * s, by - 34 * s, 14 * s, 14 * s); ctx.fillStyle = "#6b4a2a"; ctx.fillRect(x + dx * s - 3 * s, by - 34 * s, 3 * s, 14 * s); ctx.fillRect(x + dx * s + 14 * s, by - 34 * s, 3 * s, 14 * s); }
  }
  ctx.fillStyle = "rgba(0,0,0,.15)"; ctx.beginPath(); ctx.ellipse(x, by, 60 * s, 5 * s, 0, 0, 7); ctx.fill();
}
function poles(p, by, h, spacing, alpha) {
  const off = camX * p, k0 = Math.floor((off - 100) / spacing), k1 = Math.floor((off + W + 100) / spacing);
  ctx.save(); ctx.globalAlpha *= alpha;
  let prev = null;
  for (let k = k0; k <= k1; k++) {
    const x = k * spacing - off;
    ctx.fillStyle = "#6e6a64"; ctx.fillRect(x - 3, by - h, 6, h);
    ctx.fillStyle = "#55514c"; ctx.fillRect(x - 18, by - h + 8, 36, 4);
    if (prev !== null) {
      ctx.strokeStyle = "rgba(40,40,40,.55)"; ctx.lineWidth = 1.2;
      for (const dy of [9, 18]) for (const dx of [-15, 15]) { ctx.beginPath(); ctx.moveTo(prev + dx, by - h + dy); ctx.quadraticCurveTo((prev + x) / 2 + dx, by - h + dy + 22, x + dx, by - h + dy); ctx.stroke(); }
    }
    prev = x;
  }
  ctx.restore();
}

/* ---------- Earth sub-scenes ---------- */
function earthVillage() {
  const hz = horizon(), bt = bandTop();
  ctx.fillStyle = vgrad(0, hz, ["#3f86d6", "#8cc2ee", "#dceffa"]); ctx.fillRect(0, 0, W, hz + 2);
  sunDisc(W * 0.82, H * 0.14, 26);
  cells(0.04, 340, 3, 0.55, (x, k) => cloud(x, H * (0.08 + hsh(k, 4) * 0.2), 0.7 + hsh(k, 5) * 0.6, 0.95));
  ridge(0.05, hz - H * 0.04, H * 0.16, 420, 11, "#a9c2d6");
  ridge(0.12, hz + 2, H * 0.1, 260, 12, "#7da48c");
  ridge(0.18, hz + 6, H * 0.04, 60, 13, "#5d8d63");
  ctx.fillStyle = vgrad(hz, bt, ["#7fb36b", "#5f9a4e"]); ctx.fillRect(0, hz, W, bt - hz + 2);
  const rowY = lerp(hz, bt, 0.55);
  cells(0.45, 170, 31, 0.75, (x, k) => { if (hsh(k, 32) < 0.55) house(x, rowY, 0.75, k); else tree(x, rowY, 0.8, 0, k); });
  cells(0.62, 230, 41, 0.5, (x, k) => tree(x, lerp(hz, bt, 0.85), 1.0, 0, k + 99));
  poles(0.8, bt - 2, H * 0.24, 300, 1);
  pathDirt("#c9a878", "#a98656", "#7fb36b");
}
function earthRice() {
  const hz = horizon(), bt = bandTop();
  ctx.fillStyle = vgrad(0, hz, ["#4d93d9", "#a6cdea", "#efe6cf"]); ctx.fillRect(0, 0, W, hz + 2);
  sunDisc(W * 0.78, H * 0.16, 24);
  cells(0.04, 360, 5, 0.5, (x, k) => cloud(x, H * (0.07 + hsh(k, 6) * 0.18), 0.6 + hsh(k, 7) * 0.5, 0.9));
  // limestone karst towers (Ninh Bình / Hạ Long style), misty
  for (const [p, col, sc, seed, baseUp] of [[0.05, "#a8b8b6", 0.8, 51, 0.06], [0.1, "#7f988b", 1, 52, 0.0]]) {
    cells(p, 110 * sc, seed, 0.6, (x, k) => {
      const h = (90 + hsh(k, seed + 2) * 140) * sc * (H / 720), w = (60 + hsh(k, seed + 3) * 50) * sc, by = hz + 4 - H * baseUp;
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - w / 2, by);
      ctx.bezierCurveTo(x - w * 0.5, by - h * 0.7, x - w * 0.35, by - h, x, by - h);
      ctx.bezierCurveTo(x + w * 0.4, by - h, x + w * 0.55, by - h * 0.6, x + w / 2, by); ctx.closePath(); ctx.fill();
    });
  }
  ctx.fillStyle = "rgba(235,240,235,.35)"; ctx.fillRect(0, hz - H * 0.05, W, H * 0.06);
  // rice paddies with perspective parallax
  const rows = 7;
  for (let r = 0; r < rows; r++) {
    const y0 = lerp(hz, bt, r / rows), y1 = lerp(hz, bt, (r + 1) / rows), p = lerp(0.25, 0.85, r / rows);
    ctx.fillStyle = r % 2 ? "#79b14a" : "#8cc256"; ctx.fillRect(0, y0, W, y1 - y0 + 1);
    ctx.fillStyle = "rgba(180,220,240,.35)"; ctx.fillRect(0, y1 - 2, W, 2);
    const cw = 150 * (0.5 + r / rows), off = camX * p;
    ctx.strokeStyle = "rgba(90,120,60,.6)"; ctx.lineWidth = 1.5;
    for (let k = Math.floor(off / cw) - 1; k <= Math.floor((off + W) / cw) + 1; k++) { const x = k * cw - off; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x - 6, y1); ctx.stroke(); }
  }
  cells(0.5, 200, 61, 0.55, (x, k) => tree(x, lerp(hz, bt, 0.62), 0.75, 1, k));
  cells(0.75, 280, 62, 0.45, (x, k) => tree(x, bt - 4, 1.05, 1, k + 50));
  pathDirt("#b99a68", "#9a7b4c", "#7cae4c", true);
}
function earthMountain() {
  const hz = horizon(), bt = bandTop();
  ctx.fillStyle = vgrad(0, hz, ["#2c64b8", "#7fb0e2", "#d4e6f5"]); ctx.fillRect(0, 0, W, hz + 2);
  sunDisc(W * 0.75, H * 0.12, 22);
  cells(0.03, 400, 8, 0.45, (x, k) => cloud(x, H * (0.1 + hsh(k, 9) * 0.12), 0.6, 0.8));
  ridge(0.03, hz - H * 0.05, H * 0.36, 300, 71, "#f3f6fb", true); ridge(0.03, hz - H * 0.05, H * 0.36 * 0.8, 300, 71, "#9fb2c9", true);
  ridge(0.08, hz, H * 0.22, 220, 72, "#e8eef6", true); ridge(0.08, hz, H * 0.22 * 0.86, 220, 72, "#6f7884", true);
  ridge(0.16, hz + 6, H * 0.12, 150, 73, "#5f6e62");
  ctx.fillStyle = vgrad(hz, bt, ["#6f8a5a", "#56704a"]); ctx.fillRect(0, hz, W, bt - hz + 2);
  cells(0.35, 60, 81, 0.6, (x, k) => tree(x, lerp(hz, bt, 0.45), 0.6 + hsh(k, 82) * 0.25, 2, k));
  cells(0.6, 90, 83, 0.5, (x, k) => tree(x, lerp(hz, bt, 0.9), 0.9 + hsh(k, 84) * 0.3, 2, k));
  cells(0.6, 160, 85, 0.4, (x, k) => { ctx.fillStyle = "#8a8580"; ctx.beginPath(); ctx.ellipse(x, lerp(hz, bt, 0.95), 24, 12, 0, Math.PI, 0); ctx.fill(); });
  pathDirt("#9d968c", "#7c766d", "#5d6f4f");
}
function earthClouds() {
  const hz = horizon(), bt = bandTop();
  ctx.fillStyle = vgrad(0, hz, ["#0b1b48", "#2f5fa8", "#9cc6ee"]); ctx.fillRect(0, 0, W, hz + 2);
  sunDisc(W * 0.8, H * 0.18, 20);
  ridge(0.02, hz + 4, H * 0.12, 260, 91, "#f3f6fb", true); ridge(0.02, hz + 4, H * 0.12 * 0.8, 260, 91, "#b9c6d8", true);
  ctx.fillStyle = vgrad(hz, H, ["#e9f1fb", "#c7d8ee"]); ctx.fillRect(0, hz, W, H - hz);
  for (let r = 0; r < 5; r++) {
    const y = lerp(hz, H, r / 5) + 6, p = 0.15 + r * 0.18, s = 0.6 + r * 0.35;
    cells(p, 150 * s, 100 + r, 0.8, (x, k) => cloud(x, y, s, 0.9));
  }
  roadGlow(200);
}
function pathDirt(c1, c2, front, water) {
  const bt = bandTop(), bb = bandBot();
  ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(0, bt - 6, W, 6);
  ctx.fillStyle = vgrad(bt, bb, [c1, c2]); ctx.fillRect(0, bt, W, bb - bt);
  ctx.strokeStyle = "rgba(0,0,0,.08)"; ctx.lineWidth = 3;
  for (const t of [0.35, 0.68]) { ctx.beginPath(); ctx.moveTo(0, lerp(bt, bb, t)); ctx.lineTo(W, lerp(bt, bb, t)); ctx.stroke(); }
  const off = camX, cw = 26;
  for (let k = Math.floor(off / cw) - 1; k <= Math.floor((off + W) / cw) + 1; k++) {
    if (hsh(k, 201) > 0.6) continue;
    const x = k * cw - off + hsh(k, 202) * cw, y = lerp(bt + 4, bb - 4, hsh(k, 203)), r = 1.5 + hsh(k, 204) * 3;
    ctx.fillStyle = "rgba(90,70,50,.45)"; ctx.beginPath(); ctx.ellipse(x, y, r * 1.4, r, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.3, r * 0.6, r * 0.4, 0, 0, 7); ctx.fill();
  }
  if (water) {
    ctx.fillStyle = vgrad(bb, H, ["#7fb5c9", "#5d93a8"]); ctx.fillRect(0, bb, W, H - bb);
    ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) { const y = bb + 8 + i * 9, o = mod(camX * 1.1 + i * 37, 80); for (let x = -o; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 26, y); ctx.stroke(); } }
    ctx.fillStyle = "#6fa24a";
    cells(1.1, 18, 211, 0.6, (x, k) => { ctx.fillRect(x, bb + 4 + hsh(k, 212) * 30, 2, -10 - hsh(k, 213) * 10); });
  } else {
    ctx.fillStyle = vgrad(bb, H, [front, mix(front, "#203018", 0.5)]); ctx.fillRect(0, bb, W, H - bb);
    ctx.strokeStyle = mix(front, "#ffffff", 0.2); ctx.lineWidth = 2;
    const o2 = camX * 1.15;
    for (let k = Math.floor(o2 / 7); k <= Math.floor((o2 + W) / 7); k++) { const x = k * 7 - o2, h = 6 + hsh(k, 220) * 10; ctx.beginPath(); ctx.moveTo(x, bb + 2); ctx.lineTo(x + 2, bb + 2 - h); ctx.stroke(); }
  }
}
function roadGlow(hue) {
  const bt = bandTop(), bb = bandBot();
  ctx.fillStyle = `hsla(${hue},80%,70%,.16)`; ctx.fillRect(0, bt, W, bb - bt);
  ctx.fillStyle = vgrad(bt - 4, bt + 10, [`hsla(${hue},100%,85%,0)`, `hsla(${hue},100%,80%,.9)`, `hsla(${hue},100%,70%,0)`]); ctx.fillRect(0, bt - 4, W, 14);
  ctx.fillStyle = vgrad(bb - 10, bb + 4, [`hsla(${hue + 60},100%,70%,0)`, `hsla(${hue + 60},100%,80%,.8)`, `hsla(${hue + 60},100%,85%,0)`]); ctx.fillRect(0, bb - 10, W, 14);
  ctx.fillStyle = `hsla(${hue + 30},100%,90%,.5)`;
  const o = mod(camX, 70); for (let x = -o; x < W; x += 70) ctx.fillRect(x, lerp(bt, bb, 0.5), 30, 2);
}

/* ---------- Space ---------- */
const SPACE_COLS = [ // [lg, top, bottom]
  [4.9, "#020414", "#0b1d4a"], [8.0, "#03030d", "#121233"], [9.6, "#08040a", "#24150c"], [13.3, "#02030a", "#0b1530"],
  [16, "#05020f", "#1a0d33"], [19, "#0a0418", "#3a1a4f"], [21.2, "#010108", "#0e0b2a"], [23.3, "#060010", "#2a0838"], [27, "#060010", "#2a0838"]
];
function spaceCols(lg) {
  for (let i = 0; i < SPACE_COLS.length - 1; i++) {
    const a = SPACE_COLS[i], b = SPACE_COLS[i + 1];
    if (lg < b[0]) { const t = Math.max(0, Math.min(1, (lg - (b[0] - 0.6)) / 0.6)); return [mix(a[1], b[1], t), mix(a[2], b[2], t)]; }
  }
  return [SPACE_COLS[8][1], SPACE_COLS[8][2]];
}
let STARS = [];
function buildStars() { STARS = []; for (let i = 0; i < 260; i++) STARS.push({x: Math.random() * 3000, y: Math.random(), z: Math.random() * 0.9 + 0.1, tw: Math.random() * 6, h: Math.random()}); }
buildStars();
// sky bodies fade in/out by distance; fixed in the sky (slight parallax), so walking backwards still looks right
const BODIES = [
  {lg:8.58, w:0.45, x:0.72, y:0.24, r:0.16, k:"moon"},
  {lg:11.17, w:0.9, x:0.25, y:0.22, r:0.12, k:"sun"},
  {lg:11.8, w:0.25, x:0.7, y:0.2, r:0.1, k:"planet", c1:"#e8c39a", c2:"#a0704a", band:1},
  {lg:12.1, w:0.2, x:0.62, y:0.26, r:0.08, k:"planet", c1:"#f1dfa8", c2:"#b59a5a", ring:1},
  {lg:12.63, w:0.18, x:0.75, y:0.24, r:0.06, k:"planet", c1:"#7fb2ff", c2:"#2a4fb0"},
  {lg:16.6, w:0.6, x:0.7, y:0.25, r:0.025, k:"star", c:"#ffd2a8"},
  {lg:18.7, w:0.3, x:0.3, y:0.2, r:0.05, k:"star", c:"#ff7a4a"},
  {lg:19.1, w:0.35, x:0.68, y:0.26, r:0.22, k:"nebula", c:"#ff6fb0", c2:"#6fa8ff"},
  {lg:20.4, w:0.5, x:0.55, y:0.3, r:0.25, k:"core"},
  {lg:22.38, w:0.6, x:0.7, y:0.26, r:0.24, k:"spiral", hue:220},
  {lg:23.7, w:0.4, x:0.4, y:0.22, r:0.2, k:"cluster"},
  {lg:26.3, w:0.4, x:0.5, y:0.3, r:0.6, k:"cmb"}
];
function drawBody(b, a, t) {
  const R = Math.min(W, H) * b.r * (0.6 + 0.4 * a), x = W * b.x - camX * 0.01, y = H * b.y;
  ctx.save(); ctx.globalAlpha = a;
  if (b.k === "moon") {
    const g = ctx.createRadialGradient(x - R * 0.3, y - R * 0.3, R * 0.1, x, y, R); g.addColorStop(0, "#f2f0ea"); g.addColorStop(1, "#8d8a84");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
    for (let i = 0; i < 9; i++) { ctx.fillStyle = "rgba(90,88,84,.35)"; ctx.beginPath(); ctx.arc(x + (hsh(i, 1) - 0.5) * R * 1.3, y + (hsh(i, 2) - 0.5) * R * 1.3, R * (0.06 + hsh(i, 3) * 0.14), 0, 7); ctx.fill(); }
  } else if (b.k === "sun") { sunDisc(x, y, R * 0.5, "rgba(255,245,200,1)");
  } else if (b.k === "planet") {
    if (b.ring) { ctx.strokeStyle = "rgba(230,210,160,.7)"; ctx.lineWidth = R * 0.18; ctx.beginPath(); ctx.ellipse(x, y, R * 2, R * 0.5, -0.3, 0, 7); ctx.stroke(); }
    const g = ctx.createRadialGradient(x - R * 0.35, y - R * 0.35, R * 0.1, x, y, R); g.addColorStop(0, b.c1); g.addColorStop(1, b.c2);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
    if (b.band) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.clip(); ctx.fillStyle = "rgba(150,90,50,.35)"; for (const dy of [-0.4, -0.1, 0.25, 0.5]) ctx.fillRect(x - R, y + dy * R, R * 2, R * 0.12); ctx.restore(); }
  } else if (b.k === "star") {
    const g = ctx.createRadialGradient(x, y, 0, x, y, R * 6); g.addColorStop(0, "#fff"); g.addColorStop(0.15, b.c); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 6, 0, 7); ctx.fill();
  } else if (b.k === "nebula") {
    for (let i = 0; i < 7; i++) { const gx = x + (hsh(i, 11) - 0.5) * R * 2, gy = y + (hsh(i, 12) - 0.5) * R; const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, R * 0.8); g.addColorStop(0, i % 2 ? b.c : b.c2); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.globalAlpha = a * 0.35; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(gx, gy, R * 0.8, 0, 7); ctx.fill(); }
  } else if (b.k === "core") {
    const g = ctx.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, "rgba(255,240,210,1)"); g.addColorStop(0.3, "rgba(255,200,150,.6)"); g.addColorStop(1, "rgba(120,60,120,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, R * 1.8, R * 0.7, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(x, y, R * 0.06, 0, 7); ctx.fill();
  } else if (b.k === "spiral") { spiral(x, y, R, t / 9000, b.hue, 1);
  } else if (b.k === "cluster") { for (let i = 0; i < 26; i++) spiral(x + (hsh(i, 31) - 0.5) * R * 3, y + (hsh(i, 32) - 0.5) * R * 1.4, R * (0.08 + hsh(i, 33) * 0.12), i, (i * 47) % 360, 0.9);
  } else if (b.k === "cmb") {
    for (let i = 0; i < 40; i++) { ctx.globalAlpha = a * 0.25; ctx.fillStyle = `hsl(${hsh(i, 41) > 0.5 ? 20 : 210},90%,60%)`; ctx.beginPath(); ctx.arc(W * hsh(i, 42), H * 0.75 * hsh(i, 43), 30 + hsh(i, 44) * 60, 0, 7); ctx.fill(); }
  }
  ctx.restore();
}
function spiral(x, y, r, rot, hue, a) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, 0.5); ctx.globalAlpha *= a;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, `hsla(${hue},90%,92%,1)`); g.addColorStop(0.3, `hsla(${hue},80%,65%,.55)`); g.addColorStop(1, `hsla(${hue},80%,50%,0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
  ctx.strokeStyle = `hsla(${hue},90%,82%,.45)`; ctx.lineWidth = Math.max(1, r * 0.07);
  for (let k = 0; k < 2; k++) { ctx.beginPath(); for (let t = 0; t < 9; t += 0.25) { const rr = r * 0.11 * t; ctx.lineTo(Math.cos(t + k * Math.PI) * rr, Math.sin(t + k * Math.PI) * rr); } ctx.stroke(); }
  ctx.restore();
}
function drawEarthCurve(lg) {
  const t = Math.max(0, Math.min(1, (lg - 4.9) / 2.4)); const r = W * (3.2 - 2.9 * t);
  const cx = W * 0.2, cy = H + r * 0.82 - t * H * 0.25;
  const g = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.05);
  g.addColorStop(0, "#1d6fd1"); g.addColorStop(0.93, "#3fa0ff"); g.addColorStop(0.97, "rgba(140,200,255,.7)"); g.addColorStop(1, "rgba(140,200,255,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 1.05, 0, 7); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r * 0.99, 0, 7); ctx.clip();
  for (let i = 0; i < 14; i++) { const a = -Math.PI / 2 + (hsh(i, 51) - 0.5) * 1.6; ctx.fillStyle = hsh(i, 52) > 0.5 ? "rgba(70,150,80,.55)" : "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * r * 0.97, cy + Math.sin(a) * r * 0.97, r * 0.08, r * 0.03, a, 0, 7); ctx.fill(); }
  ctx.restore();
}
function drawSpace(lg, mv, t, speedPx, moving) {
  const [top, bot] = mv ? [`hsl(${curUniHue()},70%,8%)`, `hsl(${(curUniHue() + 60) % 360},60%,22%)`] : spaceCols(lg);
  ctx.fillStyle = vgrad(0, H, [top, bot]); ctx.fillRect(0, 0, W, H);
  if (!mv && lg >= 19 && lg < 21.4) { // Milky Way band
    ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = vgrad(H * 0.15, H * 0.55, ["rgba(255,200,255,0)", "rgba(255,225,240,.9)", "rgba(150,170,255,0)"]);
    ctx.beginPath(); ctx.ellipse(W / 2 - camX * 0.005, H * 0.33, W * 0.75, H * 0.09, -0.2, 0, 7); ctx.fill(); ctx.restore();
  }
  // stars (parallax with camera, streaks when moving fast)
  const streak = moving ? Math.min(180, speedPx * 0.12) : 0, dir = Math.sign(heroFace || 1);
  for (const s of STARS) {
    const x = mod(s.x - camX * s.z * 0.5, W + 40) - 20, y = s.y * H * 0.95;
    const tw = 0.6 + 0.4 * Math.sin(t / 400 + s.tw);
    const col = mv ? `hsla(${(curUniHue() + s.h * 120) % 360},100%,85%,${s.z * tw})` : `rgba(255,255,255,${s.z * tw})`;
    if (streak > 3) { ctx.strokeStyle = col; ctx.lineWidth = s.z * 1.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dir * streak * s.z, y); ctx.stroke(); }
    else { ctx.fillStyle = col; ctx.fillRect(x, y, s.z * 2, s.z * 2); }
  }
  if (!mv && lg < 7.4) drawEarthCurve(lg);
  if (!mv) for (const b of BODIES) { const a = Math.max(0, 1 - Math.abs(lg - b.lg) / b.w); if (a > 0.01) drawBody(b, Math.min(1, a * 1.4), t); }
  if (!mv && lg >= 21.2 && lg < 23.3) for (let i = 0; i < 9; i++) spiral(mod(hsh(i, 61) * 2400 - camX * 0.04, W + 200) - 100, H * (0.08 + hsh(i, 62) * 0.45), 18 + hsh(i, 63) * 30, t / 6000 + i, (i * 53) % 360, 0.8);
  if (!mv && lg >= 23.3) drawWeb(lg);
  if (mv) drawBubbles(t);
  roadGlow(mv ? curUniHue() : mod(t / 40, 360));
}
function drawWeb() {
  const pts = []; for (let i = 0; i < 46; i++) pts.push([mod(hsh(i, 71) * 2600 - camX * 0.05, W + 200) - 100, H * 0.78 * hsh(i, 72), 1 + hsh(i, 73) * 3]);
  ctx.strokeStyle = "rgba(200,120,255,.3)"; ctx.lineWidth = 1.2;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (d < 150) { ctx.globalAlpha = 1 - d / 150; ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[j][0], pts[j][1]); ctx.stroke(); } }
  ctx.globalAlpha = 1; ctx.fillStyle = "rgba(255,200,255,.85)"; for (const p of pts) { ctx.beginPath(); ctx.arc(p[0], p[1], p[2], 0, 7); ctx.fill(); }
}
function drawBubbles(t) {
  for (let i = 0; i < 16; i++) {
    const r = 18 + hsh(i, 81) * 50, x = mod(hsh(i, 82) * 2600 - camX * (0.03 + hsh(i, 83) * 0.05), W + 240) - 120, y = 70 + H * 0.55 * hsh(i, 84) + Math.sin(t / 900 + i) * 6, hue = (curUniHue() + i * 29) % 360;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, `hsla(${hue},100%,90%,.5)`); g.addColorStop(0.8, `hsla(${hue},90%,55%,.18)`); g.addColorStop(1, `hsla(${hue},90%,75%,.6)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
}

/* ---------- main background entry ---------- */
const EARTH_SUBS = [[-99, earthVillage], [2.0, earthRice], [3.3, earthMountain], [4.0, earthClouds], [4.9, null]];
function drawWorld(lg, mv, t, speedPx, moving) {
  if (mv || lg >= 4.9) { drawSpace(lg, mv, t, speedPx, moving); return; }
  // cross-fade during the last 0.3 (log10 m) before each boundary
  let i = 0; for (let k = 0; k < EARTH_SUBS.length; k++) if (lg >= EARTH_SUBS[k][0]) i = k;
  const next = EARTH_SUBS[i + 1], fade = next ? Math.max(0, Math.min(1, (lg - (next[0] - 0.3)) / 0.3)) : 0;
  ctx.globalAlpha = 1;
  if (EARTH_SUBS[i][1]) EARTH_SUBS[i][1](); else drawSpace(lg, false, t, speedPx, moving);
  if (fade > 0 && next) { ctx.globalAlpha = fade; if (next[1]) next[1](); else drawSpace(lg, false, t, speedPx, moving); ctx.globalAlpha = 1; }
}
