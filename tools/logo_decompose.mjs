// Decompose the provided Nintendo DSi logo SVG (/work/Nintendo_DSi_logo.svg) into named parts
// so the boot animation can move the dual-screen element on its own: the two rounded squares
// (the stylised "O", animated) vs the static wordmark, the "i" dot, and the TM. Flattens every
// path's transform chain into absolute viewBox coords and emits Path2D-ready 'd' strings + fill,
// so boot.js can draw each part crisply (vector) at any scale. Output: webapp/public/boot/logo_parts.json
import fs from 'fs';

const svg = fs.readFileSync(process.argv[2] || '/work/Nintendo_DSi_logo.svg', 'latin1');

// ---- transform helpers (2x3 affine [a,b,c,d,e,f]: x'=a x+c y+e, y'=b x+d y+f) ----
const I = [1, 0, 0, 1, 0, 0];
const mul = (m, n) => [m[0]*n[0]+m[2]*n[1], m[1]*n[0]+m[3]*n[1], m[0]*n[2]+m[2]*n[3], m[1]*n[2]+m[3]*n[3], m[0]*n[4]+m[2]*n[5]+m[4], m[1]*n[4]+m[3]*n[5]+m[5]];
const apply = (m, x, y) => [m[0]*x+m[2]*y+m[4], m[1]*x+m[3]*y+m[5]];
function parseTransform(s) {
  if (!s) return I;
  const t = /translate\(([-\d.]+),([-\d.]+)\)/.exec(s);
  if (t) return [1, 0, 0, 1, +t[1], +t[2]];
  const m = /matrix\(([-\d.e,]+)\)/.exec(s);
  if (m) { const v = m[1].split(',').map(Number); return v; }
  return I;
}

// ---- SVG path 'd' -> absolute segments, transform, re-emit ----
function toAbs(d) {
  const toks = d.match(/[MmLlCcHhVvZz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  const segs = []; let i = 0, cx = 0, cy = 0, sx = 0, sy = 0, cmd = '';
  const n = () => parseFloat(toks[i++]);
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) { cmd = toks[i++]; }
    if (cmd === 'M' || cmd === 'm') { let x = n(), y = n(); if (cmd === 'm') { x += cx; y += cy; } cx = sx = x; cy = sy = y; segs.push(['M', x, y]); cmd = cmd === 'm' ? 'l' : 'L'; }
    else if (cmd === 'L' || cmd === 'l') { let x = n(), y = n(); if (cmd === 'l') { x += cx; y += cy; } cx = x; cy = y; segs.push(['L', x, y]); }
    else if (cmd === 'H' || cmd === 'h') { let x = n(); if (cmd === 'h') x += cx; cx = x; segs.push(['L', x, cy]); }
    else if (cmd === 'V' || cmd === 'v') { let y = n(); if (cmd === 'v') y += cy; cy = y; segs.push(['L', cx, y]); }
    else if (cmd === 'C' || cmd === 'c') { let a = n(), b = n(), c = n(), dd = n(), x = n(), y = n(); if (cmd === 'c') { a += cx; b += cy; c += cx; dd += cy; x += cx; y += cy; } cx = x; cy = y; segs.push(['C', a, b, c, dd, x, y]); }
    else if (cmd === 'Z' || cmd === 'z') { segs.push(['Z']); cx = sx; cy = sy; }
    else i++;
  }
  return segs;
}
function emit(segs, m) {
  const P = (x, y) => { const [X, Y] = apply(m, x, y); return X.toFixed(2) + ',' + Y.toFixed(2); };
  let out = '';
  for (const s of segs) {
    if (s[0] === 'M') out += 'M' + P(s[1], s[2]);
    else if (s[0] === 'L') out += 'L' + P(s[1], s[2]);
    else if (s[0] === 'C') out += 'C' + P(s[1], s[2]) + ' ' + P(s[3], s[4]) + ' ' + P(s[5], s[6]);
    else if (s[0] === 'Z') out += 'Z';
  }
  return out;
}

// ---- walk the SVG maintaining a transform stack; collect paths ----
const tokens = svg.match(/<g[^>]*>|<\/g>|<path[^>]*\/?>/g) || [];
const stack = [I]; const paths = [];
for (const tk of tokens) {
  if (tk.startsWith('<g')) { const tr = (/transform="([^"]+)"/.exec(tk) || [])[1]; stack.push(mul(stack[stack.length - 1], parseTransform(tr))); }
  else if (tk.startsWith('</g')) { stack.pop(); }
  else if (tk.startsWith('<path')) {
    const id = (/id="([^"]+)"/.exec(tk) || [])[1];
    const d = (/d="([^"]+)"/.exec(tk) || [])[1];
    const fill = (/fill:(#[0-9a-fA-F]+)/.exec(tk) || [])[1] || '#000000';
    let m = stack[stack.length - 1];
    // a path may carry its own transform attribute too
    const ptr = (/transform="([^"]+)"/.exec(tk) || [])[1];
    if (ptr) m = mul(m, parseTransform(ptr));
    if (d) paths.push({ id, fill, d: emit(toAbs(d), m) });
  }
}

// classify by id
const SQUARES = new Set(['path63', 'path103']);  // the two dual-screen rounded squares (the "O")
const IDOT = new Set(['path115']);               // the DSi "i"
const TM = new Set(['path47', 'path51']);        // trademark
const parts = { wordmark: [], squares: [], iDot: [], tm: [] };
for (const p of paths) {
  if (SQUARES.has(p.id)) parts.squares.push(p);
  else if (IDOT.has(p.id)) parts.iDot.push(p);
  else if (TM.has(p.id)) parts.tm.push(p);
  else parts.wordmark.push(p);
}
const W = +(/<svg[^>]*\swidth="([\d.]+)"/.exec(svg) || [])[1], H = +(/<svg[^>]*\sheight="([\d.]+)"/.exec(svg) || [])[1];
const out = { w: W, h: H, ...parts };
fs.writeFileSync('webapp/public/boot/logo_parts.json', JSON.stringify(out));
console.log(`viewBox ${W}x${H}; wordmark=${parts.wordmark.length} squares=${parts.squares.map(p => p.id + '/' + p.fill)} iDot=${parts.iDot.length} tm=${parts.tm.length}`);
