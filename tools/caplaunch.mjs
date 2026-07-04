import { chromium } from 'playwright';
import { startServer } from './serve.js';
const t = +(process.argv[2]||30);
const s = await startServer();
const b = await chromium.launch({ args:['--use-gl=swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport:{width:600,height:820} });
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto(s.url,{waitUntil:'networkidle'});
await p.waitForFunction('window.DSi && window.DSi.ready');
await p.evaluate((tt)=>{ window.DSi.skipBoot(); window.DSi.renderLaunch(tt); }, t);
await p.waitForTimeout(150);
const bright = await p.evaluate(()=>{
  const r={};
  for(const id of ['top','bottom']){const c=document.getElementById(id);const g=c.getContext('2d');const d=g.getImageData(0,0,256,192).data;let s=0;for(let i=0;i<d.length;i+=4)s+=d[i];r[id]=Math.round(s/(d.length/4));}
  return r;
});
console.log('launch t='+t+' mean brightness -> top:'+bright.top+' bottom:'+bright.bottom+' (both should be well above idle ~230 and rising toward 255)');
await b.close(); s.close();
