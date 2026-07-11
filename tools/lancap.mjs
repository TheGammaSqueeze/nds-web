// Capture the carousel/menu sound effects DRY from the real firmware, by muting the launcher
// BGM at the SPU (headless melonDS `spumutesrc`, which drops every voice whose sample source is
// in the WAVE_BGM region 0x2700000+) and triggering each effect. What is left in the mix is only
// the effect, played by the real ARM7 sound driver on free voices - the authoritative sound, with
// no BGM bleed and no re-synthesis. This supersedes the serender/lanship synth for these effects.
//
// WAVE_SE loads below 0x2700000 and WAVE_BGM at/above it (found by diffing SPU channel source
// addresses during idle vs during an effect), so the BGM region mute never touches an effect, and
// a BGM voice stolen by an effect auto-unmutes the instant its source switches to the SE sample.
//
// Pipeline per effect: run a deterministic script -> read session.wav at the effect's mark ->
// trim to the active region -> short fade -> level-match to the old recording it replaces (keeps
// the app's per-play mix balance) -> write webapp/public/audio/<name>.wav. Old files backed up.
import fs from 'fs';
import { execFileSync } from 'child_process';

const EMU = 'melonDS/build-headless/melonds-headless';
const BIOS = 'bin/dsi';
const MUTE = 'spumutesrc 2700000 2A000000';   // mute the WAVE_BGM region, keep the WAVE_SE region
const PREFIX = `frame 640\ntap 128 96\nframe 1000\n${MUTE}\nwait 30\n`;

// Each job: the input that triggers the effect (after the common prefix), the mark name, the
// output file, and the effect it replaces for level-matching. `nav` is the gain anchor for the
// new effects that never had a recording (they are sibling WAVE_SE one-shots at real relative
// level, so anchoring their gain to nav preserves the firmware's loudness between them).
const JOBS = [
  { out: 'nav_blip',    mark: 'nav',    match: 'nav_blip',   body: 'mark nav\nkey RIGHT\nwait 2\nunkey RIGHT\nwait 80\n' },
  { out: 'app_launch',  mark: 'launch', match: 'app_launch', body: 'mark launch\nkey A\nwait 2\nunkey A\nwait 130\n' },
  { out: 'grab',        mark: 'grab',   match: null, anchor: 'nav_blip', body: 'mark grab\nkey UP\nwait 2\nunkey UP\nwait 80\n' },
  { out: 'set',         mark: 'set',    match: null, anchor: 'nav_blip', body: 'mark grab\nkey UP\nwait 2\nunkey UP\nwait 80\nmark set\nkey A\nwait 2\nunkey A\nwait 90\n' },
];

function readSession(dir) {
  const b = fs.readFileSync(dir + '/session.wav');
  let ch = 12, data = null;
  while (ch + 8 <= b.length) { const id = b.toString('latin1', ch, ch + 4), sz = b.readUInt32LE(ch + 4); if (id === 'data') { data = { off: ch + 8, sz }; break; } ch += 8 + sz + (sz & 1); }
  const n = (data.sz / 4) | 0, L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = b.readInt16LE(data.off + i * 4) / 32768; R[i] = b.readInt16LE(data.off + i * 4 + 2) / 32768; }
  return { L, R, n };
}
function markSample(dir, name) {
  for (const line of fs.readFileSync(dir + '/marks.csv', 'utf8').trim().split('\n')) {
    const [lbl, , smp] = line.split(',');
    if (lbl === name) return +smp;
  }
  throw new Error('mark not found: ' + name);
}
function peak(L, R, a = 0, b = L.length) { let p = 0; for (let i = a; i < b; i++) p = Math.max(p, Math.abs(L[i]), Math.abs(R[i])); return p; }
function readWavPeak(path) {
  const b = fs.readFileSync(path);
  let ch = 12, fmt = null, data = null;
  while (ch + 8 <= b.length) { const id = b.toString('latin1', ch, ch + 4), sz = b.readUInt32LE(ch + 4); if (id === 'fmt ') fmt = { ch: b.readUInt16LE(ch + 10) }; else if (id === 'data') { data = { off: ch + 8, sz }; break; } ch += 8 + sz + (sz & 1); }
  const n = (data.sz / 2 / fmt.ch) | 0; let p = 0;
  for (let i = 0; i < n; i++) for (let c = 0; c < fmt.ch; c++) p = Math.max(p, Math.abs(b.readInt16LE(data.off + (i * fmt.ch + c) * 2) / 32768));
  return p;
}
function writeWAV(path, L, R, rate = 48000) {
  const n = L.length, b = Buffer.alloc(44 + n * 4);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 4, 40);
  const cl = v => Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  for (let i = 0; i < n; i++) { b.writeInt16LE(cl(L[i]), 44 + i * 4); b.writeInt16LE(cl(R[i]), 46 + i * 4); }
  fs.writeFileSync(path, b);
}

const RATE = 48000, TMP = '/tmp/lancap';
fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync('out/ref_audio', { recursive: true });

// stage 1: run each job, extract + trim the effect at its mark, keep raw (pre-gain)
const staged = [];
for (const job of JOBS) {
  const scr = TMP + '/' + job.out + '.txt';
  fs.writeFileSync(scr, PREFIX + job.body);
  const dir = TMP + '/' + job.out; fs.mkdirSync(dir, { recursive: true });
  execFileSync(EMU, [BIOS, dir, scr], { stdio: 'ignore' });
  const s = readSession(dir), m = markSample(dir, job.mark);
  // find onset (>thr) after the mark, and the end (last sample >thr within 1.5s)
  const thr = 0.0015, lo = m, hi = Math.min(s.n, m + RATE * 1.5 | 0);
  let a = lo; while (a < hi && Math.max(Math.abs(s.L[a]), Math.abs(s.R[a])) < thr) a++;
  let b = hi - 1; while (b > a && Math.max(Math.abs(s.L[b]), Math.abs(s.R[b])) < thr) b--;
  a = Math.max(lo, a - (RATE * 0.003 | 0)); b = Math.min(hi - 1, b + (RATE * 0.010 | 0));
  const cl = s.L.slice(a, b + 1), cr = s.R.slice(a, b + 1);
  const fadeN = Math.min(RATE * 0.010 | 0, cl.length >> 2);
  for (let i = 0; i < fadeN; i++) { const g = i / fadeN; cl[cl.length - 1 - i] *= g; cr[cr.length - 1 - i] *= g; }
  staged.push({ job, cl, cr, raw: peak(cl, cr) });
  console.log(`captured ${job.out}: ${(cl.length / RATE).toFixed(3)}s raw peak ${peak(cl, cr).toFixed(4)}`);
}

// stage 2: level-match. Matched effects go to their old recording's peak; anchored (new) effects
// take the anchor effect's gain so their real firmware loudness relative to the anchor is kept.
const gains = {};
for (const st of staged) {
  if (!st.job.match) continue;
  const bak = `out/ref_audio/${st.job.out}.recording.wav`;
  const src = fs.existsSync(bak) ? bak : `webapp/public/audio/${st.job.out}.wav`;
  gains[st.job.out] = readWavPeak(src) / Math.max(1e-6, st.raw);
}
for (const st of staged) {
  const g = st.job.match ? gains[st.job.out] : gains[st.job.anchor];
  for (let i = 0; i < st.cl.length; i++) { st.cl[i] *= g; st.cr[i] *= g; }
  const dst = `webapp/public/audio/${st.job.out}.wav`;
  if (fs.existsSync(dst)) { const bak = `out/ref_audio/${st.job.out}.recording.wav`; if (!fs.existsSync(bak)) fs.copyFileSync(dst, bak); }
  writeWAV(dst, st.cl, st.cr);
  console.log(`${st.job.out}.wav  gain x${g.toFixed(2)}  peak ${peak(st.cl, st.cr).toFixed(3)}  ${(st.cl.length / RATE).toFixed(3)}s`);
}
