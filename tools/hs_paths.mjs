// Extract the traced glyph outlines from the per-colour layer SVGs (potrace output) and
// emit webapp/public/boot/hs_text.json: each layer's path 'd' (raw potrace coords) plus the
// single affine transform that maps those coords into the 256x192 logical screen. boot.js
// draws them with Path2D at scale>1 (crisp, exact original layout), scale=1 keeps the bitmap.
import fs from 'fs';

const dir = process.argv[2] || '/tmp/hsvec';
const layers = [
  { key: 'yellow', file: 'yellow2.svg', color: 'rgb(243,211,8)', group: 'static' }, // triangle fill (behind)
  { key: 'black',  file: 'black2.svg',  color: '#000000',        group: 'static' }, // title/body/sub + triangle outline + "!"
  { key: 'blue',   file: 'blue2.svg',   color: 'rgb(48,162,195)', group: 'static' }, // URL
  { key: 'prompt', file: 'prompt2.svg', color: 'rgb(74,74,74)',  group: 'prompt' }, // pulsing prompt
];

function parse(svg) {
  const wsvg = +(/width="([\d.]+)/.exec(svg) || [])[1];
  const hsvg = +(/height="([\d.]+)/.exec(svg) || [])[1];
  const gt = /<g transform="translate\(([-\d.]+),([-\d.]+)\) scale\(([-\d.]+),([-\d.]+)\)"/.exec(svg);
  const tx = +gt[1], ty = +gt[2], sx = +gt[3], sy = +gt[4];
  const ds = [...svg.matchAll(/<path d="([^"]+)"/g)].map(m => m[1]);
  return { wsvg, hsvg, tx, ty, sx, sy, d: ds.join(' ') };
}

// net map potrace-coord -> logical: logicalX = (px*sx + tx) * (256/wsvg); logicalY = (py*sy + ty) * (192/hsvg)
// expressed as a canvas transform matrix [a,b,c,d,e,f] applied before filling the raw path.
const out = { w: 256, h: 192, layers: [] };
for (const L of layers) {
  const p = `${dir}/${L.file}`;
  if (!fs.existsSync(p)) { console.log('skip missing', p); continue; }
  const s = fs.readFileSync(p, 'latin1');
  const { wsvg, hsvg, tx, ty, sx, sy, d } = parse(s);
  if (!d) { console.log('no path in', L.file); continue; }
  const kx = 256 / wsvg, ky = 192 / hsvg;
  // logicalX = sx*kx*px + tx*kx ; logicalY = sy*ky*py + ty*ky
  const m = [sx * kx, 0, 0, sy * ky, tx * kx, ty * ky];
  out.layers.push({ key: L.key, group: L.group, color: L.color, m, d });
  console.log(`${L.key}: ${d.length}B path, matrix ${m.map(v => v.toFixed(4))}`);
}
fs.writeFileSync('webapp/public/boot/hs_text.json', JSON.stringify(out));
console.log('wrote webapp/public/boot/hs_text.json', (JSON.stringify(out).length / 1024 | 0) + 'KB');
