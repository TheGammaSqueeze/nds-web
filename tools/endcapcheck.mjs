import { chromium } from 'playwright';
import { startServer } from './serve.js';
import fs from 'fs';
const s=await startServer();const b=await chromium.launch({args:['--use-gl=swiftshader','--no-sandbox']});const p=await b.newPage({viewport:{width:600,height:820}});
await p.goto(s.url,{waitUntil:'networkidle'});await p.waitForFunction('window.DSi && window.DSi.ready');
await p.evaluate(()=>{window.__demoTime=Date.parse('2000-01-01T00:00:00');window.__demoClockSpace=true;});
for(const sl of [0,38]){await p.evaluate(x=>window.DSi.renderCam(x,x,x),sl);await p.waitForTimeout(20);
 fs.writeFileSync(`/tmp/ec_${sl}.png`,Buffer.from((await p.evaluate(()=>document.getElementById('bottom').toDataURL('image/png'))).split(',')[1],'base64'));}
await b.close();s.close();console.log('ok');
