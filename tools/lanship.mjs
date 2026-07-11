// Ship the carousel/menu UI sounds rendered straight from the launcher firmware SDAT
// (assets/launcher/decoded/launcher_sound_6d501c.sdat), replacing the old melonDS recordings
// that carried BGM bleed and clipped tails. Each sound is a real named SSAR sub-sequence in
// the launcher's SAR_SE archive (or the BANK_SHUTTER archive), rendered dry by tools/serender.js,
// trimmed to its active region with a short fade, then written to webapp/public/audio/.
//
// Mapping is by the firmware's OWN symbol names (authoritative), cross-checked against the old
// recordings by envelope correlation where the recording was clean enough:
//   nav_blip   <- TWL_LAN_SE_SOFT_SCROLL   (d-pad carousel scroll)
//   app_launch <- TWL_LAN_SE_START_EFFECT  (A on a title -> launch effect; corr 0.85 vs recording)
//   boot_chime <- TWL_CMN_SE_LOGO          (boot logo chime; corr 0.57 vs recording)
//   nav_invalid<- TWL_LAN_SE_SCROLL_INVALID(scroll past the last slot)
//   grab       <- TWL_LAN_SE_SOFT_GRAB      (lift an icon in rearrange mode)
//   release    <- TWL_LAN_SE_SOFT_RELEASE   (cancel a grab)
//   set        <- TWL_LAN_SE_SOFT_SET       (drop an icon into a slot)
// All of these live in the launcher's shared SE bank, so one common gain preserves their real
// relative loudness; that gain is anchored so nav matches the old nav recording's peak (keeps
// the app's established mix balance). Old recordings are backed up to out/ref_audio/.
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { parse, fileBytes } = require('./sdat.js');
const { parseSBNK } = require('./sseq.js');
const { parseSWAR } = require('./swav.js');
const { renderSeq, RATE, ENV } = require('./serender.js');

const SRC = 'assets/launcher/decoded/launcher_sound_6d501c.sdat';
const buf = fs.readFileSync(SRC);
const sdat = parse(buf);
ENV.tpq = 48;                                          // SE player tick rate (as tools/lanrender.mjs)

// --- resolve the SAR_SE archive + its named sub-sequences from the SYMB table ---
const symbOff = buf.readUInt32LE(0x10);
const rec1 = symbOff + buf.readUInt32LE(symbOff + 8 + 4);
const readStr = rel => { if (!rel) return ''; let p = symbOff + rel, e = p; while (buf[e] !== 0) e++; return buf.toString('latin1', p, e); };
const infoOff = buf.readUInt32LE(0x18);
const arcTbl = infoOff + buf.readUInt32LE(infoOff + 8 + 4);
const arcFileId = buf.readUInt16LE(infoOff + buf.readUInt32LE(arcTbl + 4));
const ssar = fileBytes(buf, sdat, arcFileId);
const dataOff = ssar.readUInt32LE(0x18);
const sl = symbOff + buf.readUInt32LE(rec1 + 8), nSub = buf.readUInt32LE(sl);
const seByName = {};
for (let i = 0; i < nSub; i++) {
  const off = ssar.readUInt32LE(0x20 + i * 12);
  if (off === 0xffffffff) continue;
  seByName[readStr(buf.readUInt32LE(sl + 4 + i * 4))] = { off, vol: ssar[0x20 + i * 12 + 6] };
}

const sbnkSE = parseSBNK(fileBytes(buf, sdat, sdat.bank.find(b => b && b.name === 'BANK_SE').fileId));
const swarSE = parseSWAR(fileBytes(buf, sdat, sdat.wavArc.find(w => w && w.name === 'WAVE_SE').fileId));

function renderSE(name) {
  const s = seByName[name];
  if (!s) throw new Error('no SE named ' + name);
  return renderSeq({ code: ssar, base: dataOff, entry: s.off, sbnk: sbnkSE, swarSamples: swarSE, seqVol: s.vol, maxSec: 6, seed: 3 });
}

// --- WAV IO ---
function readWAV(path) {
  const b = fs.readFileSync(path);
  let ch = 12, fmt = null, data = null;
  while (ch + 8 <= b.length) { const id = b.toString('latin1', ch, ch + 4), sz = b.readUInt32LE(ch + 4); if (id === 'fmt ') fmt = { ch: b.readUInt16LE(ch + 10), rate: b.readUInt32LE(ch + 12) }; else if (id === 'data') { data = { off: ch + 8, sz }; break; } ch += 8 + sz + (sz & 1); }
  const n = Math.floor(data.sz / 2 / fmt.ch), chans = Array.from({ length: fmt.ch }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < fmt.ch; c++) chans[c][i] = b.readInt16LE(data.off + (i * fmt.ch + c) * 2) / 32768;
  return { rate: fmt.rate, chans };
}
function writeWAV(path, chans, rate) {
  const nch = chans.length, n = chans[0].length, b = Buffer.alloc(44 + n * 2 * nch);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2 * nch, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(nch, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2 * nch, 28); b.writeUInt16LE(2 * nch, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2 * nch, 40);
  for (let i = 0; i < n; i++) for (let c = 0; c < nch; c++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(chans[c][i] * 32767))), 44 + (i * nch + c) * 2);
  fs.writeFileSync(path, b);
}
const peak = chans => { let p = 0; for (const c of chans) for (let i = 0; i < c.length; i++) p = Math.max(p, Math.abs(c[i])); return p; };

// trim silence (-48 dB), keep 2 ms lead, add an 8 ms fade tail so nothing clicks off
function trim(L, R) {
  const thr = 0.004, amp = i => Math.max(Math.abs(L[i]), Math.abs(R[i]));
  let a = 0, b = L.length - 1;
  while (a < b && amp(a) < thr) a++;
  while (b > a && amp(b) < thr) b--;
  a = Math.max(0, a - (RATE * 0.002 | 0));
  b = Math.min(L.length - 1, b + (RATE * 0.008 | 0));
  const cl = L.slice(a, b + 1), cr = R.slice(a, b + 1);
  const fadeN = Math.min(RATE * 0.008 | 0, cl.length >> 2);
  for (let i = 0; i < fadeN; i++) { const g = i / fadeN; cl[cl.length - 1 - i] *= g; cr[cr.length - 1 - i] *= g; }
  return [cl, cr];
}

// file: output name. anchor: the sibling SE it borrows its gain from (new blips with no old
// recording follow nav's level so their real bank-relative loudness to nav is preserved).
const JOBS = [
  { name: 'TWL_LAN_SE_SOFT_SCROLL', file: 'nav_blip' },     // d-pad carousel scroll
  { name: 'TWL_LAN_SE_START_EFFECT', file: 'app_launch' },  // A on a title -> launch effect
  { name: 'TWL_CMN_SE_LOGO', file: 'boot_chime' },          // boot logo chime
  { name: 'TWL_LAN_SE_SCROLL_INVALID', file: 'nav_invalid', anchor: 'nav_blip' },
  { name: 'TWL_LAN_SE_SOFT_GRAB', file: 'grab', anchor: 'nav_blip' },
  { name: 'TWL_LAN_SE_SOFT_RELEASE', file: 'release', anchor: 'nav_blip' },
  { name: 'TWL_LAN_SE_SOFT_SET', file: 'set', anchor: 'nav_blip' },
];

fs.mkdirSync('out/ref_audio', { recursive: true });
// Render + trim, then level-match each replaced sound to the peak of the old recording it
// replaces (keeps the app's established per-play mix balance; the clean firmware render just
// removes the BGM bleed and clipped tail). New blips have no old recording, so they take the
// gain of their anchor SE (nav): all are SOFT_* one-shots in the same SE bank, so anchoring to
// nav preserves their true firmware relative loudness. Nothing is peak-normalized per file.
const rendered = JOBS.map(job => { const { L, R } = renderSE(job.name); const [cl, cr] = trim(L, R); return { job, cl, cr, raw: peak([cl, cr]) }; });
const gains = {};
for (const r of rendered) {
  if (r.job.anchor) continue;
  // read the ORIGINAL recording's peak from the backup (the live wav may already be a prior
  // firmware render from an earlier run); fall back to the live file on a first-ever run.
  const bak = `out/ref_audio/${r.job.file}.recording.wav`;
  const src = fs.existsSync(bak) ? bak : `webapp/public/audio/${r.job.file}.wav`;
  const oldPeak = peak(readWAV(src).chans);
  gains[r.job.file] = oldPeak / Math.max(1e-6, r.raw);
}
for (const { job, cl, cr, raw } of rendered) {
  const g = job.anchor ? gains[job.anchor] : gains[job.file];
  for (let i = 0; i < cl.length; i++) { cl[i] *= g; cr[i] *= g; }
  const dst = `webapp/public/audio/${job.file}.wav`;
  if (fs.existsSync(dst)) { const bak = `out/ref_audio/${job.file}.recording.wav`; if (!fs.existsSync(bak)) fs.copyFileSync(dst, bak); }
  writeWAV(dst, [cl, cr], RATE);
  console.log(`${job.file}.wav <- ${job.name}  (${(cl.length / RATE).toFixed(3)}s, gain x${g.toFixed(2)}, peak ${peak([cl, cr]).toFixed(3)})`);
}
