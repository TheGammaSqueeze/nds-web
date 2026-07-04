// Extract NitroFS (FNT/FAT) from an NDS/TWL .app/.nds ROM.
// Usage: node nitrofs.js <rom> <outdir>
const fs = require('fs');
const path = require('path');

const rom = fs.readFileSync(process.argv[2]);
const outdir = process.argv[3];

const fntOff = rom.readUInt32LE(0x40), fntSize = rom.readUInt32LE(0x44);
const fatOff = rom.readUInt32LE(0x48), fatSize = rom.readUInt32LE(0x4C);
const numFiles = fatSize / 8;
console.log(`FNT @0x${fntOff.toString(16)} (${fntSize}), FAT @0x${fatOff.toString(16)} (${numFiles} files)`);

// FAT: per file id -> [start,end)
const fat = [];
for (let i = 0; i < numFiles; i++) {
  const s = rom.readUInt32LE(fatOff + i * 8);
  const e = rom.readUInt32LE(fatOff + i * 8 + 4);
  fat.push([s, e]);
}

// FNT main table: directories. Entry 0 holds total dir count.
// Each main entry (8 bytes): subTableOffset(4), firstFileId(2), parentId(2)
function dirMainEntry(dirId) {
  const idx = dirId & 0xFFF;
  const base = fntOff + idx * 8;
  return {
    subOff: rom.readUInt32LE(base),
    firstFile: rom.readUInt16LE(base + 4),
    parent: rom.readUInt16LE(base + 6),
  };
}
const totalDirs = rom.readUInt16LE(fntOff + 6); // parent field of root = dir count
console.log(`directories: ${totalDirs}`);

let maxEnd = 0;
const files = [];

function walk(dirId, prefix) {
  const ent = dirMainEntry(dirId);
  let p = fntOff + ent.subOff;
  let fileId = ent.firstFile;
  for (;;) {
    const t = rom[p++];
    if (t === 0) break; // end of subtable
    const len = t & 0x7F;
    const isDir = (t & 0x80) !== 0;
    const name = rom.toString('latin1', p, p + len); p += len;
    if (isDir) {
      const subDirId = rom.readUInt16LE(p); p += 2;
      const np = path.join(prefix, name);
      fs.mkdirSync(path.join(outdir, np), { recursive: true });
      walk(subDirId, np);
    } else {
      const [s, e] = fat[fileId];
      maxEnd = Math.max(maxEnd, e);
      const data = rom.subarray(s, e);
      const fp = path.join(prefix, name);
      fs.mkdirSync(path.join(outdir, prefix), { recursive: true });
      fs.writeFileSync(path.join(outdir, fp), data);
      const magic = data.length >= 4 ? data.toString('latin1', 0, 4).replace(/[^\x20-\x7e]/g, '.') : '';
      files.push({ id: fileId, path: fp, off: s, size: e - s, magic });
      fileId++;
    }
  }
}

fs.mkdirSync(outdir, { recursive: true });
walk(0xF000, '');
files.sort((a, b) => a.id - b.id);
for (const f of files) console.log(`#${f.id} ${f.path}  @0x${f.off.toString(16)} ${f.size}b  magic="${f.magic}"`);
console.log(`\nextracted ${files.length} files; max data end 0x${maxEnd.toString(16)}`);
fs.writeFileSync(path.join(outdir, '_filelist.json'), JSON.stringify(files, null, 2));
