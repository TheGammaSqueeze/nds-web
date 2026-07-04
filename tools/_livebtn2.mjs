import { chromium } from 'playwright';
import { startServer } from '/work/nds/tools/serve.js';
import fs from 'fs';
const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 900, height: 1400 } });
await p.goto(s.url + '?scale=4', { waitUntil: 'networkidle' });
await p.waitForFunction('window.DSi && window.DSi.ready');
await p.evaluate(() => { window.DSi.skipBoot(); const a = window.DSi.openSettings(); a.page = 1; window.__A = a; });
const shot = async (name) => { const png = await p.evaluate(() => document.getElementById('bottom').toDataURL('image/png')); fs.writeFileSync(name, Buffer.from(png.split(',')[1],'base64')); };
await p.waitForTimeout(600); await shot('/tmp/lb_t0.png');
await p.waitForTimeout(6000); await shot('/tmp/lb_t6.png');
// trigger a page transition then let it settle
await p.evaluate(() => { window.__A.handle('press','right'); });
await p.waitForTimeout(1200); await shot('/tmp/lb_tr.png');
await b.close(); s.close(); console.log('ok');
