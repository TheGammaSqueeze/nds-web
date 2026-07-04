import { chromium } from 'playwright';
import { startServer } from './serve.js';
const s = await startServer();
const b = await chromium.launch({ args:['--use-gl=swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport:{width:600,height:820} });
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto(s.url,{waitUntil:'networkidle'});
await p.waitForFunction('window.DSi && window.DSi.ready');
// for a few intro frames, report each visible tile's top-edge y (5 slots at x 5,63,128,193,251) + whether the blue frame is present
for (const n of [8,16,24,40,53,59,67]) {
  await p.evaluate((nn)=>{ window.DSi.skipBoot(); window.DSi.renderIntro(nn); }, n);
  await p.waitForTimeout(50);
  const r = await p.evaluate(()=>{
    const c=document.getElementById('bottom').getContext('2d');
    const tiley=(x)=>{const d=c.getImageData(x,60,1,120).data;for(let y=0;y<120;y++){const i=y*4;if((d[i]+d[i+1]+d[i+2])/3<225)return 60+y;}return -1;};
    // blue frame present near centre? check for a saturated blue pixel around x100,y120
    const d=c.getImageData(96,118,70,6).data; let blue=0; for(let i=0;i<d.length;i+=4){if(d[i+2]>170&&d[i]<120&&d[i+2]-d[i]>70)blue++;}
    return {L:tiley(63),C:tiley(128),R:tiley(193),frameBlue:blue};
  });
  console.log('intro f='+n+' tileTopY L(x63)='+r.L+' C(x128)='+r.C+' R(x193)='+r.R+' | frameBlue='+r.frameBlue);
}
await b.close(); s.close();
