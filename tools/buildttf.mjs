// Build a real TrueType font (dsfw.ttf) from the firmware NFTR glyphs, so the boot/UI text can
// use the actual DSi typeface (which matches the original) via a normal @font-face, rendered by
// the browser font engine. Each glyph is clean-traced (bilevel -> mkbitmap interpolation ->
// potrace) and its outline converted into opentype.js path commands in font units.
import fs from 'fs';
import { execSync } from 'child_process';
import opentype from 'opentype.js';
const { parseFNTR, glyphPixels } = await import('./nftr.js').then(m => m.default || m);

const fontPath = process.argv[2] || 'assets/launcher/fs/font/ww/TBF1_m.NFTR';
const outPath = process.argv[3] || 'webapp/public/font/dsfw.ttf';
const MK = 4, INK = 2, UPEM = 1000;
const f = parseFNTR(fs.readFileSync(fontPath));
const PX = UPEM / f.tileH;                 // px -> font units (cell height = 1 em)
const dir = '/tmp/buildttf'; fs.mkdirSync(dir, { recursive: true });

// trace one glyph -> potrace path 'd' (or '' if blank)
const RAMP = [255, 170, 85, 0];            // 2bpp coverage -> gray, so the trace follows the
function traceD(gi) {                       // ~50% AA contour (correct weight), not the solid shape
  const px = glyphPixels(f, gi), W = f.tileW, H = f.tileH;
  const pgm = Buffer.alloc(W * H, 255); let any = false;
  for (let i = 0; i < W * H; i++) { pgm[i] = RAMP[px[i]]; if (px[i] > 0) any = true; }
  if (!any) return '';
  fs.writeFileSync(`${dir}/g.pgm`, Buffer.concat([Buffer.from(`P5\n${W} ${H}\n255\n`, 'latin1'), pgm]));
  execSync(`mkbitmap -f 4 -s ${MK} -t 0.5 -o ${dir}/g.pbm ${dir}/g.pgm`);
  execSync(`potrace -s -a 1.3 -O 0.3 -o ${dir}/g.svg ${dir}/g.pbm`);
  const svg = fs.readFileSync(`${dir}/g.svg`, 'latin1');
  return [...svg.matchAll(/<path d="([^"]+)"/g)].map(m => m[1]).join(' ');
}

// minimal SVG path tokenizer -> absolute segments (M/L/C), handling relative m/l/c/z from potrace
function toAbs(d) {
  const nums = []; const toks = d.match(/[MmLlCcHhVvZz]|-?\d*\.?\d+/g) || [];
  const segs = []; let i = 0, cx = 0, cy = 0, sx = 0, sy = 0, cmd = '';
  const num = () => parseFloat(toks[i++]);
  while (i < toks.length) {
    let t = toks[i];
    if (/[MmLlCcHhVvZz]/.test(t)) { cmd = t; i++; } // else implicit repeat of last cmd
    if (cmd === 'M' || cmd === 'm') { let x = num(), y = num(); if (cmd === 'm') { x += cx; y += cy; } cx = sx = x; cy = sy = y; segs.push(['M', x, y]); cmd = (cmd === 'm') ? 'l' : 'L'; }
    else if (cmd === 'L' || cmd === 'l') { let x = num(), y = num(); if (cmd === 'l') { x += cx; y += cy; } cx = x; cy = y; segs.push(['L', x, y]); }
    else if (cmd === 'H' || cmd === 'h') { let x = num(); if (cmd === 'h') x += cx; cx = x; segs.push(['L', x, cy]); }
    else if (cmd === 'V' || cmd === 'v') { let y = num(); if (cmd === 'v') y += cy; cy = y; segs.push(['L', cx, y]); }
    else if (cmd === 'C' || cmd === 'c') { let x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num(); if (cmd === 'c') { x1 += cx; y1 += cy; x2 += cx; y2 += cy; x += cx; y += cy; } cx = x; cy = y; segs.push(['C', x1, y1, x2, y2, x, y]); }
    else if (cmd === 'Z' || cmd === 'z') { segs.push(['Z']); cx = sx; cy = sy; }
    else i++;
  }
  return segs;
}

// px (potrace coords) -> font units. potrace g: translate(0, H*MK) scale(0.1,-0.1); viewBox H*MK.
// native_x = px*0.1/MK ; native_ytop = tileH - py*0.1/MK ; font y-up baseline at 0.
function build() {
  const notdef = new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: Math.round(f.tileW * PX), path: new opentype.Path() });
  const glyphs = [notdef];
  for (const [cpStr, gi] of Object.entries(f.cmap)) {
    const cp = +cpStr; if (cp < 0x20 || cp > 0x7e) continue;
    const w = f.widths[gi] || { advance: f.defaultCharW || 6, left: 0 };
    const adv = Math.round((w.advance) * PX);
    const path = new opentype.Path();
    const d = cp === 0x20 ? '' : traceD(gi);
    if (d) {
      const K = 0.1 / MK, left = w.left || 0;
      const FX = px => (px * K + left) * PX;
      const FY = py => (f.baseline - (f.tileH - py * K)) * PX;
      for (const s of toAbs(d)) {
        if (s[0] === 'M') path.moveTo(FX(s[1]), FY(s[2]));
        else if (s[0] === 'L') path.lineTo(FX(s[1]), FY(s[2]));
        else if (s[0] === 'C') path.curveTo(FX(s[1]), FY(s[2]), FX(s[3]), FY(s[4]), FX(s[5]), FY(s[6]));
        else if (s[0] === 'Z') path.close();
      }
    }
    glyphs.push(new opentype.Glyph({ name: 'u' + cp.toString(16), unicode: cp, advanceWidth: adv, path }));
  }
  const font = new opentype.Font({
    familyName: 'DSFW', styleName: 'Regular', unitsPerEm: UPEM,
    ascender: Math.round(f.baseline * PX), descender: Math.round((f.baseline - f.tileH) * PX), glyphs,
  });
  fs.writeFileSync(outPath, Buffer.from(font.toArrayBuffer()));
  console.log(`built TTF ${outPath}: ${glyphs.length} glyphs, upem=${UPEM}, asc=${Math.round(f.baseline * PX)} desc=${Math.round((f.baseline - f.tileH) * PX)}`);
}
build();
