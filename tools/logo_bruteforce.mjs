// Brute-force template matching of the DSi screen (one rounded-rect ring, /tmp/screen_tpl.png)
// against every frame of the boot logo animation. Slides the template over all positions and a
// range of scales and reports EVERY screen instance per frame (not just two) - so it captures
// the duplicate screens that slide in and fade out, which per-object tracking misses. Each
// detection: centre (x,y), width (scale), recall (match strength), and opacity (from the ring's
// gray level). Output: webapp/public/boot/logo_dets.json, one detection list per logo frame.
import { execSync } from 'child_process';
import fs from 'fs';

function loadMask(path) {
  const ppm = execSync(`convert "${path}" -depth 8 ppm:-`, { maxBuffer: 1 << 26 });
  let o = 0; const tok = () => { while ([32, 10, 9].includes(ppm[o])) o++; let s = o; while (![32, 10, 9].includes(ppm[o])) o++; return ppm.toString('latin1', s, o); };
  tok(); const W = +tok(), H = +tok(); tok(); o++; const d = ppm.subarray(o);
  return { W, H, d };
}
const tpl = loadMask('/tmp/screen_tpl.png');
const tInk = new Uint8Array(tpl.W * tpl.H);
for (let i = 0; i < tpl.W * tpl.H; i++) tInk[i] = tpl.d[i * 3] < 128 ? 1 : 0;   // ring ink
// ring ink offsets (weight +1) AND interior/hole offsets (must be empty, weight -1), so a
// solid letter like the "D" in DS does not match - only a true screen ring (empty middle).
function offsets(w) {
  const h = Math.round(w * tpl.H / tpl.W), ring = [], hole = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.min(tpl.W - 1, (x * tpl.W / w) | 0), sy = Math.min(tpl.H - 1, (y * tpl.H / h) | 0);
    if (tInk[sy * tpl.W + sx]) ring.push([x - (w >> 1), y - (h >> 1)]);
    else if (x > w * 0.3 && x < w * 0.7 && y > h * 0.3 && y < h * 0.7) hole.push([x - (w >> 1), y - (h >> 1)]);
  }
  return { w, h, ring, hole };
}
const SCALES = []; for (let w = 12; w <= 52; w += 2) SCALES.push(offsets(w));

const REG = { x0: 18, y0: 8, x1: 242, y1: 132 };
const N = 119, dets = [];
for (let f = 0; f < N; f++) {
  const p = `webapp/public/boot/top_${String(f).padStart(3, '0')}.png`;
  if (!fs.existsSync(p)) { dets.push([]); continue; }
  const { W, H, d } = loadMask(p);
  const gray = new Uint8Array(W * H), lev = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = (y * W + x) * 3, r = d[j], g = d[j + 1], b = d[j + 2];
    const lum = (r + g + b) / 3, sat = Math.max(r, g, b) - Math.min(r, g, b);
    if (lum >= 128 && lum <= 240 && sat < 26) { gray[y * W + x] = 1; lev[y * W + x] = lum; }
  }
  // integral image of gray for fast skip
  const ii = new Int32Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ii[(y + 1) * (W + 1) + x + 1] = gray[y * W + x] + ii[y * (W + 1) + x + 1] + ii[(y + 1) * (W + 1) + x] - ii[y * (W + 1) + x];
  const boxCount = (x0, y0, x1, y1) => { x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1); return ii[y1 * (W + 1) + x1] - ii[y0 * (W + 1) + x1] - ii[y1 * (W + 1) + x0] + ii[y0 * (W + 1) + x0]; };
  const cands = [];
  for (const t of SCALES) {
    const hw = t.w >> 1, hh = t.h >> 1, need = t.ring.length * 0.6;
    for (let cy = REG.y0 + hh; cy <= REG.y1 - hh; cy += 2) for (let cx = REG.x0 + hw; cx <= REG.x1 - hw; cx += 2) {
      if (boxCount(cx - hw, cy - hh, cx + hw, cy + hh) < need) continue;   // not enough gray, skip
      let matched = 0, sl = 0;
      for (const [ox, oy] of t.ring) { const x = cx + ox, y = cy + oy; if (x >= 0 && x < W && y >= 0 && y < H && gray[y * W + x]) { matched++; sl += lev[y * W + x]; } }
      const recall = matched / t.ring.length;
      if (recall < 0.78) continue;
      let holeGray = 0; for (const [ox, oy] of t.hole) { const x = cx + ox, y = cy + oy; if (x >= 0 && x < W && y >= 0 && y < H && gray[y * W + x]) holeGray++; }
      const holeEmpty = 1 - holeGray / Math.max(1, t.hole.length);
      if (holeEmpty < 0.85) continue;                                       // interior must be empty (true ring)
      cands.push({ cx, cy, w: t.w, score: recall * holeEmpty, recall, lev: sl / matched });
    }
  }
  // non-max suppression: strongest first, drop overlaps within ~40% of width
  cands.sort((a, b) => b.score - a.score);
  const keep = [];
  for (const c of cands) { if (keep.some(k => Math.abs(k.cx - c.cx) < (k.w + c.w) * 0.28 && Math.abs(k.cy - c.cy) < (k.w + c.w) * 0.28)) continue; keep.push(c); }
  dets.push(keep.map(k => ({ cx: k.cx, cy: k.cy, w: k.w, r: +k.recall.toFixed(2), op: +Math.min(1, (255 - k.lev) / 107).toFixed(2) })));
}
// ---- temporal track linking: turn noisy per-frame detections into coherent screen paths ----
// greedily link each frame's detections to active tracks (nearest centre + similar width),
// start tracks for the rest, end tracks unseen for >2 frames. Keep tracks >= 3 frames, fill
// gaps <= 2 by interpolation. This removes flicker and completes partially-missed screens.
const tracks = [];
for (let f = 0; f < N; f++) {
  const used = new Set();
  for (const tr of tracks) {
    if (tr.end < f - 3) continue;
    const last = tr.pts[tr.pts.length - 1];
    let best = -1, bd = 1e9;
    for (let i = 0; i < dets[f].length; i++) { if (used.has(i)) continue; const d = dets[f][i]; const dist = Math.hypot(d.cx - last.cx, d.cy - last.cy) + Math.abs(d.w - last.w) * 1.5; if (dist < bd && dist < 26 + (f - tr.end) * 12) { bd = dist; best = i; } }
    if (best >= 0) { const d = dets[f][best]; tr.pts.push({ f, cx: d.cx, cy: d.cy, w: d.w, op: d.op }); tr.end = f; used.add(best); }
  }
  for (let i = 0; i < dets[f].length; i++) { if (used.has(i)) continue; const d = dets[f][i]; tracks.push({ end: f, pts: [{ f, cx: d.cx, cy: d.cy, w: d.w, op: d.op }] }); }
}
const clean = Array.from({ length: N }, () => []);
for (const tr of tracks) {
  if (tr.pts.length < 3) continue;
  for (let i = 0; i < tr.pts.length; i++) {
    const a = tr.pts[i]; clean[a.f].push({ cx: a.cx, cy: a.cy, w: a.w, op: a.op });
    if (i + 1 < tr.pts.length) { const b = tr.pts[i + 1], gap = b.f - a.f; for (let g = 1; g < gap && gap <= 3; g++) { const t = g / gap; clean[a.f + g].push({ cx: +(a.cx + (b.cx - a.cx) * t).toFixed(1), cy: +(a.cy + (b.cy - a.cy) * t).toFixed(1), w: Math.round(a.w + (b.w - a.w) * t), op: +(a.op + (b.op - a.op) * t).toFixed(2) }); } }
  }
}
fs.writeFileSync('webapp/public/boot/logo_dets.json', JSON.stringify(clean));
console.log(`tracks: ${tracks.length} raw, ${tracks.filter(t => t.pts.length >= 3).length} kept (>=3 frames)`);
console.log('frame  #screens  detections (cx,cy,w,op)');
for (let f = 0; f < N; f += 4) console.log(String(f).padStart(3), String(clean[f].length).padStart(2), '  ', clean[f].map(d => `(${d.cx},${d.cy},${d.w},${d.op})`).join(' '));
