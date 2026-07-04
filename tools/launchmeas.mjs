import fs from 'fs';
import { execSync } from 'child_process';
function loadPPM(p) {
  const buf = fs.readFileSync(p);
  let o = 0; const tok = () => { while ([32,10,13,9].includes(buf[o])) o++; let s=o; while(![32,10,13,9].includes(buf[o])) o++; return buf.toString('ascii', s, o); };
  tok(); const w=+tok(), h=+tok(); tok(); o++;
  return { w, h, data: buf.subarray(o, o + w*h*3) };
}
// usercolor blue dot ~ (48,130,251); match bluish pixels
function isBlue(r,g,b){ return b > 180 && b - r > 60 && g > 80 && g < 210 && r < 150; }
// bright white card interior ~ (255,255,255) but tile has grey border; detect the
// raised tile by a bright near-white block that is NOT the bg (bg ~243/235 striped)
for (let f = 0; f <= 40; f += 2) {
  const p = `/work/nds/out/anim/launch/g_${String(f).padStart(4,'0')}.bot.ppm`;
  if (!fs.existsSync(p)) continue;
  const im = loadPPM(p);
  let bx=0, by=0, bn=0; let minx=999,maxx=-1,miny=999,maxy=-1;
  for (let y=0;y<165;y++) for (let x=100;x<156;x++){
    const i=(y*256+x)*3, r=im.data[i],g=im.data[i+1],b=im.data[i+2];
    if (isBlue(r,g,b)) { bx+=x; by+=y; bn++; if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y; }
  }
  const cx = bn? (bx/bn).toFixed(1):'-', cy = bn?(by/bn).toFixed(1):'-';
  console.log(`f${String(f).padStart(2)}  blue px=${String(bn).padStart(4)}  centroid=(${cx},${cy})  bbox x[${minx}..${maxx}] y[${miny}..${maxy}]`);
}
