import { chromium } from 'playwright';
import { startServer } from './serve.js';
import { execSync } from 'child_process';
import fs from 'fs';

function ppmFromPNGdata(b64) {
  const buf = Buffer.from(b64, 'base64');
  fs.writeFileSync('/tmp/_clone.png', buf);
  const ppm = execSync('convert /tmp/_clone.png -depth 8 ppm:-', { maxBuffer: 1 << 26 });
  return parsePPM(ppm);
}
function loadPPMfile(p) { return parsePPM(fs.readFileSync(p)); }
function parsePPM(buf) {
  let o = 0; const tok = () => { while ([32,10,13,9].includes(buf[o])) o++; let s=o; while(![32,10,13,9].includes(buf[o])) o++; return buf.toString('ascii', s, o); };
  tok(); const w=+tok(), h=+tok(); tok(); o++;
  return { w, h, data: buf.subarray(o, o + w*h*3) };
}
// whole-screen match: fraction of pixels within THRESH on all channels
function match(a, b, THRESH=20) {
  const n = Math.min(a.data.length, b.data.length);
  let ok = 0, tot = 0;
  for (let i = 0; i < n; i += 3) {
    const d = Math.max(Math.abs(a.data[i]-b.data[i]), Math.abs(a.data[i+1]-b.data[i+1]), Math.abs(a.data[i+2]-b.data[i+2]));
    if (d <= THRESH) ok++; tot++;
  }
  return ok / tot;
}

const s = await startServer();
const b = await chromium.launch({ args:['--use-gl=swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport:{width:600,height:820} });
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.goto(s.url, { waitUntil:'networkidle' });
const ok = await p.waitForFunction('window.DSi && window.DSi.ready').then(()=>1).catch(()=>0);
if (!ok) { console.log('NOT READY', await p.evaluate(()=>window.__err||'')); await b.close(); s.close(); process.exit(1); }

// sweep clone cameras 17.00 .. 18.00
const cams = [];
for (let k = 0; k <= 20; k++) cams.push(+(17 + k*0.05).toFixed(2));
const cloneImgs = {};
for (const cam of cams) {
  await p.evaluate((cam) => window.DSi.renderCam(17, 18, cam), cam);
  await p.waitForTimeout(30);
  const d = await p.evaluate(() => document.getElementById('bottom').toDataURL('image/png'));
  cloneImgs[cam] = ppmFromPNGdata(d.split(',')[1]);
}
await b.close(); s.close();

// for each real navR frame, find best clone camera
console.log('realFrame  bestCam  match%   (2nd-best)');
for (let f = 0; f <= 12; f++) {
  const rp = `/work/nds/out/anim/navR/g_${String(f).padStart(4,'0')}.bot.ppm`;
  if (!fs.existsSync(rp)) continue;
  const real = loadPPMfile(rp);
  let best = null, bestM = -1, second = -1, secondCam = null;
  for (const cam of cams) {
    const m = match(real, cloneImgs[cam]);
    if (m > bestM) { second = bestM; secondCam = best; bestM = m; best = cam; }
    else if (m > second) { second = m; secondCam = cam; }
  }
  console.log(`f${String(f).padStart(2)}  cam=${best.toFixed(2)}  ${(bestM*100).toFixed(2)}%   (${secondCam} ${(second*100).toFixed(2)}%)`);
}
