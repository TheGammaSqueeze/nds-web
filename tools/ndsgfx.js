// NDS graphics format decoders: NCLR (palette), NCGR (tiles), NSCR (tilemap),
// NCER (cells/OAM), NANR (animation). Renders to RGBA buffers.
const fs = require('fs');

function findBlock(buf, magic, startGuess = 0x10) {
  // blocks after the generic 0x10 header; scan for magic
  let pos = startGuess;
  while (pos + 8 <= buf.length) {
    const m = buf.toString('latin1', pos, pos + 4);
    if (m === magic) return pos;
    const sz = buf.readUInt32LE(pos + 4);
    if (sz < 8 || pos + sz > buf.length) break;
    pos += sz;
  }
  // fallback: linear search
  for (let i = 0; i + 4 <= buf.length; i++) if (buf.toString('latin1', i, i + 4) === magic) return i;
  return -1;
}

function bgr555(c) {
  // melonDS-exact 6-bit expansion: (v5<<3)|(v5>>3) -> 31/28/27/26 = 251/227/219/211.
  // (The old (v*255/31) rounding gave 255/230/222/213, +2..4 too bright vs the reference.)
  const e = (v) => { v &= 0x1F; return (v << 3) | (v >> 3); };
  return [e(c), e(c >> 5), e(c >> 10)];
}

// ---- NCLR ----
function parseNCLR(buf) {
  const p = findBlock(buf, 'TTLP');
  const bitDepth = buf.readUInt32LE(p + 8); // 3=4bpp(16),4=8bpp(256)
  const dataSize = buf.readUInt32LE(p + 0x10);
  const colorsPer = buf.readUInt16LE(p + 0x14) || (bitDepth === 4 ? 256 : 16);
  const dataOff = p + 0x18;
  const nColors = Math.floor(dataSize / 2);
  const colors = [];
  for (let i = 0; i < nColors; i++) colors.push(bgr555(buf.readUInt16LE(dataOff + i * 2)));
  const per = bitDepth === 4 ? 256 : 16;
  const palettes = [];
  for (let i = 0; i < colors.length; i += per) palettes.push(colors.slice(i, i + per));
  return { bitDepth, colorsPer: per, palettes, colors };
}

// ---- NCGR ----
function parseNCGR(buf) {
  const p = findBlock(buf, 'RAHC');
  let nTilesY = buf.readUInt16LE(p + 8);
  let nTilesX = buf.readUInt16LE(p + 0x0A);
  const bpp = buf.readUInt32LE(p + 0x0C); // 3=4bpp,4=8bpp
  // mapping flags at p+0x10 (u32), p+0x14 (u32 tiled?), dataSize at p+0x18, dataOff p+0x1C
  const tiledFlag = buf.readUInt32LE(p + 0x14);
  const dataSize = buf.readUInt32LE(p + 0x18);
  const dataOff = p + 0x20;
  const is8 = bpp === 4;
  const bytesPerTile = is8 ? 64 : 32;
  const data = buf.subarray(dataOff, dataOff + dataSize);
  const nTiles = Math.floor(data.length / bytesPerTile);
  return { nTilesX, nTilesY, is8, bytesPerTile, data, nTiles, tiledFlag };
}

// get pixel palette-index for a tile (8x8) at (tx,ty within tile)
function tilePixel(ncgr, tileIdx, x, y) {
  const base = tileIdx * ncgr.bytesPerTile;
  if (ncgr.is8) {
    return ncgr.data[base + y * 8 + x] || 0;
  } else {
    const b = ncgr.data[base + (y * 8 + x) / 2 | 0];
    if (b === undefined) return 0;
    return (x & 1) ? (b >> 4) : (b & 0x0F);
  }
}

// ---- NSCR ----
function parseNSCR(buf) {
  const p = findBlock(buf, 'NRCS');
  const w = buf.readUInt16LE(p + 8);   // px
  const h = buf.readUInt16LE(p + 0x0A);
  const dataSize = buf.readUInt32LE(p + 0x10);
  const dataOff = p + 0x14;
  const entries = [];
  for (let i = 0; i < dataSize / 2; i++) {
    const v = buf.readUInt16LE(dataOff + i * 2);
    entries.push({ tile: v & 0x3FF, flipH: !!(v & 0x400), flipV: !!(v & 0x800), pal: (v >> 12) & 0xF });
  }
  return { w, h, entries };
}

// render NSCR background -> RGBA (w x h)
function renderBG(nscr, ncgr, nclr, palOverride) {
  const W = nscr.w, H = nscr.h;
  const out = Buffer.alloc(W * H * 4);
  const tilesW = W / 8;
  for (let i = 0; i < nscr.entries.length; i++) {
    const e = nscr.entries[i];
    const cx = (i % tilesW) * 8, cy = (Math.floor(i / tilesW)) * 8;
    const pal = (palOverride !== undefined ? palOverride : (nclr.palettes.length > 1 ? e.pal : 0));
    const palette = nclr.palettes[pal] || nclr.palettes[0];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const sx = e.flipH ? 7 - x : x, sy = e.flipV ? 7 - y : y;
      const idx = tilePixel(ncgr, e.tile, sx, sy);
      const o = ((cy + y) * W + (cx + x)) * 4;
      if (idx === 0) { out[o + 3] = 0; continue; }
      const c = palette[idx] || [255, 0, 255];
      out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = 255;
    }
  }
  return { w: W, h: H, data: out };
}

function writeRGBA(img, path) { fs.writeFileSync(path, img.data); }

module.exports = { parseNCLR, parseNCGR, parseNSCR, renderBG, tilePixel, findBlock, bgr555, writeRGBA };

// CLI: node ndsgfx.js bg <nscr> <ncgr> <nclr> <out.rgba> [palIndex]
if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'bg') {
    const nscr = parseNSCR(fs.readFileSync(process.argv[3]));
    const ncgr = parseNCGR(fs.readFileSync(process.argv[4]));
    const nclr = parseNCLR(fs.readFileSync(process.argv[5]));
    const pal = process.argv[7] !== undefined ? +process.argv[7] : undefined;
    const img = renderBG(nscr, ncgr, nclr, pal);
    writeRGBA(img, process.argv[6]);
    console.log(`rendered ${img.w}x${img.h} -> ${process.argv[6]} (ncgr ${ncgr.nTiles} tiles, ${ncgr.is8?8:4}bpp; nclr ${nclr.palettes.length} pals)`);
  } else if (cmd === 'info') {
    const buf = fs.readFileSync(process.argv[3]);
    const m = buf.toString('latin1', 0, 4);
    console.log('magic', m);
    if (m === 'RLCN') console.log(JSON.stringify(parseNCLR(buf), null, 0).slice(0, 400));
    if (m === 'RGCN') { const n = parseNCGR(buf); console.log({ nTilesX: n.nTilesX, nTilesY: n.nTilesY, is8: n.is8, nTiles: n.nTiles }); }
    if (m === 'RCSN') { const n = parseNSCR(buf); console.log({ w: n.w, h: n.h, entries: n.entries.length }); }
  }
}
