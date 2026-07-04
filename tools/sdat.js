// SDAT container reader for the DSi firmware sound archives. Parses the SDAT header,
// SYMB (symbol/name) block, INFO (record tables), and FAT (file allocation), then can
// extract the embedded SSEQ (sequence), SBNK (bank) and SWAR (wave archive) files, and
// resolve which bank + wave archives each sequence uses. First stage of rendering the
// real menu/settings BGM. No guessing:
// offsets and record layouts follow the documented NITRO SDAT format, verified by the
// FOURCC magics of the container and every extracted sub-file.
'use strict';
const fs = require('fs');
const path = require('path');

function fourcc(buf, off) { return buf.toString('latin1', off, off + 4); }

function parse(buf) {
  if (fourcc(buf, 0) !== 'SDAT') throw new Error('not an SDAT (magic ' + fourcc(buf, 0) + ')');
  const nBlocks = buf.readUInt16LE(0x0e);
  const blk = {};
  const names4 = ['SYMB', 'INFO', 'FAT', 'FILE'];
  for (let i = 0; i < Math.min(nBlocks, 4); i++) {
    blk[names4[i]] = { off: buf.readUInt32LE(0x10 + i * 8), size: buf.readUInt32LE(0x14 + i * 8) };
  }

  // --- FAT: fileId -> {offset,size} ---
  const fatOff = blk.FAT.off;
  if (fourcc(buf, fatOff) !== 'FAT ') throw new Error('bad FAT magic');
  const nFiles = buf.readUInt32LE(fatOff + 8);
  const files = [];
  for (let i = 0; i < nFiles; i++) {
    const r = fatOff + 12 + i * 16;
    files.push({ offset: buf.readUInt32LE(r), size: buf.readUInt32LE(r + 4) });
  }

  // --- SYMB: names per record type ---
  const RECORDS = ['SEQ', 'SEQARC', 'BANK', 'WAVARC', 'PLAYER', 'GROUP', 'PLAYER2', 'STRM'];
  const names = {};
  if (blk.SYMB) {
    const sOff = blk.SYMB.off;
    if (fourcc(buf, sOff) !== 'SYMB') throw new Error('bad SYMB magic');
    for (let t = 0; t < 8; t++) {
      const tblRel = buf.readUInt32LE(sOff + 8 + t * 4);
      names[RECORDS[t]] = [];
      if (!tblRel) continue;
      const tbl = sOff + tblRel;
      const cnt = buf.readUInt32LE(tbl);
      for (let i = 0; i < cnt; i++) {
        const strRel = buf.readUInt32LE(tbl + 4 + i * 4);
        if (!strRel) { names[RECORDS[t]].push(''); continue; }
        let p = sOff + strRel, e = p; while (buf[e] !== 0 && e < buf.length) e++;
        names[RECORDS[t]].push(buf.toString('latin1', p, e));
      }
    }
  }

  // --- INFO: record tables ---
  const iOff = blk.INFO.off;
  if (fourcc(buf, iOff) !== 'INFO') throw new Error('bad INFO magic');
  const infoTable = t => {
    const rel = buf.readUInt32LE(iOff + 8 + t * 4); const tbl = iOff + rel;
    const cnt = buf.readUInt32LE(tbl); const rows = [];
    for (let i = 0; i < cnt; i++) { const rr = buf.readUInt32LE(tbl + 4 + i * 4); rows.push(rr ? iOff + rr : 0); }
    return rows;
  };
  // SEQ record: fileId u16, fileId2 u16(pad/unk), bankId u16, vol u8, cpr u8, ppr u8, poly u8
  const seq = infoTable(0).map((o, i) => o ? { name: names.SEQ && names.SEQ[i], fileId: buf.readUInt16LE(o), bankId: buf.readUInt16LE(o + 4), vol: buf[o + 6] } : null);
  // BANK record: fileId u16, then 4 waveArc ids u16
  const bank = infoTable(2).map((o, i) => o ? { name: names.BANK && names.BANK[i], fileId: buf.readUInt16LE(o), wavArc: [0, 1, 2, 3].map(k => buf.readUInt16LE(o + 4 + k * 2)).filter(v => v !== 0xffff) } : null);
  // WAVARC record: fileId u16
  const wavArc = infoTable(3).map((o, i) => o ? { name: names.WAVARC && names.WAVARC[i], fileId: buf.readUInt16LE(o) } : null);

  return { blk, files, names, seq, bank, wavArc };
}

function fileBytes(buf, sdat, fileId) {
  const f = sdat.files[fileId];
  return buf.subarray(f.offset, f.offset + f.size);
}

module.exports = { parse, fileBytes, fourcc };

if (require.main === module) {
  const src = process.argv[2] || 'assets/launcher/settings_fs/sound/sound_data.sdat';
  const outDir = process.argv[3];
  const buf = fs.readFileSync(src);
  const sdat = parse(buf);
  console.log('SDAT', src, '- files:', sdat.files.length);
  console.log('SEQ:'); sdat.seq.filter(Boolean).forEach(s => console.log('  ', JSON.stringify(s), 'magic=' + fourcc(fileBytes(buf, sdat, s.fileId), 0)));
  console.log('BANK:'); sdat.bank.filter(Boolean).forEach(b => console.log('  ', JSON.stringify(b), 'magic=' + fourcc(fileBytes(buf, sdat, b.fileId), 0)));
  console.log('WAVARC:'); sdat.wavArc.filter(Boolean).forEach(w => console.log('  ', JSON.stringify(w), 'magic=' + fourcc(fileBytes(buf, sdat, w.fileId), 0)));
  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    const dump = (rec, ext) => rec.filter(Boolean).forEach(r => { const b = fileBytes(buf, sdat, r.fileId); const nm = (r.name || ('id' + r.fileId)).replace(/[^\w.-]/g, '_'); fs.writeFileSync(path.join(outDir, `${nm}.${ext}`), b); });
    dump(sdat.seq, 'sseq'); dump(sdat.bank, 'sbnk'); dump(sdat.wavArc, 'swar');
    console.log('extracted SSEQ/SBNK/SWAR ->', outDir);
  }
}
