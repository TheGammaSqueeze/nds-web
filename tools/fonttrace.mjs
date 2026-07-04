// Clean vectorizer test for a real firmware NFTR font. Renders each glyph from the 2bpp
// NFTR data to a bilevel bitmap (hard edges, so potrace makes smooth curves instead of the
// wavy result you get tracing anti-aliased coverage), upscales nearest, and traces it. Output
// is one strip PNG so the letterform quality (not wavy) can be judged before building the font.
import fs from 'fs';
import { execSync } from 'child_process';
const { parseFNTR, glyphPixels } = await import('./nftr.js').then(m => m.default || m);

const fontPath = process.argv[2] || 'assets/launcher/fs/font/ww/TBF1_m.NFTR';
const text = process.argv[3] || 'ABEHRSTOUNILGWARNING';
const UP = 12;                 // nearest upscale before tracing
const f = parseFNTR(fs.readFileSync(fontPath));
const dir = '/tmp/fonttrace'; fs.mkdirSync(dir, { recursive: true });

const svgs = [];
let xoff = 0;
const placed = [];
for (const ch of text) {
  const gi = f.cmap[ch.codePointAt(0)]; if (gi == null) continue;
  const px = glyphPixels(f, gi);                  // levels 0..3, tileW*tileH
  const W = f.tileW, H = f.tileH;
  // bilevel: ink where level >= 2 (the solid part of the 2bpp ramp)
  const UW = W * UP, UH = H * UP;
  const bm = Buffer.alloc(UW * UH, 0);            // 0 = white in our convention below
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (px[y * W + x] >= 2) for (let yy = 0; yy < UP; yy++) for (let xx = 0; xx < UP; xx++) bm[(y * UP + yy) * UW + (x * UP + xx)] = 1;
  }
  // write PBM P4 (1=black). Our bm: 1=ink -> black.
  const rowBytes = Math.ceil(UW / 8);
  const pbm = Buffer.alloc(rowBytes * UH);
  for (let y = 0; y < UH; y++) for (let x = 0; x < UW; x++) if (bm[y * UW + x]) pbm[y * rowBytes + (x >> 3)] |= (0x80 >> (x & 7));
  const hdr = Buffer.from(`P4\n${UW} ${UH}\n`, 'latin1');
  fs.writeFileSync(`${dir}/${gi}.pbm`, Buffer.concat([hdr, pbm]));
  // trace: moderate corner smoothing, optimize, drop specks -> clean not wavy
  execSync(`potrace -s -a 1.0 -O 0.2 -t 4 -o ${dir}/${gi}.svg ${dir}/${gi}.pbm`);
  placed.push({ gi, ch });
}
// render each glyph SVG to PNG and append horizontally for a visual strip
const pngs = placed.map(p => { execSync(`convert -background white ${dir}/${p.gi}.svg -resize x120 ${dir}/${p.gi}.png`); return `${dir}/${p.gi}.png`; });
execSync(`convert ${pngs.join(' ')} +append -bordercolor '#ccc' -border 4 ${dir}/strip.png`);
console.log('wrote', `${dir}/strip.png`, 'glyphs:', placed.map(p => p.ch).join(''));
