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

await p.evaluate(() => { window.__demoTime = Date.parse('2000-01-01T00:00:00'); window.__demoClockSpace = true; });

// n = frames since the touch (matches out/boot m_0000.bot.ppm). Covers the white
// cross-fade and the carousel intro fade-up; bottom hands off ~61f, top ~52f
// (see TOP_HANDOFF/TOP_DECAY in main.js).
const frames = [0,10,20,30,40,50,55,60,61,65,70,75,80,85,90,95,100,110,120,135,150];
fs.mkdirSync('/tmp/bec', { recursive: true });
const tilesTop = [], tilesBot = [];
let totalAE = 0, maxAE = 0, maxF = -1;
for (const n of frames) {
  await p.evaluate((n) => window.DSi.renderBootEnter(n), n);
  await p.waitForTimeout(20);
  const realPpmBot = `/work/nds/out/boot/m_${String(n).padStart(4,'0')}.bot.ppm`;
  const realPpmTop = `/work/nds/out/boot/m_${String(n).padStart(4,'0')}.top.ppm`;
  if (!fs.existsSync(realPpmBot)) { console.log(`f${n}: no real frame`); continue; }
  let frameAE = 0;
  for (const [screen, id, realPpm] of [['bot','bottom',realPpmBot], ['top','top',realPpmTop]]) {
    const d = await p.evaluate((elId) => document.getElementById(elId).toDataURL('image/png'), id);
    const clonePng = `/tmp/bec/clone_${screen}_${n}.png`;
    fs.writeFileSync(clonePng, Buffer.from(d.split(',')[1], 'base64'));
    const realPng = `/tmp/bec/real_${screen}_${n}.png`;
    execSync(`convert ${realPpm} ${realPng}`);
    const ae = execSync(`compare -metric AE -fuzz 8% ${realPng} ${clonePng} /tmp/bec/diff_${screen}_${n}.png 2>&1 || true`).toString().trim();
    const aen = parseInt(ae, 10) || 0;
    frameAE += aen;
    console.log(`f${String(n).padStart(3)} ${screen}  AE(fuzz8%)=${ae}`);
    execSync(`convert ${realPng} ${clonePng} -append -scale 200% -bordercolor '#444' -border 2 /tmp/bec/pair_${screen}_${n}.png`);
    (screen === 'top' ? tilesTop : tilesBot).push(`/tmp/bec/pair_${screen}_${n}.png`);
  }
  totalAE += frameAE; if (frameAE > maxAE) { maxAE = frameAE; maxF = n; }
}
await b.close(); s.close();
execSync(`montage ${tilesBot.join(' ')} -tile 7x3 -geometry +3+3 -background '#222' /tmp/boot_enter_cmp_bot.png`);
execSync(`montage ${tilesTop.join(' ')} -tile 7x3 -geometry +3+3 -background '#222' /tmp/boot_enter_cmp_top.png`);
console.log('wrote /tmp/boot_enter_cmp_bot.png and /tmp/boot_enter_cmp_top.png (top=real melonDS, bottom=clone, per frame)');
console.log(`totalAE=${totalAE} maxAE=${maxAE} at f${maxF}`);
