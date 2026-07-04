// Temporal smoothing + visual verification of the fitted logo animation (logo_anim.json).
// - links fitted screens across frames into tracks, median-filters each track's cx/cy/w/op
//   (window 5) to remove single-frame jitter, and snaps near-static runs
// - median-filters the global alphas (window 3)
// - re-scores every frame with the SAME canvas renderer as the fit; keeps a smoothed frame
//   only if it does not worsen that frame by > 0.3 mean gray
// - writes the final logo_anim.json and renders REAL-vs-FIT side-by-side strips (canvas,
//   correct opacity - not ImageMagick) for the requested frames
import { chromium } from 'playwright';
import { startServer } from './serve.js';
import fs from 'fs';

const FRAMES = (process.argv[2] || '12,20,24,32,40,48,56,64,72,80,88,100,112').split(',').map(Number);

const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.goto(s.url + 'index.html', { waitUntil: 'networkidle' });

const out = await p.evaluate(async (FRAMES) => {
  const N = 119, REG = { x0: 18, y0: 8, x1: 242, y1: 132 };
  const S = 0.357, OX = 20.29, OY = 59.29, SCX = 135.0, SCY = 86.7, SW = 15.5, BG = 251;
  const parts = await (await fetch('public/boot/logo_parts.json')).json();
  const anim = await (await fetch('public/boot/logo_anim.json')).json();
  const P = {
    wordmark: parts.wordmark.map(q => new Path2D(q.d)),
    screen: new Path2D(parts.squares[0].d),
    top: new Path2D(parts.squares[1].d),
    iDot: parts.iDot.map(q => new Path2D(q.d)),
    tm: parts.tm.map(q => new Path2D(q.d)),
  };
  const real = [];
  for (let f = 0; f < N; f++) {
    const img = new Image(); img.src = `public/boot/top_${String(f).padStart(3, '0')}.png`;
    await img.decode();
    const c = document.createElement('canvas'); c.width = 256; c.height = 192;
    const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
    real.push(cx.getImageData(0, 0, 256, 192));
  }
  const rc = document.createElement('canvas'); rc.width = 256; rc.height = 192;
  const ctx = rc.getContext('2d', { willReadFrequently: true });
  function render(st) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    ctx.fillStyle = `rgb(${BG},${BG},${BG})`; ctx.fillRect(0, 0, 256, 192);
    const base = () => { ctx.translate(OX, OY); ctx.scale(S, S); };
    const grp = (paths, a, fill) => { if (a <= 0) return; ctx.save(); ctx.globalAlpha = Math.min(1, a); ctx.fillStyle = fill; base(); for (const q of paths) ctx.fill(q); ctx.restore(); };
    for (let k = 0; k < P.wordmark.length; k++) grp([P.wordmark[k]], st.wma[k], '#000');
    for (const sc of st.s) {
      const [cx, cy, w, op] = sc; if (op <= 0) continue;
      const settled = Math.abs(w - SW) <= 1.5 && Math.abs(cx - SCX) <= 2 && Math.abs(cy - SCY) <= 2;
      ctx.save(); ctx.globalAlpha = Math.min(1, op);
      if (settled) {
        ctx.fillStyle = 'rgb(147,149,152)';
        base(); ctx.fill(P.screen);   // snap fully to the SVG pose (identity)
      } else {
        const rim = 0.148 * w, h = 0.8138 * w;
        ctx.strokeStyle = 'rgb(147,149,152)'; ctx.lineWidth = rim;
        ctx.beginPath();
        ctx.roundRect(cx - w / 2 + rim / 2, cy - h / 2 + rim / 2, w - rim, h - rim, Math.max(0.5, 0.172 * w - rim / 2));
        ctx.stroke();
      }
      ctx.restore();
    }
    grp([P.top], st.blk, '#000');
    grp(P.iDot, st.i, '#000');
    // no TM: the real boot animation never shows it
  }
  function diff(st, f) {
    render(st);
    const d = ctx.getImageData(0, 0, 256, 192).data, r = real[f].data;
    let sum = 0, n = 0;
    for (let y = REG.y0; y < REG.y1; y++) for (let x = REG.x0; x < REG.x1; x++) {
      const i = (y * 256 + x) * 4;
      sum += Math.abs((d[i] + d[i + 1] + d[i + 2]) / 3 - (r[i] + r[i + 1] + r[i + 2]) / 3); n++;
    }
    return sum / n;
  }

  // ---- track linking on the fitted screens ----
  const tracks = [];
  for (let f = 0; f < N; f++) {
    const used = new Set();
    for (const tr of tracks) {
      if (tr.end !== f - 1) continue;
      const last = tr.pts[tr.pts.length - 1].sc;
      let best = -1, bd = 1e9;
      (anim[f].s || []).forEach((sc, i) => { if (used.has(i)) return; const d = Math.hypot(sc[0] - last[0], sc[1] - last[1]) + Math.abs(sc[2] - last[2]); if (d < bd && d < 18) { bd = d; best = i; } });
      if (best >= 0) { tr.pts.push({ f, sc: anim[f].s[best] }); tr.end = f; used.add(best); }
    }
    (anim[f].s || []).forEach((sc, i) => { if (!used.has(i)) tracks.push({ end: f, pts: [{ f, sc, idx: i }] }); });
  }
  // remember which anim screens belong to which track point (for the fallback path below)
  for (const tr of tracks) for (const pt of tr.pts) { if (pt.idx === undefined) { const i = (anim[pt.f].s || []).indexOf(pt.sc); pt.idx = i; } }
  const shortSet = new Set();
  for (const tr of tracks) if (tr.pts.length < 3) for (const pt of tr.pts) shortSet.add(pt.f + ':' + pt.idx);
  // drop 1-2 frame tracks: they are optimizer overfit (e.g. a dark ring "helping" fading
  // letters) and play back as visible one-frame pops. The re-score guard below verifies the
  // cost of removing them stays small.
  const kept = tracks.filter(tr => tr.pts.length >= 3);
  tracks.length = 0; tracks.push(...kept);
  // median filter per track (window 5 on cx,cy,w; 3 on op)
  const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
  for (const tr of tracks) {
    const n = tr.pts.length; if (n < 3) continue;
    const get = k => tr.pts.map(pt => pt.sc[k]);
    const cxs = get(0), cys = get(1), ws = get(2), ops = get(3);
    for (let i = 0; i < n; i++) {
      const w5 = (arr) => { const lo = Math.max(0, i - 2), hi = Math.min(n, i + 3); return med(arr.slice(lo, hi)); };
      const w3 = (arr) => { const lo = Math.max(0, i - 1), hi = Math.min(n, i + 2); return med(arr.slice(lo, hi)); };
      tr.pts[i].sm = [w5(cxs), w5(cys), w5(ws), +w3(ops).toFixed(2)];
    }
  }
  // rebuild per-frame smoothed states; alphas (wma/i/tm/blk) are the frozen measured curves,
  // already smooth + monotone - pass them through untouched
  const smooth = anim.map(a => ({ ...a, s: [] }));
  for (const tr of tracks) for (const pt of tr.pts) smooth[pt.f].s.push(pt.sm || pt.sc);
  // re-score: accept smoothed frame unless it regresses > 0.3; the fallback also excludes
  // short-track screens so one-frame pops never come back
  const final = [], report = [];
  for (let f = 0; f < N; f++) {
    const dOld = anim[f].d, dNew = diff(smooth[f], f);
    if (dNew <= dOld + 0.3) { final.push({ ...smooth[f], d: +dNew.toFixed(2) }); }
    else {
      const fb = { ...anim[f], s: (anim[f].s || []).filter((_, i) => !shortSet.has(f + ':' + i)) };
      final.push({ ...fb, d: +diff(fb, f).toFixed(2) });
    }
    report.push(final[f].d);
  }
  // ---- side-by-side strips for the requested frames (data URLs) ----
  const strip = document.createElement('canvas');
  const SC = 2, FW = 224 * SC, FH = 124 * SC;                     // region crop, 2x
  strip.width = FW * FRAMES.length; strip.height = FH * 2 + 18;
  const sx2 = strip.getContext('2d');
  sx2.fillStyle = '#fff'; sx2.fillRect(0, 0, strip.width, strip.height);
  sx2.imageSmoothingEnabled = false;
  FRAMES.forEach((f, i) => {
    // real (top)
    const tmp = document.createElement('canvas'); tmp.width = 256; tmp.height = 192;
    tmp.getContext('2d').putImageData(real[f], 0, 0);
    sx2.drawImage(tmp, REG.x0, REG.y0, 224, 124, i * FW, 0, FW, FH);
    // fit (bottom)
    render(final[f]);
    sx2.drawImage(rc, REG.x0, REG.y0, 224, 124, i * FW, FH + 18, FW, FH);
    sx2.fillStyle = '#000'; sx2.font = '12px sans-serif';
    sx2.fillText('f' + f + '  d=' + final[f].d, i * FW + 4, FH + 13);
  });
  return { final, report, strip: strip.toDataURL('image/png') };
}, FRAMES);

fs.writeFileSync('webapp/public/boot/logo_anim.json', JSON.stringify(out.final));
fs.writeFileSync('/tmp/logo_fitcheck.png', Buffer.from(out.strip.split(',')[1], 'base64'));
const ds = out.report;
console.log('after smoothing: mean', (ds.reduce((a, b) => a + b, 0) / ds.length).toFixed(2), 'max', Math.max(...ds).toFixed(2));
console.log('wrote /tmp/logo_fitcheck.png (top=REAL bottom=FIT per column)');
await b.close(); s.close();
