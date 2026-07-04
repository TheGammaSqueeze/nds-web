// Trace the REAL boot Health & Safety text from healthsafety.png into clean vector paths for
// the scale>1 render, replacing the DSFW glyph-traced font (which was the wrong weight and wavy
// because it traced tiny individual font cells). Tracing the actual rendered lines - long,
// consistent strokes with the firmware's own anti-aliasing - gives the correct thin typeface,
// crisp. Split by Y-band into black paragraph+title / blue URL / grey prompt (the prompt pulses
// independently); the warning triangle box is excluded (drawn separately from hs_triangle.json).
// Output: webapp/public/boot/hs_text.json { black, blue, gray } = SVG path 'd' in native 256x192.
import fs from 'fs';
import { execSync } from 'child_process';
import { loadPNG } from './veccontour.mjs';

const SRC = 'webapp/public/boot/healthsafety.png';
const OUT = 'webapp/public/boot/hs_text.json';
const MK = 6, W = 256, H = 192;
const dir = '/tmp/hstext'; fs.mkdirSync(dir, { recursive: true });
const png = loadPNG(SRC);
const lum = p => 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;

// coverage PGM (0=ink black, 255=empty white) for pixels matching a band predicate; the trace
// follows the firmware anti-aliasing (grayscale in), so pass the ink darkness through.
function bandPGM(pred) {
  const buf = Buffer.alloc(W * H, 255); let any = false;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = png.px[y][x];
    if (p.a > 8 && pred(x, y, p)) {
      // ink coverage from how far the pixel is below the near-white background
      const cov = Math.max(0, Math.min(255, Math.round((235 - lum(p)) / 235 * 255)));
      if (cov > 8) { buf[y * W + x] = 255 - cov; any = true; }
    }
  }
  return any ? buf : null;
}

function toAbs(d) {
  const toks = d.match(/[MmLlCcHhVvZz]|-?\d*\.?\d+/g) || [];
  const segs = []; let i = 0, cx = 0, cy = 0, sx = 0, sy = 0, cmd = '';
  const num = () => parseFloat(toks[i++]);
  while (i < toks.length) {
    const t = toks[i];
    if (/[MmLlCcHhVvZz]/.test(t)) { cmd = t; i++; }
    if (cmd === 'M' || cmd === 'm') { let x = num(), y = num(); if (cmd === 'm') { x += cx; y += cy; } cx = sx = x; cy = sy = y; segs.push(['M', x, y]); cmd = cmd === 'm' ? 'l' : 'L'; }
    else if (cmd === 'L' || cmd === 'l') { let x = num(), y = num(); if (cmd === 'l') { x += cx; y += cy; } cx = x; cy = y; segs.push(['L', x, y]); }
    else if (cmd === 'H' || cmd === 'h') { let x = num(); if (cmd === 'h') x += cx; cx = x; segs.push(['L', x, cy]); }
    else if (cmd === 'V' || cmd === 'v') { let y = num(); if (cmd === 'v') y += cy; cy = y; segs.push(['L', cx, y]); }
    else if (cmd === 'C' || cmd === 'c') { let a = num(), b = num(), c = num(), d2 = num(), e = num(), g = num(); if (cmd === 'c') { a += cx; b += cy; c += cx; d2 += cy; e += cx; g += cy; } cx = e; cy = g; segs.push(['C', a, b, c, d2, e, g]); }
    else if (cmd === 'Z' || cmd === 'z') { segs.push(['Z']); cx = sx; cy = sy; }
    else i++;
  }
  return segs;
}

// potrace path coords (mkbitmap MK-scaled, 0.1 units/px, Y flipped) -> native 256x192
function traceBand(pred) {
  const pgm = bandPGM(pred);
  if (!pgm) return '';
  const MF = process.env.HS_F || '2', MT = process.env.HS_T || '0.45', PA = process.env.HS_A || '0.7';
  fs.writeFileSync(`${dir}/b.pgm`, Buffer.concat([Buffer.from(`P5\n${W} ${H}\n255\n`, 'latin1'), pgm]));
  execSync(`mkbitmap -f ${MF} -s ${MK} -t ${MT} -o ${dir}/b.pbm ${dir}/b.pgm`);
  execSync(`potrace -s -a ${PA} -O 0.35 -o ${dir}/b.svg ${dir}/b.pbm`);
  const svg = fs.readFileSync(`${dir}/b.svg`, 'latin1');
  const k = 0.1 / MK;
  const f = v => (+v.toFixed(2)).toString();
  const nx = px => f(k * px), ny = py => f(H - k * py);
  let out = '';
  for (const dstr of [...svg.matchAll(/<path d="([^"]+)"/g)].map(m => m[1])) {
    for (const s of toAbs(dstr)) {
      if (s[0] === 'M') out += `M${nx(s[1])} ${ny(s[2])}`;
      else if (s[0] === 'L') out += `L${nx(s[1])} ${ny(s[2])}`;
      else if (s[0] === 'C') out += `C${nx(s[1])} ${ny(s[2])} ${nx(s[3])} ${ny(s[4])} ${nx(s[5])} ${ny(s[6])}`;
      else if (s[0] === 'Z') out += 'Z';
    }
  }
  return out;
}

// triangle box to exclude from the black band (measured: ~x14..31, y10..34)
const inTriangle = (x, y) => x >= 13 && x <= 31 && y >= 10 && y <= 34;
const isBlue = p => p.b > p.r + 20 && p.b > 90 && lum(p) < 210;
const isGray = p => Math.abs(p.r - p.g) < 24 && Math.abs(p.g - p.b) < 24;

const black = traceBand((x, y, p) => y >= 10 && y < 122 && !inTriangle(x, y) && lum(p) < 150 && !isBlue(p));
const blue = traceBand((x, y, p) => y >= 143 && y < 162 && isBlue(p));
const gray = traceBand((x, y, p) => y >= 164 && y < 186 && lum(p) < 205);

fs.writeFileSync(OUT, JSON.stringify({ black, blue, gray }));
console.log('black', black.length, 'blue', blue.length, 'gray', gray.length, 'bytes ->', OUT);
