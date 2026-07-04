// Build glyph atlases (PNG + JSON) from the launcher NFTR fonts, and render a
// verification string. Uses tools/nftr.js. White-on-transparent, 2bpp -> alpha.
const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const { parseFNTR, glyphPixels } = require('./nftr.js');

const FONT_DIR = '/work/nds/assets/launcher/fs/font/ww';
const OUT_DIR = '/work/nds/assets/launcher/decoded/font';
fs.mkdirSync(OUT_DIR, { recursive: true });

const FONTS = {
  'TBF1_s': 'TBF1_s.NFTR',
  'TBF1_m': 'TBF1_m.NFTR',
  'TBF1_l': 'TBF1_l.NFTR',
  'TBF1_banner_lm': 'TBF1_banner_lm.NFTR',
  'TBF1_banner_m': 'TBF1_banner_m.NFTR',
};

const COLS = 16; // glyphs per atlas row

// The launcher fonts are 2bpp (levels 0..3). The real firmware does NOT blend
// the middle levels linearly. Measured from the idle carousel START label
// (white glyphs over the solid-blue selection frame, whose R channel is 0, so
// the rendered R equals the effective coverage directly): level 1 lands at
// alpha 107 and level 2 at alpha 181, not the linear 85 / 170. Sampled over all
// five START glyphs the medians are exact (0.418 and 0.709), so this is a fixed
// coverage table, not noise. Level 3 is full. Use the measured table for 2bpp
// and keep the linear fallback for any other depth.
const ALPHA_LUT_2BPP = [0, 107, 181, 255];
function intensityToAlpha(v, bitDepth) {
  if (bitDepth === 2) return ALPHA_LUT_2BPP[v];
  const max = (1 << bitDepth) - 1;
  return Math.round((v / max) * 255);
}

function buildAtlas(name, file) {
  const buf = fs.readFileSync(path.join(FONT_DIR, file));
  const font = parseFNTR(buf);
  const { tileW, tileH, nGlyphs, bitDepth } = font;

  const rows = Math.ceil(nGlyphs / COLS);
  const W = COLS * tileW, H = rows * tileH;
  const rgba = Buffer.alloc(W * H * 4); // transparent

  // render each glyph cell
  for (let g = 0; g < nGlyphs; g++) {
    const cx = (g % COLS) * tileW;
    const cy = Math.floor(g / COLS) * tileH;
    const px = glyphPixels(font, g);
    for (let y = 0; y < tileH; y++) for (let x = 0; x < tileW; x++) {
      const v = px[y * tileW + x];
      if (v === 0) continue;
      const a = intensityToAlpha(v, bitDepth);
      const o = ((cy + y) * W + (cx + x)) * 4;
      rgba[o] = 255; rgba[o + 1] = 255; rgba[o + 2] = 255; rgba[o + 3] = a;
    }
  }

  const rgbaPath = path.join(OUT_DIR, name + '.rgba');
  const pngPath = path.join(OUT_DIR, name + '.png');
  fs.writeFileSync(rgbaPath, rgba);
  // -strip: see tools/ncer.js writePNG for why (ImageMagick's default gAMA/cHRM
  // chunks make Chromium silently shift decoded RGB values by a few levels).
  cp.execSync(`convert -size ${W}x${H} -depth 8 rgba:${rgbaPath} -strip ${pngPath}`);
  fs.unlinkSync(rgbaPath);

  // build glyph metric map keyed by codepoint
  const glyphs = {};
  for (const cpStr of Object.keys(font.cmap)) {
    const codepoint = +cpStr;
    const gi = font.cmap[codepoint];
    if (gi >= nGlyphs) continue;
    const cx = (gi % COLS) * tileW;
    const cy = Math.floor(gi / COLS) * tileH;
    const w = font.widths[gi] || { left: font.defaultLeft, width: font.defaultGlyphW, advance: font.defaultCharW };
    glyphs[codepoint] = {
      atlasX: cx, atlasY: cy, w: tileW, h: tileH,
      left: w.left, advance: w.advance, ink: w.width, glyph: gi,
    };
  }

  const json = {
    name,
    cellW: tileW, cellH: tileH,
    lineHeight: font.lineFeed,
    ascent: font.fAscent, baseline: font.baseline,
    bitDepth, nGlyphs, atlasW: W, atlasH: H, atlasCols: COLS,
    defaultAdvance: font.defaultCharW,
    glyphs,
  };
  fs.writeFileSync(path.join(OUT_DIR, name + '.json'), JSON.stringify(json));
  console.log(`${name}: ${tileW}x${tileH} cell, ${nGlyphs} glyphs, ${Object.keys(glyphs).length} mapped codepoints, atlas ${W}x${H}, lineH ${font.lineFeed}`);
  return { font, json };
}

const built = {};
for (const [name, file] of Object.entries(FONTS)) built[name] = buildAtlas(name, file);

// ---- verification: render a string using a font's atlas + metrics ----
function renderString(name, text, outPng, scale = 1) {
  const { font, json } = built[name];
  const buf = fs.readFileSync(path.join(FONT_DIR, FONTS[name]));
  // measure
  let penX = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    const g = json.glyphs[cp];
    penX += g ? g.advance : json.defaultAdvance;
  }
  const W = Math.max(1, penX) + 2;
  const H = json.cellH + 4;
  const rgba = Buffer.alloc(W * H * 4);

  penX = 1;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    const g = json.glyphs[cp];
    if (g) {
      const px = glyphPixels(font, g.glyph);
      for (let y = 0; y < font.tileH; y++) for (let x = 0; x < font.tileW; x++) {
        const v = px[y * font.tileW + x];
        if (v === 0) continue;
        const a = Math.round((v / ((1 << font.bitDepth) - 1)) * 255);
        const dx = penX + x, dy = 2 + y;
        if (dx < 0 || dx >= W || dy < 0 || dy >= H) continue;
        const o = (dy * W + dx) * 4;
        // simple over-composite onto (possibly) existing white
        rgba[o] = 255; rgba[o + 1] = 255; rgba[o + 2] = 255;
        rgba[o + 3] = Math.max(rgba[o + 3], a);
      }
      penX += g.advance;
    } else {
      penX += json.defaultAdvance;
    }
  }

  const rgbaPath = outPng.replace(/\.png$/, '.rgba');
  fs.writeFileSync(rgbaPath, rgba);
  // dark background for legibility, then composite the white text over it
  const sW = W * scale, sH = H * scale;
  cp.execSync(`convert -size ${W}x${H} -depth 8 rgba:${rgbaPath} -background '#202830' -flatten -filter point -resize ${sW}x${sH} -strip ${outPng}`);
  fs.unlinkSync(rgbaPath);
  console.log(`rendered "${text}" with ${name} -> ${outPng} (${W}x${H} x${scale})`);
}

renderString('TBF1_m', 'NINTENDO DSi MENU START 01/01', path.join(OUT_DIR, '_verify_m.png'), 4);
renderString('TBF1_l', 'NINTENDO DSi MENU', path.join(OUT_DIR, '_verify_l.png'), 4);
renderString('TBF1_s', '01/01 12:34', path.join(OUT_DIR, '_verify_s.png'), 6);
renderString('TBF1_banner_lm', 'Nintendo DSi', path.join(OUT_DIR, '_verify_banner.png'), 4);
