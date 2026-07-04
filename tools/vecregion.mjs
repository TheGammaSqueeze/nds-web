// General per-colour-region smoother: the "smooth" counterpart to svgify's blocky per-pixel
// output. For each distinct opaque colour in the real sprite it traces the EXACT pixel-region
// contour and Chaikin-rounds it, emitting one filled path per colour. Nothing is invented -
// same palette, same regions, only the staircase edges are rounded for the N>1 display.
// To avoid hairline seams between adjacent rounded regions, darker regions are painted first
// and each region is drawn with a 0.75px same-colour stroke so neighbours meet with no gap.
// scale=1 keeps the exact PNG; this only authors the SVG loaded at scale>1.
import fs from 'fs';
import { loadPNG, mask, traceRings, chaikin, ringsToPath, hex } from './veccontour.mjs';

export function buildRegionSVG(pngFile, { iters = 1, order = 'dark-first' } = {}) {
  const png = loadPNG(pngFile);
  // group opaque pixels by exact colour
  const groups = new Map();
  for (let y = 0; y < png.h; y++) for (let x = 0; x < png.w; x++) {
    const p = png.px[y][x]; if (p.a <= 8) continue;
    const k = hex(p); if (!groups.has(k)) groups.set(k, []); groups.get(k).push([x, y]);
  }
  const lum = c => { const n = parseInt(c.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
  const colors = [...groups.keys()];
  if (order === 'dark-first') colors.sort((a, b) => lum(a) - lum(b));
  else if (order === 'area-first') colors.sort((a, b) => groups.get(b).length - groups.get(a).length);
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${png.w}" height="${png.h}" viewBox="0 0 ${png.w} ${png.h}" shape-rendering="geometricPrecision">`];
  for (const c of colors) {
    const set = new Set(groups.get(c).map(([x, y]) => x + ',' + y));
    const m = mask(png, (p, x, y) => false);   // placeholder, rebuild by coords below
    // rebuild a boolean grid for this colour
    const grid = Array.from({ length: png.h }, () => Array(png.w).fill(false));
    for (const key of set) { const [x, y] = key.split(',').map(Number); grid[y][x] = true; }
    const rings = traceRings(grid).map(r => chaikin(r, iters));
    if (!rings.length) continue;
    const d = ringsToPath(rings, 2);
    parts.push(`<path d="${d}" fill="${c}" stroke="${c}" stroke-width="0.75" stroke-linejoin="round" fill-rule="evenodd"/>`);
  }
  parts.push('</svg>');
  return parts.join('');
}

// CLI + verify
if (import.meta.url === `file://${process.argv[1]}`) {
  const { chromium } = await import('playwright');
  const files = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await b.newPage();
  for (const f of files) {
    const png = loadPNG(f);
    const svg = buildRegionSVG(f, { iters: 1 });
    const out = f.replace(/\.png$/, '.svg');
    fs.writeFileSync(out, svg);
    const r1 = await page.evaluate(async ({ svg, w, h }) => {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/svg+xml;base64,' + btoa(svg); });
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const cx = cv.getContext('2d', { willReadFrequently: true }); cx.imageSmoothingEnabled = true;
      cx.drawImage(img, 0, 0, w, h);
      return Array.from(cx.getImageData(0, 0, w, h).data);
    }, { svg, w: png.w, h: png.h });
    let inter = 0, uni = 0;
    for (let y = 0; y < png.h; y++) for (let x = 0; x < png.w; x++) {
      const i = (y * png.w + x) * 4; const s = r1[i + 3] > 40, p = png.px[y][x].a > 40;
      if (s || p) uni++; if (s && p) inter++;
    }
    console.log(`${out}  IoU=${(inter / uni).toFixed(3)}  (${svg.length}B)`);
  }
  await b.close();
}
