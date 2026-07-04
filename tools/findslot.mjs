import { chromium } from 'playwright';
import { startServer } from './serve.js';
const s = await startServer();
const b = await chromium.launch({ args:['--use-gl=swiftshader','--no-sandbox'] });
const p = await b.newPage();
await p.goto(s.url,{waitUntil:'networkidle'});
await p.waitForFunction('window.DSi && window.DSi.ready');
const info = await p.evaluate(()=>{
  const L=window.DSi.launcher;
  const lk=Object.keys(L);
  // find an array of slot-like objects
  const arrays={};
  for(const k of lk){ if(Array.isArray(L[k])) arrays[k]=L[k].length; }
  // sample the likely slots array
  let sample=null, tmSlots=[];
  for(const k of lk){
    if(Array.isArray(L[k]) && L[k].length>10){
      sample={key:k, first: L[k].slice(0,3).map(o=> o && typeof o==='object'? Object.keys(o):o) };
      L[k].forEach((o,i)=>{ const t=o&&(o.title||o.name||o.label); if(t && /[^\x00-\x7E]/.test(t)) tmSlots.push([i,t]); });
    }
  }
  return { lk, arrays, sample, tmSlots };
});
console.log(JSON.stringify(info,null,1));
await b.close(); s.close();
