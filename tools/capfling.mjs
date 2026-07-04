import { chromium } from 'playwright';
import { startServer } from './serve.js';
const s = await startServer();
const b = await chromium.launch({ args:['--use-gl=swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport:{width:600,height:820} });
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto(s.url,{waitUntil:'networkidle'});
await p.waitForFunction('window.DSi && window.DSi.ready');
const trace = await p.evaluate(()=>{
  const L = window.DSi.launcher; window.DSi.skipBoot();
  window.__pauseLoop = true;               // stop the RAF loop so we drive update() manually
  L.selected=17; L.camera=17; L.targetCamera=17; L.sliding=false; L.slideFrom=17;
  L.scrub(17); L.scrub(17.3);              // simulate a drag
  L.flingScrub(0.35);                       // release with a rightward velocity
  const out=[];
  for(let i=0;i<40;i++){ L.update(1/60); out.push(+L.camera.toFixed(2)); if(!L.fling && Math.round(L.camera)===L.camera && L.targetCamera===L.camera) break; }
  return { trace: out, finalSelected: L.selected };
});
console.log('fling camera trace:', trace.trace.join(' '));
console.log('settled at slot', trace.finalSelected, '(glided past 17 with ease-out, then snapped)');
await b.close(); s.close();
