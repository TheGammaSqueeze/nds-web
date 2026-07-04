// Per-line comparison of the boot render vs the original bitmap: x-extent, y-centroid of ink,
// and ink coverage (a proxy for stroke weight). Guides baseline/size/weight tuning.
import { execSync } from 'child_process';
function load(path, resize) {
  const ppm = execSync(`convert "${path}" ${resize || ''} -depth 8 ppm:-`, { maxBuffer: 1 << 26 });
  let o = 0; const tok = () => { while ([32, 10, 9].includes(ppm[o])) o++; let s = o; while (![32, 10, 9].includes(ppm[o])) o++; return ppm.toString('latin1', s, o); };
  tok(); const W = +tok(), H = +tok(); tok(); o++; const d = ppm.subarray(o);
  return { W, H, at: (x, y) => { const i = (y * W + x) * 3; return [d[i], d[i + 1], d[i + 2]]; } };
}
const orig = load('webapp/public/boot/healthsafety.png');
const mine = load('/tmp/mine.png', '-resize 256x192');   // scale=4 render down to native
const bands = { title: [15, 30], body1: [45, 56], body2: [64, 75], body3: [83, 94], body4: [102, 113], sub: [128, 139], url: [143, 156], prompt: [167, 178] };
function stats(img, y0, y1) {
  let minx = 999, maxx = -1, n = 0, sy = 0;
  for (let y = y0; y <= y1; y++) for (let x = 0; x < img.W; x++) { const [r, g, b] = img.at(x, y); if (r < 235 || g < 235 || b < 235) { n++; sy += y; if (x < minx) minx = x; if (x > maxx) maxx = x; } }
  return { minx, maxx, w: maxx - minx + 1, cx: ((minx + maxx) / 2).toFixed(1), cy: (sy / (n || 1)).toFixed(1), ink: n };
}
console.log('line     | ORIGINAL                                  | MINE');
for (const [name, [y0, y1]] of Object.entries(bands)) {
  const o = stats(orig, y0, y1), m = stats(mine, y0, y1);
  const fmt = s => `x[${s.minx}..${s.maxx}] w${String(s.w).padStart(3)} cx${s.cx} cy${s.cy} ink${String(s.ink).padStart(4)}`;
  console.log(`${name.padEnd(8)} | ${fmt(o)} | ${fmt(m)}  dW${m.w - o.w} dCX${(m.cx - o.cx).toFixed(1)} dCY${(m.cy - o.cy).toFixed(1)} dInk${(((m.ink / o.ink) - 1) * 100).toFixed(0)}%`);
}
