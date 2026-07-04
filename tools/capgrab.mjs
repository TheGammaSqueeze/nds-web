import { chromium } from 'playwright';
import { startServer } from './serve.js';
import fs from 'fs';
const move = +(process.argv[2]||0);
const s = await startServer();
const b = await chromium.launch({ args:['--use-gl=swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport:{width:600,height:820} });
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto(s.url,{waitUntil:'networkidle'});
await p.waitForFunction('window.DSi && window.DSi.ready');
await p.evaluate((mv)=>{ window.__demoTime=Date.parse('2000-01-01T00:00:00'); window.__demoClockSpace=true; window.DSi.skipBoot(); window.DSi.renderGrab(mv); }, move);
await p.waitForTimeout(200);
for(const sc of ['top','bottom']){const d=await p.evaluate(id=>document.getElementById(id).toDataURL('image/png'),sc);fs.writeFileSync(`/tmp/clone_grab_${move}.${sc}.png`,Buffer.from(d.split(',')[1],'base64'));}
await b.close(); s.close(); console.log('captured grab move='+move);
