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

await p.evaluate(() => {
  window.__demoTime = Date.parse('2000-01-01T00:00:00');
  window.__demoClockSpace = true;
  window.DSi.reg.defaultSlot = 0;
  window.DSi.launcher.selected = 0;
  window.DSi.launcher.camera = 0;
  window.DSi.launcher.targetCamera = 0;
  window.DSi.launcher.sliding = false;
  window.DSi.launcher.slideFrom = 0;
  window.DSi.launcher.snapNameFade();
});

const frames = [0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,40,48];
fs.mkdirSync('/tmp/lcs', { recursive: true });
const tiles = [];
let totalAE = 0, maxAE = 0, maxF = -1;
for (const t of frames) {
  await p.evaluate((t) => window.DSi.renderLaunch(t), t);
  await p.waitForTimeout(20);
  const d = await p.evaluate(() => document.getElementById('bottom').toDataURL('image/png'));
  const clonePng = `/tmp/lcs/clone_${t}.png`;
  fs.writeFileSync(clonePng, Buffer.from(d.split(',')[1], 'base64'));
  const realPpm = `/work/nds/out/launch_settings/anim/launch_settings/g_${String(t).padStart(4,'0')}.bot.ppm`;
  if (!fs.existsSync(realPpm)) { console.log(`f${t}: no real frame`); continue; }
  const realPng = `/tmp/lcs/real_${t}.png`;
  execSync(`convert ${realPpm} ${realPng}`);
  const ae = execSync(`compare -metric AE -fuzz 8% ${realPng} ${clonePng} /tmp/lcs/diff_${t}.png 2>&1 || true`).toString().trim();
  const aen = parseInt(ae, 10) || 0;
  totalAE += aen; if (aen > maxAE) { maxAE = aen; maxF = t; }
  console.log(`f${String(t).padStart(2)}  AE(fuzz8%)=${ae}`);
  execSync(`convert ${realPng} ${clonePng} -append -scale 200% -bordercolor '#444' -border 2 /tmp/lcs/pair_${t}.png`);
  tiles.push(`/tmp/lcs/pair_${t}.png`);
}
await b.close(); s.close();
execSync(`montage ${tiles.join(' ')} -tile 5x4 -geometry +3+3 -background '#222' /tmp/launch_settings_cmp.png`);
console.log('wrote /tmp/launch_settings_cmp.png (top=real melonDS, bottom=clone, per frame)');
console.log(`totalAE=${totalAE} maxAE=${maxAE} at f${maxF}`);
