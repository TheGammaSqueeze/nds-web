// Objective frame-by-frame check: render MY logo (wordmark + one SVG screen at every brute-force
// detection + settled black top + i/tm) for all 119 frames and diff each against the real capture
// over the animated region. Reports mean abs pixel diff per frame, overall, and the worst frames.
import { execSync } from 'child_process';
import fs from 'fs';

const parts = JSON.parse(fs.readFileSync('webapp/public/boot/logo_parts.json'));
const dets = JSON.parse(fs.readFileSync('webapp/public/boot/logo_dets.json'));
const screen = parts.squares[0].d, topScreen = parts.squares[1].d;
const S = 0.357, OX = 20.29, OY = 59.29, SCX = 135.0, SCY = 86.7, SW = 15.5;
const cl = v => v < 0 ? 0 : v > 1 ? 1 : v;
function frameSVG(lf) {
  const wmA = cl((lf - 8) / 16), iA = cl((lf - 52) / 12), tmA = cl((lf - 98) / 16), blk = cl((lf - 96) / 16);
  const base = `translate(${OX} ${OY}) scale(${S})`;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="192" viewBox="0 0 256 192"><rect width="256" height="192" fill="white"/>`;
  s += `<g transform="${base}" opacity="${wmA}">` + parts.wordmark.map(p => `<path d="${p.d}" fill="#000"/>`).join('') + `</g>`;
  for (const d of (dets[lf] || [])) s += `<path d="${screen}" fill="#939598" opacity="${cl(d.op)}" transform="translate(${d.cx} ${d.cy}) scale(${d.w / SW}) translate(${-SCX} ${-SCY}) ${base}"/>`;
  if (blk > 0) s += `<path d="${topScreen}" fill="#000" opacity="${blk}" transform="${base}"/>`;
  s += `<g transform="${base}" opacity="${iA}">` + parts.iDot.map(p => `<path d="${p.d}" fill="#000"/>`).join('') + `</g>`;
  s += `<g transform="${base}" opacity="${tmA}">` + parts.tm.map(p => `<path d="${p.d}" fill="#000"/>`).join('') + `</g>`;
  return s + `</svg>`;
}
function gray(path, resize) {
  const ppm = execSync(`convert "${path}" ${resize || ''} -colorspace Gray -depth 8 pgm:-`, { maxBuffer: 1 << 26 });
  let o = 0; const tok = () => { while ([32, 10, 9].includes(ppm[o])) o++; let s = o; while (![32, 10, 9].includes(ppm[o])) o++; return ppm.toString('latin1', s, o); };
  tok(); const W = +tok(), H = +tok(); tok(); o++; return { W, H, d: ppm.subarray(o) };
}
const diffs = [];
for (let f = 0; f < 119; f++) {
  const real = `webapp/public/boot/top_${String(f).padStart(3, '0')}.png`;
  if (!fs.existsSync(real)) { diffs.push(null); continue; }
  fs.writeFileSync('/tmp/df.svg', frameSVG(f));
  execSync(`convert -background white /tmp/df.svg /tmp/df_mine.png`);
  const m = gray('/tmp/df_mine.png'), r = gray(real);
  let sum = 0, n = 0;
  for (let y = 10; y < 130; y++) for (let x = 18; x < 242; x++) { const i = y * m.W + x; sum += Math.abs(m.d[i] - r.d[i]); n++; }
  diffs.push({ f, d: +(sum / n).toFixed(2) });
}
const valid = diffs.filter(Boolean);
const mean = (valid.reduce((a, b) => a + b.d, 0) / valid.length).toFixed(2);
const worst = [...valid].sort((a, b) => b.d - a.d).slice(0, 10);
console.log('overall mean abs diff (0..255):', mean);
console.log('worst frames:', worst.map(w => `f${w.f}:${w.d}`).join('  '));
console.log('per-frame (every 6):', valid.filter(v => v.f % 6 === 0).map(v => `${v.f}:${v.d}`).join(' '));
