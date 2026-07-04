import { chromium } from 'playwright';
import { startServer } from './serve.js';
const s = await startServer();
const b = await chromium.launch({ args:['--use-gl=swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport:{width:900,height:900} });
await p.goto(s.url + '?scale=2',{waitUntil:'networkidle'});
await p.waitForFunction('window.DSi && window.DSi.ready');
await p.evaluate(()=>document.fonts.load("15px 'DSVec'"));
await p.waitForTimeout(300);
const r = await p.evaluate(()=>{
  const F = window.DSi.fonts ? window.DSi.fonts.m : null;
  // fall back: reach Fonts via module? expose through a global if present
  const Fonts = window.__Fonts || (window.DSi && window.DSi.Fonts);
  const fm = (Fonts && Fonts.m) || F;
  const c = document.createElement('canvas'); const ctx=c.getContext('2d');
  const vecSize = fm ? fm.vecSize : 15;
  ctx.font = `${vecSize}px 'DSVec', sans-serif`; ctx.textBaseline='alphabetic';
  const out={};
  for (const str of ['Nintendo','Photos will be displayed','User','START','Camera']){
    const bw = fm ? fm.measure(str) : 0;
    const vw = ctx.measureText(str).width;
    out[str] = { bw, vw };
  }
  const capA = ctx.measureText('N').actualBoundingBoxAscent;
  const capH = fm ? fm._bmCapH() : 10;
  return { vecSize, capA, capH, sy: capH/capA, out };
});
console.log(JSON.stringify(r,null,1));
await b.close(); s.close();
