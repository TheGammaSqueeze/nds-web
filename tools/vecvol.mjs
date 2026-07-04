// Purpose-built smooth volume icon for scale>1, from the real firmware sprite: the speaker is
// traced as one silhouette (exact outline, lightly rounded) and the 3 sound-wave arcs are drawn
// as quadratic curves through their REAL measured anchor pixels (top / rightmost / bottom of
// each arc's connected component). Colours are sampled from the sprite. Nothing eyeballed:
// silhouette + arc anchors + colours all come from the pixels. scale=1 keeps the exact PNG.
import fs from 'fs';
import { loadPNG, mask, traceRings, chaikin, ringsToPath, hex } from './veccontour.mjs';

// 8-connected components of a boolean grid
function components(grid) {
  const H = grid.length, W = grid[0].length, seen = Array.from({ length: H }, () => Array(W).fill(false));
  const comps = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!grid[y][x] || seen[y][x]) continue;
    const stack = [[x, y]], cells = []; seen[y][x] = true;
    while (stack.length) {
      const [cx, cy] = stack.pop(); cells.push([cx, cy]);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && grid[ny][nx] && !seen[ny][nx]) { seen[ny][nx] = true; stack.push([nx, ny]); }
      }
    }
    comps.push(cells);
  }
  return comps;
}

function modalColor(png, cells) {
  const cnt = new Map();
  for (const [x, y] of cells) { const c = hex(png.px[y][x]); cnt.set(c, (cnt.get(c) || 0) + 1); }
  return [...cnt.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export function buildVolSVG(pngFile, speakerMaxX = 7) {
  const png = loadPNG(pngFile);
  const opaque = (x, y) => png.px[y][x].a > 8;
  // speaker = opaque pixels at x <= speakerMaxX (the left blob)
  const spkGrid = Array.from({ length: png.h }, (_, y) => Array.from({ length: png.w }, (_, x) => opaque(x, y) && x <= speakerMaxX));
  const spkCells = []; for (let y = 0; y < png.h; y++) for (let x = 0; x < png.w; x++) if (spkGrid[y][x]) spkCells.push([x, y]);
  const spkColor = modalColor(png, spkCells);
  const spkRings = traceRings(spkGrid).map(r => chaikin(r, 1));
  const spkPath = ringsToPath(spkRings, 2);
  // arcs = opaque pixels at x > speakerMaxX, split into connected components, ordered by radius (mean x)
  const arcGrid = Array.from({ length: png.h }, (_, y) => Array.from({ length: png.w }, (_, x) => opaque(x, y) && x > speakerMaxX));
  let comps = components(arcGrid).filter(c => c.length >= 3);
  comps.forEach(c => { c.mx = c.reduce((s, p) => s + p[0], 0) / c.length; });
  comps.sort((a, b) => a.mx - b.mx);
  const arcs = comps.map(cells => {
    let top = cells[0], bot = cells[0], right = cells[0];
    for (const p of cells) { if (p[1] < top[1]) top = p; if (p[1] > bot[1]) bot = p; if (p[0] > right[0]) right = p; }
    // arc thickness ~ component width in the middle row -> stroke width
    const rowXs = cells.filter(p => p[1] === right[1]).map(p => p[0]);
    const sw = Math.max(1.2, (Math.max(...rowXs) - Math.min(...rowXs) + 1) * 0.9);
    const color = modalColor(png, cells);
    // anchor at pixel centres (+0.5); quad control so the curve passes through the right anchor
    const T = [top[0] + 0.5, top[1] + 0.2], B = [bot[0] + 0.5, bot[1] + 0.8], M = [right[0] + 0.9, right[1] + 0.5];
    const ctrl = [2 * M[0] - (T[0] + B[0]) / 2, 2 * M[1] - (T[1] + B[1]) / 2];
    return { T, B, ctrl, sw, color };
  });
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${png.w}" height="${png.h}" viewBox="0 0 ${png.w} ${png.h}" shape-rendering="geometricPrecision">`];
  parts.push(`<path d="${spkPath}" fill="${spkColor}" fill-rule="evenodd"/>`);
  const f = v => (+v.toFixed(2)).toString();
  for (const a of arcs) parts.push(`<path d="M${f(a.T[0])} ${f(a.T[1])} Q${f(a.ctrl[0])} ${f(a.ctrl[1])} ${f(a.B[0])} ${f(a.B[1])}" fill="none" stroke="${a.color}" stroke-width="${f(a.sw)}" stroke-linecap="round"/>`);
  parts.push('</svg>');
  return { svg: parts.join(''), nArcs: arcs.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { chromium } = await import('playwright');
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await b.newPage();
  for (const f of process.argv.slice(2)) {
    const png = loadPNG(f);
    const { svg, nArcs } = buildVolSVG(f);
    fs.writeFileSync(f.replace(/\.png$/, '.svg'), svg);
    const r1 = await page.evaluate(async ({ svg, w, h }) => {
      const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/svg+xml;base64,' + btoa(svg); });
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.imageSmoothingEnabled = true; cx.drawImage(img, 0, 0, w, h);
      return Array.from(cx.getImageData(0, 0, w, h).data);
    }, { svg, w: png.w, h: png.h });
    let inter = 0, uni = 0; for (let y = 0; y < png.h; y++) for (let x = 0; x < png.w; x++) { const i = (y * png.w + x) * 4; const s = r1[i + 3] > 40, p = png.px[y][x].a > 40; if (s || p) uni++; if (s && p) inter++; }
    console.log(`${f.replace(/\.png$/, '.svg')}  arcs=${nArcs}  IoU=${(inter / uni).toFixed(3)}  (${svg.length}B)`);
  }
  await b.close();
}
