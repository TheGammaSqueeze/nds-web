import { chromium } from 'playwright';
import { startServer } from './serve.js';
import fs from 'fs';
const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 600, height: 820 } });
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.goto(s.url, { waitUntil: 'networkidle' });
await p.waitForFunction('window.DSi && window.DSi.ready');
const shot = async (name) => { const d = await p.evaluate(() => document.getElementById('bottom').toDataURL('image/png')); fs.writeFileSync(`/tmp/${name}.png`, Buffer.from(d.split(',')[1], 'base64')); };
// dialog mid-slide, and settled
await p.evaluate(() => { const st = window.DSi.openSettings(); st.trans = null; st.sub = null; st.confirmExit = { t: 6, sel: 0 }; window.DSi.drawSettings(); });
await p.waitForTimeout(30); await shot('exit_dialog_mid');
await p.evaluate(() => { const st = window.DSi.settings; st.confirmExit = { t: 20, sel: 1 }; window.DSi.drawSettings(); });
await p.waitForTimeout(30); await shot('exit_dialog_no');
console.log('crash?', await p.evaluate(() => window.__err || 'none'));
await b.close(); s.close();
console.log('wrote /tmp/exit_dialog_mid.png (Yes sel), /tmp/exit_dialog_no.png (No sel)');
