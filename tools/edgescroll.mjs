import { chromium } from 'playwright';
import { startServer } from './serve.js';
import { execSync } from 'child_process';
import fs from 'fs';
function rP(p){const b=fs.readFileSync(p);let o=0;const t=()=>{while(b[o]<=32)o++;let s=o;while(b[o]>32)o++;return b.slice(s,o).toString()};t();const w=+t(),h=+t();t();o++;return{w,h,d:b.slice(o)}}
function rG(p){const ppm=execSync(`convert "${p}" -depth 8 ppm:-`,{maxBuffer:1<<26});let o=0;const t=()=>{while([32,10,13,9].includes(ppm[o]))o++;let s=o;while(![32,10,13,9].includes(ppm[o]))o++;return ppm.toString("ascii",s,o)};t();const w=+t(),h=+t();t();o++;return{w,h,d:ppm.subarray(o)}}
const s=await startServer();const b=await chromium.launch({args:["--use-gl=swiftshader","--no-sandbox"]});const p=await b.newPage({viewport:{width:600,height:820}});
p.on("pageerror",e=>console.log("ERR",e.message));
await p.goto(s.url,{waitUntil:"networkidle"});await p.waitForFunction("window.DSi && window.DSi.ready");
for(const [nm,sl] of [["left",0],["right",38]]){
  await p.evaluate(()=>{window.__demoTime=Date.parse("2000-01-01T00:00:00");window.__demoClockSpace=true;});await p.evaluate(x=>window.DSi.renderCam(x,x,x),sl); await p.waitForTimeout(20);
  for(const scr of ["top","bottom"]){const tag=scr==="bottom"?"bot":"top";const d=await p.evaluate(id=>document.getElementById(id).toDataURL("image/png"),scr);fs.writeFileSync(`/tmp/es_${nm}_${tag}.png`,Buffer.from(d.split(",")[1],"base64"));}
  const swn=sl===0?"sw00":"sw38";
  for(const tag of ["top","bot"]){const r=rP(`out/sbsweep/${swn}.${tag}.ppm`),c=rG(`/tmp/es_${nm}_${tag}.png`);
    const rows={};let n=0;for(let y=0;y<192;y++)for(let x=0;x<256;x++){const i=(y*256+x)*3;const dd=Math.max(Math.abs(r.d[i]-c.d[i]),Math.abs(r.d[i+1]-c.d[i+1]),Math.abs(r.d[i+2]-c.d[i+2]));if(dd>20){n++;(rows[y]??=[]).push(x);}}
    console.log(`${nm} ${tag}: ${n} diff px`);
    for(const y of Object.keys(rows).sort((a,b)=>a-b).slice(0,10)){const xs=rows[y];console.log("   y"+y,"x"+xs[0]+".."+xs[xs.length-1]+" ("+xs.length+")");}
  }
}
await b.close();s.close();
