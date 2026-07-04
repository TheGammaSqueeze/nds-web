// Bitmap font renderer using decoded NFTR glyph atlases.
// Falls back to canvas text if an atlas is unavailable.
import { Assets } from './assets.js';
import { RENDER_SCALE } from './screen.js';

// At high render scale the low-res bitmap glyphs only get blockier, so for ?scale=2/3/4
// we render glyphs with lookalike vector fonts for smooth high-res text. Letters use 'DSVec'
// (Mirsany); digits use 'DSVecNum' (M PLUS Rounded 1c), a closer match for the DS numerals.
// Each glyph is placed at its bitmap pen position, so spacing and layout match native (1x).
// The font is chosen per glyph from real coverage data (coverage.json): Mirsany, else the
// broad-coverage number font, else the bitmap. So a symbol one font lacks (a title's (TM), an
// accented letter) still renders smooth from another font instead of dropping the whole string
// to the bitmap; only the firmware button/target sprites stay bitmap. Native scale=1 always
// uses the pixel-exact bitmap (unchanged).
let VEC_READY = false, VECNUM_READY = false;
if (RENDER_SCALE > 1 && typeof document !== 'undefined' && document.fonts) {
  document.fonts.load("16px 'DSVec'").then(() => { VEC_READY = true; }).catch(() => {});
  document.fonts.load("16px 'DSVecNum'").then(() => { VECNUM_READY = true; }).catch(() => {});
}
// per-font Unicode coverage (compact [start,end] ranges) loaded from coverage.json.
let COVERAGE = null;
function covers(fam, cp) {
  const rs = COVERAGE && COVERAGE[fam]; if (!rs) return false;
  let lo = 0, hi = rs.length - 1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (cp < rs[m][0]) hi = m - 1; else if (cp > rs[m][1]) lo = m + 1; else return true; }
  return false;
}
// choose the vector font for a glyph, or null to render it from the bitmap atlas. Digits
// prefer the number font; letters/symbols prefer Mirsany then fall back to the number font
// (broad coverage). The firmware button/target glyphs always stay bitmap to match the sprites.
function pickFont(cp, cls) {
  if (cp === 0x25CE || (cp >= 0xE000 && cp <= 0xF8FF)) return null;
  if (cls === 'num' && VECNUM_READY && covers('DSVecNum', cp)) return 'DSVecNum';
  if (VEC_READY && covers('DSVec', cp)) return 'DSVec';
  if (VECNUM_READY && covers('DSVecNum', cp)) return 'DSVecNum';
  return null;
}
// classify each char into numeric vs text; separators (space / : . ,) stick to the current
// class so clock/date strings like 01/01 and 12:34 stay fully numeric and use the number font.
function isDigit(cp) { return cp >= 0x30 && cp <= 0x39; }
function isSep(cp) { return cp === 0x20 || cp === 0x2F || cp === 0x3A || cp === 0x2E || cp === 0x2C; }

export class BitmapFont {
  constructor(name) {
    this.name = name;
    this.atlas = null;     // Image
    this.meta = null;      // { cellW, cellH, lineHeight, glyphs: {cp:{atlasX,atlasY,w,h,left,advance}} }
    this.tint = null;      // optional tint canvas cache
  }
  ready() { return this.atlas && this.meta; }
  attach(atlasImg, meta) {
    this.atlas = atlasImg; this.meta = meta;
    // vector-font sizing to match the bitmap cell: em-size ~ cellH, baseline near the cell
    // bottom (tuned per the launcher fonts). Overridable via meta if present.
    this.vecSize = meta.vecSize || (meta.cellH - 1);
    this.vecBase = meta.vecBase || (meta.baseline != null ? meta.baseline : meta.cellH - 3);
  }
  // eligible for the vector path when scale>1 and the letter font is loaded; the per-glyph
  // font choice (vector or bitmap) then happens inside _vecRender via pickFont().
  _useVecStr() {
    return VEC_READY && RENDER_SCALE > 1 && this.ready();
  }
  // a tiny offscreen ctx for measuring vector runs (measureText / actualBoundingBoxAscent).
  _mctx() {
    if (!this._mc) { const c = document.createElement('canvas'); c.width = 8; c.height = 8; this._mc = c.getContext('2d'); }
    this._mc.textBaseline = 'alphabetic';
    return this._mc;
  }
  // vertical scale making a given vector font's cap-height equal the bitmap cap-height.
  _famScale(mctx, fam, capH) {
    if (!this._vsf) this._vsf = {};
    if (this._vsf[fam] != null) return this._vsf[fam];
    mctx.font = `${this.vecSize}px '${fam}', sans-serif`; mctx.textBaseline = 'alphabetic';
    const vCap = mctx.measureText('N').actualBoundingBoxAscent || this.vecSize * 0.72;
    this._vsf[fam] = capH / vCap;
    return this._vsf[fam];
  }
  // scan a glyph's cell in the atlas for its topmost/bottommost ink row (cell-relative).
  _bmInk(g) {
    const c = document.createElement('canvas'); c.width = g.w; c.height = g.h;
    const cx = c.getContext('2d');
    cx.drawImage(this.atlas, g.atlasX, g.atlasY, g.w, g.h, 0, 0, g.w, g.h);
    const d = cx.getImageData(0, 0, g.w, g.h).data;
    let top = -1, bot = -1;
    for (let y = 0; y < g.h; y++) {
      let ink = false;
      for (let x = 0; x < g.w; x++) { if (d[(y * g.w + x) * 4 + 3] > 40) { ink = true; break; } }
      if (ink) { if (top < 0) top = y; bot = y; }
    }
    return { top: top < 0 ? 0 : top, bot: bot < 0 ? g.h - 1 : bot };
  }
  // cap-height of the real bitmap glyphs (px, baseline to cap top), measured once from the
  // firmware atlas using a representative uppercase/digit glyph - not eyeballed.
  _bmCapH() {
    if (this._capH != null) return this._capH;
    let g = null;
    for (const cp of [0x4E, 0x45, 0x48, 0x41, 0x30]) { if (this.meta.glyphs[cp]) { g = this.meta.glyphs[cp]; break; } }
    if (!g) { this._capH = this.meta.baseline; return this._capH; }
    this._capH = Math.max(1, this.meta.baseline - this._bmInk(g).top);
    return this._capH;
  }
  // per-char class (numeric vs text); separators stick to the current class so clock/date
  // strings like 01/01 and 12:34 stay fully numeric and use the number font.
  _vecClasses(str) {
    const cls = []; let cur = 'text';
    for (const ch of str) { const cp = ch.codePointAt(0); const c = isDigit(cp) ? 'num' : (isSep(cp) ? cur : 'text'); cur = c; cls.push(c); }
    return cls;
  }
  // Render a string GLYPH BY GLYPH at the real bitmap pen positions: the pen advances by each
  // glyph's bitmap advance, so per-letter spacing and total width match the native (1x) layout
  // exactly. Each glyph picks its font via pickFont(): a vector glyph is scaled to the bitmap
  // cap-height (baseline aligned) and centred in its advance cell, keeping the font's natural
  // aspect unless it would overflow the cell (then it condenses to fit); a glyph no vector font
  // covers is blitted straight from the bitmap atlas (bmSrc) at its native size.
  _vecRender(ctx, str, x, y, color, bmSrc) {
    const mctx = this._mctx();
    const capH = this._bmCapH();
    const cls = this._vecClasses(str);
    const by = y + this.vecBase;
    ctx.save();
    ctx.fillStyle = color; ctx.textBaseline = 'alphabetic';
    let pen = x, i = 0;
    for (const ch of str) {
      const cp = ch.codePointAt(0);
      const g = this.meta.glyphs[cp];
      const adv = g ? g.advance : (this.meta.spaceAdvance || 6);
      if (g && ch !== ' ') {
        const fam = pickFont(cp, cls[i]);
        if (fam) {
          const S = this._famScale(mctx, fam, capH);
          mctx.font = `${this.vecSize}px '${fam}', sans-serif`;
          const nadv = mctx.measureText(ch).width || adv;
          const sx = nadv * S <= adv ? S : adv / nadv;
          const off = (adv - nadv * sx) / 2;
          ctx.save();
          ctx.font = `${this.vecSize}px '${fam}', sans-serif`;
          ctx.translate(pen + off, by); ctx.scale(sx, S);
          ctx.fillText(ch, 0, 0);
          ctx.restore();
        } else if (g.w > 0 && bmSrc) {
          const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
          ctx.drawImage(bmSrc, g.atlasX, g.atlasY, g.w, g.h, (pen + (g.left || 0)) | 0, y | 0, g.w, g.h);
          ctx.imageSmoothingEnabled = sm;
        }
      }
      pen += adv; i++;
    }
    ctx.restore();
    return pen - x;
  }

  // track: extra px of pen advance added after every glyph (including the last, since
  // it also widens the block for centre/right alignment). 0 for fixed system labels
  // ("User" in the status pill measures pixel-exact with track=0); user-entered profile
  // text (message, birthday) measures pixel-exact only with track=1 - see PROFILE card
  // notes where this was derived from real capture glyph-boundary positions, not guessed.
  measure(str, track = 0) {
    if (!this.ready()) return str.length * 6;
    let w = 0;
    for (const ch of str) { const g = this.meta.glyphs[ch.codePointAt(0)]; w += (g ? g.advance : (this.meta.spaceAdvance || 6)) + track; }
    return w;
  }

  // draw left-aligned at (x,y) baseline-top; color tints white glyphs
  draw(ctx, str, x, y, color = '#000', track = 0) {
    if (!this.ready()) { ctx.fillStyle = color; ctx.font = '10px sans-serif'; ctx.fillText(str, x, y + 9); return; }
    if (this._useVecStr(str)) { return this._vecRender(ctx, str, x, y, color, this._tinted(color)); }
    const src = this._tinted(color);
    let cx = x;
    for (const ch of str) {
      const g = this.meta.glyphs[ch.codePointAt(0)];
      if (!g) { cx += (this.meta.spaceAdvance || 6) + track; continue; }
      if (g.w > 0) ctx.drawImage(src, g.atlasX, g.atlasY, g.w, g.h, (cx + (g.left || 0)) | 0, y | 0, g.w, g.h);
      cx += g.advance + track;
    }
    return cx - x;
  }
  // the launcher centres text by truncating (floor), not rounding: for odd-width
  // strings that lands the block 1px left of round(), matching the reference.
  // per-glyph vector runs advance by the bitmap widths, so the vector total width equals
  // measure(str) and centring/right-align use the same math as the bitmap path.
  drawCentered(ctx, str, cx, y, color, track = 0) { const w = this.measure(str, track); this.draw(ctx, str, Math.floor(cx - w / 2), y, color, track); }
  drawRight(ctx, str, rx, y, color, track = 0) { const w = this.measure(str, track); this.draw(ctx, str, Math.round(rx - w), y, color, track); }

  // The DSi renders 2bpp text as a FIXED OPAQUE anti-alias ramp that REPLACES the
  // pixels underneath (not an alpha blend of white over the background). Reproduce
  // it: quantise the atlas coverage-alpha into levels 0..3 and emit the opaque
  // palette colour per level. levels = {1:[r,g,b], 2:[...], 3:[...]}; 0 stays clear.
  _leveled(key, levels) {
    if (!this._lvlCache) this._lvlCache = {};
    if (this._lvlCache[key]) return this._lvlCache[key];
    const c = document.createElement('canvas'); c.width = this.atlas.width; c.height = this.atlas.height;
    const cx = c.getContext('2d'); cx.drawImage(this.atlas, 0, 0);
    const im = cx.getImageData(0, 0, c.width, c.height); const d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      const lvl = a < 50 ? 0 : (a < 145 ? 1 : (a < 218 ? 2 : 3));
      if (lvl === 0) { d[i + 3] = 0; }
      else { const col = levels[lvl]; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255; }
    }
    cx.putImageData(im, 0, 0);
    this._lvlCache[key] = c; return c;
  }
  drawLevels(ctx, str, x, y, key, levels, track = 0) {
    if (!this.ready()) { this.draw(ctx, str, x, y, `rgb(${levels[3].join(',')})`); return; }
    if (this._useVecStr(str)) { this._vecRender(ctx, str, x, y, `rgb(${levels[3].join(',')})`, this._leveled(key, levels)); return; }
    const src = this._leveled(key, levels); const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    let cx = x;
    for (const ch of str) {
      const g = this.meta.glyphs[ch.codePointAt(0)];
      if (!g) { cx += (this.meta.spaceAdvance || 6) + track; continue; }
      if (g.w > 0) ctx.drawImage(src, g.atlasX, g.atlasY, g.w, g.h, (cx + (g.left || 0)) | 0, y | 0, g.w, g.h);
      cx += g.advance + track;
    }
    ctx.imageSmoothingEnabled = sm;
  }
  drawCenteredLevels(ctx, str, cx, y, key, levels, track = 0) { const w = this.measure(str, track); this.drawLevels(ctx, str, Math.floor(cx - w / 2), y, key, levels, track); }
  drawRightLevels(ctx, str, rx, y, key, levels, track = 0) { const w = this.measure(str, track); this.drawLevels(ctx, str, Math.round(rx - w), y, key, levels, track); }

  // produce a color-tinted version of the (white-on-transparent) atlas
  _tinted(color) {
    if (!this._tintCache) this._tintCache = {};
    if (this._tintCache[color]) return this._tintCache[color];
    const c = document.createElement('canvas');
    c.width = this.atlas.width; c.height = this.atlas.height;
    const cx = c.getContext('2d');
    cx.drawImage(this.atlas, 0, 0);
    cx.globalCompositeOperation = 'source-in';
    cx.fillStyle = color;
    cx.fillRect(0, 0, c.width, c.height);
    this._tintCache[color] = c;
    return c;
  }
}

export const Fonts = {
  s: new BitmapFont('s'), m: new BitmapFont('m'), l: new BitmapFont('l'), banner: new BitmapFont('banner'),
  settings: new BitmapFont('settings'),
  async load() {
    COVERAGE = await Assets.loadJSON('font_coverage', 'public/font/coverage.json').catch(() => null);
    const names = { s: 'TBF1_s', m: 'TBF1_m', l: 'TBF1_l', banner: 'TBF1_banner_lm', settings: 'TBF1_banner_m' };
    for (const [k, f] of Object.entries(names)) {
      const meta = await Assets.loadJSON('font_' + k, `public/font/${f}.json`).catch(() => null);
      const img = await Assets.loadImage('font_' + k, `public/font/${f}.png`);
      if (meta && img) this[k].attach(img, meta);
    }
  },
};
