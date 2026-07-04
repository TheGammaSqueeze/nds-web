// Capture a scale=4 settings ENTER-transition mid-frame and measure text crispness.
// A native-res transition buffer upscaled to 4x has few, fat AA edges (looks bitmap);
// a scale-aware buffer has many thin AA steps (crisp). Metric: count of "AA" pixels
// (luminance strictly between near-black and near-white) in a text band - higher = crisper.
// Also dumps a PNG crop for the eyeball. Label passed as argv[2] (before/after).
import { chromium } from 'playwright';
import { startServer } from '/work/nds/tools/serve.js';
import fs from 'fs';

const label = process.argv[2] || 'after';
const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 900, height: 1400 } });
await p.goto(s.url + '?scale=4', { waitUntil: 'networkidle' });
await p.waitForFunction('window.DSi && window.DSi.ready');

await p.evaluate(() => {
  window.__demoTime = Date.parse('2000-01-01T00:00:00'); window.__demoClockSpace = true;
  window.DSi.skipBoot();
  const app = window.DSi.openSettings();
  // freeze an ENTER transition partway into the fade-IN of the new sub-screen, where the
  // new state is ~70% opaque - the exact moment the buffer content is on screen.
  app.page = 0; app.sub = null; app.sel = 0;
  app.trans = { type: 'enter', page: 0, sel: 0, newSub: 0, fromSub: null,
                t: 8 + 9 + 4 + 7, press: 8, fadeOut: 9, hold: 4, fadeIn: 10 };
  window.DSi.drawSettings();
});
await p.waitForTimeout(30);

const buf = await p.evaluate(() => {
  const cv = document.getElementById('bottom');
  const g = cv.getContext('2d');
  const im = g.getImageData(0, 0, cv.width, cv.height);
  return { w: cv.width, h: cv.height, data: Array.from(im.data) };
});
const { w, h, data } = buf;
// AA-pixel count in the top text band (DS y 40..150 -> device y*4), full width
let aa = 0, edges = 0;
const lum = (x, y) => { const i = (y * w + x) * 4; return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; };
for (let y = 40 * 4; y < 150 * 4; y++) {
  let prev = lum(0, y);
  for (let x = 1; x < w; x++) {
    const L = lum(x, y);
    if (L > 40 && L < 215) aa++;
    if (Math.abs(L - prev) > 30) edges++;
    prev = L;
  }
}
console.log(`${label}: scale4 mid-transition  AA-band px=${aa}  edge-steps=${edges}`);

// save a PNG crop (device 0..256 wide x DS 40..150) via canvas toDataURL
const png = await p.evaluate(() => {
  const cv = document.getElementById('bottom');
  const c = document.createElement('canvas'); c.width = cv.width; c.height = 110 * 4;
  c.getContext('2d').drawImage(cv, 0, 40 * 4, cv.width, 110 * 4, 0, 0, cv.width, 110 * 4);
  return c.toDataURL('image/png');
});
fs.writeFileSync(`/tmp/transcrisp_${label}.png`, Buffer.from(png.split(',')[1], 'base64'));
console.log(`wrote /tmp/transcrisp_${label}.png`);
await b.close(); s.close();
