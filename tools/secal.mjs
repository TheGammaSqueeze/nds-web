// Calibrate the envelope decay scale of the NITRO SE renderer against the melonDS recordings
// (the ground truth of the real ARM7 sequence player). Grid-search ENV.decScale to maximize
// the summed RMS-profile correlation for the three settings SEs whose recordings we have:
// DECIDE(->settings_enter), BACK(->settings_back), PAGE_CHG(->settings_nav).
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { parse, fileBytes } = require('./sdat.js');
const { parseSBNK } = require('./sseq.js');
const { parseSWAR } = require('./swav.js');
const { renderSeq, RATE, ENV } = require('./serender.js');

const sdatBuf = fs.readFileSync('assets/launcher/settings_fs/sound/sound_data.sdat');
const sdat = parse(sdatBuf);
const sbnk = parseSBNK(fileBytes(sdatBuf, sdat, 2));
const swar = parseSWAR(fileBytes(sdatBuf, sdat, 4));
const ssar = fileBytes(sdatBuf, sdat, 1);
const dataOff = ssar.readUInt32LE(0x18);

function readWAV(path) {
  const b = fs.readFileSync(path);
  let ch = 12, fmt = null, data = null;
  while (ch + 8 <= b.length) { const id = b.toString('latin1', ch, ch + 4), sz = b.readUInt32LE(ch + 4); if (id === 'fmt ') fmt = { ch: b.readUInt16LE(ch + 10), rate: b.readUInt32LE(ch + 12) }; else if (id === 'data') { data = { off: ch + 8, sz }; break; } ch += 8 + sz + (sz & 1); }
  const n = Math.floor(data.sz / 2 / fmt.ch), mono = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let c = 0; c < fmt.ch; c++) s += b.readInt16LE(data.off + (i * fmt.ch + c) * 2); mono[i] = s / fmt.ch / 32768; }
  return { rate: fmt.rate, pcm: mono };
}
function prof(pcm, rate, win = 0.025) {
  const W = (rate * win) | 0, out = [];
  for (let i = 0; i + W <= pcm.length; i += W) { let s = 0; for (let j = 0; j < W; j++) s += pcm[i + j] * pcm[i + j]; out.push(Math.sqrt(s / W)); }
  // trim leading/trailing near-silence
  let a = 0, b = out.length - 1;
  const thr = Math.max(...out) * 0.02;
  while (a < b && out[a] < thr) a++;
  while (b > a && out[b] < thr) b--;
  return out.slice(a, b + 1);
}
function resampleArr(a, L) { const out = new Float32Array(L); for (let i = 0; i < L; i++) { const x = i * (a.length - 1) / (L - 1); const i0 = x | 0, f = x - i0; out[i] = (a[i0] || 0) * (1 - f) + (a[i0 + 1] || 0) * f; } return out; }
const pearson = (a, b) => { const n = a.length; let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n; let d = 0, na = 0, nb = 0; for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; d += x * y; na += x * x; nb += y * y; } return d / (Math.sqrt(na * nb) + 1e-9); };

const CASES = [
  { entry: 364, vol: 127, rec: 'settings_enter' },   // SUB_DECIDE is what settings uses for enter
  { entry: 500, vol: 127, rec: 'settings_back' },
  { entry: 737, vol: 96, rec: 'settings_nav' },
];
const recs = CASES.map(c => { const w = readWAV(`out/ref_audio/${c.rec}.recording.wav`); return { p: prof(w.pcm, w.rate), dur: w.pcm.length / w.rate }; });

console.log('decScale  corr(enter) corr(back) corr(nav)  durRatio(enter,back,nav)  total');
let best = null;
for (const scale of [1, 0.5, 0.25, 0.12, 0.06, 0.03, 0.015]) {
  ENV.decScale = scale;
  let tot = 0; const cs = [], drs = [];
  for (let k = 0; k < CASES.length; k++) {
    const { L, R } = renderSeq({ code: ssar, base: dataOff, entry: CASES[k].entry, sbnk, swarSamples: swar, seqVol: CASES[k].vol, maxSec: 4 });
    const mono = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) mono[i] = (L[i] + R[i]) / 2;
    const mp = prof(mono, RATE);
    const Lc = Math.max(mp.length, recs[k].p.length, 24);
    const c = pearson(resampleArr(mp, Lc), resampleArr(recs[k].p, Lc));
    const dr = (mp.length * 0.025) / (recs[k].p.length * 0.025);
    cs.push(c.toFixed(2)); drs.push(dr.toFixed(2));
    tot += c * Math.sqrt(Math.min(dr, 1 / dr));
  }
  console.log(String(scale).padEnd(9), cs.join('        '), '  ', drs.join(','), '  ', tot.toFixed(3));
  if (!best || tot > best.tot) best = { scale, tot };
}
console.log('BEST decScale:', best.scale);
