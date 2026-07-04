import { chromium } from 'playwright';
import { startServer } from './serve.js';
import { execSync } from 'child_process';
import fs from 'fs';
const s = await startServer();
const b = await chromium.launch({ args:['--use-gl=swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport:{width:600,height:820} });
await p.goto(s.url,{waitUntil:'networkidle'});
await p.waitForFunction('window.DSi && window.DSi.ready');
await p.evaluate(()=>{ window.__demoTime=Date.parse('2000-01-01T00:00:00'); window.__demoClockSpace=true; window.DSi.skipBoot(); window.DSi.setSlot(17); });
const results=[];
for(let fr=0; fr<120; fr+=2){
  await p.evaluate((f)=>{ window.__freezeAnim=f; }, fr);
  await p.waitForTimeout(60);
  const d=await p.evaluate(()=>document.getElementById('bottom').toDataURL('image/png'));
  fs.writeFileSync('/tmp/fr.png', Buffer.from(d.split(',')[1],'base64'));
  // measure sel_icon region diff vs real
  const out=execSync(`compare -metric AE -fuzz 8% -crop 34x34+111+96 assets/reference/idle.bot.png /tmp/fr.png /tmp/frd.png 2>&1 || true`).toString().trim().split(/\s+/)[0];
  results.push([fr, parseInt(out)||9999]);
}
results.sort((a,b)=>a[1]-b[1]);
console.log('best frames (frame:iconDiffPx):', results.slice(0,5).map(r=>r[0]+':'+r[1]).join('  '));
await b.close(); s.close();
