// Lossless PNG -> SVG re-encoder for static UI chrome.
//
// This does NOT trace or idealize shapes (no bezier fitting, no rounding out
// staircase corners into arcs - the DSi firmware really does draw hard-edged
// integer staircases in a lot of places, and "fixing" that would be an
// approximation the project's no-approximations rule forbids). It only:
//   1. Run-length merges the exact pixel grid into axis-aligned solid rects.
//   2. Where a run of rects along one axis shares the same span and its color
//      changes every step (a real vertical/horizontal gradient ramp baked by
//      the DS palette), replaces that run with one rect filled by an SVG
//      linearGradient whose stops are the EXACT measured colors at the EXACT
//      real offsets. That only smooths the interpolation BETWEEN measured
//      rows; every stop itself is a real pixel value, nothing is invented.
// Every output is verified by rasterizing the SVG back at 1:1 and diffing
// against the source PNG. Gradient collapsing is only kept if it stays
// within tolerance; otherwise that run falls back to exact per-step rects,
// which are lossless by construction (they ARE the source pixels).
//
// Usage: node tools/svgify.mjs <in.png> <out.svg> [--tolerance N] [--min-gradient-run N]

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const MIN_GRADIENT_RUN = 6; // shortest ramp worth collapsing into a gradient
const DEFAULT_TOLERANCE = 0; // gradient collapsing must round-trip byte-exact or it is rejected

async function loadPNGPixels(page, pngPath) {
  const buf = fs.readFileSync(pngPath);
  const b64 = buf.toString('base64');
  return page.evaluate(async (dataUrl) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.imageSmoothingEnabled = false;
    cx.drawImage(img, 0, 0);
    const id = cx.getImageData(0, 0, cv.width, cv.height);
    return { width: cv.width, height: cv.height, data: Array.from(id.data) };
  }, `data:image/png;base64,${b64}`);
}

async function rasterizeSVG(page, svgString, width, height) {
  const b64 = Buffer.from(svgString, 'utf8').toString('base64');
  return page.evaluate(async ({ dataUrl, w, h }) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.imageSmoothingEnabled = false;
    cx.drawImage(img, 0, 0, w, h);
    const id = cx.getImageData(0, 0, w, h);
    return Array.from(id.data);
  }, { dataUrl: `data:image/svg+xml;base64,${b64}`, w: width, h: height });
}

function px(data, w, x, y) {
  const i = (y * w + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}
function eq(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]; }

// Row-based RLE -> vertical merge into solid rects (histogram meshing).
function meshRects(data, w, h) {
  const rects = [];
  let open = []; // { x, len, color, y0 }
  for (let y = 0; y <= h; y++) {
    const spans = [];
    if (y < h) {
      let x = 0;
      while (x < w) {
        const c = px(data, w, x, y);
        let x2 = x + 1;
        while (x2 < w && eq(px(data, w, x2, y), c)) x2++;
        spans.push({ x, len: x2 - x, color: c });
        x = x2;
      }
    }
    const stillOpen = [];
    for (const o of open) {
      const match = y < h && spans.find(s => s.x === o.x && s.len === o.len && eq(s.color, o.color));
      if (match) { match._claimed = true; stillOpen.push(o); }
      else rects.push({ x: o.x, y: o.y0, w: o.len, h: y - o.y0, color: o.color });
    }
    open = stillOpen;
    if (y < h) for (const s of spans) if (!s._claimed) open.push({ x: s.x, len: s.len, color: s.color, y0: y });
  }
  return rects;
}

// Find runs of same-span (x,w) unit-height rects stacked in y, color changing every step:
// candidates for a vertical linear gradient. Mutates nothing; returns { gradientRuns, used(Set) }.
function findVerticalGradientRuns(rects, minRun) {
  const byX = new Map();
  for (const r of rects) {
    const key = `${r.x},${r.w}`;
    if (!byX.has(key)) byX.set(key, []);
    byX.get(key).push(r);
  }
  const runs = [];
  const used = new Set();
  for (const [, list] of byX) {
    list.sort((a, b) => a.y - b.y);
    let i = 0;
    while (i < list.length) {
      let j = i;
      // a run: contiguous in y (r[k].y + r[k].h === r[k+1].y), height 1 each, color differs from previous
      while (j + 1 < list.length
        && list[j].h === 1 && list[j + 1].h === 1
        && list[j].y + list[j].h === list[j + 1].y
        && !eq(list[j].color, list[j + 1].color)) j++;
      const runLen = j - i + 1;
      if (runLen >= minRun && list[i].h === 1) {
        runs.push(list.slice(i, j + 1));
        for (const r of list.slice(i, j + 1)) used.add(r);
      }
      i = j + 1;
    }
  }
  return { runs, used };
}

function findHorizontalGradientRuns(rects, minRun, excludeSet) {
  const byY = new Map();
  for (const r of rects) {
    if (excludeSet.has(r)) continue;
    const key = `${r.y},${r.h}`;
    if (!byY.has(key)) byY.set(key, []);
    byY.get(key).push(r);
  }
  const runs = [];
  const used = new Set();
  for (const [, list] of byY) {
    list.sort((a, b) => a.x - b.x);
    let i = 0;
    while (i < list.length) {
      let j = i;
      while (j + 1 < list.length
        && list[j].w === 1 && list[j + 1].w === 1
        && list[j].x + list[j].w === list[j + 1].x
        && !eq(list[j].color, list[j + 1].color)) j++;
      const runLen = j - i + 1;
      if (runLen >= minRun && list[i].w === 1) {
        runs.push(list.slice(i, j + 1));
        for (const r of list.slice(i, j + 1)) used.add(r);
      }
      i = j + 1;
    }
  }
  return { runs, used };
}

function colorStr([r, g, b, a]) {
  return { fill: `rgb(${r},${g},${b})`, opacity: a / 255 };
}

function buildSVG(width, height, rects, vGradients, hGradients) {
  const defs = [];
  const shapes = [];
  let gid = 0;
  const emitRect = (r) => {
    const { fill, opacity } = colorStr(r.color);
    const op = opacity < 1 ? ` fill-opacity="${opacity.toFixed(4)}"` : '';
    shapes.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${fill}"${op}/>`);
  };
  for (const run of vGradients) {
    const id = `g${gid++}`;
    const x = run[0].x, w = run[0].w, y0 = run[0].y, y1 = run[run.length - 1].y + run[run.length - 1].h;
    const stops = run.map(r => {
      const off = ((r.y + 0.5 - y0) / (y1 - y0) * 100).toFixed(3);
      const { fill, opacity } = colorStr(r.color);
      const op = opacity < 1 ? ` stop-opacity="${opacity.toFixed(4)}"` : '';
      return `<stop offset="${off}%" stop-color="${fill}"${op}/>`;
    }).join('');
    defs.push(`<linearGradient id="${id}" x1="0" y1="${y0}" x2="0" y2="${y1}" gradientUnits="userSpaceOnUse">${stops}</linearGradient>`);
    shapes.push(`<rect x="${x}" y="${y0}" width="${w}" height="${y1 - y0}" fill="url(#${id})"/>`);
  }
  for (const run of hGradients) {
    const id = `g${gid++}`;
    const y = run[0].y, h = run[0].h, x0 = run[0].x, x1 = run[run.length - 1].x + run[run.length - 1].w;
    const stops = run.map(r => {
      const off = ((r.x + 0.5 - x0) / (x1 - x0) * 100).toFixed(3);
      const { fill, opacity } = colorStr(r.color);
      const op = opacity < 1 ? ` stop-opacity="${opacity.toFixed(4)}"` : '';
      return `<stop offset="${off}%" stop-color="${fill}"${op}/>`;
    }).join('');
    defs.push(`<linearGradient id="${id}" x1="${x0}" y1="0" x2="${x1}" y2="0" gradientUnits="userSpaceOnUse">${stops}</linearGradient>`);
    shapes.push(`<rect x="${x0}" y="${y}" width="${x1 - x0}" height="${h}" fill="url(#${id})"/>`);
  }
  const usedRects = new Set([...vGradients, ...hGradients].flat());
  for (const r of rects) {
    if (usedRects.has(r)) continue;
    if (r.color[3] === 0) continue; // fully transparent, nothing to draw
    emitRect(r);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    (defs.length ? `<defs>${defs.join('')}</defs>` : '') + shapes.join('') + `</svg>`;
}

function diff(a, b) {
  let maxDiff = 0, diffCount = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > 0) diffCount++;
    if (d > maxDiff) maxDiff = d;
  }
  return { maxDiff, diffCount };
}

// DS graphics are hardware tile-based (8x8 tiles); a lot of "texture" chrome (line
// patterns, dither washes) is really a small tile repeated across the whole surface.
// Detect a genuine exact repeat period (not a guess - every pixel must match the
// modulo-tiled source) so it can be encoded as one small <pattern> instead of
// thousands of individual rects. Smallest area wins; a real repeat always exists
// trivially at (w,h) so anything smaller found here is a measured structural fact.
function findTilePeriod(data, w, h, maxP = 32) {
  const packed = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    packed[y * w + x] = ((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]) >>> 0;
  }
  const candidates = [];
  for (let ph = 1; ph <= Math.min(maxP, h); ph++)
    for (let pw = 1; pw <= Math.min(maxP, w); pw++)
      if (pw !== w || ph !== h) candidates.push([pw, ph, pw * ph]);
  candidates.sort((a, b) => a[2] - b[2]);
  for (const [pw, ph] of candidates) {
    if (pw * ph * 4 > w * h) break; // no point tiling if the tile isn't meaningfully smaller
    let ok = true;
    for (let y = 0; ok && y < h; y++) {
      const my = y % ph;
      const rowBase = y * w, tileRowBase = my * w;
      for (let x = 0; x < w; x++) {
        if (packed[rowBase + x] !== packed[tileRowBase + (x % pw)]) { ok = false; break; }
      }
    }
    if (ok) return [pw, ph];
  }
  return null;
}

function buildTiledSVG(width, height, pw, ph, tileRects) {
  const shapes = tileRects.filter(r => r.color[3] !== 0).map(r => {
    const { fill, opacity } = colorStr(r.color);
    const op = opacity < 1 ? ` fill-opacity="${opacity.toFixed(4)}"` : '';
    return `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${fill}"${op}/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><pattern id="t" x="0" y="0" width="${pw}" height="${ph}" patternUnits="userSpaceOnUse">${shapes}</pattern></defs>` +
    `<rect x="0" y="0" width="${width}" height="${height}" fill="url(#t)"/></svg>`;
}

export async function svgify(page, inputPath, outputPath, opts = {}) {
  const tolerance = opts.tolerance ?? DEFAULT_TOLERANCE;
  const minRun = opts.minGradientRun ?? MIN_GRADIENT_RUN;
  const { width, height, data } = await loadPNGPixels(page, inputPath);

  // 1) exact tile-repeat encoding, verified; smallest and crispest when it applies
  const period = opts.noTile ? null : findTilePeriod(data, width, height);
  if (period) {
    const [pw, ph] = period;
    const tileData = new Array(pw * ph * 4);
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      const si = (y * width + x) * 4, di = (y * pw + x) * 4;
      for (let c = 0; c < 4; c++) tileData[di + c] = data[si + c];
    }
    const tileRects = meshRects(tileData, pw, ph);
    const svg = buildTiledSVG(width, height, pw, ph, tileRects);
    const raster = await rasterizeSVG(page, svg, width, height);
    const { maxDiff, diffCount } = diff(data, raster);
    if (maxDiff === 0) {
      if (outputPath) { fs.mkdirSync(path.dirname(outputPath), { recursive: true }); fs.writeFileSync(outputPath, svg); }
      return { width, height, rectCount: tileRects.length, tilePeriod: [pw, ph], gradientRuns: 0,
        usedGradients: false, maxDiff, diffCount, totalPixels: width * height, bytes: svg.length };
    }
    // tile detection false positive (shouldn't happen given the exact modulo check) - fall through
  }

  const rects = meshRects(data, width, height);

  // 2) gradient collapsing on top of the full mesh
  const { runs: vRuns, used: vUsed } = findVerticalGradientRuns(rects, minRun);
  const { runs: hRuns } = findHorizontalGradientRuns(rects, minRun, vUsed);
  let svg = buildSVG(width, height, rects, vRuns, hRuns);
  let raster = await rasterizeSVG(page, svg, width, height);
  let { maxDiff, diffCount } = diff(data, raster);

  let usedGradients = true;
  if (maxDiff > tolerance) {
    // 3) fall back to exact rects only, always lossless by construction
    svg = buildSVG(width, height, rects, [], []);
    raster = await rasterizeSVG(page, svg, width, height);
    ({ maxDiff, diffCount } = diff(data, raster));
    usedGradients = false;
  }

  if (outputPath) { fs.mkdirSync(path.dirname(outputPath), { recursive: true }); fs.writeFileSync(outputPath, svg); }
  return {
    width, height, rectCount: rects.length,
    gradientRuns: usedGradients ? vRuns.length + hRuns.length : 0,
    usedGradients, maxDiff, diffCount, totalPixels: width * height,
    bytes: svg.length,
  };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const [inFile, outFile] = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (!inFile || !outFile) { console.error('usage: node tools/svgify.mjs <in.png> <out.svg>'); process.exit(1); }
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
  const page = await b.newPage();
  const result = await svgify(page, inFile, outFile, {});
  await b.close();
  console.log(JSON.stringify(result, null, 2));
}
