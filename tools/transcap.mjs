import { chromium } from 'playwright';
import { startServer } from './serve.js';
import { execSync } from 'child_process';
import fs from 'fs';
const s = await startServer();
const b = await chromium.launch({ args:['--use-gl=swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport:{width:600,height:820} });
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.goto(s.url, { waitUntil:'networkidle' });
const ok = await p.waitForFunction('window.DSi && window.DSi.ready').then(()=>1).catch(()=>0);
if (!ok) { console.log('NOT READY', await p.evaluate(()=>window.__err||'')); await b.close(); s.close(); process.exit(1); }
fs.mkdirSync('/tmp/tc', { recursive: true });

async function shot(name) {
  const d = await p.evaluate(() => document.getElementById('bottom').toDataURL('image/png'));
  fs.writeFileSync(`/tmp/tc/${name}.png`, Buffer.from(d.split(',')[1], 'base64'));
  return `/tmp/tc/${name}.png`;
}

// ---- page slide (page 0 -> 1) ----
await p.evaluate(() => { const st = window.DSi.openSettings(); st.page = 0; st.sub = null; st.trans = null; });
await p.evaluate(() => { const st = window.DSi.settings; st._startPage(1); });
const pageTiles = [];
for (const t of [0, 4, 7, 10, 13, 15]) {
  await p.evaluate((t) => { const st = window.DSi.settings; st.trans.t = t; window.DSi.drawSettings(); }, t);
  await p.waitForTimeout(20);
  pageTiles.push(await shot(`page_${t}`));
}
// ---- enter (page 1 Date sub-screen) ----
await p.evaluate(() => { const st = window.DSi.settings; st.trans = null; st.page = 1; st.sub = null; st._startEnter(1, 'date'); });
const enterTiles = [];
for (const t of [0, 6, 9, 12, 15, 18]) {
  await p.evaluate((t) => { const st = window.DSi.settings; st.trans.t = t; window.DSi.drawSettings(); }, t);
  await p.waitForTimeout(20);
  enterTiles.push(await shot(`enter_${t}`));
}
await b.close(); s.close();
execSync(`montage ${pageTiles.join(' ')} -tile 6x1 -geometry +2+2 -background '#222' /tmp/clone_page.png`);
execSync(`montage ${enterTiles.join(' ')} -tile 6x1 -geometry +2+2 -background '#222' /tmp/clone_enter.png`);
console.log('wrote /tmp/clone_page.png and /tmp/clone_enter.png');
