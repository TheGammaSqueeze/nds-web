import { chromium } from 'playwright';
import { startServer } from '/work/nds/tools/serve.js';
import fs from 'fs';
const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 900, height: 1400 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(s.url + '?scale=4', { waitUntil: 'networkidle' });
await p.waitForFunction('window.DSi && window.DSi.ready');
// open settings via the real API so the LOOP keeps running (don't pause)
await p.evaluate(() => { window.DSi.skipBoot(); window.DSi.openSettings(); });
async function grab(t) {
  await p.waitForTimeout(t);
  const g = await p.evaluate(() => {
    const { Assets } = window.__dbg || {};
    return { hasGrads: !!(window.DSi && window.DSi), bg: null };
  });
  const has = await p.evaluate(async () => { const { Assets } = await import('/src/assets.js'); return !!(Assets.data && Assets.data.button_grads); });
  return has;
}
console.log('button_grads present @0.5s:', await grab(500));
console.log('button_grads present @6s:', await grab(5500));
// re-enter settings a few times (each creates a new SettingsApp -> re-loadJSON)
for (let i=0;i<3;i++){ await p.evaluate(()=>{ window.DSi.state='menu'; window.DSi.openSettings(); }); await p.waitForTimeout(200); }
const after = await p.evaluate(async () => { const { Assets } = await import('/src/assets.js'); return !!(Assets.data && Assets.data.button_grads); });
console.log('button_grads present after 3 re-enters:', after, 'errs:', errs.slice(0,2));
await b.close(); s.close();
