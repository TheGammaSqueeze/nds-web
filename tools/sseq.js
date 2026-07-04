// NITRO sequence tooling: SBNK instrument parsing, SSEQ/SSAR bytecode disassembly, and a
// renderer that synthesizes a sequence to PCM using the SWAR samples (tools/swav.js).
// Used to render the firmware's own UI sound effects (SSAR sub-sequences, named in the SDAT
// symbol table) and the settings BGM (TWL_SETTING_BGM.sseq) from the real data.
'use strict';
const fs = require('fs');
const { parseSWAR } = require('./swav.js');

// ---------- SBNK ----------
function parseSBNK(buf) {
  if (buf.toString('latin1', 0, 4) !== 'SBNK') throw new Error('not an SBNK');
  const n = buf.readUInt32LE(0x38);
  const instr = [];
  for (let i = 0; i < n; i++) {
    const r = 0x3C + i * 4;
    const type = buf[r];
    const off = buf.readUInt16LE(r + 1);
    if (type === 0 || off + 10 > buf.length) { instr.push(null); continue; }
    const readNote = (o) => o + 10 <= buf.length ? ({ swav: buf.readUInt16LE(o), swar: buf.readUInt16LE(o + 2), note: buf[o + 4], attack: buf[o + 5], decay: buf[o + 6], sustain: buf[o + 7], release: buf[o + 8], pan: buf[o + 9] }) : { swav: 0, swar: 0, note: 60, attack: 127, decay: 127, sustain: 127, release: 127, pan: 64 };
    if (type >= 1 && type <= 5) instr.push({ type, ...readNote(off) });
    else if (type === 16) {
      const ends = [...buf.subarray(off, off + 8)];
      const regions = [];
      let p = off + 8;
      for (let k = 0; k < 8 && ends[k] !== 0 && p + 12 <= buf.length; k++) { regions.push({ end: ends[k], sub: { type: buf.readUInt16LE(p), ...readNote(p + 2) } }); p += 12; }
      instr.push({ type, regions });
    } else if (type === 17) {
      // observed layout (launcher BANK_SE): same as type 16 - an 8-byte region-end table
      // then one 12-byte record per region (verified by hand-decoding instruments 9 and 26:
      // 2 regions fit the record span exactly; a per-note table would not fit the file)
      const ends = [...buf.subarray(off, off + 8)];
      const regions = [];
      let p = off + 8;
      for (let k = 0; k < 8 && ends[k] !== 0 && p + 12 <= buf.length; k++) { regions.push({ end: ends[k], sub: { type: buf.readUInt16LE(p), ...readNote(p + 2) } }); p += 12; }
      instr.push({ type, regions });
    } else instr.push({ type, raw: off });
  }
  return instr;
}

// resolve an instrument + note to the concrete sample definition
function resolveNote(instr, prog, note) {
  const ins = instr[prog];
  if (!ins) return null;
  if (ins.type >= 1 && ins.type <= 5) return { ...ins, itype: ins.type };
  if (ins.type === 16) { for (const r of ins.regions) if (note <= r.end) return { ...r.sub, itype: r.sub.type }; return null; }
  if (ins.type === 17) { for (const r of ins.regions) if (note <= r.end) return { ...r.sub, itype: r.sub.type }; return null; }
  return null;
}

// ---------- SSEQ bytecode ----------
function varlen(buf, p) { let v = 0; for (;;) { const b = buf[p++]; v = (v << 7) | (b & 0x7f); if (!(b & 0x80)) break; } return [v, p]; }

// disassemble from an offset; follows track opens but not jumps beyond a budget
function disasm(buf, start, maxEvents = 400) {
  const out = [];
  let p = start, n = 0;
  while (p < buf.length && n++ < maxEvents) {
    const at = p, op = buf[p++];
    if (op < 0x80) { const vel = buf[p++]; let len; [len, p] = varlen(buf, p); out.push([at, 'note', op, vel, len]); }
    else if (op === 0x80) { let w; [w, p] = varlen(buf, p); out.push([at, 'wait', w]); }
    else if (op === 0x81) { let prog; [prog, p] = varlen(buf, p); out.push([at, 'prog', prog]); }
    else if (op === 0x93) { const t = buf[p]; const off = buf.readUIntLE(p + 1, 3); p += 4; out.push([at, 'track', t, off]); }
    else if (op === 0x94) { const off = buf.readUIntLE(p, 3); p += 3; out.push([at, 'jump', off]); break; }
    else if (op === 0x95) { const off = buf.readUIntLE(p, 3); p += 3; out.push([at, 'call', off]); }
    else if (op === 0xfd) { out.push([at, 'ret']); }
    else if (op === 0xfe) { const m = buf.readUInt16LE(p); p += 2; out.push([at, 'alloc', m]); }
    else if (op === 0xff) { out.push([at, 'end']); break; }
    else if (op >= 0xc0 && op <= 0xdf) { out.push([at, 'c' + op.toString(16), buf[p++]]); }
    else if (op === 0xe0 || op === 0xe1 || op === 0xe3) { const v = buf.readUInt16LE(p); p += 2; out.push([at, 'e' + op.toString(16), v]); }
    else out.push([at, 'op' + op.toString(16)]);
  }
  return out;
}

module.exports = { parseSBNK, resolveNote, varlen, disasm };

// CLI: disassemble the named SSAR sub-sequences + dump SBNK instruments
if (require.main === module) {
  const { parse, fileBytes } = require('./sdat.js');
  const sdatBuf = fs.readFileSync(process.argv[2] || 'assets/launcher/settings_fs/sound/sound_data.sdat');
  const sdat = parse(sdatBuf);
  console.log('=== BANK_SE instruments ===');
  const sbnk = parseSBNK(fileBytes(sdatBuf, sdat, 2));
  sbnk.forEach((ins, i) => { if (ins) console.log(i, JSON.stringify(ins)); });
  console.log('\n=== SSAR named sequences ===');
  const ssar = fileBytes(sdatBuf, sdat, 1);
  const dataOff = ssar.readUInt32LE(0x18);
  // sub-names from SYMB
  const symbOff = sdatBuf.readUInt32LE(0x10);
  const rec1 = symbOff + sdatBuf.readUInt32LE(symbOff + 8 + 4);
  const readStr = rel => { if (!rel) return ''; let p = symbOff + rel, e = p; while (sdatBuf[e] !== 0) e++; return sdatBuf.toString('latin1', p, e); };
  const nArc = sdatBuf.readUInt32LE(rec1);
  const slRel = sdatBuf.readUInt32LE(rec1 + 8);
  const sl = symbOff + slRel, nSub = sdatBuf.readUInt32LE(sl);
  for (let i = 0; i < nSub; i++) {
    const name = readStr(sdatBuf.readUInt32LE(sl + 4 + i * 4));
    const r = 0x20 + i * 12, off = ssar.readUInt32LE(r);
    if (off === 0xffffffff) continue;
    console.log(`--- [${i}] ${name || '(unnamed)'} off=${off} bank=${ssar.readUInt16LE(r + 4)} vol=${ssar[r + 6]}`);
    for (const ev of disasm(ssar, dataOff + off, 40)) console.log('   ', ev.join(' '));
  }
}
