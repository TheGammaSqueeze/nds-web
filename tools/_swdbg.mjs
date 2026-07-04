import { chromium } from 'playwright';
import { startServer } from '/work/nds/tools/serve.js';
const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage();
const errs = []; p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
await p.goto(s.url + '?scale=4', { waitUntil: 'networkidle' });
await p.waitForFunction('window.DSi && window.DSi.ready');
await p.evaluate(() => { window.DSi.skipBoot(); window.DSi.openSettings(); });
await p.waitForTimeout(600);
const r = await p.evaluate(async () => {
  const { Assets } = await import('/src/assets.js');
  const sw = Assets.img('color_swatch_blue');
  const rg = Assets.img('color_ring_rest');
  return { sw: sw ? sw.src.split('/').pop() : null, swW: sw?.naturalWidth, rg: rg ? rg.src.split('/').pop() : null };
});
console.log(JSON.stringify(r), 'errs:', errs.slice(0,3));
await b.close(); s.close();
