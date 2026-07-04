import { chromium } from 'playwright';
import { startServer } from './serve.js';
import fs from 'fs';
const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 600, height: 820 } });
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(s.url, { waitUntil: 'networkidle' });
await p.waitForFunction('window.DSi && window.DSi.ready');
await p.evaluate(() => {
  window.__demoTime = Date.parse('2000-01-01T00:00:00');
  window.__demoClockSpace = true;
  const st = window.DSi.openSettings();
  st._askExit();
  st.confirmExit.t = 30; // settled, past the slide-in animation
});
await p.waitForTimeout(150);
fs.mkdirSync('/work/nds/compare/settings', { recursive: true });
for (const sc of ['bottom']) {
  const d = await p.evaluate(id => document.getElementById(id).toDataURL('image/png'), sc);
  fs.writeFileSync(`/work/nds/compare/settings/dlg_state.${sc}.png`, Buffer.from(d.split(',')[1], 'base64'));
}
await b.close(); s.close(); console.log('captured dialog state');
