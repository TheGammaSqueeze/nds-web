// NFTR (Nitro Font Resource) decoder -> web glyph atlases.
// Header magic 'RTFN'. Blocks (4cc stored byte-reversed):
//   FNIF (=FINF font info), PLGC (=CGLP glyph bitmaps),
//   HDWC (=CWDH char widths), PAMC (=CMAP code->glyph maps).
// All launcher fonts are 2bpp grayscale. palette index 0 = transparent.
const fs = require('fs');

function parseFNTR(buf) {
  if (buf.toString('latin1', 0, 4) !== 'RTFN') throw new Error('not an NFTR (RTFN) file');
  const fileSize = buf.readUInt32LE(0x08);
  const headerSize = buf.readUInt16LE(0x0C);
  const nBlocks = buf.readUInt16LE(0x0E);

  // ---- FNIF / FINF (starts right after the 0x10 header) ----
  const finfOff = headerSize; // = 0x10
  if (buf.toString('latin1', finfOff, finfOff + 4) !== 'FNIF') throw new Error('FNIF not found');
  const finfData = finfOff + 8;
  const fontType        = buf.readUInt8(finfData + 0x00);
  const lineFeed        = buf.readUInt8(finfData + 0x01);
  const alterCharIndex  = buf.readUInt16LE(finfData + 0x02);
  const defaultLeft     = buf.readUInt8(finfData + 0x04);
  const defaultGlyphW   = buf.readUInt8(finfData + 0x05);
  const defaultCharW    = buf.readUInt8(finfData + 0x06);
  const encoding        = buf.readUInt8(finfData + 0x07);
  // The three section offsets point at each block's DATA (header + 8).
  const offCGLP = buf.readUInt32LE(finfData + 0x08);
  const offCWDH = buf.readUInt32LE(finfData + 0x0C);
  const offCMAP = buf.readUInt32LE(finfData + 0x10);
  const fHeight = buf.readUInt8(finfData + 0x14);
  const fWidth  = buf.readUInt8(finfData + 0x15);
  const fAscent = buf.readUInt8(finfData + 0x16);

  // ---- PLGC / CGLP : glyph bitmaps ----
  const cglpHdr = offCGLP - 8;
  if (buf.toString('latin1', cglpHdr, cglpHdr + 4) !== 'PLGC') throw new Error('PLGC not found');
  const cglpSize  = buf.readUInt32LE(cglpHdr + 4);
  const tileW     = buf.readUInt8(offCGLP + 0x00);
  const tileH     = buf.readUInt8(offCGLP + 0x01);
  const tileSize  = buf.readUInt16LE(offCGLP + 0x02); // bytes per glyph
  const baseline  = buf.readUInt8(offCGLP + 0x04);
  const maxCharW  = buf.readUInt8(offCGLP + 0x05);
  const bitDepth  = buf.readUInt8(offCGLP + 0x06); // 1/2/4
  const rotate    = buf.readUInt8(offCGLP + 0x07);
  const glyphData = offCGLP + 0x08;
  const nGlyphs   = Math.floor((cglpSize - 16) / tileSize);

  // ---- HDWC / CWDH : per-glyph widths ----
  const widths = {}; // glyphIndex -> {left, width, advance}
  if (offCWDH) {
    const cwdhHdr = offCWDH - 8;
    if (buf.toString('latin1', cwdhHdr, cwdhHdr + 4) !== 'HDWC') throw new Error('HDWC not found');
    const firstCode = buf.readUInt16LE(offCWDH + 0x00);
    const lastCode  = buf.readUInt16LE(offCWDH + 0x02);
    // u32 nextOffset at +4 (chained CWDH possible; launcher fonts use one)
    let p = offCWDH + 8;
    for (let g = firstCode; g <= lastCode; g++) {
      const left    = buf.readInt8(p);      // signed left bearing
      const width   = buf.readUInt8(p + 1); // glyph ink width
      const advance = buf.readInt8(p + 2);  // pen advance
      widths[g] = { left, width, advance };
      p += 3;
    }
  }

  // ---- PAMC / CMAP : codepoint -> glyph index (chained) ----
  const cmap = {}; // codepoint -> glyphIndex
  let nextData = offCMAP;
  const seen = new Set();
  while (nextData && !seen.has(nextData)) {
    seen.add(nextData);
    const hdr = nextData - 8;
    if (buf.toString('latin1', hdr, hdr + 4) !== 'PAMC') break;
    const firstChar = buf.readUInt16LE(nextData + 0x00);
    const lastChar  = buf.readUInt16LE(nextData + 0x02);
    const mapType   = buf.readUInt32LE(nextData + 0x04);
    const next      = buf.readUInt32LE(nextData + 0x08);
    let d = nextData + 0x0C;
    if (mapType === 0) {
      // direct range: firstGlyphIndex at d, glyph = firstGlyph + (char-firstChar)
      const firstGlyph = buf.readUInt16LE(d);
      for (let c = firstChar; c <= lastChar; c++) {
        const gi = firstGlyph + (c - firstChar);
        if (gi !== 0xFFFF) cmap[c] = gi;
      }
    } else if (mapType === 1) {
      // offset table: one u16 glyph index per char in [firstChar,lastChar]
      for (let c = firstChar; c <= lastChar; c++) {
        const gi = buf.readUInt16LE(d);
        d += 2;
        if (gi !== 0xFFFF) cmap[c] = gi;
      }
    } else if (mapType === 2) {
      // pairs: u16 count, then (u16 char, u16 glyph)*
      const n = buf.readUInt16LE(d); d += 2;
      for (let i = 0; i < n; i++) {
        const c = buf.readUInt16LE(d); const gi = buf.readUInt16LE(d + 2); d += 4;
        if (gi !== 0xFFFF) cmap[c] = gi;
      }
    }
    nextData = next;
  }

  return {
    fileSize, nBlocks, fontType, encoding,
    lineFeed, alterCharIndex, defaultLeft, defaultGlyphW, defaultCharW,
    fHeight, fWidth, fAscent,
    tileW, tileH, tileSize, baseline, maxCharW, bitDepth, rotate, nGlyphs,
    buf, glyphData, widths, cmap,
  };
}

// Decode one glyph's pixels into a flat array (tileW*tileH) of intensity levels 0..(2^bpp-1).
// Bits are packed MSB-first as a continuous stream per glyph, row-major.
function glyphPixels(font, glyphIndex) {
  const { buf, glyphData, tileW, tileH, tileSize, bitDepth } = font;
  const base = glyphData + glyphIndex * tileSize;
  const mask = (1 << bitDepth) - 1;
  const px = new Uint8Array(tileW * tileH);
  let bitPos = 0;
  for (let i = 0; i < tileW * tileH; i++) {
    const byteIndex = base + (bitPos >> 3);
    const bitOff = bitPos & 7;
    const b = byteIndex < buf.length ? buf[byteIndex] : 0;
    const shift = 8 - bitDepth - bitOff; // bitDepth in {1,2,4} divides 8 -> never spans bytes
    px[i] = (b >> shift) & mask;
    bitPos += bitDepth;
  }
  return px;
}

module.exports = { parseFNTR, glyphPixels };
