// Identify, for each text line of the boot Health & Safety screen, which real
// firmware font (Fonts.s/m/l/banner/settings) + baseline position best reproduces
// the captured bitmap ink. Renders candidates with the actual webapp font.js in a
// browser (same path as _camtest2.mjs) and scores ink overlap against the real
// healthsafety.png reference, tolerant of the reference's 8-bit AA (matches on ink
// presence, not exact level). Prints the best font + x + y + overlap per line.
import { chromium } from 'playwright';
import { startServer } from './serve.js';
import { execSync } from 'child_process';

function readPPMink(path) {
  const ppm = execSync(`convert "${path}" -depth 8 ppm:-`, { maxBuffer: 1 << 26 });
  let o = 0; const tok = () => { while ([32, 10, 9].includes(ppm[o])) o++; let s = o; while (![32, 10, 9].includes(ppm[o])) o++; return ppm.toString('latin1', s, o); };
  tok(); const W = +tok(), H = +tok(); tok(); o++;
  const d = ppm.subarray(o);
  const at = (x, y) => { const i = (y * W + x) * 3; return [d[i], d[i + 1], d[i + 2]]; };
  return { W, H, at };
}

const ref = readPPMink('webapp/public/boot/healthsafety.png');
const BG = 251; // background level (from _hsanalyze); treat near-bg as blank
function refInk(x, y) { const [r, g, b] = ref.at(x, y); return (r < BG - 6 || g < BG - 6 || b < BG - 6); }

// Each line: y-band from _hsanalyze, candidate strings, and the ink x-window to
// exclude non-text graphics (the warning triangle sits left of the title text).
const D = String.fromCodePoint(0x2013); // en dash
const LINES = [
  { name: 'title', y0: 15, y1: 29, xmin: 31, xmax: 242, strs: ['WARNING ' + D + ' HEALTH AND SAFETY', 'WARNING - HEALTH AND SAFETY'] },
  { name: 'body1', y0: 46, y1: 56, xmin: 0, xmax: 256, strs: ['BEFORE PLAYING, READ THE HEALTH'] },
  { name: 'body2', y0: 65, y1: 74, xmin: 0, xmax: 256, strs: ['AND SAFETY PRECAUTIONS BOOKLET'] },
  { name: 'body3', y0: 84, y1: 93, xmin: 0, xmax: 256, strs: ['FOR IMPORTANT INFORMATION'] },
  { name: 'body4', y0: 103, y1: 112, xmin: 0, xmax: 256, strs: ['ABOUT YOUR HEALTH AND SAFETY.'] },
  { name: 'sub', y0: 129, y1: 138, xmin: 0, xmax: 256, strs: ['TO GET AN EXTRA COPY FOR YOUR REGION, GO ONLINE AT'] },
  { name: 'url', y0: 144, y1: 155, xmin: 0, xmax: 256, strs: ['www.nintendo.com/healthsafety/'] },
  { name: 'prompt', y0: 168, y1: 177, xmin: 0, xmax: 256, strs: ['Touch the Touch Screen to continue.'] },
];

const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(s.url + 'index.html', { waitUntil: 'networkidle' });
await p.waitForFunction('window.DSi && window.DSi.ready');

const ORIGIN = 40; // safe render origin so glyphs never clip at negative coords
// render one string with one font at (ORIGIN,ORIGIN) baseline-top; return ink pixels + metrics
async function render(fontKey, str) {
  return p.evaluate(async ({ fontKey, str, ORIGIN }) => {
    const { Fonts } = await import('/src/font.js');
    await Fonts.load();
    const c = document.createElement('canvas'); c.width = 256; c.height = 192;
    const ctx = c.getContext('2d');
    Fonts[fontKey].draw(ctx, str, ORIGIN, ORIGIN, '#000');
    const im = ctx.getImageData(0, 0, 256, 192).data;
    const out = [];
    for (let ry = 0; ry < 192; ry++) for (let rx = 0; rx < 256; rx++) { if (im[(ry * 256 + rx) * 4 + 3] > 40) out.push([rx, ry]); }
    return { out, cap: Fonts[fontKey]._bmCapH(), w: Fonts[fontKey].measure(str) };
  }, { fontKey, str, ORIGIN });
}

// build reference ink set for a line's band (within its x-window)
function refSet(L) {
  const set = new Set(); let n = 0;
  for (let y = L.y0; y <= L.y1; y++) for (let x = L.xmin; x < Math.min(L.xmax, ref.W); x++) if (refInk(x, y)) { set.add(x + ',' + y); n++; }
  return { set, n };
}

const FONTS = ['s', 'm', 'l', 'banner', 'settings'];
const results = {};
for (const L of LINES) {
  const { set: rset, n: rn } = refSet(L);
  let best = null;
  for (const fk of FONTS) {
    for (const str of L.strs) {
      const base = await render(fk, str);           // ink drawn at baseline-top (ORIGIN,ORIGIN)
      if (!base.out.length) continue;
      // draw at (X,Y) => ink shifts by (X-ORIGIN, Y-ORIGIN). Search absolute X,Y.
      for (let X = 0; X <= 60; X++) {
        for (let Y = L.y0 - 6; Y <= L.y0 + 8; Y++) {
          const sx = X - ORIGIN, sy = Y - ORIGIN;
          let hit = 0, stray = 0;
          for (const [rx, ry] of base.out) { if (rset.has((rx + sx) + ',' + (ry + sy))) hit++; else stray++; }
          const cover = hit / rn, strayFrac = stray / base.out.length;
          const goodness = cover - strayFrac;
          if (!best || goodness > best.goodness) best = { fk, str, X, Y, cover: +cover.toFixed(3), stray: +strayFrac.toFixed(3), cap: base.cap, w: base.w, goodness: +goodness.toFixed(3) };
        }
      }
    }
  }
  results[L.name] = best;
  console.log(L.name.padEnd(7), 'refInk=' + rn, JSON.stringify(best));
}
console.log('\nSPECS', JSON.stringify(results, null, 0));
await b.close(); s.close();
