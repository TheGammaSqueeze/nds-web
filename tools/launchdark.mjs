import fs from 'fs';
function loadPPM(p) {
  const buf = fs.readFileSync(p);
  let o = 0; const tok = () => { while ([32,10,13,9].includes(buf[o])) o++; let s=o; while(![32,10,13,9].includes(buf[o])) o++; return buf.toString('ascii', s, o); };
  tok(); const w=+tok(), h=+tok(); tok(); o++;
  return { w, h, data: buf.subarray(o, o + w*h*3) };
}
// Bird&Beans icon = dark starfield (r,g,b all < 120, slightly blue). Track its
// centroid in the central band x[104,152] (the lifting tile), y[0,160].
for (let f = 0; f <= 30; f++) {
  const p = `/work/nds/out/anim/launch/g_${String(f).padStart(4,'0')}.bot.ppm`;
  if (!fs.existsSync(p)) continue;
  const im = loadPPM(p);
  let sy=0,sx=0,n=0,miny=999,maxy=-1;
  for (let y=0;y<160;y++) for (let x=104;x<152;x++){
    const i=(y*256+x)*3, r=im.data[i],g=im.data[i+1],b=im.data[i+2];
    if (r<115&&g<115&&b<130&&Math.max(r,g,b)-Math.min(r,g,b)<70) { sx+=x;sy+=y;n++; if(y<miny)miny=y; if(y>maxy)maxy=y; }
  }
  console.log(`f${String(f).padStart(2)}  darkPx=${String(n).padStart(4)}  cy=${n?(sy/n).toFixed(1):'--'}  y[${n?miny:'-'}..${n?maxy:'-'}]`);
}
