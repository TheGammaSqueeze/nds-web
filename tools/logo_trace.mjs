// Frame-by-frame analysis of the boot logo: the two dual-screen squares move INDEPENDENTLY
// (a large vertical pair that rearranges into the diagonal dual-screen layout while descending
// and shrinking; each square stays axis-aligned). Track the two squares separately: mask the
// gray outline pixels, drop thin wordmark AA via connected-component area, then k-means (k=2)
// seeded from the previous frame for temporal consistency. Output each square's centre + half-
// size per frame (screen 256x192 coords) so boot.js can drive the two SVG squares exactly.
import { execSync } from 'child_process';
import fs from 'fs';

const N = 119;
function load(p) {
  const ppm = execSync(`convert "${p}" -depth 8 ppm:-`, { maxBuffer: 1 << 26 });
  let o = 0; const tok = () => { while ([32, 10, 9].includes(ppm[o])) o++; let s = o; while (![32, 10, 9].includes(ppm[o])) o++; return ppm.toString('latin1', s, o); };
  tok(); const W = +tok(), H = +tok(); tok(); o++; return { W, H, d: ppm.subarray(o) };
}
// filtered gray-square pixels of a frame (component area >= 20, excludes the black wordmark, its
// thin AA, and the upper-right "i" region)
function grayPix(W, H, d) {
  const mask = new Uint8Array(W * H);
  for (let y = 12; y < 130; y++) for (let x = 20; x < 240; x++) {
    const j = (y * W + x) * 3, r = d[j], g = d[j + 1], b = d[j + 2];
    const lum = (r + g + b) / 3, sat = Math.max(r, g, b) - Math.min(r, g, b);
    if (lum >= 135 && lum <= 224 && sat < 22) mask[y * W + x] = 1;
  }
  const seen = new Uint8Array(W * H), st = new Int32Array(W * H), pts = [];
  for (let s = 0; s < W * H; s++) {
    if (!mask[s] || seen[s]) continue;
    let sp = 0; st[sp++] = s; seen[s] = 1; const comp = [];
    while (sp) { const p = st[--sp]; comp.push(p); const nb = [p - 1, p + 1, p - W, p + W]; for (const q of nb) if (q >= 0 && q < W * H && mask[q] && !seen[q]) { seen[q] = 1; st[sp++] = q; } }
    if (comp.length >= 20) for (const p of comp) pts.push([p % W, (p / W) | 0]);
  }
  return pts;
}
// k-means k=2 seeded from prev centres
function kmeans2(pts, seed) {
  if (pts.length < 8) return null;
  let c = seed || [[pts[0][0], pts[0][1] - 20], [pts[0][0], pts[0][1] + 20]];
  for (let it = 0; it < 12; it++) {
    const sum = [[0, 0, 0], [0, 0, 0]];
    for (const [x, y] of pts) { const k = ((x - c[0][0]) ** 2 + (y - c[0][1]) ** 2) <= ((x - c[1][0]) ** 2 + (y - c[1][1]) ** 2) ? 0 : 1; sum[k][0] += x; sum[k][1] += y; sum[k][2]++; }
    for (let k = 0; k < 2; k++) if (sum[k][2]) c[k] = [sum[k][0] / sum[k][2], sum[k][1] / sum[k][2]];
  }
  // per-cluster half-extent
  const ext = [[1e9, 1e9, -1e9, -1e9], [1e9, 1e9, -1e9, -1e9]], cnt = [0, 0];
  for (const [x, y] of pts) { const k = ((x - c[0][0]) ** 2 + (y - c[0][1]) ** 2) <= ((x - c[1][0]) ** 2 + (y - c[1][1]) ** 2) ? 0 : 1; const e = ext[k]; if (x < e[0]) e[0] = x; if (y < e[1]) e[1] = y; if (x > e[2]) e[2] = x; if (y > e[3]) e[3] = y; cnt[k]++; }
  return c.map((cc, k) => ({ cx: +cc[0].toFixed(1), cy: +cc[1].toFixed(1), hw: cnt[k] ? +((ext[k][2] - ext[k][0]) / 2).toFixed(1) : 0, hh: cnt[k] ? +((ext[k][3] - ext[k][1]) / 2).toFixed(1) : 0, n: cnt[k] }));
}

const traj = []; let seed = null;
for (let i = 0; i < N; i++) {
  const p = `webapp/public/boot/top_${String(i).padStart(3, '0')}.png`;
  if (!fs.existsSync(p)) { traj.push(null); continue; }
  const { W, H, d } = load(p);
  const km = kmeans2(grayPix(W, H, d), seed);
  if (km) { km.sort((a, b) => a.cy - b.cy); seed = km.map(s => [s.cx, s.cy]); traj.push({ f: i, a: km[0], b: km[1] }); }
  else traj.push({ f: i, a: null, b: null });
}
fs.writeFileSync('webapp/public/boot/logo_traj.json', JSON.stringify(traj));
console.log('frame  squareTop(cx,cy,hw,hh)     squareBot(cx,cy,hw,hh)');
for (const r of traj) { if (!r || r.f % 6) continue; const f = s => s ? `${s.cx},${s.cy},${s.hw},${s.hh}` : '-'; console.log(String(r.f).padStart(3), f(r.a).padEnd(22), f(r.b)); }
