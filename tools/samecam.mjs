import { chromium } from 'playwright';
import { startServer } from './serve.js';
import { execSync } from 'child_process';
import fs from 'fs';
function rP(p){const b=fs.readFileSync(p);let o=0;const t=()=>{while(b[o]<=32)o++;let s=o;while(b[o]>32)o++;return b.slice(s,o).toString()};t();const w=+t(),h=+t();t();o++;return{w,h,d:b.slice(o)}}
function rG(buf){let o=0;const t=()=>{while([32,10,13,9].includes(buf[o]))o++;let s=o;while(![32,10,13,9].includes(buf[o]))o++;return buf.toString('ascii',s,o)};t();const w=+t(),h=+t();t();o++;return{w,h,d:buf.subarray(o)}}
const s=await startServer();const b=await chromium.launch({args:['--use-gl=swiftshader','--no-sandbox']});const p=await b.newPage({viewport:{width:600,height:820}});
await p.goto(s.url,{waitUntil:'networkidle'});await p.waitForFunction('window.DSi && window.DSi.ready');
await p.evaluate(()=>{window.__demoTime=Date.parse('2000-01-01T00:00:00');window.__demoClockSpace=true;});
const files=fs.readdirSync('out/scrollL').filter(f=>f.endsWith('.bot.ppm')).sort();
// melonDS slide 17->16 is frames 0..9. cameras derived from the tracked groove (rest x29 -> +58).
const cams={2:16.879,3:16.741,4:16.621,5:16.5,6:16.379,7:16.259,8:16.138,9:16.03};
for(const [fk,cam] of Object.entries(cams)){
  await p.evaluate((c)=>window.DSi.renderCam(17,16,c),cam);
  await p.waitForTimeout(15);
  const cl=rG(execSync('convert - -depth 8 ppm:-',{input:Buffer.from((await p.evaluate(()=>document.getElementById('bottom').toDataURL('image/png'))).split(',')[1],'base64'),maxBuffer:1<<26}));
  const r=rP('out/scrollL/'+files[+fk]);
  // full-frame diff + scrollbar-region diff
  let all=0,sb=0;for(let y=0;y<192;y++)for(let x=0;x<256;x++){const i=(y*256+x)*3;const d=Math.max(Math.abs(r.d[i]-cl.d[i]),Math.abs(r.d[i+1]-cl.d[i+1]),Math.abs(r.d[i+2]-cl.d[i+2]));if(d>20){all++;if(y>=170)sb++;}}
  console.log('cam '+cam+' (melonDS f'+fk+'): full diff '+all+'px, scrollbar '+sb+'px');
}
await b.close();s.close();
