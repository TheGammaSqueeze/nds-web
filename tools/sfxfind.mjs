import fs from 'fs';
const b = fs.readFileSync('out/settings_trans/session.wav');
// find 'data' chunk
let off = 12;
while (off < b.length) { const id = b.toString('ascii', off, off+4); const sz = b.readUInt32LE(off+4); if (id==='data'){ off+=8; break; } off += 8 + sz; }
const dataStart = off;
const nSamples = (b.length - dataStart) / 4; // stereo 16-bit
function rmsWindow(startSample, len) {
  let s=0; for (let i=0;i<len;i++){ const p=dataStart+(startSample+i)*4; if(p+2>b.length)break; const l=b.readInt16LE(p); s+=l*l; } return Math.sqrt(s/len);
}
// scan a region [s0,s1] in 5ms windows, report onset (where RMS exceeds threshold)
function scan(label, s0, s1) {
  const W = 240; // 5ms
  const env=[];
  for (let s=s0;s<s1;s+=W){ env.push([s, rmsWindow(s, W)]); }
  const peak = Math.max(...env.map(e=>e[1]));
  const thr = Math.max(80, peak*0.12);
  // find contiguous bursts above thr
  const bursts=[]; let cur=null;
  for (const [s,r] of env){ if(r>thr){ if(!cur)cur=[s,s]; else cur[1]=s; } else { if(cur){bursts.push(cur);cur=null;} } }
  if(cur)bursts.push(cur);
  console.log(`\n${label}: region ${s0}..${s1} (${((s1-s0)/48000).toFixed(2)}s) peak=${peak.toFixed(0)} thr=${thr.toFixed(0)}`);
  for (const [a,c] of bursts){ if (c-a < 240) continue; console.log(`  burst ${a}..${c+W}  (${((a)/48000).toFixed(3)}s, dur ${((c+W-a)/48000*1000).toFixed(0)}ms, peakRMS ${Math.max(...env.filter(e=>e[0]>=a&&e[0]<=c).map(e=>e[1])).toFixed(0)})`); }
}
scan('PAGE change', 1604649, 1660000);
scan('ENTER subscreen', 1740000, 1800000);
scan('BACK', 1900000, 1960000);
console.log('\ntotal samples', nSamples, 'dur', (nSamples/48000).toFixed(1)+'s');
