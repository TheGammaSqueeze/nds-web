// Circle-fit vectorizer for the colour swatches (filled discs) and selection rings (annuli).
// These sprites are true circles, so a fitted <circle> is cleaner than a traced staircase.
// Centre = opaque centroid; radii = measured from the real pixels (disc: sqrt(area/pi);
// ring: min/max opaque radius -> a stroked mid-radius circle of the measured thickness).
// Colours sampled from the sprite. Disc vs ring detected by whether the centre is transparent.
import fs from 'fs';
import { loadPNG, hex } from './veccontour.mjs';

export function buildCircleSVG(pngFile) {
  const png = loadPNG(pngFile);
  const pts = [];
  for (let y = 0; y < png.h; y++) for (let x = 0; x < png.w; x++) if (png.px[y][x].a > 40) pts.push([x, y]);
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length + 0.5;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length + 0.5;
  const centreOpaque = png.px[Math.floor(cy)]?.[Math.floor(cx)]?.a > 40;
  const modalAmong = pred => {
    const m = new Map();
    for (const [x, y] of pts) { const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (pred(r)) { const c = hex(png.px[y][x]); m.set(c, (m.get(c) || 0) + 1); } }
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  const radii = pts.map(([x, y]) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy));
  const rMax = Math.max(...radii);
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${png.w}" height="${png.h}" viewBox="0 0 ${png.w} ${png.h}" shape-rendering="geometricPrecision">`;
  const f = v => (+v.toFixed(2)).toString();
  if (centreOpaque) {
    // filled disc (swatch): area -> radius; fill = interior colour, thin rim stroke
    const r = Math.sqrt(pts.length / Math.PI);
    const fill = modalAmong(rr => rr < r - 1.5) || modalAmong(() => true);
    const rim = modalAmong(rr => rr >= r - 1.5) || fill;
    return head + `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r - 0.5)}" fill="${fill}" stroke="${rim}" stroke-width="1"/></svg>`;
  }
  // annulus (ring): inner radius = smallest opaque radius; stroke a mid-radius circle
  const rMin = Math.min(...radii);
  const mid = (rMin + rMax) / 2, thick = rMax - rMin;
  const ringC = modalAmong(rr => rr > rMin + thick * 0.25 && rr < rMax - thick * 0.25) || modalAmong(() => true);
  const edgeC = modalAmong(rr => rr >= rMax - 1) || ringC;
  return head
    + `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(mid)}" fill="none" stroke="${ringC}" stroke-width="${f(thick)}"/>`
    + `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rMax - 0.5)}" fill="none" stroke="${edgeC}" stroke-width="1"/></svg>`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { chromium } = await import('playwright');
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await b.newPage();
  for (const f of process.argv.slice(2)) {
    const png = loadPNG(f);
    const svg = buildCircleSVG(f);
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
