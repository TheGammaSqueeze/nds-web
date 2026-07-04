// Ship the firmware-rendered UI sounds: trim silence, level-match each to the recording it
// replaces (keeps the app's existing mix balance), 5ms fade-out, write to webapp/public/audio/
// under the same filename (zero app-code change). Old recordings are kept in out/ref_audio/.
import fs from 'fs';

const MAP = [
  ['TWL_SET_SE_PAGE_CHG', 'settings_nav'],
  ['TWL_CMN_SE_SUB_DECIDE', 'settings_enter'],
  ['TWL_CMN_SE_BACK', 'settings_back'],
  ['TWL_CMN_SE_TOUCH', 'touch_continue'],
];

function readWAV(path) {
  const b = fs.readFileSync(path);
  let ch = 12, fmt = null, data = null;
  while (ch + 8 <= b.length) { const id = b.toString('latin1', ch, ch + 4), sz = b.readUInt32LE(ch + 4); if (id === 'fmt ') fmt = { ch: b.readUInt16LE(ch + 10), rate: b.readUInt32LE(ch + 12) }; else if (id === 'data') { data = { off: ch + 8, sz }; break; } ch += 8 + sz + (sz & 1); }
  const n = Math.floor(data.sz / 2 / fmt.ch);
  const chans = Array.from({ length: fmt.ch }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < fmt.ch; c++) chans[c][i] = b.readInt16LE(data.off + (i * fmt.ch + c) * 2) / 32768;
  return { rate: fmt.rate, chans };
}
function writeWAV(path, chans, rate) {
  const nch = chans.length, n = chans[0].length;
  const b = Buffer.alloc(44 + n * 2 * nch);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2 * nch, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(nch, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2 * nch, 28); b.writeUInt16LE(2 * nch, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2 * nch, 40);
  for (let i = 0; i < n; i++) for (let c = 0; c < nch; c++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(chans[c][i] * 32767))), 44 + (i * nch + c) * 2);
  fs.writeFileSync(path, b);
}
const peakOf = chans => { let p = 0; for (const c of chans) for (let i = 0; i < c.length; i++) p = Math.max(p, Math.abs(c[i])); return p; };

fs.mkdirSync('out/ref_audio', { recursive: true });
for (const [render, target] of MAP) {
  const src = readWAV(`/tmp/se_render/${render}.wav`);
  const old = `webapp/public/audio/${target}.wav`;
  const ref = readWAV(old);
  // trim: -60 dB threshold, keep 2ms lead, add 6ms fade-out tail
  const thr = 0.001;
  let a = 0, b = src.chans[0].length - 1;
  const loud = i => Math.max(Math.abs(src.chans[0][i]), Math.abs(src.chans[1][i]));
  while (a < b && loud(a) < thr) a++;
  while (b > a && loud(b) < thr) b--;
  a = Math.max(0, a - (src.rate * 0.002 | 0)); b = Math.min(src.chans[0].length - 1, b + (src.rate * 0.006 | 0));
  const chans = src.chans.map(c => c.slice(a, b + 1));
  const fadeN = Math.min(src.rate * 0.006 | 0, chans[0].length >> 2);
  for (let i = 0; i < fadeN; i++) { const g = i / fadeN; for (const c of chans) c[c.length - 1 - i] *= g; }
  // level-match to the recording being replaced
  const g = peakOf(ref.chans) / Math.max(1e-6, peakOf(chans));
  for (const c of chans) for (let i = 0; i < c.length; i++) c[i] *= g;
  // backup old, write new
  const bak = `out/ref_audio/${target}.recording.wav`;
  if (!fs.existsSync(bak)) fs.copyFileSync(old, bak);
  writeWAV(old, chans, src.rate);
  console.log(`${target}.wav <- ${render}  (${(chans[0].length / src.rate).toFixed(3)}s, gain x${g.toFixed(2)})`);
}
