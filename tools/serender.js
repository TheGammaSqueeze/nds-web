// Render NITRO sequences (SSAR sub-sequences / SSEQ) to 48kHz stereo PCM from the real
// firmware data: SSEQ bytecode player (multi-track, waits, program/pan/volume/expression,
// ADSR overrides, tempo, calls/jumps/loops) + synthesizer over the SBNK instruments:
// PCM samples from the SWAR (via tools/swav.js), PSG square (duty from the swav field) and
// PSG noise (15-bit LFSR), with the NITRO envelope model (dB-domain: multiplicative attack
// toward 0 dB, linear-dB decay to the sustain level, linear-dB release; 192 Hz updates).
// Velocity/volume/expression use the driver's decibel-square curve (40*log10(v/127)).
'use strict';
const fs = require('fs');
const { parseSWAR } = require('./swav.js');
const { parseSBNK, resolveNote, varlen } = require('./sseq.js');

const RATE = 48000, ENVHZ = 192;
const DB_MIN = -723;                       // envelope floor, dB (driver fixed-point -92544/128)
const dbSq = v => v <= 0 ? DB_MIN : Math.max(DB_MIN, 40 * Math.log10(v / 127));
const noteHz = n => 440 * Math.pow(2, (n - 69) / 12);

// envelope rate tables (NITRO driver model)
const ATK_TBL = { 127: 0, 126: 1, 125: 5, 124: 14, 123: 26, 122: 38, 121: 51, 120: 63, 119: 73, 118: 84, 117: 92, 116: 100, 115: 109, 114: 116, 113: 123, 112: 127, 111: 132, 110: 137, 109: 143 };
const atkMul = a => (a >= 109 ? ATK_TBL[a] : 255 - a) / 255;         // dB multiplier per env frame
// decay/release rate in dB per env frame. ENV.decScale is CALIBRATED against the melonDS
// recordings (tools/secal.mjs): the table-formula rate alone kills notes ~10x too fast vs
// the real ARM7 player, and the recordings are the ground truth for the real behaviour.
const ENV = { decScale: 0.125, tpq: 48 };   // calibrated vs melonDS recording of DECIDE (corr 0.93); = rate units 1/1024 dB
const decRate = d => d === 127 ? 1e9 : (d === 126 ? 120 : d < 50 ? (d * 2 + 1) / 128 : (0x1E00 / (126 - d)) / 128) * ENV.decScale;

class Voice {
  constructor(def, note, vel, lenTicks, state, swarSamples) {
    this.state = { ...state };                    // pan/vol/expr snapshot at note-on
    this.note = note; this.velDb = dbSq(vel);
    this.lenSec = null; this.onSec = 0;           // filled by player (tick->sec)
    this.phase = 'attack'; this.env = DB_MIN; this.dead = false;
    this.atk = atkMul(state.attack !== null ? state.attack : def.attack);
    this.dec = decRate(state.decay !== null ? state.decay : def.decay);
    this.sus = dbSq(state.sustain !== null ? state.sustain : def.sustain);
    this.rel = decRate(state.release !== null ? state.release : def.release);
    this.itype = def.itype;
    if (def.itype === 1) {                        // PCM
      const s = swarSamples[def.swav];
      this.pcm = s.pcm; this.loop = s.loop; this.loopStart = Math.max(0, (s.loopStart * 4 - 4) * (s.type === 2 ? 2 : s.type === 1 ? 0.5 : 1)) | 0;
      // playback ratio: sample rate * pitch shift (incl. track pitch bend) -> output rate
      this.ratio = (s.rate * Math.pow(2, (note - def.note + (state.bendSemis || 0)) / 12)) / RATE;
      this.pos = 0;
    } else if (def.itype === 2) {                 // PSG square, swav field = duty index
      this.duty = (def.swav & 7); this.acc = 0; this.hz = noteHz(note + (state.bendSemis || 0));
    } else if (def.itype === 3) {                 // PSG noise (15-bit LFSR)
      this.lfsr = 0x7FFF; this.acc = 0; this.hz = noteHz(note) * 8; this.bit = 0;
    }
    this.pan = (state.pan !== null ? state.pan : def.pan);
  }
  sample(dt) {
    // envelope (per-sample, rates scaled from env frames)
    const fr = dt * ENVHZ;
    if (this.stopSec !== undefined && this.onSec >= this.stopSec) {
      // stolen by the 16-channel limit: quick 5ms fade like the hardware channel retrigger
      this.stealGain = (this.stealGain === undefined ? 1 : this.stealGain) - dt / 0.005;
      if (this.stealGain <= 0) { this.dead = true; return 0; }
    }
    if (this.phase === 'attack') {
      this.env = this.env * Math.pow(this.atk, fr);
      if (this.env > -0.1) { this.env = 0; this.phase = 'decay'; }
    } else if (this.phase === 'decay') {
      this.env -= this.dec * fr;
      if (this.env <= this.sus) { this.env = this.sus; this.phase = 'sustain'; }
    } else if (this.phase === 'release') {
      this.env -= this.rel * fr;
      if (this.env <= DB_MIN) { this.dead = true; return 0; }
    }
    this.onSec += dt;
    if (this.lenSec !== null && this.onSec >= this.lenSec && this.phase !== 'release') this.phase = 'release';
    let v = 0;
    if (this.itype === 1) {
      let i = this.pos | 0;
      if (i + 1 >= this.pcm.length) {
        // wrap: reset pos AND the read index - interpolating with the stale index made the
        // fraction hugely negative, emitting a ~1300x impulse every loop cycle (the shriek)
        if (this.loop) { this.pos = this.loopStart + (this.pos - i); i = this.pos | 0; }
        else { this.dead = true; return 0; }
      }
      if (this.state.modDepth > 0 && this.onSec * 1000 > (this.state.modDelay || 0)) {
        const lfo = Math.sin(2 * Math.PI * (this.state.modSpeed * 0.3125) * this.onSec);
        this.vib = Math.pow(2, lfo * (this.state.modDepth / 128) / 12);
      } else this.vib = 1;
      if (this.ratio > 1.25) {
        // pitched up: box-average over the skipped span as a cheap anti-alias low-pass.
        // The naive skip-read aliases badly (metallic sheen on high notes, +spiky peaks).
        const span = Math.min(Math.ceil(this.ratio), 8);
        let acc = 0, cnt = 0;
        for (let k = 0; k < span; k++) { const j = i + k; acc += this.pcm[j < this.pcm.length ? j : (this.loop ? this.loopStart + (j - this.pcm.length) % Math.max(1, this.pcm.length - this.loopStart) : this.pcm.length - 1)] || 0; cnt++; }
        v = acc / cnt / 32768;
      } else {
        const f = this.pos - i;
        v = ((this.pcm[i] || 0) * (1 - f) + (this.pcm[i + 1] || 0) * f) / 32768;
      }
      this.pos += this.ratio * (this.vib || 1);
    } else if (this.itype === 2) {
      this.acc += this.hz * dt; const ph = this.acc - Math.floor(this.acc);
      v = ph < (this.duty + 1) / 8 ? 0.6 : -0.6;
    } else if (this.itype === 3) {
      this.acc += this.hz * dt;
      while (this.acc >= 1) { this.acc -= 1; const b = this.lfsr & 1; this.lfsr >>= 1; if (b) { this.lfsr ^= 0x6000; this.bit = -0.6; } else this.bit = 0.6; }
      v = this.bit;
    }
    // live expression/volume automation: advance forward cursors over the track's event lanes
    let exprV = this.state.expr, volV = this.state.vol;
    if (this.track) {
      const t = this.tStart + this.onSec;
      const ea = this.track.exprAuto, va = this.track.volAuto;
      if (this._ei === undefined) { this._ei = 0; this._vi = 0; }
      while (this._ei < ea.length && ea[this._ei][0] <= t) { exprV = ea[this._ei][1]; this._ei++; }
      if (this._ei > 0) exprV = ea[this._ei - 1][1]; else if (ea.length && ea[0][0] > t) exprV = this.state.expr;
      while (this._vi < va.length && va[this._vi][0] <= t) { this._vi++; }
      if (this._vi > 0) volV = va[this._vi - 1][1];
    }
    const gDb = this.velDb + this.env + dbSq(volV) + dbSq(exprV) + this.state.extraDb;
    return v * Math.pow(10, Math.max(DB_MIN, gDb) / 40) * (this.stealGain === undefined ? 1 : Math.max(0, this.stealGain));
  }
}

// play one sequence (buf bytecode at entry, offsets relative to base) -> stereo Float32.
// Timing is TEMPO-AWARE: time accumulates per tick under the current tempo (the settings BGM
// modulates tempo continuously), and note-offs are gated by tick, not precomputed seconds.
// Implements the sequence variable ops (0xB0-0xBD), the random (0xA0) and from-var (0xA1)
// argument prefixes, and detects the master loop (the main track's backward 0x94) so the
// output can loop seamlessly: returns {L, R, rate, loopStart, loopEnd} (seconds, or null).
function renderSeq({ code, base, entry, sbnk, swarSamples, seqVol = 127, maxSec = 12, seed = 1 }) {
  const mkTrack = pc => ({ pc, wait: 0, prog: 0, pan: null, vol: 127, expr: 127, attack: null, decay: null, sustain: null, release: null, bend: 0, bendRange: 2, transpose: 0, mono: 0, lastVoice: null, loopStack: [], cond: true, modDepth: 0, modSpeed: 16, modType: 0, modDelay: 0, stack: [], done: false, jumped: false, exprAuto: [], volAuto: [] });
  const tracks = [mkTrack(base + entry)];
  let tempo = 120;
  const voices = [], gates = [];                       // gates: [{offTick, voice}]
  const vars = new Int16Array(32);
  let rngState = seed >>> 0;
  const rnd = () => { rngState = (rngState * 1664525 + 1013904223) >>> 0; return rngState / 4294967296; };
  const extraDb = dbSq(seqVol);
  const tickSec = () => 60 / (tempo * ENV.tpq);
  // pre-scan the main track for its backward jump target (the loop point)
  let mainJumpTarget = null;
  {
    let p = base + entry, guard = 0;
    while (p < code.length && guard++ < 30000) {
      const op = code[p++];
      if (op < 0x80) { p++; [, p] = varlen(code, p); }
      else if (op === 0x80 || op === 0x81) { [, p] = varlen(code, p); }
      else if (op === 0x93) p += 4;
      else if (op === 0x94) { mainJumpTarget = code[p] | (code[p + 1] << 8) | (code[p + 2] << 16); break; }
      else if (op === 0x95) p += 3;
      else if (op === 0xa0) p += 5;
      else if (op === 0xa1) p += 2;
      else if (op >= 0xb0 && op <= 0xbd) p += 3;
      else if (op >= 0xc0 && op <= 0xdf) p += 1;
      else if (op === 0xe0 || op === 0xe1 || op === 0xe3) p += 2;
      else if (op === 0xfe) p += 2;
      else if (op === 0xff) break;
    }
  }
  let timeSec = 0, loopStart = null, loopEnd = null;
  let guard = 0;
  for (let tick = 0; guard < 500000; tick++, guard++) {
    let allDone = true;
    for (let ti = 0; ti < tracks.length; ti++) {
      const tr = tracks[ti];
      if (tr.done) continue; allDone = false;
      if (tr.wait > 0) { tr.wait--; continue; }
      while (!tr.done && tr.wait === 0 && guard++ < 500000) {
        if (ti === 0 && mainJumpTarget !== null && tr.pc === base + mainJumpTarget && loopStart === null) loopStart = timeSec;
        const op = code[tr.pc++];
        // one-byte-argument commands may be wrapped by 0xA0 (random arg) / 0xA1 (arg from var)
        let realOp = op, argOverride = null;
        if (op === 0xa2) {
          // conditional: skip the next command entirely when the flag is false
          if (!tr.cond) { const nx = code[tr.pc]; tr.pc++;
            if (nx < 0x80) { tr.pc++; [, tr.pc] = varlen(code, tr.pc); }
            else if (nx === 0x80 || nx === 0x81) { [, tr.pc] = varlen(code, tr.pc); }
            else if (nx === 0x93) tr.pc += 4; else if (nx === 0x94 || nx === 0x95) tr.pc += 3;
            else if (nx >= 0xb0 && nx <= 0xbd) tr.pc += 3;
            else if (nx >= 0xc0 && nx <= 0xdf) tr.pc += 1;
            else if (nx === 0xe0 || nx === 0xe1 || nx === 0xe3) tr.pc += 2;
            continue;
          }
          realOp = code[tr.pc++];
        } else if (op === 0xa0) { realOp = code[tr.pc++]; const mn = code.readInt16LE(tr.pc), mx = code.readInt16LE(tr.pc + 2); tr.pc += 4; argOverride = Math.round(mn + rnd() * (mx - mn)); }
        else if (op === 0xa1) { realOp = code[tr.pc++]; argOverride = vars[code[tr.pc++] & 31]; }
        const arg1 = () => { if (argOverride !== null) return argOverride; return code[tr.pc++]; };
        const argVar = () => { if (argOverride !== null) return argOverride; let v; [v, tr.pc] = varlen(code, tr.pc); return v; };
        if (realOp === undefined) { tr.done = true; break; }
        if (realOp < 0x80) {
          const vel = code[tr.pc++]; const len = argVar();
          const noteNum = realOp + tr.transpose;
          const def = resolveNote(sbnk, tr.prog, noteNum);
          if (def) {
            const v = new Voice(def, noteNum, vel, len, { pan: tr.pan, vol: tr.vol, expr: tr.expr, attack: tr.attack, decay: tr.decay, sustain: tr.sustain, release: tr.release, extraDb, bendSemis: tr.bend * tr.bendRange / 128, modDepth: tr.modDepth, modSpeed: tr.modSpeed, modDelay: tr.modDelay }, swarSamples);
            v.lenSec = null; v.tStart = timeSec;               // gated by tick below
            v.track = tr;
            if (tr.mono && tr.lastVoice && tr.lastVoice.lenSec === null) { tr.lastVoice.lenSec = timeSec - tr.lastVoice.tStart; tr.lastVoice.relEnd = timeSec + 90 / Math.max(1e-3, tr.lastVoice.rel * 192); }
            tr.lastVoice = v;
            // 16-channel hardware limit: steal the oldest still-sounding voice
            const sounding = voices.filter(x => x.stopAt === undefined && (x.relEnd === undefined || x.relEnd > timeSec));
            if (sounding.length >= 16) {
              const oldest = sounding.reduce((a, b) => a.tStart <= b.tStart ? a : b);
              oldest.stopAt = timeSec; oldest.stopSec = Math.max(0, timeSec - oldest.tStart);
            }
            voices.push(v); gates.push({ offTick: tick + len, v });
          }
        }
        else if (realOp === 0x80) { tr.wait = argVar(); }
        else if (realOp === 0x81) { tr.prog = argVar(); }
        else if (realOp === 0x93) { const off = code[tr.pc + 1] | (code[tr.pc + 2] << 8) | (code[tr.pc + 3] << 16); tr.pc += 4; tracks.push(mkTrack(base + off)); }
        else if (realOp === 0x94) {
          const off = code[tr.pc] | (code[tr.pc + 1] << 8) | (code[tr.pc + 2] << 16); tr.pc += 3;
          tr.jumps = (tr.jumps || 0) + 1;
          if (ti === 0 && off === mainJumpTarget) {
            // master loop: render TWO passes. Pass 2 carries pass 1's ringing voices across
            // the boundary, so the loop region [loopStart, loopEnd] is seamless.
            if (loopStart === null || loopStart === 0) { loopStart = timeSec; tr.pc = base + off; }
            else { loopEnd = timeSec; for (const t2 of tracks) t2.done = true; }
          } else if (tr.jumps <= 3) tr.pc = base + off;        // forward jumps (SE echo tracks) follow
          else tr.done = true;
        }
        else if (realOp === 0x95) { const off = code[tr.pc] | (code[tr.pc + 1] << 8) | (code[tr.pc + 2] << 16); tr.pc += 3; tr.stack.push(tr.pc); tr.pc = base + off; }
        else if (realOp === 0xfd) { tr.pc = tr.stack.pop() ?? code.length; }
        else if (realOp === 0xfe) { tr.pc += 2; }
        else if (realOp === 0xff) { tr.done = true; }
        else if (realOp === 0xc0) tr.pan = arg1();
        else if (realOp === 0xc1) { tr.vol = arg1(); tr.volAuto.push([timeSec, tr.vol]); }
        else if (realOp === 0xc3) { const b = arg1(); tr.transpose = b > 127 ? b - 256 : b; }
        else if (realOp === 0xc4) { const b = arg1(); tr.bend = b > 127 ? b - 256 : b; }
        else if (realOp === 0xc5) tr.bendRange = arg1();
        else if (realOp === 0xc7) tr.mono = arg1();
        else if (realOp === 0xca) tr.modDepth = arg1();
        else if (realOp === 0xcb) tr.modSpeed = arg1();
        else if (realOp === 0xcc) tr.modType = arg1();
        else if (realOp === 0xcd) tr.pc0 = arg1();
        else if (realOp === 0xd0) tr.attack = arg1();
        else if (realOp === 0xd1) tr.decay = arg1();
        else if (realOp === 0xd2) tr.sustain = arg1();
        else if (realOp === 0xd3) tr.release = arg1();
        else if (realOp === 0xd4) { tr.loopStack.push({ pc: tr.pc + (argOverride !== null ? 0 : 1), count: argOverride !== null ? argOverride : code[tr.pc], done: 0 }); if (argOverride === null) tr.pc++; }
        else if (realOp === 0xfc) { const l = tr.loopStack[tr.loopStack.length - 1]; if (l) { l.done++; if (l.count === 0 ? l.done < 3 : l.done < l.count) tr.pc = l.pc; else tr.loopStack.pop(); } }
        else if (realOp === 0xd5) { tr.expr = arg1(); tr.exprAuto.push([timeSec, tr.expr]); }
        else if (realOp >= 0xb8 && realOp <= 0xbd) {
          const vi = code[tr.pc] & 31; const val = code.readInt16LE(tr.pc + 1); tr.pc += 3;
          const x = vars[vi];
          tr.cond = realOp === 0xb8 ? x === val : realOp === 0xb9 ? x >= val : realOp === 0xba ? x > val : realOp === 0xbb ? x <= val : realOp === 0xbc ? x < val : x !== val;
        }
        else if (realOp === 0xe1) { tempo = (argOverride !== null) ? argOverride : code.readUInt16LE(tr.pc); if (argOverride === null) tr.pc += 2; }
        else if (realOp >= 0xb0 && realOp <= 0xb7) {
          const vi = code[tr.pc] & 31; const val = code.readInt16LE(tr.pc + 1); tr.pc += 3;
          if (realOp === 0xb0) vars[vi] = val;
          else if (realOp === 0xb1) vars[vi] += val;
          else if (realOp === 0xb2) vars[vi] -= val;
          else if (realOp === 0xb3) vars[vi] *= val;
          else if (realOp === 0xb4) vars[vi] = val ? (vars[vi] / val) | 0 : 0;
          else if (realOp === 0xb5) vars[vi] = val >= 0 ? vars[vi] << val : vars[vi] >> -val;
          else if (realOp === 0xb6) vars[vi] = Math.round(rnd() * val);
        }
        else if (realOp >= 0xc2 && realOp <= 0xcf) { if (argOverride === null) tr.pc++; }
        else if (realOp === 0xd4 || realOp === 0xd6) { if (argOverride === null) tr.pc++; }
        else if (realOp === 0xe0 || realOp === 0xe3) { if (argOverride === null) tr.pc += 2; }
        else if (realOp === 0xfc) { /* loop end marker */ }
      }
    }
    // gate note-offs scheduled for this tick (convert to absolute seconds now, under real tempo)
    for (const g of gates) if (g.offTick === tick && g.v.lenSec === null) {
      g.v.lenSec = timeSec - g.v.tStart;
      // ring-out estimate for the 16-channel steal pool: 90 dB at the release rate
      g.v.relEnd = timeSec + 90 / Math.max(1e-3, g.v.rel * 192);
    }
    if (allDone) break;
    timeSec += tickSec();
    if (timeSec > maxSec) break;
  }
  for (const g of gates) if (g.v.lenSec === null) g.v.lenSec = Math.max(0.01, timeSec - g.v.tStart);
  // total length: to loopEnd exactly if looping (seamless), else last gate + tail
  let total;
  if (loopEnd !== null) total = loopEnd;
  else { total = 0.05; for (const v of voices) total = Math.max(total, v.tStart + (v.lenSec || 0) + 3); total = Math.min(total, maxSec); }
  const n = Math.ceil(total * RATE), L = new Float32Array(n), R = new Float32Array(n);
  const dt = 1 / RATE;
  for (const v of voices) {
    const s0 = Math.floor(v.tStart * RATE);
    const pan = (v.pan === null ? 64 : v.pan) / 127;
    const gl = Math.cos(pan * Math.PI / 2), gr = Math.sin(pan * Math.PI / 2);
    for (let i = s0; i < n && !v.dead; i++) { const s = v.sample(dt); L[i] += s * gl; R[i] += s * gr; }
  }
  return { L, R, rate: RATE, loopStart, loopEnd: loopEnd !== null ? total : null };
}

function writeWavStereo(path, L, R, rate) {
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  // normalize only if clipping
  let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = peak > 0.99 ? 0.99 / peak : 1;
  for (let i = 0; i < n; i++) { buf.writeInt16LE(Math.round(L[i] * g * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(R[i] * g * 32767), 46 + i * 4); }
  fs.writeFileSync(path, buf);
}

module.exports = { renderSeq, writeWavStereo, RATE, ENV };

// CLI: render all named SSAR sub-sequences to /tmp/se_render/
if (require.main === module) {
  const { parse, fileBytes } = require('./sdat.js');
  const sdatBuf = fs.readFileSync('assets/launcher/settings_fs/sound/sound_data.sdat');
  const sdat = parse(sdatBuf);
  const sbnk = parseSBNK(fileBytes(sdatBuf, sdat, 2));                 // BANK_SE
  const swarSamples = parseSWAR(fileBytes(sdatBuf, sdat, 4));          // WAVE_SE
  const ssar = fileBytes(sdatBuf, sdat, 1);
  const dataOff = ssar.readUInt32LE(0x18);
  const symbOff = sdatBuf.readUInt32LE(0x10);
  const rec1 = symbOff + sdatBuf.readUInt32LE(symbOff + 8 + 4);
  const readStr = rel => { if (!rel) return ''; let p = symbOff + rel, e = p; while (sdatBuf[e] !== 0) e++; return sdatBuf.toString('latin1', p, e); };
  const sl = symbOff + sdatBuf.readUInt32LE(rec1 + 8), nSub = sdatBuf.readUInt32LE(sl);
  fs.mkdirSync('/tmp/se_render', { recursive: true });
  for (let i = 0; i < nSub; i++) {
    const r = 0x20 + i * 12, off = ssar.readUInt32LE(r);
    if (off === 0xffffffff) continue;
    const name = readStr(sdatBuf.readUInt32LE(sl + 4 + i * 4)) || ('se' + i);
    const { L, R } = renderSeq({ code: ssar, base: dataOff, entry: off, sbnk, swarSamples, seqVol: ssar[r + 6], maxSec: 6 });
    const secs = (L.length / RATE).toFixed(2);
    writeWavStereo(`/tmp/se_render/${name}.wav`, L, R, RATE);
    console.log(name, secs + 's');
  }
}
