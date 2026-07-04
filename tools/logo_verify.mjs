// Verify the brute-force detections reproduce the boot animation: for each frame, render MY
// version (the static wordmark + one SVG screen drawn at every detected screen box, with the
// detected opacity) and stack it against the real captured frame. If the detections are right,
// mine matches the real frame including the sliding/fading duplicate screens.
import { execSync } from 'child_process';
import fs from 'fs';

const parts = JSON.parse(fs.readFileSync('webapp/public/boot/logo_parts.json'));
const dets = JSON.parse(fs.readFileSync('webapp/public/boot/logo_dets.json'));
const screen = parts.squares[0].d;                       // one screen ring (logo coords)
const S = 0.357, OX = 20.29, OY = 59.29, SCX = 135.0, SCY = 86.7, SW = 15.5;
const cl = v => v < 0 ? 0 : v > 1 ? 1 : v;

function frameSVG(lf) {
  const wmA = cl((lf - 8) / 16), iA = cl((lf - 52) / 12), tmA = cl((lf - 98) / 16);
  const base = `translate(${OX} ${OY}) scale(${S})`;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="192" viewBox="0 0 256 192"><rect width="256" height="192" fill="white"/>`;
  s += `<g transform="${base}" opacity="${wmA}">` + parts.wordmark.map(p => `<path d="${p.d}" fill="#000"/>`).join('') + `</g>`;
  for (const d of (dets[lf] || [])) {
    const kw = d.w / SW;
    s += `<path d="${screen}" fill="#939598" opacity="${d.op}" transform="translate(${d.cx} ${d.cy}) scale(${kw}) translate(${-SCX} ${-SCY}) ${base}"/>`;
  }
  s += `<g transform="${base}" opacity="${iA}">` + parts.iDot.map(p => `<path d="${p.d}" fill="#000"/>`).join('') + `</g>`;
  s += `<g transform="${base}" opacity="${tmA}">` + parts.tm.map(p => `<path d="${p.d}" fill="#000"/>`).join('') + `</g>`;
  return s + `</svg>`;
}

const frames = (process.argv[2] || '28,40,52,60,72,84,96').split(',').map(Number);
const cols = [];
for (const f of frames) {
  fs.writeFileSync('/tmp/vf.svg', frameSVG(f));
  execSync(`convert -background white /tmp/vf.svg -resize 220x /tmp/vf_mine_${f}.png`);
  execSync(`convert webapp/public/boot/top_${String(f).padStart(3, '0')}.png -resize 220x /tmp/vf_real_${f}.png`);
  execSync(`convert /tmp/vf_real_${f}.png /tmp/vf_mine_${f}.png -append /tmp/vf_col_${f}.png`);
  cols.push(`/tmp/vf_col_${f}.png`);
}
execSync(`montage ${cols.join(' ')} -tile ${frames.length}x1 -geometry +3+3 -background '#ccc' -label 'f%[t]' /tmp/logo_verify.png`);
console.log('wrote /tmp/logo_verify.png (each column: REAL on top, MINE below)');
