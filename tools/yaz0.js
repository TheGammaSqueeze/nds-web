// Yaz0 decompressor (Nintendo). Usage: node yaz0.js <in.szs> <out.bin>
const fs = require('fs');
function yaz0(buf) {
  if (buf.toString('latin1', 0, 4) !== 'Yaz0') throw new Error('not Yaz0');
  const size = buf.readUInt32BE(4);
  const out = Buffer.alloc(size);
  let src = 16, dst = 0;
  while (dst < size) {
    let code = buf[src++];
    for (let i = 0; i < 8 && dst < size; i++) {
      if (code & 0x80) {
        out[dst++] = buf[src++];
      } else {
        const b1 = buf[src++], b2 = buf[src++];
        let dist = ((b1 & 0x0F) << 8) | b2;
        let n = b1 >> 4;
        if (n === 0) { n = buf[src++] + 0x12; } else { n += 2; }
        let copyFrom = dst - dist - 1;
        for (let j = 0; j < n; j++) out[dst++] = out[copyFrom++];
      }
      code <<= 1;
    }
  }
  return out;
}
const data = fs.readFileSync(process.argv[2]);
const out = yaz0(data);
fs.writeFileSync(process.argv[3], out);
const magic = out.toString('latin1', 0, 4).replace(/[^\x20-\x7e]/g, '.');
console.log(`${process.argv[2]} -> ${process.argv[3]} : ${out.length}b magic="${magic}"`);
