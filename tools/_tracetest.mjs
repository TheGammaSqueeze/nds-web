// Find a clean (not blocky, not wavy) vectorization of the real TBF1_m glyphs. Render a test
// string to a bilevel of the 2bpp font, then trace it several ways and stack the results under
// the original bitmap crop to pick the best smooth-upscale settings.
import fs from 'fs';
import { execSync } from 'child_process';
const { parseFNTR, glyphPixels } = await import('./nftr.js').then(m => m.default || m);

const str = 'BEFORE PLAYING, READ THE HEALTH';
const f = parseFNTR(fs.readFileSync('assets/launcher/fs/font/ww/TBF1_m.NFTR'));
const dir = '/tmp/tracetest'; fs.mkdirSync(dir, { recursive: true });

// render string bilevel (ink = 2bpp level >= 2) at native res
let W = 2; for (const ch of str) { const gi = f.cmap[ch.codePointAt(0)]; W += gi != null && f.widths[gi] ? f.widths[gi].advance : 6; }
const H = f.tileH;
const ink = Buffer.alloc(W * H, 0);
let pen = 1;
for (const ch of str) { const gi = f.cmap[ch.codePointAt(0)]; if (gi == null) { pen += 6; continue; } const px = glyphPixels(f, gi), gw = f.tileW, left = (f.widths[gi] || {}).left || 0; for (let y = 0; y < H; y++) for (let x = 0; x < gw; x++) if (px[y * gw + x] >= 2) { const dx = pen + left + x; if (dx >= 0 && dx < W) ink[y * W + dx] = 1; } pen += (f.widths[gi] || {}).advance || gw; }
// write PGM (0=ink black, 255=white) for mkbitmap, and PBM for direct potrace
const pgm = Buffer.alloc(W * H, 255); for (let i = 0; i < W * H; i++) if (ink[i]) pgm[i] = 0;
fs.writeFileSync(`${dir}/s.pgm`, Buffer.concat([Buffer.from(`P5\n${W} ${H}\n255\n`, 'latin1'), pgm]));

const variants = [
  ['A_smooth_f4s4', `mkbitmap -f 4 -s 4 -t 0.45 -o ${dir}/A.pbm ${dir}/s.pgm && potrace -s -a 1.3 -O 0.3 -o ${dir}/A.svg ${dir}/A.pbm`],
  ['B_smooth_f8s6', `mkbitmap -f 8 -s 6 -t 0.45 -o ${dir}/B.pbm ${dir}/s.pgm && potrace -s -a 1.3 -O 0.3 -o ${dir}/B.svg ${dir}/B.pbm`],
  ['C_smooth_f2s8', `mkbitmap -f 2 -s 8 -t 0.5 -o ${dir}/C.pbm ${dir}/s.pgm && potrace -s -a 1.5 -O 0.2 -o ${dir}/C.svg ${dir}/C.pbm`],
];
const pngs = [];
execSync(`convert webapp/public/boot/healthsafety.png -crop 232x14+22+44 +repage -resize x64 ${dir}/orig.png`);
pngs.push(`${dir}/orig.png`);
console.log('order: ORIGINAL, ' + variants.map(v => v[0]).join(', '));
for (const [name, cmd] of variants) { execSync(cmd); execSync(`convert -background white ${dir}/${name[0]}.svg -resize x64 ${dir}/${name}.png`); pngs.push(`${dir}/${name}.png`); }
execSync(`convert ${pngs.join(' ')} -background '#dddddd' -gravity West -append ${dir}/compare.png`);
console.log('wrote', `${dir}/compare.png`);
