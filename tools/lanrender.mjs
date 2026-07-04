// Render the LAUNCHER's sounds from the carved in-RAM SDAT (assets/launcher/decoded/
// launcher_sound_6d501c.sdat): TWL_LAN_BGM_MAIN (the carousel music, two-pass loop) and the
// named SAR_SE effects (nav scroll, launch, grab/release/set, boot logo chime, ...).
// BGM tick rate is chosen by the caller (verified vs the melonDS idle-menu recording).
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { parse, fileBytes } = require('./sdat.js');
const { parseSBNK } = require('./sseq.js');
const { parseSWAR } = require('./swav.js');
const { renderSeq, writeWavStereo, RATE, ENV } = require('./serender.js');

const SRC = 'assets/launcher/decoded/launcher_sound_6d501c.sdat';
const buf = fs.readFileSync(SRC);
const sdat = parse(buf);
const mode = process.argv[2] || 'se';

if (mode === 'bgm') {
  ENV.tpq = +(process.argv[3] || 64);
  const seqInfo = sdat.seq.filter(Boolean)[0];                   // TWL_LAN_BGM_MAIN
  const bank = sdat.bank[seqInfo.bankId];                        // BANK_LANCH_BGM
  const sbnk = parseSBNK(fileBytes(buf, sdat, bank.fileId));
  const swar = parseSWAR(fileBytes(buf, sdat, sdat.wavArc[bank.wavArc[0]].fileId));   // WAVE_BGM
  const sseq = fileBytes(buf, sdat, seqInfo.fileId);
  const dataOff = sseq.readUInt32LE(0x18);
  const t0 = Date.now();
  const { L, R, loopStart, loopEnd } = renderSeq({ code: sseq, base: dataOff, entry: 0, sbnk, swarSamples: swar, seqVol: seqInfo.vol, maxSec: 900, seed: 7 });
  console.log(`BGM tpq=${ENV.tpq}: ${(L.length / RATE).toFixed(2)}s in ${((Date.now() - t0) / 1000).toFixed(0)}s, loop [${loopStart && loopStart.toFixed(2)} .. ${loopEnd && loopEnd.toFixed(2)}] pass=${loopStart !== null && loopEnd !== null ? (loopEnd - loopStart).toFixed(2) : '?'}s`);
  writeWavStereo(`/tmp/lan_bgm_tpq${ENV.tpq}.wav`, L, R, RATE);
  fs.writeFileSync(`/tmp/lan_bgm_tpq${ENV.tpq}.json`, JSON.stringify({ loopStart, loopEnd }));
} else {
  // SAR_SE sub-sequences (tpq 48 - calibrated for the SE player)
  ENV.tpq = 48;
  const symbOff = buf.readUInt32LE(0x10);
  const rec1 = symbOff + buf.readUInt32LE(symbOff + 8 + 4);
  const readStr = rel => { if (!rel) return ''; let p = symbOff + rel, e = p; while (buf[e] !== 0) e++; return buf.toString('latin1', p, e); };
  // INFO SEQARC 0 -> fileId
  const infoOff = buf.readUInt32LE(0x18);
  const arcTbl = infoOff + buf.readUInt32LE(infoOff + 8 + 4);
  const arcFileId = buf.readUInt16LE(infoOff + buf.readUInt32LE(arcTbl + 4));
  const ssar = fileBytes(buf, sdat, arcFileId);
  if (ssar.toString('latin1', 0, 4) !== 'SSAR') throw new Error('SEQARC0 fileId wrong: ' + ssar.toString('latin1', 0, 4));
  const dataOff = ssar.readUInt32LE(0x18);
  const sbnkSE = parseSBNK(fileBytes(buf, sdat, sdat.bank.filter(Boolean).find(b => b.name === 'BANK_SE').fileId));
  const swarSE = parseSWAR(fileBytes(buf, sdat, sdat.wavArc.filter(Boolean).find(w => w.name === 'WAVE_SE').fileId));
  const sl = symbOff + buf.readUInt32LE(rec1 + 8), nSub = buf.readUInt32LE(sl);
  fs.mkdirSync('/tmp/lan_se', { recursive: true });
  for (let i = 0; i < nSub; i++) {
    const r = 0x20 + i * 12, off = ssar.readUInt32LE(r);
    if (off === 0xffffffff) continue;
    const name = readStr(buf.readUInt32LE(sl + 4 + i * 4)) || ('se' + i);
    const { L, R } = renderSeq({ code: ssar, base: dataOff, entry: off, sbnk: sbnkSE, swarSamples: swarSE, seqVol: ssar[r + 6], maxSec: 8, seed: 3 });
    writeWavStereo(`/tmp/lan_se/${name}.wav`, L, R, RATE);
    console.log(name, (L.length / RATE).toFixed(2) + 's');
  }
}
