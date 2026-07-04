// Per-frame FIT of the vector boot logo against the real captured frames, using Chromium
// canvas (Playwright) as the renderer - the same Path2D + globalAlpha model boot.js uses live.
// (ImageMagick's SVG renderer ignores opacity, which corrupted the previous verification.)
//
// For each of the 119 frames:
//   state = { wm, i, tm, blk (global fade alphas), screens: [{cx,cy,w,op}, ...] }
//   - seed from the previous frame's fit + that frame's brute-force detections (union, dedup)
//   - coordinate descent: refine each screen (cx,cy,w,op) and each alpha to minimize the mean
//     abs gray diff vs the real frame over the animation region
//   - drop-test each screen (remove if that lowers or keeps the diff)
//   - residual scan: find leftover gray blobs the render misses, test-add screens there
// Output: webapp/public/boot/logo_anim.json (per-frame state, replayed verbatim by boot.js)
// plus an honest per-frame diff table incl. the achievable floor (settled-frame diff).
import { chromium } from 'playwright';
import { startServer } from './serve.js';
import fs from 'fs';

const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('PAGEERR', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await p.goto(s.url + 'index.html', { waitUntil: 'networkidle' });

const result = await p.evaluate(async () => {
  const N = 119;
  const REG = { x0: 18, y0: 8, x1: 242, y1: 132 };
  const S = 0.357, OX = 20.29, OY = 59.29, SCX = 135.0, SCY = 86.7, SW = 15.5;
  const BG = 251;

  const parts = await (await fetch('public/boot/logo_parts.json')).json();
  const dets = await (await fetch('public/boot/logo_dets.json')).json();
  const fades = await (await fetch('public/boot/logo_fades.json')).json();
  const P = {
    wordmark: parts.wordmark.map(q => new Path2D(q.d)),
    screen: new Path2D(parts.squares[0].d),
    top: new Path2D(parts.squares[1].d),
    iDot: parts.iDot.map(q => new Path2D(q.d)),
    tm: parts.tm.map(q => new Path2D(q.d)),
  };

  // load all real frames as gray arrays
  const real = [];
  for (let f = 0; f < N; f++) {
    const img = new Image();
    img.src = `public/boot/top_${String(f).padStart(3, '0')}.png`;
    await img.decode();
    const c = document.createElement('canvas'); c.width = 256; c.height = 192;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    const d = cx.getImageData(0, 0, 256, 192).data;
    const g = new Float32Array(256 * 192);
    for (let i = 0; i < 256 * 192; i++) g[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
    real.push(g);
  }

  const rc = document.createElement('canvas'); rc.width = 256; rc.height = 192;
  const ctx = rc.getContext('2d', { willReadFrequently: true });

  function render(st) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgb(${BG},${BG},${BG})`;
    ctx.fillRect(0, 0, 256, 192);
    const base = () => { ctx.translate(OX, OY); ctx.scale(S, S); };
    const grp = (paths, a, fill) => {
      if (a <= 0) return;
      ctx.save(); ctx.globalAlpha = Math.min(1, a); ctx.fillStyle = fill; base();
      for (const q of paths) ctx.fill(q);
      ctx.restore();
    };
    // per-letter wordmark alphas: the real fade is a left-to-right wipe on NINTENDO with the
    // DS block lagging (measured), which one global alpha cannot express
    for (let k = 0; k < P.wordmark.length; k++) grp([P.wordmark[k]], st.wma[k], '#000');
    // screens: a screen AT the settled pose renders as the exact SVG path (it has become the
    // logo's O, and must match the black upper screen's weight); flying screens render as
    // stroked rounded rects with rim = 0.148*w - measured from per-screen rim fits, slightly
    // thinner than the SVG's proportional 0.161*w, which is what the real frames show.
    for (const sc of st.screens) {
      if (sc.op <= 0) continue;
      const settled = Math.abs(sc.w - SW) <= 1.5 && Math.abs(sc.cx - SCX) <= 2 && Math.abs(sc.cy - SCY) <= 2;
      ctx.save(); ctx.globalAlpha = Math.min(1, sc.op);
      if (settled) {
        ctx.fillStyle = 'rgb(147,149,152)';
        base(); ctx.fill(P.screen);   // snap fully to the SVG pose (identity)
      } else {
        const rim = 0.148 * sc.w, h = 0.8138 * sc.w;
        ctx.strokeStyle = 'rgb(147,149,152)'; ctx.lineWidth = rim;
        const r = Math.max(0.5, 0.172 * sc.w - rim / 2);
        ctx.beginPath();
        ctx.roundRect(sc.cx - sc.w / 2 + rim / 2, sc.cy - h / 2 + rim / 2, sc.w - rim, h - rim, r);
        ctx.stroke();
      }
      ctx.restore();
    }
    grp([P.top], st.blk, '#000');
    grp(P.iDot, st.i, '#000');
    // no TM: the real boot animation never shows it
  }

  function diff(st, rg) {
    render(st);
    const d = ctx.getImageData(0, 0, 256, 192).data;
    let sum = 0, n = 0;
    for (let y = REG.y0; y < REG.y1; y++) for (let x = REG.x0; x < REG.x1; x++) {
      const i = y * 256 + x;
      sum += Math.abs((d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3 - rg[i]); n++;
    }
    return sum / n;
  }

  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

  function refine(st, rg) {
    // all fade alphas are FROZEN to the measured curves (logo_fades.json); only the flying
    // screens are optimized, so AA error cannot leak into letter darkness or ghost alphas
    let best = diff(st, rg);
    // screens: coordinate descent
    for (let pass = 0; pass < 2; pass++) {
      for (const sc of st.screens) {
        for (const [key, steps, lo, hi] of [['cx', [4, 2, 1], REG.x0, REG.x1], ['cy', [4, 2, 1], REG.y0, REG.y1], ['w', [4, 2], 10, 60], ['op', [0.2, 0.08, 0.03], 0.03, 1]]) {
          for (const step of steps) {
            let moved = true;
            while (moved) {
              moved = false;
              for (const dir of [1, -1]) {
                const v = clamp(sc[key] + dir * step, lo, hi);
                if (v === sc[key]) continue;
                const old = sc[key]; sc[key] = v;
                const d = diff(st, rg);
                if (d < best - 1e-4) { best = d; moved = true; } else sc[key] = old;
              }
            }
          }
        }
      }
      // drop-test with margin: prefer fewer screens, kill low-value ghost compensators
      for (let k = st.screens.length - 1; k >= 0; k--) {
        const removed = st.screens.splice(k, 1)[0];
        const d = diff(st, rg);
        if (d <= best + 0.06 || removed.op < 0.10) best = Math.min(best, d);
        else st.screens.splice(k, 0, removed);
      }
    }
    return best;
  }

  // residual gray-blob scan: propose screens where the real frame has gray ink my render lacks
  function addScan(st, rg) {
    let best = diff(st, rg);
    render(st);
    const d = ctx.getImageData(0, 0, 256, 192).data;
    const res = new Uint8Array(256 * 192);
    for (let y = REG.y0; y < REG.y1; y++) for (let x = REG.x0; x < REG.x1; x++) {
      const i = y * 256 + x;
      const mine = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
      if (rg[i] > 128 && rg[i] < 242 && mine - rg[i] > 14) res[i] = 1;   // real darker gray, mine too light
    }
    // connected components
    const seen = new Uint8Array(256 * 192), stax = new Int32Array(256 * 192);
    const props = [];
    for (let i0 = 0; i0 < 256 * 192; i0++) {
      if (!res[i0] || seen[i0]) continue;
      let sp = 0; stax[sp++] = i0; seen[i0] = 1;
      let n = 0, sx = 0, sy = 0, x0 = 256, y0 = 192, x1 = 0, y1 = 0;
      while (sp) {
        const q = stax[--sp], qx = q % 256, qy = (q / 256) | 0;
        n++; sx += qx; sy += qy;
        if (qx < x0) x0 = qx; if (qx > x1) x1 = qx; if (qy < y0) y0 = qy; if (qy > y1) y1 = qy;
        for (const nb of [q - 1, q + 1, q - 256, q + 256]) if (nb >= 0 && nb < 256 * 192 && res[nb] && !seen[nb]) { seen[nb] = 1; stax[sp++] = nb; }
      }
      if (n >= 30) props.push({ cx: Math.round(sx / n), cy: Math.round(sy / n), w: clamp(Math.round(Math.max(x1 - x0, (y1 - y0) * 1.23) * 1.1), 12, 56), n });
    }
    props.sort((a, b) => b.n - a.n);
    for (const pr of props.slice(0, 4)) {
      const cand = { cx: pr.cx, cy: pr.cy, w: pr.w, op: 0.4 };
      st.screens.push(cand);
      // quick local fit of the candidate
      let d2 = diff(st, rg);
      for (const [key, steps, lo, hi] of [['op', [0.25, 0.1, 0.04], 0.03, 1], ['cx', [3, 1], REG.x0, REG.x1], ['cy', [3, 1], REG.y0, REG.y1], ['w', [4, 2], 10, 60]]) {
        for (const step of steps) {
          let moved = true;
          while (moved) {
            moved = false;
            for (const dir of [1, -1]) {
              const v = clamp(cand[key] + dir * step, lo, hi);
              if (v === cand[key]) continue;
              const old = cand[key]; cand[key] = v;
              const dd = diff(st, rg);
              if (dd < d2 - 1e-4) { d2 = dd; moved = true; } else cand[key] = old;
            }
          }
        }
      }
      if (d2 < best - 0.05) best = d2;
      else st.screens.pop();
    }
    return best;
  }

  // ---- fit all frames: forward pass, then a backward pass ----
  // Backward matters at appearance transitions: when an object fades in overlapping the
  // wordmark, the detector misses it and forward seeding has nothing to carry, but the next
  // frames have it solidly - seeding from the future recovers it (e.g. the big pair at f24-27).
  function fitFrame(f, seedScreens) {
    const rg = real[f];
    const st = {
      wma: parts.wordmark.map((_, k) => fades['L' + k][f]),
      i: fades.i[f], tm: fades.tm[f], blk: fades.blk[f],
      screens: seedScreens.map(x => ({ ...x })),
    };
    for (const d of (dets[f] || [])) {
      if (!st.screens.some(sc => Math.abs(sc.cx - d.cx) < 10 && Math.abs(sc.cy - d.cy) < 10)) {
        st.screens.push({ cx: d.cx, cy: d.cy, w: d.w, op: d.op });
      }
    }
    let dd = refine(st, rg);
    dd = addScan(st, rg);
    dd = refine(st, rg);
    return { st, dd };
  }
  const fits = [];
  let prev = { screens: [] };
  for (let f = 0; f < N; f++) { const r = fitFrame(f, prev.screens); fits.push(r); prev = r.st; }
  for (let f = N - 2; f >= 0; f--) {
    const r = fitFrame(f, fits[f + 1].st.screens);
    if (r.dd < fits[f].dd - 0.05) fits[f] = r;
  }
  return fits.map(({ st, dd }) => ({ d: +dd.toFixed(2), wma: st.wma.map(v => +v.toFixed(2)), i: +st.i.toFixed(2), tm: +st.tm.toFixed(2), blk: +st.blk.toFixed(2), s: st.screens.map(sc => [Math.round(sc.cx), Math.round(sc.cy), Math.round(sc.w), +sc.op.toFixed(2)]) }));
});

fs.writeFileSync('webapp/public/boot/logo_anim.json', JSON.stringify(result));
const ds = result.map(r => r.d);
const mean = (ds.reduce((a, b) => a + b, 0) / ds.length).toFixed(2);
const worst = result.map((r, f) => ({ f, d: r.d })).sort((a, b) => b.d - a.d).slice(0, 10);
console.log('mean abs gray diff per frame (0..255):', mean, ' max:', Math.max(...ds).toFixed(2));
console.log('worst frames:', worst.map(w => `f${w.f}:${w.d}`).join(' '));
console.log('every 6th:', result.filter((_, f) => f % 6 === 0).map((r, i) => `${i * 6}:${r.d}`).join(' '));
console.log('sample states: f30', JSON.stringify(result[30]), '\n  f60', JSON.stringify(result[60]), '\n  f100', JSON.stringify(result[100]));
await b.close(); s.close();
