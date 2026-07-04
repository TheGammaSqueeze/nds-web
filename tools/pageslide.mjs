import fs from 'fs';
function loadPPM(p) {
  const buf = fs.readFileSync(p);
  let o = 0; const tok = () => { while ([32,10,13,9].includes(buf[o])) o++; let s=o; while(![32,10,13,9].includes(buf[o])) o++; return buf.toString('ascii', s, o); };
  tok(); const w=+tok(), h=+tok(); tok(); o++;
  return { w, h, data: buf.subarray(o, o + w*h*3) };
}
// column luminance profile over the button band
function colProfile(im, y0, y1) {
  const p = new Float64Array(256);
  for (let x=0;x<256;x++){ let s=0; for(let y=y0;y<y1;y++){ const i=(y*256+x)*3; s += 0.299*im.data[i]+0.587*im.data[i+1]+0.114*im.data[i+2]; } p[x]=s; }
  return p;
}
function bestShift(ref, prof, lo, hi, x0, x1) {
  let bestS=0,bestE=Infinity; const errs=[];
  for (let s=lo;s<=hi;s++){ let e=0,n=0; for(let x=x0;x<x1;x++){ const xs=x-s; if(xs<0||xs>=256)continue; const d=prof[x]-ref[xs]; e+=d*d;n++; } e=n?e/n:Infinity; errs.push([s,e]); if(e<bestE){bestE=e;bestS=s;} }
  const im=errs.findIndex(e=>e[0]===bestS); let sub=bestS;
  if(im>0&&im<errs.length-1){const y1=errs[im-1][1],y2=errs[im][1],y3=errs[im+1][1],dn=(y1-2*y2+y3); if(dn!==0)sub=bestS+0.5*(y1-y3)/dn;}
  return sub;
}
const dir='out/settings_trans/page';
const N=35, Y0=40, Y1=150;
const imgs=[]; for(let f=0;f<N;f++){const p=`${dir}/g_${String(f).padStart(4,'0')}.bot.ppm`; if(fs.existsSync(p))imgs.push(loadPPM(p)); else imgs.push(null);}
const profs=imgs.map(im=>im?colProfile(im,Y0,Y1):null);
const ref=profs[34];
console.log('frame  shift(px, vs FINAL page; +256=new page fully right)  delta');
let prev=0;
for(let f=0;f<N;f++){ if(!profs[f])continue; const s=bestShift(ref,profs[f],-260,20,30,226); console.log(`f${String(f).padStart(2)}  ${s.toFixed(1).padStart(7)}   ${(s-prev).toFixed(1)}`); prev=s; }
