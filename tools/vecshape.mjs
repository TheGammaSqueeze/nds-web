// Silhouette vectorizer for solid/annular sprites (colour swatches, selection rings) where
// per-colour region smoothing fails (thin AA borders explode into blob chains). Traces the
// UNION of all opaque pixels as ONE shape (outer contour + any holes) and fills it with the
// sprite's dominant interior colour; the 1px AA rim is redrawn as a thin stroke in the rim
// colour. Geometry (the exact silhouette) and both colours come from the real pixels.
import fs from 'fs';
import { loadPNG, traceRings, chaikin, ringsToPath, hex } from './veccontour.mjs';

export function buildShapeSVG(pngFile, { iters = 2 } = {}) {
  const png = loadPNG(pngFile);
  const grid = png.px.map(row => row.map(p => p.a > 40));
  // dominant interior colour = modal colour among pixels whose 4-neighbours are all opaque
  const interior = new Map(), rim = new Map();
  for (let y = 0; y < png.h; y++) for (let x = 0; x < png.w; x++) {
    if (!grid[y][x]) continue;
    const edge = !grid[y - 1]?.[x] || !grid[y + 1]?.[x] || !grid[y][x - 1] || !grid[y][x + 1];
    const c = hex(png.px[y][x]);
    (edge ? rim : interior).set(c, ((edge ? rim : interior).get(c) || 0) + 1);
  }
  const modal = m => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const fillC = modal(interior) || modal(rim) || '#000000';
  const rimC = modal(rim) || fillC;
  const rings = traceRings(grid).map(r => chaikin(r, iters));
  const d = ringsToPath(rings, 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${png.w}" height="${png.h}" viewBox="0 0 ${png.w} ${png.h}" shape-rendering="geometricPrecision">`
    + `<path d="${d}" fill="${fillC}" stroke="${rimC}" stroke-width="1" stroke-linejoin="round" fill-rule="evenodd"/></svg>`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { chromium } = await import('playwright');
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await b.newPage();
  for (const f of process.argv.slice(2)) {
    const png = loadPNG(f);
    const svg = buildShapeSVG(f);
    fs.writeFileSync(f.replace(/\.png$/, '.svg'), svg);
    const r1 = await page.evaluate(async ({ svg, w, h }) => {
      const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/svg+xml;base64,' + btoa(svg); });
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.imageSmoothingEnabled = true; cx.drawImage(img, 0, 0, w, h);
      return Array.from(cx.getImageData(0, 0, w, h).data);
    }, { svg, w: png.w, h: png.h });
    let inter = 0, uni = 0; for (let y = 0; y < png.h; y++) for (let x = 0; x < png.w; x++) { const i = (y * png.w + x) * 4; const s = r1[i + 3] > 40, p = png.px[y][x].a > 40; if (s || p) uni++; if (s && p) inter++; }
    console.log(`${f.replace(/\.png$/, '.svg')}  IoU=${(inter / uni).toFixed(3)}  (${svg.length}B)`);
  }
  await b.close();
}
