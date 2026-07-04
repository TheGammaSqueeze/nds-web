// Capture the boot logo (top screen) at scale=4 across the animation, to compare the vector
// recreation against the real captured frames. Grabs the top canvas at several wall-clock
// times (the boot frame advances at ~60fps, logo starts ~frame 92).
import { chromium } from 'playwright';
import { startServer } from './serve.js';
import fs from 'fs';

const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(s.url + '?scale=4', { waitUntil: 'networkidle' });
await p.waitForFunction('window.DSi && window.DSi.ready');
const shots = [[1700, 'a'], [2100, 'b'], [2500, 'c'], [2900, 'd'], [3300, 'e'], [3800, 'f']];
let t0 = Date.now();
for (const [ms, tag] of shots) {
  const wait = ms - (Date.now() - t0);
  if (wait > 0) await p.waitForTimeout(wait);
  const u = await p.evaluate(() => document.getElementById('top').toDataURL('image/png'));
  fs.writeFileSync(`/tmp/logo_${tag}.png`, Buffer.from(u.split(',')[1], 'base64'));
}
console.log('captured logo frames a..f');
await b.close(); s.close();
