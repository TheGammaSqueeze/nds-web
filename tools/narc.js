// NARC archive extractor. Usage: node narc.js <in.narc> <outdir>
const fs = require('fs');
const path = require('path');

function parseNarc(buf) {
  if (buf.toString('latin1', 0, 4) !== 'NARC') throw new Error('not NARC');
  let pos = 0x10;
  let btaf, btnf, gmifDataOff;
  // BTAF
  if (buf.toString('latin1', pos, pos + 4) !== 'BTAF') throw new Error('no BTAF');
  const btafSize = buf.readUInt32LE(pos + 4);
  const numFiles = buf.readUInt16LE(pos + 8);
  const fat = [];
  let p = pos + 0x0C;
  for (let i = 0; i < numFiles; i++) { fat.push([buf.readUInt32LE(p), buf.readUInt32LE(p + 4)]); p += 8; }
  pos += btafSize;
  // BTNF
  if (buf.toString('latin1', pos, pos + 4) !== 'BTNF') throw new Error('no BTNF');
  const btnfSize = buf.readUInt32LE(pos + 4);
  const btnfStart = pos;
  pos += btnfSize;
  // GMIF
  if (buf.toString('latin1', pos, pos + 4) !== 'GMIF') throw new Error('no GMIF');
  const gmifData = pos + 8;

  // parse names from BTNF (NDS FNT). Root subtable at btnfStart+8.
  const names = [];
  // main table entry 0
  const mainOff = btnfStart + 8;
  const subOff = buf.readUInt32LE(mainOff);
  let sp = mainOff + subOff;
  let fileId = 0;
  // only handle a single (root) directory of named files (typical for these NARCs)
  while (true) {
    const t = buf[sp++];
    if (t === 0 || t === undefined) break;
    const len = t & 0x7F;
    const isDir = (t & 0x80) !== 0;
    const name = buf.toString('latin1', sp, sp + len); sp += len;
    if (isDir) { sp += 2; names.push({ id: fileId, name, dir: true }); }
    else { names.push({ id: fileId, name }); fileId++; }
  }

  const files = fat.map(([s, e], i) => {
    const nm = names.find(n => n.id === i && !n.dir);
    return { id: i, name: nm ? nm.name : `file_${i}.bin`, data: buf.subarray(gmifData + s, gmifData + e) };
  });
  return files;
}

const buf = fs.readFileSync(process.argv[2]);
const outdir = process.argv[3];
fs.mkdirSync(outdir, { recursive: true });
const files = parseNarc(buf);
for (const f of files) {
  fs.writeFileSync(path.join(outdir, f.name), f.data);
  const magic = f.data.length >= 4 ? f.data.toString('latin1', 0, 4).replace(/[^\x20-\x7e]/g, '.') : '';
  console.log(`${f.name}  ${f.data.length}b  magic="${magic}"`);
}
