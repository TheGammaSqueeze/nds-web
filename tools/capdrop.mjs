import { chromium } from 'playwright';
import { startServer } from './serve.js';
const s = await startServer();
const b = await chromium.launch({ args:['--use-gl=swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport:{width:600,height:820} });
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto(s.url,{waitUntil:'networkidle'});
await p.waitForFunction('window.DSi && window.DSi.ready');
// measure the grabbed tile top-edge y at x128 across drop frames
for (const t of [0,2,4,6,8,10]) {
  await p.evaluate((tt)=>{ window.DSi.skipBoot(); window.DSi.renderGrabDrop(tt); }, t);
  await p.waitForTimeout(60);
  const y = await p.evaluate(()=>{ const c=document.getElementById('bottom').getContext('2d'); const d=c.getImageData(128,2,1,140).data; for(let yy=0;yy<140;yy++){const i=yy*4; const lum=(d[i]+d[i+1]+d[i+2])/3; if(lum<210) return 2+yy;} return -1; });
  console.log('drop t='+t+' -> tile top-edge y='+y);
}
await b.close(); s.close();
