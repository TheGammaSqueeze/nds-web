import { chromium } from 'playwright';
import { startServer } from './serve.js';
import { SCRIM_L, SCRIM_R } from '../webapp/src/camera_scrim.js';

function decodeInk(SCRIM) {
  const ink = new Map();
  const LV = { '65,65,65': 3, '113,113,113': 2, '170,170,170': 1 };
  for (const [row, runs] of SCRIM) for (const [col, len, rgb] of runs) {
    const lv = LV[rgb]; if (lv) for (let i = 0; i < len; i++) ink.set(`${col + i},${row}`, lv);
  }
  return ink;
}
const inkL = decodeInk(SCRIM_L);
const inkR = decodeInk(SCRIM_R);
console.log('inkL', inkL.size, 'inkR', inkR.size);

const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(s.url + 'index.html', { waitUntil: 'networkidle' });
await p.waitForFunction('window.DSi && window.DSi.ready');

async function renderCandidate(fontKey, str, x, y) {
  return p.evaluate(async ({ fontKey, str, x, y }) => {
    const { Fonts } = await import('/src/font.js');
    await Fonts.load();
    const W = 110, H = 40;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const levels = { 1: [170, 170, 170], 2: [113, 113, 113], 3: [65, 65, 65] };
    Fonts[fontKey].drawLevels(ctx, str, x, y, 'camtest2_' + fontKey, levels);
    const im = ctx.getImageData(0, 0, W, H).data;
    const out = [];
    for (let ry = 0; ry < H; ry++) for (let rx = 0; rx < W; rx++) {
      const i = (ry * W + rx) * 4; const a = im[i + 3];
      if (a) out.push([rx, ry, im[i] === 170 ? 1 : im[i] === 113 ? 2 : im[i] === 65 ? 3 : 0]);
    }
    return out;
  }, { fontKey, str, x, y });
}

function score(rendered, ink, ox, oy) {
  let exact = 0, extra = 0; const used = new Set();
  for (const [rx, ry, lv] of rendered) {
    const key = `${rx + ox},${ry + oy}`;
    if (ink.has(key)) { used.add(key); if (ink.get(key) === lv) exact++; else extra++; }
    else extra++;
  }
  return { exact, extra, total: rendered.length, inkTotal: ink.size, missed: ink.size - used.size };
}

async function findBest(ink, candidates, label) {
  let best = null;
  for (const fk of ['m', 'banner', 'settings']) {
    for (const str of candidates) {
      const rendered = await renderCandidate(fk, str, 20, 5);
      if (!rendered.length) continue;
      for (let ox = -20; ox <= 20; ox++) for (let oy = -8; oy <= 8; oy++) {
        const sc = score(rendered, ink, ox, oy);
        const goodness = sc.exact - sc.extra - sc.missed;
        if (!best || goodness > best.goodness) best = { fk, str: JSON.stringify(str), x: 20 + ox, y: 5 + oy, ...sc, goodness };
      }
    }
  }
  console.log(`BEST ${label}`, best);
  return best;
}

const E004 = String.fromCodePoint(0xE004), E005 = String.fromCodePoint(0xE005);
await findBest(inkL, [E004 + ' Camera', E004 + 'Camera', ' Camera', 'Camera'], 'L-with-icon');
await findBest(inkR, ['Camera ' + E005, 'Camera' + E005, 'Camera ', 'Camera'], 'R-with-icon');

await b.close(); s.close();
