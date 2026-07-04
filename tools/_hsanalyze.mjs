// Analyze the boot Health & Safety reference bitmap: per-row ink profile
// (non-background pixel count, x-extent, distinct colors) so each text block's
// y-band, horizontal placement, and exact opaque colors are known before the
// glyph-fit search. Reads the PNG via ImageMagick -> PPM (same as pixdiff.js).
import { execSync } from 'child_process';

const path = process.argv[2] || 'webapp/public/boot/healthsafety.png';
const ppm = execSync(`convert "${path}" -depth 8 ppm:-`, { maxBuffer: 1 << 26 });
// parse PPM header: P6\nW H\n255\n<data>
let o = 0; function tok() { while (ppm[o] === 0x20 || ppm[o] === 0x0a || ppm[o] === 0x09) o++; let s = o; while (ppm[o] !== 0x20 && ppm[o] !== 0x0a && ppm[o] !== 0x09) o++; return ppm.toString('latin1', s, o); }
const magic = tok(), W = +tok(), H = +tok(), maxv = +tok(); o++; // skip single whitespace after maxval
const data = ppm.subarray(o);
function px(x, y) { const i = (y * W + x) * 3; return [data[i], data[i + 1], data[i + 2]]; }

// background = most common color overall
const hist = new Map();
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const [r, g, b] = px(x, y); const k = `${r},${g},${b}`; hist.set(k, (hist.get(k) || 0) + 1); }
const bg = [...hist.entries()].sort((a, b) => b[1] - a[1])[0][0];
console.log(`${magic} ${W}x${H} bg=${bg}`);

function isBg(r, g, b) { return `${r},${g},${b}` === bg; }
// per row: ink count, x-extent, top colors
let bandStart = -1;
for (let y = 0; y < H; y++) {
  let cnt = 0, minx = 999, maxx = -1; const c = new Map();
  for (let x = 0; x < W; x++) { const [r, g, b] = px(x, y); if (!isBg(r, g, b)) { cnt++; if (x < minx) minx = x; if (x > maxx) maxx = x; const k = `${r},${g},${b}`; c.set(k, (c.get(k) || 0) + 1); } }
  const hasInk = cnt > 0;
  if (hasInk && bandStart < 0) bandStart = y;
  if (!hasInk && bandStart >= 0) { console.log(`--- gap after band y${bandStart}..${y - 1} ---`); bandStart = -1; }
  if (hasInk) {
    const top = [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${k}:${n}`).join('  ');
    console.log(`y${String(y).padStart(3)} n=${String(cnt).padStart(4)} x[${minx}..${maxx}] ${top}`);
  }
}
