import { chromium } from 'playwright';
import { startServer } from '/work/nds/tools/serve.js';
const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type()==='error') errs.push('console:'+m.text()); });
await p.goto(s.url + '?scale=4', { waitUntil: 'networkidle' });
await p.waitForFunction('window.DSi && window.DSi.ready');
// check the loop is running: sample state at intervals after triggering exit
await p.evaluate(() => { window.DSi.skipBoot(); const a = window.DSi.openSettings(); window.__A = a; a.confirmExit = {t:0,sel:-1}; a.handle('press','A'); });
const states = [];
for (let i=0;i<8;i++){ await p.waitForTimeout(250); states.push(await p.evaluate(()=>window.DSi.state)); }
console.log('states over 2s after Yes:', states.join(' '));
console.log('errs:', errs.slice(0,4));
// is the loop even running? check a frame-advancing value
const adv = await p.evaluate(async () => { const s1 = window.DSi.launcher.introFrame ?? 0; return typeof window.requestAnimationFrame; });
console.log('rAF type:', adv);
await b.close(); s.close();
