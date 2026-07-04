// Measure the REAL per-element fade curves of the boot logo directly from the captured
// frames: for each of the 9 wordmark letters, the i-dot, the TM, and the settled upper
// screen's blackening, compute alpha(f) = (BG - p25(inkLum)) / (BG - p25 at final frame),
// where the ink mask is that element's dark pixels in the FINAL frame (so passing duplicate
// screens barely perturb the percentile). Median-5 smoothed + monotone (running max): the
// real fades only ramp up. Output webapp/public/boot/logo_fades.json - these curves are
// FROZEN in the fit so vector-vs-bitmap AA error cannot leak into letter darkness.
import { execSync } from 'child_process';
import fs from 'fs';

const N = 119, BG = 251, S = 0.357, OX = 20.29, OY = 59.29;
function load(p) {
  const ppm = execSync(`convert "${p}" -depth 8 pgm:-`, { maxBuffer: 1 << 26 });
  let o = 0; const t = () => { while ([32, 10, 9].includes(ppm[o])) o++; let a = o; while (![32, 10, 9].includes(ppm[o])) o++; return ppm.toString('latin1', a, o); };
  t(); const W = +t(), H = +t(); t(); o++; return { W, H, d: ppm.subarray(o) };
}
const frames = [];
for (let f = 0; f < N; f++) frames.push(load(`webapp/public/boot/top_${String(f).padStart(3, '0')}.png`));
const FIN = frames[N - 1];

const parts = JSON.parse(fs.readFileSync('webapp/public/boot/logo_parts.json'));
function bboxScreen(paths) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of paths) { const n = p.d.match(/-?\d+\.?\d*/g).map(Number); for (let i = 0; i < n.length; i += 2) { if (n[i] < x0) x0 = n[i]; if (n[i] > x1) x1 = n[i]; if (n[i + 1] < y0) y0 = n[i + 1]; if (n[i + 1] > y1) y1 = n[i + 1]; } }
  return { x0: Math.floor(OX + S * x0) - 1, y0: Math.floor(OY + S * y0) - 1, x1: Math.ceil(OX + S * x1) + 1, y1: Math.ceil(OY + S * y1) + 1 };
}
// element regions: 9 letters, i-dot, tm, upper small screen (blk)
const elems = parts.wordmark.map((p, k) => ({ name: 'L' + k, box: bboxScreen([p]) }));
elems.push({ name: 'i', box: bboxScreen(parts.iDot) });
elems.push({ name: 'tm', box: bboxScreen(parts.tm) });
elems.push({ name: 'blk', box: bboxScreen([parts.squares[1]]) });

function p25(arr) { if (!arr.length) return BG; const s = arr.slice().sort((a, b) => a - b); return s[(s.length * 0.25) | 0]; }
const med5 = (a, i) => { const lo = Math.max(0, i - 2), hi = Math.min(a.length, i + 3); return a.slice(lo, hi).sort((x, y) => x - y)[(hi - lo) >> 1]; };

const curves = {};
for (const el of elems) {
  // final-frame ink mask inside the element box (dark pixels = the element's own ink)
  const mask = [];
  for (let y = el.box.y0; y <= el.box.y1; y++) for (let x = el.box.x0; x <= el.box.x1; x++) {
    if (x < 0 || y < 0 || x >= FIN.W || y >= FIN.H) continue;
    if (FIN.d[y * FIN.W + x] < 200) mask.push(y * FIN.W + x);
  }
  const finP = p25(mask.map(i => FIN.d[i]));
  const raw = [];
  for (let f = 0; f < N; f++) {
    const fr = frames[f];
    const v = p25(mask.map(i => fr.d[i]));
    raw.push(Math.max(0, Math.min(1, (BG - v) / Math.max(1, BG - finP))));
  }
  const smoothed = raw.map((_, i) => med5(raw, i));
  let run = 0;
  curves[el.name] = smoothed.map(v => { run = Math.max(run, v); return +run.toFixed(3); });
}
fs.writeFileSync('webapp/public/boot/logo_fades.json', JSON.stringify(curves));
const showAt = [8, 12, 16, 20, 24, 28, 40, 60, 90, 118];
console.log('element  alpha at f=' + showAt.join(','));
for (const [k, v] of Object.entries(curves)) console.log(k.padEnd(4), showAt.map(f => v[f].toFixed(2)).join(' '));
