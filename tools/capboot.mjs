import { chromium } from 'playwright';
import fs from 'fs';
import { startServer } from './serve.js';
const server = await startServer();
const b = await chromium.launch({ args:['--use-gl=swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport:{width:700,height:900} });
let err=null; p.on('pageerror',e=>err=e.message);
await p.goto(server.url,{waitUntil:'networkidle'});
await p.waitForFunction('window.DSi && window.DSi.ready',null,{timeout:15000});
// drive boot to the touch-prompt peak (frame 210) and a trough (frame 240)
for (const [f,tag] of [[210,'peak'],[240,'trough'],[118,'hsshown']]) {
  await p.evaluate((fr)=>{ if(window.DSi.boot){ DSi.state='boot'; DSi.boot.frame=fr; DSi.boot.phase = fr>=118?'wait':'boot'; DSi.boot.done=false; } }, f);
  await p.waitForTimeout(50);
  const url = await p.evaluate(()=>document.getElementById('bottom').toDataURL('image/png'));
  fs.writeFileSync(`compare/zoom/boot_${tag}.png`, Buffer.from(url.split(',')[1],'base64'));
}
console.log('err:', err, '| __err:', await p.evaluate(()=>window.__err||'none'));
await b.close(); server.close();
