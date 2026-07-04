import { chromium } from 'playwright';
import { startServer } from '/work/nds/tools/serve.js';
const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(s.url + '?scale=4', { waitUntil: 'networkidle' });
await p.waitForFunction('window.DSi && window.DSi.ready');
const r = await p.evaluate(async () => {
  window.DSi.skipBoot();
  const a = window.DSi.openSettings();
  const before = window.DSi.state;
  a._askExit ? a._askExit() : (a.confirmExit = {t:0,sel:-1});
  const dlgUp = !!a.confirmExit;
  // press A on Yes (sel default -1 -> yes)
  a.handle('press','A');
  await new Promise(r=>setTimeout(r,1500));  // let the whiteout + returnToMenu run
  return { before, dlgUp, after: window.DSi.state };
});
console.log('state before:', r.before, '| dialog up:', r.dlgUp, '| state after Yes:', r.after, '| errs:', errs.slice(0,3));
await b.close(); s.close();
