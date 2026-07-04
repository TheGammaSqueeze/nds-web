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

const frames = [4, 8, 12, 16, 20, 24];
fs.mkdirSync('/tmp/lc', { recursive: true });
const tiles = [];
for (const t of frames) {
  await p.evaluate((t) => window.DSi.renderLaunch(t), t);
  await p.waitForTimeout(40);
  const d = await p.evaluate(() => document.getElementById('bottom').toDataURL('image/png'));
  const clonePng = `/tmp/lc/clone_${t}.png`;
  fs.writeFileSync(clonePng, Buffer.from(d.split(',')[1], 'base64'));
  // real frame -> png
  const realPpm = `/work/nds/out/anim/launch/g_${String(t).padStart(4,'0')}.bot.ppm`;
  const realPng = `/tmp/lc/real_${t}.png`;
  execSync(`convert ${realPpm} ${realPng}`);
  // stack real over clone with labels
  execSync(`convert ${realPng} ${clonePng} -append -scale 200% -bordercolor '#444' -border 2 /tmp/lc/pair_${t}.png`);
  tiles.push(`/tmp/lc/pair_${t}.png`);
}
await b.close(); s.close();
execSync(`montage ${tiles.join(' ')} -tile 6x1 -geometry +3+3 -background '#222' -label 'f%[t]' /tmp/launch_cmp.png`.replace('%[t]',''));
console.log('wrote /tmp/launch_cmp.png (top=real, bottom=clone, per frame)');
