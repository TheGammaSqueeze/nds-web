import { chromium } from 'playwright';
import { startServer } from './serve.js';
import fs from 'fs';
const s = await startServer();
const b = await chromium.launch({ args:['--use-gl=swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport:{width:600,height:820} });
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto(s.url,{waitUntil:'networkidle'});
await p.waitForFunction('window.DSi && window.DSi.ready');
const shot=async(nm)=>{const d=await p.evaluate(()=>document.getElementById('bottom').toDataURL('image/png'));fs.writeFileSync(`/tmp/ac_${nm}.png`,Buffer.from(d.split(',')[1],'base64'));};
// mid-slide 17->18 at cam 17.5
await p.evaluate(()=>window.DSi.renderCam(17,18,17.5)); await p.waitForTimeout(20); await shot('slide');
// settle squash (renderCam settled, then check START)
await p.evaluate(()=>window.DSi.renderCam(17,17,17)); await p.waitForTimeout(20); await shot('settled');
// intro cascade (if hook exists)
const hasIntro = await p.evaluate(()=>typeof window.DSi.renderIntro==='function');
if(hasIntro){ await p.evaluate(()=>window.DSi.renderIntro(40)); await p.waitForTimeout(20); await shot('intro'); }
// grab mode
const hasGrab = await p.evaluate(()=>typeof window.DSi.renderGrab==='function');
if(hasGrab){ await p.evaluate(()=>window.DSi.renderGrab(0)); await p.waitForTimeout(20); await shot('grab'); }
await b.close(); s.close();
console.log('shots:', ['slide','settled', hasIntro&&'intro', hasGrab&&'grab'].filter(Boolean).join(','));
