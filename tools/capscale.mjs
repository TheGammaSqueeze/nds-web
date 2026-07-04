import { chromium } from 'playwright';
import { startServer } from './serve.js';
import fs from 'fs';
const s = await startServer();
const b = await chromium.launch({ args:['--use-gl=swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport:{width:1200,height:1000} });
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto(s.url + '?scale=4',{waitUntil:'networkidle'});
await p.waitForFunction('window.DSi && window.DSi.ready');
await p.evaluate(async()=>{ try{ await document.fonts.load("16px 'DSVec'"); await document.fonts.load("16px 'DSVecNum'"); await document.fonts.ready; }catch(e){} });
await p.evaluate(()=>{ window.__demoTime=Date.parse('2000-01-01T12:34:00'); window.DSi.skipBoot && window.DSi.skipBoot(); });
await p.waitForTimeout(400);
await p.evaluate(()=>{ window.DSi.seatAt && window.DSi.seatAt(2); });
await p.waitForTimeout(300);
for(let i=0;i<30;i++){ await p.evaluate(()=>window.DSi.stepFrame && window.DSi.stepFrame()); }
await p.waitForTimeout(200);
fs.mkdirSync('/work/nds/compare/scale',{recursive:true});
for(const sc of ['top','bottom']){const d=await p.evaluate(id=>document.getElementById(id).toDataURL('image/png'),sc);fs.writeFileSync(`/work/nds/compare/scale/x4_${sc}.png`,Buffer.from(d.split(',')[1],'base64'));}
await b.close(); s.close(); console.log('captured scale4');
