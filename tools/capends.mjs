import { chromium } from 'playwright';
import fs from 'fs';
import { startServer } from './serve.js';
const server = await startServer();
const b = await chromium.launch({ args:['--use-gl=swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport:{width:700,height:900} });
await p.goto(server.url,{waitUntil:'networkidle'});
await p.waitForFunction('window.DSi && window.DSi.ready',null,{timeout:15000});
await p.evaluate(()=>{ window.__freezeAnim=120; DSi.skipBoot(); });
for (const s of [0,38]) {
  await p.evaluate((n)=>{ DSi.setSlot(n); DSi.launcher.intro=null; }, s);
  await p.waitForTimeout(50);
  const url = await p.evaluate(()=>document.getElementById('bottom').toDataURL('image/png'));
  fs.writeFileSync(`compare/zoom/end_${s}.png`, Buffer.from(url.split(',')[1],'base64'));
}
await b.close(); server.close(); console.log('done');
