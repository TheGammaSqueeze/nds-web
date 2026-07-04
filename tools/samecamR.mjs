import { chromium } from 'playwright';
import { startServer } from './serve.js';
import { execSync } from 'child_process';
import fs from 'fs';
function rP(p){const b=fs.readFileSync(p);let o=0;const t=()=>{while(b[o]<=32)o++;let s=o;while(b[o]>32)o++;return b.slice(s,o).toString()};t();const w=+t(),h=+t();t();o++;return{w,h,d:b.slice(o)}}
function rG(buf){let o=0;const t=()=>{while([32,10,13,9].includes(buf[o]))o++;let s=o;while(![32,10,13,9].includes(buf[o]))o++;return buf.toString('ascii',s,o)};t();const w=+t(),h=+t();t();o++;return{w,h,d:buf.subarray(o)}}
const s=await startServer();const b=await chromium.launch({args:['--use-gl=swiftshader','--no-sandbox']});const p=await b.newPage({viewport:{width:600,height:820}});
await p.goto(s.url,{waitUntil:'networkidle'});await p.waitForFunction('window.DSi && window.DSi.ready');
await p.evaluate(()=>{window.__demoTime=Date.parse('2000-01-01T00:00:00');window.__demoClockSpace=true;});
const files=fs.readdirSync('out/scrollR').filter(f=>f.endsWith('.bot.ppm')).sort();
const cams={2:17.121,3:17.259,4:17.379,5:17.5,6:17.621,7:17.741,8:17.862,9:17.97};
for(const [fk,cam] of Object.entries(cams)){
  await p.evaluate((c)=>window.DSi.renderCam(17,18,c),cam);await p.waitForTimeout(15);
  const cl=rG(execSync('convert - -depth 8 ppm:-',{input:Buffer.from((await p.evaluate(()=>document.getElementById('bottom').toDataURL('image/png'))).split(',')[1],'base64'),maxBuffer:1<<26}));
  const r=rP('out/scrollR/'+files[+fk]);let sb=0;for(let y=170;y<192;y++)for(let x=0;x<256;x++){const i=(y*256+x)*3;if(Math.max(Math.abs(r.d[i]-cl.d[i]),Math.abs(r.d[i+1]-cl.d[i+1]),Math.abs(r.d[i+2]-cl.d[i+2]))>20)sb++;}
  console.log('RIGHT cam '+cam+' (f'+fk+'): scrollbar '+sb+'px');
}
await b.close();s.close();
