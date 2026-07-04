// Vectorize the real boot Health & Safety capture (webapp/public/boot/healthsafety.png)
// by smooth-tracing it, so the >1 render keeps the EXACT original size, proportions, letter
// spacing and placement (it is the same pixels) with the original firmware letterforms, just
// unpixellated. Splits the capture into colour layers (black text, yellow triangle, blue URL,
// gray prompt), writes each as a coverage graymap (PGM) for mkbitmap + potrace. The prompt is
// its own layer so it can keep pulsing. No re-typesetting, no substitute font.
import { execSync } from 'child_process';
import fs from 'fs';

const ppm = execSync('convert webapp/public/boot/healthsafety.png -depth 8 ppm:-', { maxBuffer: 1 << 26 });
let o = 0; const tok = () => { while ([32, 10, 9].includes(ppm[o])) o++; let s = o; while (![32, 10, 9].includes(ppm[o])) o++; return ppm.toString('latin1', s, o); };
tok(); const W = +tok(), H = +tok(); tok(); o++;
const d = ppm.subarray(o);
const at = (x, y) => { const i = (y * W + x) * 3; return [d[i], d[i + 1], d[i + 2]]; };
const lum = (r, g, b) => (r * 77 + g * 151 + b * 28) >> 8;
const gray = (r, g, b) => Math.abs(r - g) < 26 && Math.abs(g - b) < 26 && Math.abs(r - b) < 26;

const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v | 0;
// each layer returns 0..255 ink coverage graymap value (0 = full ink) for a pixel
const LAYERS = {
  yellow:   (x, y, r, g, b) => (y < 33 && x < 32) ? clamp(255 - (g - b)) : 255,       // triangle fill
  triblack: (x, y, r, g, b) => (y >= 14 && y <= 30 && x >= 11 && x <= 28 && gray(r, g, b) && lum(r, g, b) < 200) ? lum(r, g, b) : 255, // triangle outline + "!" (x<=28: stop before the "W")
};

const outdir = process.argv[2] || '/tmp/hsvec';
fs.mkdirSync(outdir, { recursive: true });
for (const [name, fn] of Object.entries(LAYERS)) {
  const buf = Buffer.alloc(W * H);
  let ink = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const [r, g, b] = at(x, y); const v = fn(x, y, r, g, b); buf[y * W + x] = v; if (v < 200) ink++; }
  const hdr = Buffer.from(`P5\n${W} ${H}\n255\n`, 'latin1');
  fs.writeFileSync(`${outdir}/${name}.pgm`, Buffer.concat([hdr, buf]));
  console.log(`${name}.pgm  ink px=${ink}`);
}
console.log('wrote graymaps to', outdir);
