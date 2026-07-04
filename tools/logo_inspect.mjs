// Inspect specific frames of the logo fit: render REAL | FIT | ABS-DIFF heat side by side
// at 3x for the given frames, using the same canvas renderer as the fitter.
import { chromium } from 'playwright';
import { startServer } from './serve.js';
import fs from 'fs';

const FRAMES = (process.argv[2] || '24,25').split(',').map(Number);
const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.goto(s.url + 'index.html', { waitUntil: 'networkidle' });
const png = await p.evaluate(async (FRAMES) => {
  const REG = { x0: 18, y0: 8, x1: 242, y1: 132 };
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
      if (settled) { ctx.fillStyle = 'rgb(147,149,152)'; ctx.translate(cx, cy); ctx.scale(w / SW, w / SW); ctx.translate(-SCX, -SCY); base(); ctx.fill(P.screen); }
      else {
        const rim = 0.148 * w, h = 0.8138 * w;
        ctx.strokeStyle = 'rgb(147,149,152)'; ctx.lineWidth = rim;
        ctx.beginPath(); ctx.roundRect(cx - w / 2 + rim / 2, cy - h / 2 + rim / 2, w - rim, h - rim, Math.max(0.5, 0.172 * w - rim / 2)); ctx.stroke();
      }
      ctx.restore();
    }
    grp([P.top], st.blk, '#000');
    grp(P.iDot, st.i, '#000');
    grp(P.tm, st.tm, '#000');
  }
  const W = 224, H = 124, SCL = 3;
  const outc = document.createElement('canvas');
  outc.width = W * 3 * SCL + 8; outc.height = (H * SCL + 18) * FRAMES.length;
  const oc = outc.getContext('2d');
  oc.fillStyle = '#fff'; oc.fillRect(0, 0, outc.width, outc.height);
  oc.imageSmoothingEnabled = false;
  for (let fi = 0; fi < FRAMES.length; fi++) {
    const f = FRAMES[fi];
    const img = new Image(); img.src = `public/boot/top_${String(f).padStart(3, '0')}.png`;
    await img.decode();
    const realc = document.createElement('canvas'); realc.width = 256; realc.height = 192;
    const rcx = realc.getContext('2d', { willReadFrequently: true }); rcx.drawImage(img, 0, 0);
    const rd = rcx.getImageData(0, 0, 256, 192).data;
    render(anim[f]);
    const md = ctx.getImageData(0, 0, 256, 192).data;
    // heat canvas
    const heat = document.createElement('canvas'); heat.width = 256; heat.height = 192;
    const hx = heat.getContext('2d');
    const hd = hx.createImageData(256, 192);
    for (let i = 0; i < 256 * 192; i++) {
      const dm = Math.abs((md[i * 4] + md[i * 4 + 1] + md[i * 4 + 2]) / 3 - (rd[i * 4] + rd[i * 4 + 1] + rd[i * 4 + 2]) / 3);
      const v = Math.min(255, dm * 5);
      hd.data[i * 4] = 255; hd.data[i * 4 + 1] = 255 - v; hd.data[i * 4 + 2] = 255 - v; hd.data[i * 4 + 3] = 255;
    }
    hx.putImageData(hd, 0, 0);
    const y0 = fi * (H * SCL + 18);
    oc.drawImage(realc, REG.x0, REG.y0, W, H, 0, y0 + 16, W * SCL, H * SCL);
    oc.drawImage(rc, REG.x0, REG.y0, W, H, W * SCL + 4, y0 + 16, W * SCL, H * SCL);
    oc.drawImage(heat, REG.x0, REG.y0, W, H, 2 * (W * SCL + 4), y0 + 16, W * SCL, H * SCL);
    oc.fillStyle = '#000'; oc.font = '13px sans-serif';
    oc.fillText(`f${f}  d=${anim[f].d}   REAL | FIT | DIFF x5`, 4, y0 + 12);
  }
  return outc.toDataURL('image/png');
}, FRAMES);
fs.writeFileSync('/tmp/logo_inspect.png', Buffer.from(png.split(',')[1], 'base64'));
console.log('wrote /tmp/logo_inspect.png');
await b.close(); s.close();
