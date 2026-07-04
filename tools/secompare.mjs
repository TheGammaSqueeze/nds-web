// Verify the firmware-rendered SEs against the melonDS recordings: trim silence from both,
// compare duration + fixed-length energy-envelope correlation. High agreement validates the
// synth (envelope model, PSG, mixing) AND the name mapping before anything ships.
import fs from 'fs';

function readWAV(path) {
  const b = fs.readFileSync(path);
  let ch = 12, fmt = null, data = null;
  while (ch + 8 <= b.length) {
    const id = b.toString('latin1', ch, ch + 4), sz = b.readUInt32LE(ch + 4);
    if (id === 'fmt ') fmt = { ch: b.readUInt16LE(ch + 10), rate: b.readUInt32LE(ch + 12), bits: b.readUInt16LE(ch + 22) };
    else if (id === 'data') { data = { off: ch + 8, sz }; break; }
    ch += 8 + sz + (sz & 1);
  }
  const n = Math.floor(data.sz / (fmt.bits / 8) / fmt.ch);
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let c = 0; c < fmt.ch; c++) s += b.readInt16LE(data.off + (i * fmt.ch + c) * 2); mono[i] = s / fmt.ch / 32768; }
  return { rate: fmt.rate, pcm: mono };
}
function trim(w, thrDb = -46) {
  const thr = Math.pow(10, thrDb / 20);
  let a = 0, b = w.pcm.length - 1;
  while (a < b && Math.abs(w.pcm[a]) < thr) a++;
  while (b > a && Math.abs(w.pcm[b]) < thr) b--;
  return { rate: w.rate, pcm: w.pcm.subarray(a, b + 1) };
}
function envFixed(w, L = 64) {
  const n = w.pcm.length, out = new Float32Array(L);
  for (let i = 0; i < L; i++) {
    const lo = Math.floor(i * n / L), hi = Math.max(lo + 1, Math.floor((i + 1) * n / L));
    let s = 0; for (let j = lo; j < hi; j++) s += w.pcm[j] * w.pcm[j];
    out[i] = Math.sqrt(s / (hi - lo));
  }
  const mx = Math.max(...out, 1e-9); for (let i = 0; i < L; i++) out[i] /= mx;
  return out;
}
const pearson = (a, b) => { const n = a.length; let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n; let d = 0, na = 0, nb = 0; for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; d += x * y; na += x * x; nb += y * y; } return d / (Math.sqrt(na * nb) + 1e-9); };

const RENDERS = fs.readdirSync('/tmp/se_render').filter(f => f.endsWith('.wav'));
const RECS = ['settings_nav', 'settings_enter', 'settings_back', 'nav_blip', 'touch_continue'];
const rend = RENDERS.map(f => { const t = trim(readWAV('/tmp/se_render/' + f)); return { name: f.replace('.wav', ''), dur: t.pcm.length / t.rate, env: envFixed(t) }; });
console.log('recording        dur    best matches (render : shapeCorr / dur)');
for (const rn of RECS) {
  const t = trim(readWAV(`webapp/public/audio/${rn}.wav`));
  const dur = t.pcm.length / t.rate, env = envFixed(t);
  const scored = rend.map(r => { const dr = Math.min(dur, r.dur) / Math.max(dur, r.dur); return { n: r.name, c: pearson(env, r.env), dr, score: pearson(env, r.env) * Math.sqrt(dr), rdur: r.dur }; }).sort((a, b) => b.score - a.score);
  console.log(rn.padEnd(16), dur.toFixed(3) + 's');
  for (const s of scored.slice(0, 3)) console.log('   ', s.n.padEnd(28), 'corr=' + s.c.toFixed(2), 'dur=' + s.rdur.toFixed(3) + 's', 'score=' + s.score.toFixed(2));
}
