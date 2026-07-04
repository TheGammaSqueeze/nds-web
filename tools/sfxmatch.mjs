// Identify which clean firmware SWAV sample corresponds to each shipped UI sound, by
// cross-correlating the shipped wav (the correct sound, but recorded from melonDS with BGM
// bleed) against every decoded SE sample. The best onset-aligned correlation names the clean
// source, which then replaces the recording. Objective, no listening required.
import fs from 'fs';

function readWAV(path) {
  const b = fs.readFileSync(path);
  // find 'fmt ' and 'data' chunks
  let ch = 12, fmt = null, data = null;
  while (ch + 8 <= b.length) {
    const id = b.toString('latin1', ch, ch + 4), sz = b.readUInt32LE(ch + 4);
    if (id === 'fmt ') fmt = { ch: b.readUInt16LE(ch + 10), rate: b.readUInt32LE(ch + 12), bits: b.readUInt16LE(ch + 22) };
    else if (id === 'data') { data = { off: ch + 8, sz }; break; }
    ch += 8 + sz + (sz & 1);
  }
  const { ch: nch, rate, bits } = fmt, n = Math.floor(data.sz / (bits / 8) / nch);
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < nch; c++) { const p = data.off + (i * nch + c) * (bits / 8); s += bits === 16 ? b.readInt16LE(p) : (b.readUInt8(p) - 128) << 8; }
    mono[i] = s / nch / 32768;
  }
  return { rate, pcm: mono };
}

// naive linear resample to target rate
function resample(sig, from, to) {
  const n = Math.round(sig.length * to / from), out = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i * from / to, i0 = x | 0, f = x - i0; out[i] = (sig[i0] || 0) * (1 - f) + (sig[i0 + 1] || 0) * f; }
  return out;
}
// short-time energy envelope (window 64 samples)
function envelope(sig) {
  const w = 64, n = Math.ceil(sig.length / w), e = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < w; j++) { const v = sig[i * w + j] || 0; s += v * v; } e[i] = Math.sqrt(s / w); }
  const mx = Math.max(...e, 1e-9); for (let i = 0; i < n; i++) e[i] /= mx; return e;
}
// resample an envelope to a fixed length L (normalises duration to compare shape)
function fixed(env, L = 48) { const out = new Float32Array(L); for (let i = 0; i < L; i++) { const x = i * (env.length - 1) / (L - 1); const i0 = x | 0, f = x - i0; out[i] = (env[i0] || 0) * (1 - f) + (env[i0 + 1] || 0) * f; } return out; }
function pearson(a, b) { const n = a.length; let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n; let d = 0, na = 0, nb = 0; for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; d += x * y; na += x * x; nb += y * y; } return d / (Math.sqrt(na * nb) + 1e-9); }

const RATE = 16000;
const targets = process.argv.slice(2);
const seDir = '/tmp/se_wavs';
const seFiles = fs.readdirSync(seDir).filter(f => f.endsWith('.wav')).sort();
const seEnv = seFiles.map(f => { const w = readWAV(`${seDir}/${f}`); const dur = w.pcm.length / w.rate; return { f, dur, fx: fixed(envelope(resample(w.pcm, w.rate, RATE))) }; });

for (const t of targets) {
  const w = readWAV(t);
  const dur = w.pcm.length / w.rate;
  const fx = fixed(envelope(resample(w.pcm, w.rate, RATE)));
  // score = shape correlation x duration plausibility (dry SE is <= recording, similar order)
  const scored = seEnv.map(s => { const shape = pearson(fx, s.fx); const dr = Math.min(dur, s.dur) / Math.max(dur, s.dur); return { f: s.f, dur: +s.dur.toFixed(3), shape: +shape.toFixed(3), score: +(shape * Math.sqrt(dr)).toFixed(3) }; }).sort((a, b) => b.score - a.score);
  console.log(`\n${t.split('/').pop()}  (${dur.toFixed(3)}s)`);
  for (const s of scored.slice(0, 4)) console.log(`   ${s.f}  dur=${s.dur}s shape=${s.shape} score=${s.score}`);
}
