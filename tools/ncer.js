// NCER (cells/OAM) + NANR (animation) decoder for NDS launcher sprites.
// Builds on ndsgfx.js (NCLR/NCGR/NSCR). Does NOT modify ndsgfx.js.
//
// File magics are stored reversed: 'RECN' (NCER), 'RNAN' (NANR).
// NCER inner block 'KBEC', NANR inner block 'KNBA'.
//
// Color rule: palette index 0 = transparent, colors BGR555.

const fs = require('fs');
const path = require('path');
const G = require('./ndsgfx.js');

// ---- DS OAM hardware shape+size -> [w,h] in pixels ----
const SIZE_TABLE = {
  0: [[8, 8], [16, 16], [32, 32], [64, 64]],   // square
  1: [[16, 8], [32, 8], [32, 16], [64, 32]],   // wide
  2: [[8, 16], [8, 32], [16, 32], [32, 64]],   // tall
  3: [[8, 8], [8, 8], [8, 8], [8, 8]],         // invalid -> fallback
};

// ---------------------------------------------------------------------------
// NCER
// ---------------------------------------------------------------------------
function parseNCER(buf) {
  const kbec = G.findBlock(buf, 'KBEC');
  if (kbec < 0) throw new Error('KBEC block not found');
  const base = kbec + 8; // start of KBEC data fields (file 0x18 typically)
  const nCells = buf.readUInt16LE(base + 0);
  const bankAttr = buf.readUInt16LE(base + 2);
  const cellDataOffset = buf.readUInt32LE(base + 4);     // relative to `base`
  const mappingMode = buf.readUInt32LE(base + 8);        // 1D boundary shift: tileMul = 1<<mappingMode

  const withBounds = (bankAttr & 1) === 1;
  const cellSize = withBounds ? 16 : 8;
  const cellArrayStart = base + cellDataOffset;
  const oamSectionStart = cellArrayStart + nCells * cellSize;

  const cells = [];
  for (let i = 0; i < nCells; i++) {
    const co = cellArrayStart + i * cellSize;
    const nOAM = buf.readUInt16LE(co + 0);
    const cellAttr = buf.readUInt16LE(co + 2);
    const oamOff = buf.readUInt32LE(co + 4);
    let bounds = null;
    if (withBounds) {
      bounds = {
        maxX: buf.readInt16LE(co + 8),
        maxY: buf.readInt16LE(co + 10),
        minX: buf.readInt16LE(co + 12),
        minY: buf.readInt16LE(co + 14),
      };
    }
    const oams = [];
    for (let j = 0; j < nOAM; j++) {
      const o = oamSectionStart + oamOff + j * 6;
      const a0 = buf.readUInt16LE(o + 0);
      const a1 = buf.readUInt16LE(o + 2);
      const a2 = buf.readUInt16LE(o + 4);

      let y = a0 & 0xFF; if (y >= 128) y -= 256;
      const rotscale = (a0 >> 8) & 1;
      const disable = (a0 >> 9) & 1;       // when rotscale==0
      const mode = (a0 >> 10) & 3;
      const color256 = (a0 >> 13) & 1;
      const shape = (a0 >> 14) & 3;

      let x = a1 & 0x1FF; if (x >= 256) x -= 512;
      const size = (a1 >> 14) & 3;
      const flipH = rotscale ? 0 : (a1 >> 12) & 1;
      const flipV = rotscale ? 0 : (a1 >> 13) & 1;

      const tile = a2 & 0x3FF;
      const prio = (a2 >> 10) & 3;
      const pal = (a2 >> 12) & 0xF;

      const dim = SIZE_TABLE[shape][size];
      oams.push({
        x, y, w: dim[0], h: dim[1], tile, pal, prio,
        flipH: !!flipH, flipV: !!flipV, color256: !!color256,
        rotscale: !!rotscale, disable: !!disable, mode, shape, size,
        attr0: a0, attr1: a1, attr2: a2,
      });
    }
    cells.push({ index: i, nOAM, cellAttr, bounds, oams });
  }
  return { nCells, bankAttr, withBounds, mappingMode, cellArrayStart, oamSectionStart, cells };
}

// Render one cell -> {w,h,data(RGBA), ox, oy} where (ox,oy) maps cell-space (0,0)
// to image pixel (ox,oy). Tight image around all visible OAMs.
function renderCell(cell, ncgr, nclr, mappingMode, palOverride) {
  // bounding box from OAMs
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const drawn = cell.oams.filter(o => !o.disable);
  if (drawn.length === 0) {
    return { w: 1, h: 1, data: Buffer.alloc(4), ox: 0, oy: 0, empty: true };
  }
  for (const o of drawn) {
    if (o.x < minX) minX = o.x;
    if (o.y < minY) minY = o.y;
    if (o.x + o.w > maxX) maxX = o.x + o.w;
    if (o.y + o.h > maxY) maxY = o.y + o.h;
  }
  const W = maxX - minX, H = maxY - minY;
  const out = Buffer.alloc(W * H * 4);
  const tileMul = 1 << mappingMode;

  // draw back-to-front so OAM[0] ends on top
  for (let k = drawn.length - 1; k >= 0; k--) {
    const o = drawn[k];
    const tilesW = o.w >> 3;
    const baseTile = o.tile * tileMul;
    const palette = nclr.palettes[(palOverride !== undefined ? palOverride : o.pal)] || nclr.palettes[0];
    const dx0 = o.x - minX, dy0 = o.y - minY;
    for (let py = 0; py < o.h; py++) {
      for (let px = 0; px < o.w; px++) {
        const sx = o.flipH ? (o.w - 1 - px) : px;
        const sy = o.flipV ? (o.h - 1 - py) : py;
        const localTile = (sy >> 3) * tilesW + (sx >> 3);
        const idx = G.tilePixel(ncgr, baseTile + localTile, sx & 7, sy & 7);
        if (idx === 0) continue;
        const c = palette[idx] || [255, 0, 255];
        const oo = ((dy0 + py) * W + (dx0 + px)) * 4;
        out[oo] = c[0]; out[oo + 1] = c[1]; out[oo + 2] = c[2]; out[oo + 3] = 255;
      }
    }
  }
  return { w: W, h: H, data: out, ox: -minX, oy: -minY };
}

// ---------------------------------------------------------------------------
// NANR
// ---------------------------------------------------------------------------
function parseNANR(buf) {
  const knba = G.findBlock(buf, 'KNBA');
  if (knba < 0) throw new Error('KNBA block not found');
  const base = knba + 8;
  const nSeq = buf.readUInt16LE(base + 0);
  const nTotalFrames = buf.readUInt16LE(base + 2);
  const seqArrOff = buf.readUInt32LE(base + 4);   // relative to base
  const frameArrOff = buf.readUInt32LE(base + 8);
  const valuesOff = buf.readUInt32LE(base + 12);

  const seqStart = base + seqArrOff;
  const frameStart = base + frameArrOff;
  const valStart = base + valuesOff;

  const sequences = [];
  for (let s = 0; s < nSeq; s++) {
    const so = seqStart + s * 16;
    // sequence element (16 bytes):
    //   u16 numFrames; u16 loopStartFrame; u16 animElementType(0/1/2); u16 _pad;
    //   u32 playMode(1=once,2=loop,...); u32 frameArrayOffset (rel frameStart)
    const numFrames = buf.readUInt16LE(so + 0);
    const loopStart = buf.readUInt16LE(so + 2);
    const animType = buf.readUInt16LE(so + 4);   // element kind (0 index,1 SRT,2 T)
    const animMode = buf.readUInt32LE(so + 8);   // playback mode
    const frameOff = buf.readUInt32LE(so + 12);  // relative to frameStart

    const frames = [];
    for (let f = 0; f < numFrames; f++) {
      const fo = frameStart + frameOff + f * 8;
      const dataOff = buf.readUInt32LE(fo + 0);  // byte offset into values pool
      const duration = buf.readUInt16LE(fo + 4); // in 1/60s frames
      // cell index is always the first u16 of the element, regardless of type
      const cellIndex = buf.readUInt16LE(valStart + dataOff);
      // Translation / SRT extras only exist for 8/16-byte elements. These
      // launcher assets are all pure index-swap (verified: pool holds only
      // small u16 indices, no fx32 scale words), so tx/ty/scale/rot default.
      let tx = 0, ty = 0, scale = 1, rot = 0;
      frames.push({ cellIndex, duration, tx, ty, scale, rot });
    }
    sequences.push({ index: s, numFrames, loopStart, animType, animMode, frames });
  }
  return { nSeq, nTotalFrames, sequences };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function writePNG(img, outPath, tmpDir) {
  const rgba = path.join(tmpDir, 'tmp.rgba');
  fs.writeFileSync(rgba, img.data);
  // -strip drops the gAMA/cHRM chunks ImageMagick writes by default: Chromium's
  // canvas color management reads those and silently shifts decoded RGB values
  // by a few levels (confirmed: a flat 178 grey round-tripped as 178,178,180
  // without -strip, exact 178,178,178 with it). Without -strip every sprite
  // this writes is subtly wrong on screen, masked only by verify.js's 8% fuzz.
  require('child_process').execSync(
    `convert -size ${img.w}x${img.h} -depth 8 rgba:${rgba} -strip ${outPath}`);
}

module.exports = { parseNCER, renderCell, parseNANR, SIZE_TABLE, writePNG };
