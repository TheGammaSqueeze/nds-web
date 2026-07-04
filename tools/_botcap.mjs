import { chromium } from 'playwright';
import { startServer } from '/work/nds/tools/serve.js';
import fs from 'fs';
const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 900, height: 1400 } });
await p.goto(s.url + '?scale=4', { waitUntil: 'networkidle' });
await p.waitForFunction('window.DSi && window.DSi.ready');
await p.evaluate(() => { window.__demoTime = Date.parse('2000-01-01T09:30:00'); window.DSi.skipBoot(); window.DSi.setSlot(6); });
await p.waitForTimeout(60);
const png = await p.evaluate(() => {
  const cv = document.getElementById('bottom');
  const c = document.createElement('canvas'); c.width = cv.width; c.height = 24 * 4;
  c.getContext('2d').drawImage(cv, 0, 168 * 4, cv.width, 24 * 4, 0, 0, cv.width, 24 * 4);
  return c.toDataURL('image/png');
});
fs.writeFileSync('/tmp/scrollbar_scale4.png', Buffer.from(png.split(',')[1], 'base64'));
await b.close(); s.close(); console.log('ok');
