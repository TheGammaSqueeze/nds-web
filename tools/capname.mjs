import { chromium } from 'playwright';
import { startServer } from './serve.js';
import fs from 'fs';
const slot = +(process.argv[2]||7);
const s = await startServer();
const b = await chromium.launch({ args:['--use-gl=swiftshader','--no-sandbox'] });
async function shot(scale){
  const p=await b.newPage({viewport:{width:1200,height:1000}});
  await p.goto(s.url+(scale>1?`?scale=${scale}`:''),{waitUntil:'networkidle'});
  await p.waitForFunction('window.DSi && window.DSi.ready');
  await p.evaluate(async()=>{try{await document.fonts.load("16px 'DSVec'");await document.fonts.load("16px 'DSVecNum'");await document.fonts.ready;}catch(e){}});
  await p.evaluate(()=>{window.DSi.skipBoot&&window.DSi.skipBoot();});
  await p.waitForTimeout(350);
  await p.evaluate((sl)=>{window.DSi.seatAt&&window.DSi.seatAt(sl);},slot);
  await p.waitForTimeout(250);
  for(let i=0;i<20;i++){await p.evaluate(()=>window.DSi.stepFrame&&window.DSi.stepFrame());}
  await p.waitForTimeout(150);
  const d=await p.evaluate(()=>document.getElementById('bottom').toDataURL('image/png'));
  await p.close();
  return Buffer.from(d.split(',')[1],'base64');
}
fs.writeFileSync('/work/nds/compare/scale/name1.png', await shot(1));
fs.writeFileSync('/work/nds/compare/scale/name4.png', await shot(4));
await b.close(); s.close(); console.log('captured slot '+slot);
