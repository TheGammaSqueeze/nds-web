// Build smooth, faithful battery SVGs (full/low/charge) for the scale>1 crisp UI, from the
// real decoded firmware sprites. The dark body frame + terminal nub + (charge) plug are
// traced from their exact pixel silhouette and Chaikin-rounded; the coloured fill bands are
// kept as exact axis-aligned rects (already crisp at any scale). scale=1 keeps the PNG.
import fs from 'fs';
import { chromium } from 'playwright';
import { loadPNG, mask, traceRings, chaikin, ringsToPath, hex } from './veccontour.mjs';

const near = (p, c, t = 30) => Math.abs(p.r - c.r) < t && Math.abs(p.g - c.g) < t && Math.abs(p.b - c.b) < t;

// auto-detect the frame colour: the colour of the longest solid horizontal border run near
// the top (the battery outline). Works for both the launcher dark #414141 frame and the
// settings-bar light #cbcbcb frame - no hardcoded palette.
function frameColor(png) {
  for (let y = 0; y < png.h; y++) {
    let x = 0;
    while (x < png.w) {
      const p = png.px[y][x];
      if (p.a <= 8) { x++; continue; }
      let x2 = x + 1; while (x2 < png.w && png.px[y][x2].a > 8 && png.px[y][x2].r === p.r && png.px[y][x2].g === p.g && png.px[y][x2].b === p.b) x2++;
      if (x2 - x >= 6) return { r: p.r, g: p.g, b: p.b };
      x = x2;
    }
  }
  return { r: 65, g: 65, b: 65 };
}

// bounding box of the frame mask (for isolating the 4 rounded-corner AA pixels)
function frameBBox(png, fc) {
  let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
  for (let y = 0; y < png.h; y++) for (let x = 0; x < png.w; x++) if (png.px[y][x].a > 8 && near(png.px[y][x], fc)) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  return { minX, maxX, minY, maxY };
}

// horizontal-run merge of the coloured fill pixels (everything not frame, not a corner-AA
// pixel that sits exactly at a frame bbox corner - those are replaced by the rounded vector corner)
function fillRects(png, fc, bb) {
  const isFrame = p => p.a > 8 && near(p, fc);
  const atCorner = (x, y) => (x <= bb.minX + 1 || x >= bb.maxX - 1) && (y <= bb.minY + 1 || y >= bb.maxY - 1);
  const isCornerAA = (p, x, y) => p.a > 8 && !isFrame(p) && atCorner(x, y);
  const rects = [];
  for (let y = 0; y < png.h; y++) {
    let x = 0;
    while (x < png.w) {
      const p = png.px[y][x];
      if (p.a <= 8 || isFrame(p) || isCornerAA(p, x, y)) { x++; continue; }
      const c = hex(p); let x2 = x + 1;
      while (x2 < png.w) { const q = png.px[y][x2]; if (q.a <= 8 || isFrame(q) || isCornerAA(q, x2, y) || hex(q) !== c) break; x2++; }
      rects.push({ x, y, w: x2 - x, h: 1, fill: c });
      x = x2;
    }
  }
  // vertical-merge identical adjacent rows
  rects.sort((a, b) => a.x - b.x || a.w - b.w || a.y - b.y);
  const merged = [];
  for (const r of rects) {
    const m = merged.find(o => o.x === r.x && o.w === r.w && o.fill === r.fill && o.y + o.h === r.y);
    if (m) m.h += 1; else merged.push({ ...r });
  }
  return merged;
}

function buildSVG(pngFile) {
  const png = loadPNG(pngFile);
  const fc = frameColor(png);
  const frame = mask(png, p => p.a > 8 && near(p, fc));
  // 1 Chaikin pass = a single corner chamfer: rounds the staircase just enough to kill the
  // jaggies at N>1 while keeping the frame's real ~1px corner radius (2 passes over an 11px
  // body over-rounds it into a pill). The plug silhouette in charge also reads cleaner subtle.
  const rings = traceRings(frame).map(r => chaikin(r, 1));
  const framePath = ringsToPath(rings, 2);
  const fills = fillRects(png, fc, frameBBox(png, fc));
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${png.w}" height="${png.h}" viewBox="0 0 ${png.w} ${png.h}" shape-rendering="geometricPrecision">`];
  // fills first (behind the frame), then the smoothed frame on top (frame colour from the sprite)
  for (const f of fills) parts.push(`<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="${f.fill}"/>`);
  parts.push(`<path d="${framePath}" fill="${hex(fc)}" fill-rule="evenodd"/>`);
  parts.push('</svg>');
  return parts.join('');
}

// rasterize an SVG string to an RGBA grid at a given scale via Chromium canvas
async function raster(page, svg, scale, w, h) {
  return page.evaluate(async ({ svg, scale, w, h }) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/svg+xml;base64,' + btoa(svg); });
    const cv = document.createElement('canvas'); cv.width = w * scale; cv.height = h * scale;
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.imageSmoothingEnabled = true;
    cx.drawImage(img, 0, 0, w * scale, h * scale);
    return Array.from(cx.getImageData(0, 0, cv.width, cv.height).data);
  }, { svg, scale, w, h });
}

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: vecbatt.mjs <png>...'); process.exit(1); }
const b = await chromium.launch({ args: ['--no-sandbox'] });
const page = await b.newPage();
for (const f of files) {
  const png = loadPNG(f);
  const svg = buildSVG(f);
  const out = f.replace(/\.png$/, '.svg');
  fs.writeFileSync(out, svg);
  // verify: rasterize the SVG at 1x, compare silhouette (opaque coverage) to the PNG
  const r1 = await raster(page, svg, 1, png.w, png.h);
  let inter = 0, uni = 0, colErr = 0, colN = 0;
  for (let y = 0; y < png.h; y++) for (let x = 0; x < png.w; x++) {
    const i = (y * png.w + x) * 4;
    const svgA = r1[i + 3] > 40, pngA = png.px[y][x].a > 40;
    if (svgA || pngA) uni++; if (svgA && pngA) inter++;
    if (svgA && pngA) { const p = png.px[y][x]; colErr += Math.abs(r1[i] - p.r) + Math.abs(r1[i + 1] - p.g) + Math.abs(r1[i + 2] - p.b); colN++; }
  }
  console.log(`${out}  IoU=${(inter / uni).toFixed(3)}  meanColErr=${(colErr / (colN * 3)).toFixed(1)}  (${svg.length}B)`);
}
await b.close();
