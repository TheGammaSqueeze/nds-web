// Sweep the global icon-animation frame (window.__freezeAnim) to find the value
// that best matches the reference menu_idle.bot (all animated neighbour icons are
// driven by one counter, so a single frame should align them if it matches the
// reference capture frame). Prints per-freeze slot-region diff totals.
import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';
import { startServer } from './serve.js';

const REF = '/work/nds/assets/reference/idle.bot.png';
const TMP = '/work/nds/compare/_sweep';
fs.mkdirSync(TMP, { recursive: true });

// PNG -> raw via ImageMagick txt is slow; use a tiny PPM read
function toPPM(png) { const p = png.replace(/\.png$/, '.ppm'); execSync(`convert "${png}" "${p}"`); return p; }
function readPPM(p) { const b = fs.readFileSync(p); let i = 0, t = []; while (t.length < 4) { while (b[i] === 32 || b[i] === 10 || b[i] === 9) i++; let s = i; while (!(b[i] === 32 || b[i] === 10 || b[i] === 9)) i++; t.push(b.toString('ascii', s, i)); } i++; return { W: +t[1], H: +t[2], d: b.subarray(i) }; }
const ref = readPPM(toPPM(REF));
const REGIONS = [ ['left2', -32, 84, 60, 76], ['left1', 33, 84, 60, 76], ['selicon', 111, 96, 34, 34], ['right1', 161, 84, 60, 76], ['right2', 226, 84, 60, 76] ];
function regionDiff(img, rx, ry, rw, rh) { let diff = 0; for (let y = Math.max(0, ry); y < Math.min(192, ry + rh); y++) for (let x = Math.max(0, rx); x < Math.min(256, rx + rw); x++) { const o = (y * 256 + x) * 3; const d = Math.max(Math.abs(ref.d[o] - img.d[o]), Math.abs(ref.d[o + 1] - img.d[o + 1]), Math.abs(ref.d[o + 2] - img.d[o + 2])); if (d > 20) diff++; } return diff; }

const START = +(process.argv[2] || 0), END = +(process.argv[3] || 160), STEP = +(process.argv[4] || 1);

(async () => {
  const server = await startServer();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 700, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(server.url, { waitUntil: 'networkidle' });
  await page.waitForFunction('window.DSi && window.DSi.ready', null, { timeout: 15000 });
  await page.evaluate(() => { window.__demoTime = Date.parse('2000-01-01T00:00:00'); window.__demoClockSpace = true; });
  await page.evaluate(`DSi.skipBoot(); DSi.setSlot(17);`);
  const results = [];
  for (let f = START; f <= END; f += STEP) {
    await page.evaluate((fr) => { window.__freezeAnim = fr; }, f);
    await page.waitForTimeout(60);
    const png = `${TMP}/f${f}.png`;
    const dataUrl = await page.evaluate(() => document.getElementById('bottom').toDataURL('image/png'));
    fs.writeFileSync(png, Buffer.from(dataUrl.split(',')[1], 'base64'));
    const img = readPPM(toPPM(png));
    const per = REGIONS.map(([n, ...r]) => [n, regionDiff(img, ...r)]);
    const total = per.reduce((a, [, v]) => a + v, 0);
    results.push({ f, total, per });
    fs.rmSync(png); fs.rmSync(png.replace('.png', '.ppm'));
  }
  results.sort((a, b) => a.total - b.total);
  console.log('BEST 12 freeze values (by summed slot diff):');
  for (const r of results.slice(0, 12)) console.log(`  freeze=${r.f}  total=${r.total}  [${r.per.map(([n, v]) => n + ':' + v).join(' ')}]`);
  await browser.close(); server.close();
})();
