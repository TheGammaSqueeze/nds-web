import { chromium } from 'playwright';
import { startServer } from '/work/nds/tools/serve.js';
import fs from 'fs';
const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 900, height: 1400 } });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(s.url + '?scale=4', { waitUntil: 'networkidle' });
await p.waitForFunction('window.DSi && window.DSi.ready');
await p.evaluate(() => { window.DSi.skipBoot(); const a = window.DSi.openSettings(); a.confirmExit={t:0,sel:-1}; a.handle('press','A'); });
await p.waitForTimeout(2500);   // let the whiteout ramp + returnToMenu + carousel intro run
const st = await p.evaluate(()=>window.DSi.state);
const png = await p.evaluate(() => document.getElementById('bottom').toDataURL('image/png'));
fs.writeFileSync('/tmp/postexit.png', Buffer.from(png.split(',')[1],'base64'));
console.log('state after exit:', st, '| errs:', errs.slice(0,2));
await b.close(); s.close();
