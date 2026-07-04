import { chromium } from 'playwright';
import { startServer } from './serve.js';
import { execSync } from 'child_process';
import fs from 'fs';
const s = await startServer();
const b = await chromium.launch({ args:['--use-gl=swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport:{width:600,height:820} });
await p.goto(s.url, { waitUntil:'networkidle' });
await p.waitForFunction('window.DSi && window.DSi.ready');
fs.mkdirSync('/tmp/le',{recursive:true}); const tiles=[];
for (const t of [0,1,2,30,40,48]) {
  await p.evaluate((t)=>window.DSi.renderLaunch(t), t); await p.waitForTimeout(40);
  const d = await p.evaluate(()=>document.getElementById('bottom').toDataURL('image/png'));
  const cp=`/tmp/le/c_${t}.png`; fs.writeFileSync(cp, Buffer.from(d.split(',')[1],'base64'));
  execSync(`convert /work/nds/out/anim/launch/g_${String(t).padStart(4,'0')}.bot.ppm /tmp/le/r_${t}.png`);
  execSync(`convert /tmp/le/r_${t}.png ${cp} -append -bordercolor '#444' -border 2 /tmp/le/p_${t}.png`); tiles.push(`/tmp/le/p_${t}.png`);
}
await b.close(); s.close();
execSync(`montage ${tiles.join(' ')} -tile 6x1 -geometry +2+2 -background '#222' /tmp/launch_ends.png`);
console.log('done');
