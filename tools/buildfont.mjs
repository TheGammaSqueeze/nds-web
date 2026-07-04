// Build a reusable vector font from a real firmware NFTR by clean-tracing every glyph
// (bilevel of the 2bpp data -> nearest upscale -> potrace, so it is a crisp upscale of the
// real letterforms, not wavy and not pixellated). Emits a glyph atlas JSON: per-codepoint
// path 'd' (raw potrace coords) + advance/left, plus the single matrix mapping trace coords
// into native cell pixels (y-down, baseline at row `baseline`). A renderer draws each glyph
// with Path2D at any size. Reusable for arbitrary text (the whole font, not just one string).
import fs from 'fs';
import { execSync } from 'child_process';
const { parseFNTR, glyphPixels } = await import('./nftr.js').then(m => m.default || m);

const fontPath = process.argv[2] || 'assets/launcher/fs/font/ww/TBF1_m.NFTR';
const outPath = process.argv[3] || 'webapp/public/font/dsboot.json';
const MK = 4, INK = 2;                   // mkbitmap upscale, ink threshold on the 0..3 ramp
const f = parseFNTR(fs.readFileSync(fontPath));
const dir = '/tmp/buildfont'; fs.mkdirSync(dir, { recursive: true });

// Render the glyph to a native-res bilevel, then mkbitmap interpolates + upscales it and
// potrace traces smooth curves (not the blocky nearest-trace). This is the recommended
// potrace smoothing workflow, so the real firmware letterforms come out cleanly upscaled.
function trace(gi) {
  const px = glyphPixels(f, gi), W = f.tileW, H = f.tileH;
  const pgm = Buffer.alloc(W * H, 255);
  let any = false;
  for (let i = 0; i < W * H; i++) if (px[i] >= INK) { pgm[i] = 0; any = true; }
  if (!any) return '';
  fs.writeFileSync(`${dir}/g.pgm`, Buffer.concat([Buffer.from(`P5\n${W} ${H}\n255\n`, 'latin1'), pgm]));
  execSync(`mkbitmap -f 4 -s ${MK} -t 0.5 -o ${dir}/g.pbm ${dir}/g.pgm`);
  execSync(`potrace -s -a 1.3 -O 0.3 -o ${dir}/g.svg ${dir}/g.pbm`);
  const svg = fs.readFileSync(`${dir}/g.svg`, 'latin1');
  const ds = [...svg.matchAll(/<path d="([^"]+)"/g)].map(m => m[1]);
  return ds.join(' ');
}

const glyphs = {};
let n = 0;
for (const [cpStr, gi] of Object.entries(f.cmap)) {
  const cp = +cpStr;
  if (cp < 0x20 || cp > 0x7e) continue;             // ASCII printable is plenty for the boot screen first
  const w = f.widths[gi] || { advance: f.defaultCharW || 6, left: 0 };
  const d = trace(gi);
  glyphs[cp] = { d, advance: w.advance, left: w.left || 0 };
  n++;
}
// cap height: ink-top of 'H' to baseline
const giH = f.cmap[0x48]; let capTop = f.baseline;
if (giH != null) { const px = glyphPixels(f, giH); for (let y = 0; y < f.tileH; y++) { let ink = false; for (let x = 0; x < f.tileW; x++) if (px[y * f.tileW + x] >= INK) { ink = true; break; } if (ink) { capTop = y; break; } } }
const out = { name: 'dsboot', up: MK, cellW: f.tileW, cellH: f.tileH, baseline: f.baseline, capHeight: f.baseline - capTop, spaceAdvance: (f.widths[f.cmap[0x20]] || {}).advance || (f.defaultCharW || 6), glyphs };
fs.writeFileSync(outPath, JSON.stringify(out));
console.log(`built ${n} glyphs -> ${outPath} (${(JSON.stringify(out).length / 1024 | 0)}KB), cellH=${f.tileH} baseline=${f.baseline} cap=${out.capHeight}`);
