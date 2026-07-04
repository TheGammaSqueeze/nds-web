import { chromium } from 'playwright';
import { startServer } from '/work/nds/tools/serve.js';
const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 900, height: 1400 } });
await p.goto(s.url + '?scale=4', { waitUntil: 'networkidle' });
await p.waitForFunction('window.DSi && window.DSi.ready');
await p.evaluate(() => { window.DSi.skipBoot(); const a = window.DSi.openSettings(); a.page = 0; window.__A = a; });
// dither energy: mean |horizontal neighbour diff| over the first menu button face (device rect)
const ditherE = () => p.evaluate(() => {
  const cv = document.getElementById('bottom'); const g = cv.getContext('2d');
  const d = g.getImageData(150, 175, 600, 40).data; // button face band at scale4
  let sum = 0, n = 0;
  for (let y = 0; y < 40; y++) for (let x = 1; x < 600; x++) { const i = (y*600+x)*4, j = (y*600+x-1)*4; sum += Math.abs(d[i]-d[j]); n++; }
  return +(sum/n).toFixed(2);
});
const step = async (label, fn, wait=800) => { if (fn) await p.evaluate(fn); await p.waitForTimeout(wait); console.log(label.padEnd(28), 'ditherE=', await ditherE()); };
await step('open (0.8s)', null);
await step('wait 5s', null, 5000);
await step('enter DataMgmt', () => window.__A.handle('press','A'), 900);   // selects first item
await step('back', () => window.__A.handle('press','B'), 900);
await step('page right', () => window.__A.handle('press','right'), 1000);
await step('page left', () => window.__A.handle('press','left'), 1000);
await step('touch a button', () => window.__A.touch({x:128,y:60}), 300);
await step('after touch release', () => window.__A.handle('release','A'), 600);
await b.close(); s.close();
