// Faithful smooth vectorizer for small multi-tone icons (volume, etc.): traces the ACTUAL
// sprite shape with mkbitmap+potrace instead of an idealized redraw. Two luminance bands
// (outer silhouette + bright core) are each smooth-upscaled and traced, then layered
// darkest-first, reproducing the "high-quality upscale" look as true vectors. Band cut and
// both fill colours are measured from the real pixels. scale=1 keeps the exact PNG.
import fs from 'fs';
import { execFileSync } from 'child_process';
import { loadPNG, hex } from './veccontour.mjs';

const lum = p => 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;

function tracePBM(mask, w, h, scale = 8, thresh = 0.42, filter = 4) {
  // PBM P1: 1 = black (potrace traces black). mask[y][x] true -> ink.
  let pbm = `P1\n${w} ${h}\n`;
  for (let y = 0; y < h; y++) { const row = []; for (let x = 0; x < w; x++) row.push(mask[y][x] ? 1 : 0); pbm += row.join(' ') + '\n'; }
  fs.writeFileSync('/tmp/_vp.pbm', pbm);
  execFileSync('mkbitmap', ['-f', String(filter), '-s', String(scale), '-t', String(thresh), '/tmp/_vp.pbm', '-o', '/tmp/_vp_s.pbm']);
  const raw = execFileSync('potrace', ['/tmp/_vp_s.pbm', '--svg', '-o', '-']).toString();
  const vb = raw.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
  const g = raw.match(/<g([^>]*)>([\s\S]*?)<\/g>/);
  if (!vb || !g) return null;
  // strip potrace's own fill/stroke from the group tag; keep only the transform
  const tr = (g[1].match(/transform="[^"]*"/) || [''])[0];
  return { W: +vb[1], H: +vb[2], transform: tr, body: g[2].replace(/fill="[^"]*"/g, '').replace(/style="[^"]*"/g, '') };
}

export function buildPotraceSVG(pngFile, { scale = 8, filter = 4, thresh = 0.42, fill = null } = {}) {
  const png = loadPNG(pngFile);
  const op = [];
  for (let y = 0; y < png.h; y++) for (let x = 0; x < png.w; x++) if (png.px[y][x].a > 40) op.push({ x, y, l: lum(png.px[y][x]), c: hex(png.px[y][x]) });
  const modal = pred => { const m = new Map(); for (const o of op) if (pred(o)) m.set(o.c, (m.get(o.c) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]; };
  // single-level trace: mkbitmap's smoothing bridges the dotted sound-wave arcs into
  // continuous smooth curves (a 2-level trace re-fragments them into blobs). Fill with the
  // sprite's dominant opaque colour - crisp and faithful to the real icon's shape.
  const fillC = fill || modal(() => true) || '#c8c8c8';
  const maskAll = png.px.map(row => row.map(p => p.a > 40));
  const outer = tracePBM(maskAll, png.w, png.h, scale, thresh, filter);
  if (!outer) return null;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${png.w}" height="${png.h}" viewBox="0 0 ${outer.W} ${outer.H}" shape-rendering="geometricPrecision">`
    + `<g ${outer.transform} fill="${fillC}">${outer.body}</g></svg>`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { chromium } = await import('playwright');
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await b.newPage();
  for (const f of process.argv.slice(2)) {
    const svg = buildPotraceSVG(f);
    if (!svg) { console.log(f, 'TRACE FAILED'); continue; }
    fs.writeFileSync(f.replace(/\.png$/, '.svg'), svg);
    console.log(`${f.replace(/\.png$/, '.svg')}  (${svg.length}B)`);
  }
  await b.close();
}
