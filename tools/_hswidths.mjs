// For each H&S line string, print measure() width and rendered ink-bbox height
// for every candidate font, so each line's font can be picked by matching the
// real reference ink extent (width) and cap-height, not fragile full-line overlap.
import { chromium } from 'playwright';
import { startServer } from './serve.js';

const D = String.fromCodePoint(0x2013);
const LINES = [
  ['title', 'WARNING ' + D + ' HEALTH AND SAFETY', 211, '15..29'],
  ['title-', 'WARNING - HEALTH AND SAFETY', 211, '15..29'],
  ['body1', 'BEFORE PLAYING, READ THE HEALTH', 206, '46..54'],
  ['body2', 'AND SAFETY PRECAUTIONS BOOKLET', 205, '65..73'],
  ['body3', 'FOR IMPORTANT INFORMATION', 180, '84..92'],
  ['body4', 'ABOUT YOUR HEALTH AND SAFETY.', 201, '103..111'],
  ['sub', 'TO GET AN EXTRA COPY FOR YOUR REGION, GO ONLINE AT', 234, '130..136'],
  ['url', 'www.nintendo.com/healthsafety/', 195, '144..152'],
  ['prompt', 'Touch the Touch Screen to continue.', 205, '168..176'],
];

const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(s.url + 'index.html', { waitUntil: 'networkidle' });
await p.waitForFunction('window.DSi && window.DSi.ready');

const probe = await p.evaluateHandle(async () => { const m = await import('/src/font.js'); await m.Fonts.load(); return m.Fonts; });

for (const [name, str, refW, band] of LINES) {
  const row = await p.evaluate(async ({ str }) => {
    const { Fonts } = await import('/src/font.js');
    const out = {};
    for (const fk of ['s', 'm', 'l', 'banner', 'settings']) {
      const c = document.createElement('canvas'); c.width = 400; c.height = 40;
      const ctx = c.getContext('2d');
      Fonts[fk].draw(ctx, str, 4, 20, '#000');
      const d = ctx.getImageData(0, 0, 400, 40).data;
      let minx = 999, maxx = -1, miny = 999, maxy = -1;
      for (let y = 0; y < 40; y++) for (let x = 0; x < 400; x++) { if (d[(y * 400 + x) * 4 + 3] > 40) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; } }
      out[fk] = { w: Fonts[fk].measure(str), inkW: maxx - minx + 1, inkH: maxy - miny + 1 };
    }
    return out;
  }, { str });
  const cells = ['s', 'm', 'l', 'banner', 'settings'].map(fk => `${fk}:w${row[fk].w}/H${row[fk].inkH}`).join('  ');
  console.log(name.padEnd(8), `refW~${refW} band[${band}]  `, cells);
}
await b.close(); s.close();
