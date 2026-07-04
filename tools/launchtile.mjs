import fs from 'fs';
function loadPPM(p) {
  const buf = fs.readFileSync(p);
  let o = 0; const tok = () => { while ([32,10,13,9].includes(buf[o])) o++; let s=o; while(![32,10,13,9].includes(buf[o])) o++; return buf.toString('ascii', s, o); };
  tok(); const w=+tok(), h=+tok(); tok(); o++;
  return { w, h, data: buf.subarray(o, o + w*h*3) };
}
// The lifted tile is a bright white rounded CARD (~52px wide) around x128. Detect
// the top-most near-white row within the central band x[104,152], y[0,150] that has
// a run of >=30 near-white px (the card top edge). Also mean brightness for fade.
for (let f = 0; f <= 40; f++) {
  const p = `/work/nds/out/anim/launch/g_${String(f).padStart(4,'0')}.bot.ppm`;
  if (!fs.existsSync(p)) continue;
  const im = loadPPM(p);
  let cardTop = -1;
  for (let y=0;y<152 && cardTop<0;y++){
    let run=0;
    for (let x=104;x<152;x++){ const i=(y*256+x)*3; const r=im.data[i],g=im.data[i+1],b=im.data[i+2];
      if (r>235&&g>235&&b>235) { run++; if(run>=30){cardTop=y;break;} } else run=0; }
  }
  // mean brightness whole screen
  let sum=0; for (let i=0;i<im.data.length;i+=3) sum+=im.data[i];
  const mean=(sum/(im.data.length/3)).toFixed(1);
  console.log(`f${String(f).padStart(2)}  cardTop=${cardTop>=0?cardTop:'--'}  meanR=${mean}`);
}
