// 1:1 upscale guard: scale=1 must be pixel-identical to native; scale=N downscaled to 1x
// must faithfully match the 1x output (a supersampled superset).
import { chromium } from 'playwright';
import { startServer } from '/work/nds/tools/serve.js';
import fs from 'fs'; import { execSync } from 'child_process';
function rP(pt){const bb=fs.readFileSync(pt);let o=0;const t=()=>{while(bb[o]<=32)o++;let ss=o;while(bb[o]>32)o++;return bb.slice(ss,o).toString()};t();const w=+t(),h=+t();t();o++;return{w,h,d:bb.slice(o)}}
const s=await startServer();
const b=await chromium.launch({args:['--use-gl=swiftshader','--no-sandbox']});
async function shot(scale, which){
  const p=await b.newPage({viewport:{width:900,height:1200}});
  await p.goto(s.url + (scale>1?`?scale=${scale}`:''),{waitUntil:'networkidle'});
  await p.waitForFunction('window.DSi && window.DSi.ready');
  // renderCam() hardcodes window.__freezeAnim=0 internally (main.js), which silently
  // picks frame 0 of slot 17's 19-frame Bird & Beans animation regardless of what the
  // caller sets. verify.js's skipBoot()+setSlot() path does not, and is what actually
  // reproduces idle.bot's real melonDS-captured animation phase (freezeAnim=120 ->
  // frame 16) for a true apples-to-apples scale=1-vs-reference comparison.
  await p.evaluate(()=>{window.__demoTime=Date.parse('2000-01-01T00:00:00');window.__demoClockSpace=true;window.__freezeAnim=120;window.DSi.skipBoot();window.DSi.setSlot(17);});
  await p.waitForTimeout(30);
  const dim=await p.evaluate((w)=>{const cv=document.getElementById(w);return {w:cv.width,h:cv.height};},which);
  const buf=Buffer.from((await p.evaluate((w)=>document.getElementById(w).toDataURL('image/png'),which)).split(',')[1],'base64');
  await p.close();
  return {dim, buf};
}
// scale 1 bottom
const s1=await shot(1,'bottom'); fs.writeFileSync('.tmp/s1.png',s1.buf); execSync('convert .tmp/s1.png -depth 8 .tmp/s1.ppm');
const s2=await shot(2,'bottom'); fs.writeFileSync('.tmp/s2.png',s2.buf);
const s3=await shot(3,'bottom'); fs.writeFileSync('.tmp/s3.png',s3.buf);
console.log('backing dims: scale1',s1.dim,' scale2',s2.dim,' scale3',s3.dim);
execSync('convert .tmp/s2.png -depth 8 .tmp/s2.ppm');
// downscale s2 (512x384) to 256x192 for a faithful-superset check
execSync('convert .tmp/s2.png -resize 256x192 -depth 8 .tmp/s2d.ppm');
await b.close(); s.close();
const A=rP('.tmp/s1.ppm'), R=rP('assets/reference/idle.bot.ppm'), D=rP('.tmp/s2d.ppm');
let vsref=0; for(let i=0;i<A.d.length;i++){if(Math.abs(A.d[i]-R.d[i])>0)vsref++;}
let vsref20=0; for(let i=0;i<A.d.length;i+=3){if(Math.max(Math.abs(A.d[i]-R.d[i]),Math.abs(A.d[i+1]-R.d[i+1]),Math.abs(A.d[i+2]-R.d[i+2]))>20)vsref20++;}
let d2=0; for(let i=0;i<A.d.length;i+=3){if(Math.max(Math.abs(A.d[i]-D.d[i]),Math.abs(A.d[i+1]-D.d[i+1]),Math.abs(A.d[i+2]-D.d[i+2]))>20)d2++;}
console.log('scale1 vs idle.bot: exact-diff bytes',vsref,' | >20 px',vsref20,'(must be 0 = native match preserved)');
console.log('scale2-downscaled vs scale1: >20 px',d2,'of 49152 (faithful superset; small = good)');
