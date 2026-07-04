import { chromium } from 'playwright';
import { startServer } from './serve.js';
import { execSync } from 'child_process';
import fs from 'fs';
function rP(p){const b=fs.readFileSync(p);let o=0;const t=()=>{while(b[o]<=32)o++;let s=o;while(b[o]>32)o++;return b.slice(s,o).toString()};t();const w=+t(),h=+t();t();o++;return{w,h,d:b.slice(o)}}
function rG(buf){let o=0;const t=()=>{while([32,10,13,9].includes(buf[o]))o++;let s=o;while(![32,10,13,9].includes(buf[o]))o++;return buf.toString('ascii',s,o)};t();const w=+t(),h=+t();t();o++;return{w,h,d:buf.subarray(o)}}
const thumbX=(im)=>{for(let x=19;x<=236;x++){const i=(182*256+x)*3;if(im.d[i]<120&&im.d[i+2]>200)return x;}return -1;};
const sbdiff=(a,b)=>{let n=0;for(let y=170;y<192;y++)for(let x=0;x<256;x++){const i=(y*256+x)*3;if(Math.max(Math.abs(a.d[i]-b.d[i]),Math.abs(a.d[i+1]-b.d[i+1]),Math.abs(a.d[i+2]-b.d[i+2]))>20)n++;}return n;};
const s=await startServer();const b=await chromium.launch({args:['--use-gl=swiftshader','--no-sandbox']});const p=await b.newPage({viewport:{width:600,height:820}});
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto(s.url,{waitUntil:'networkidle'});await p.waitForFunction('window.DSi && window.DSi.ready');
await p.evaluate(()=>{window.__demoTime=Date.parse('2000-01-01T00:00:00');window.__demoClockSpace=true;window.DSi.seatAt(17);});
const grab=async()=>rG(execSync('convert - -depth 8 ppm:-',{input:Buffer.from((await p.evaluate(()=>document.getElementById('bottom').toDataURL('image/png'))).split(',')[1],'base64'),maxBuffer:1<<26}));
const ref=fs.readdirSync('out/scrollL').filter(f=>f.endsWith('.bot.ppm')).sort().map(f=>rP('out/scrollL/'+f));
const rows=[];let fi=0;
for(let press=0;press<18;press++){
  for(let f=0;f<16;f++){
    if(f===2) await p.evaluate(()=>window.DSi.moveL());
    const cam=await p.evaluate(()=>window.DSi.stepFrame());
    const cl=await grab();
    if(fi<ref.length){rows.push({fi,ctx:thumbX(cl),rtx:thumbX(ref[fi]),cam:+cam.toFixed(2),sb:sbdiff(ref[fi],cl)});}
    fi++;
  }
}
await b.close();s.close();
// report frames where thumb-x differs OR scrollbar diff is high
console.log('frames where clone thumb != melonDS thumb, or scrollbar-region diff>60:');
let bad=0;for(const r of rows){if(r.ctx!==r.rtx||r.sb>60){bad++;if(bad<=40)console.log('f'+r.fi+' cam'+r.cam+' cloneThumb'+r.ctx+' refThumb'+r.rtx+' sbDiff'+r.sb);}}
console.log('total frames:',rows.length,' mismatched:',bad);
