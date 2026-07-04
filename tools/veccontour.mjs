// Faithful pixel-region -> smooth SVG path tracer for the scale>1 "redrawn crisp" assets.
// It does NOT invent geometry: it walks the EXACT boundary edges between selected and
// unselected pixels of the real firmware sprite (integer vertices on the pixel lattice),
// giving the true staircase silhouette as closed rings (outer + holes). Optional Chaikin
// corner-cutting rounds the staircase into smooth curves for the N>1 display, fit to the
// real outline - the only thing "smoothed" is the interpolation between real pixel corners.
// Colours are taken verbatim from the sprite. scale=1 keeps the exact bitmap (this file is
// only used to author the SVG that loads at scale>1).
import { execFileSync } from 'child_process';

// decode a PNG to {w,h, px:[{r,g,b,a}]} via ImageMagick (no native deps)
export function loadPNG(file) {
  const out = execFileSync('convert', [file, '-depth', '8', 'txt:-'], { maxBuffer: 1 << 24 }).toString();
  const px = {}; let W = 0, H = 0;
  for (const line of out.split('\n')) {
    const m = line.match(/^(\d+),(\d+):\s*\(([-0-9. ,]+)\)/);
    if (!m) continue;
    const x = +m[1], y = +m[2];
    const c = m[3].split(',').map(s => parseFloat(s.trim()));
    px[x + ',' + y] = { r: c[0], g: c[1], b: c[2], a: c[3] === undefined ? 255 : c[3] };
    if (x + 1 > W) W = x + 1; if (y + 1 > H) H = y + 1;
  }
  const grid = [];
  for (let y = 0; y < H; y++) { const row = []; for (let x = 0; x < W; x++) row.push(px[x + ',' + y] || { r: 0, g: 0, b: 0, a: 0 }); grid.push(row); }
  return { w: W, h: H, px: grid };
}

// boolean mask from a predicate over each pixel
export function mask(png, pred) {
  return png.px.map(row => row.map(p => !!pred(p)));
}

// trace ALL boundary rings of a mask by walking pixel-edge segments and chaining them into
// closed loops. Each unit edge between an inside cell and an outside cell (or grid border)
// is emitted with a consistent winding, then segments are stitched end-to-end into rings.
export function traceRings(m) {
  const H = m.length, W = m[0].length;
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && m[y][x];
  const segs = new Map();               // "x,y" start -> [end,...]
  const add = (ax, ay, bx, by) => { const k = ax + ',' + ay; if (!segs.has(k)) segs.set(k, []); segs.get(k).push([bx, by]); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inside(x, y)) continue;
    // emit each of the 4 unit edges that borders an outside cell, wound CW so the inside
    // stays on the right (top: L->R, right: T->B, bottom: R->L, left: B->T)
    if (!inside(x, y - 1)) add(x, y, x + 1, y);
    if (!inside(x + 1, y)) add(x + 1, y, x + 1, y + 1);
    if (!inside(x, y + 1)) add(x + 1, y + 1, x, y + 1);
    if (!inside(x - 1, y)) add(x, y + 1, x, y);
  }
  const rings = [];
  const used = new Set();
  for (const [startKey, ends] of segs) {
    for (let ei = 0; ei < ends.length; ei++) {
      const uid = startKey + '>' + ei;
      if (used.has(uid)) continue;
      // walk a loop
      let ring = [startKey.split(',').map(Number)];
      let cx = ends[ei][0], cy = ends[ei][1];
      used.add(uid);
      let guard = 0;
      while (guard++ < 100000) {
        ring.push([cx, cy]);
        const k = cx + ',' + cy;
        const nexts = segs.get(k);
        if (!nexts) break;
        // pick the first unused outgoing edge that keeps the loop simple (prefer turning)
        let picked = -1;
        for (let j = 0; j < nexts.length; j++) { if (!used.has(k + '>' + j)) { picked = j; break; } }
        if (picked < 0) break;
        used.add(k + '>' + picked);
        cx = nexts[picked][0]; cy = nexts[picked][1];
        if (cx === ring[0][0] && cy === ring[0][1]) break;
      }
      if (ring.length >= 4) rings.push(dedupeCollinear(ring));
    }
  }
  return rings;
}

// drop collinear intermediate points (keeps corners only)
function dedupeCollinear(r) {
  const out = [];
  const n = r.length;
  for (let i = 0; i < n; i++) {
    const a = r[(i - 1 + n) % n], b = r[i], c = r[(i + 1) % n];
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (cross !== 0) out.push(b);
  }
  return out.length >= 3 ? out : r;
}

// Chaikin corner-cutting: rounds the staircase. iters ~2 gives a smooth outline that still
// hugs the real pixel corners. closed ring in, closed ring out.
export function chaikin(ring, iters = 2) {
  let pts = ring;
  for (let it = 0; it < iters; it++) {
    const out = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    pts = out;
  }
  return pts;
}

// rings -> SVG path data. Each ring closed with Z; even-odd fill handles holes.
export function ringsToPath(rings, prec = 2) {
  const f = v => (+v.toFixed(prec)).toString();
  return rings.map(r => 'M' + r.map(p => f(p[0]) + ' ' + f(p[1])).join(' L') + 'Z').join(' ');
}

export const hex = p => '#' + [p.r, p.g, p.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
