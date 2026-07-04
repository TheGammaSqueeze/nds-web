// One-off decode of the raw VRAM dumps captured from the boot Health & Safety
// screen (engine A, BG2, text mode, 4bpp, charBase=0 screenBase=0x6000) to see
// whether it's real tile/font data and, if so, what it looks like.
import fs from 'fs';

const dir = process.argv[2] || '/tmp/hs_re3';
const paldir = process.argv[3] || '/tmp/hs_re4';
const tag = process.argv[4] || '';

const chars = fs.readFileSync(`${dir}/hs_A_char${tag}.bin`);
const map = fs.readFileSync(`${dir}/hs_A_map${tag}.bin`);
const pal = fs.readFileSync(`${paldir}/hs_A_bgpal${tag}.bin`);

function palColor(bank, idx) {
  if (idx === 0) return [0, 0, 0, 0];
  const off = (bank * 16 + idx) * 2;
  const c = pal.readUInt16LE(off);
  const r = (c & 0x1f) * 255 / 31, g = ((c >> 5) & 0x1f) * 255 / 31, b = ((c >> 10) & 0x1f) * 255 / 31;
  return [r | 0, g | 0, b | 0, 255];
}

const W = 32 * 8, H = 32 * 8;
const img = Buffer.alloc(W * H * 4);
let usedTiles = new Set(), usedBanks = new Set();
for (let ty = 0; ty < 32; ty++) {
  for (let tx = 0; tx < 32; tx++) {
    const entry = map.readUInt16LE((ty * 32 + tx) * 2);
    const tileNum = entry & 0x3ff;
    const hflip = (entry >> 10) & 1, vflip = (entry >> 11) & 1;
    const bank = (entry >> 12) & 0xf;
    if (tileNum) { usedTiles.add(tileNum); usedBanks.add(bank); }
    const tileOff = tileNum * 32; // 4bpp: 32 bytes/tile
    for (let py = 0; py < 8; py++) {
      const sy = vflip ? 7 - py : py;
      for (let px = 0; px < 8; px++) {
        const sx = hflip ? 7 - px : px;
        const byteOff = tileOff + sy * 4 + (sx >> 1);
        if (byteOff >= chars.length) continue;
        const byte = chars[byteOff];
        const nib = (sx & 1) ? (byte >> 4) : (byte & 0xf);
        const [r, g, b, a] = palColor(bank, nib);
        const dx = tx * 8 + px, dy = ty * 8 + py;
        const di = (dy * W + dx) * 4;
        img[di] = r; img[di + 1] = g; img[di + 2] = b; img[di + 3] = a;
      }
    }
  }
}
fs.writeFileSync(`/tmp/hs_bg2${tag}.rgba`, img);
console.log('tiles used:', usedTiles.size, [...usedTiles].sort((a, b) => a - b).slice(0, 40));
console.log('palette banks used:', [...usedBanks]);
console.log(`W=${W} H=${H} -> /tmp/hs_bg2${tag}.rgba`);
