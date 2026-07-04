// Decode the DSi launcher per-favorite-color palette overrides.
//
// assets/launcher/narc/usercolor_launcher/*.NCLR are "mask" palette banks the
// System Menu swaps in to recolour the animated background / UI accent to the
// user's chosen favorite color. File naming: msk_<layout>_<bank>.NCLR where the
// trailing hex is a palette-bank id; bank 0x0D of launcher_D is the
// favorite-color bank and ships as 16 variants UC0D0..UC0DF, one per DSi
// favorite color (index 0..15). Each NCLR holds 16 sub-palettes of 16 BGR555
// colors (animation frames of the rippling background gradient).
//
// We decode with the verified parseNCLR, write usercolor.json (filename ->
// palettes as [r,g,b]), render a 16x16 swatch grid per file, and build a
// labelled montage of the 16 favorite-color variants for visual confirmation.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parseNCLR } = require('./ndsgfx.js');

// DSi favorite-color order (system color index 0..15), confirmed against the
// varying palette positions (bank 15, index 1 is the cleanest representative).
const FAV_NAMES = [
  'grey', 'brown', 'red', 'pink', 'orange', 'yellow', 'lime', 'green',
  'dark-green', 'turquoise', 'light-blue', 'blue', 'dark-blue', 'violet',
  'magenta', 'rose',
];

function favIndexFromName(name) {
  const m = name.match(/UC0D([0-9A-Fa-f])\.NCLR$/);
  return m ? parseInt(m[1], 16) : null;
}

// Render a palette set to an RGBA buffer: rows = palettes, cols = 16 colors.
function renderSwatch(nclr, cell) {
  const rows = nclr.palettes.length;
  const cols = nclr.colorsPer;
  const W = cols * cell, H = rows * cell;
  const out = Buffer.alloc(W * H * 4, 0);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const col = nclr.palettes[r][c] || [0, 0, 0];
      for (let y = 0; y < cell; y++) {
        for (let x = 0; x < cell; x++) {
          const px = c * cell + x, py = r * cell + y;
          const o = (py * W + px) * 4;
          out[o] = col[0]; out[o + 1] = col[1]; out[o + 2] = col[2]; out[o + 3] = 255;
        }
      }
    }
  }
  return { w: W, h: H, data: out };
}

function rgbaToPNG(img, pngPath) {
  const raw = pngPath + '.rgba';
  fs.writeFileSync(raw, img.data);
  // -strip: see tools/ncer.js writePNG for why (ImageMagick's default gAMA/cHRM
  // chunks make Chromium silently shift decoded RGB values by a few levels).
  execSync(`convert -size ${img.w}x${img.h} -depth 8 rgba:${raw} -strip ${pngPath}`);
  fs.unlinkSync(raw);
}

if (require.main === module) {
  const dir = process.argv[2] || 'assets/launcher/narc/usercolor_launcher';
  const outDir = process.argv[3] || 'assets/launcher/decoded/usercolor';
  fs.mkdirSync(outDir, { recursive: true });

  const files = fs.readdirSync(dir).filter((f) => f.toUpperCase().endsWith('.NCLR')).sort();
  const json = {};
  for (const f of files) {
    const nclr = parseNCLR(fs.readFileSync(path.join(dir, f)));
    const favIdx = favIndexFromName(f);
    json[f] = {
      bitDepth: nclr.bitDepth,
      colorsPerPalette: nclr.colorsPer,
      paletteCount: nclr.palettes.length,
      favoriteColorIndex: favIdx,
      favoriteColorName: favIdx !== null ? FAV_NAMES[favIdx] : null,
      // representative accent: palette bank 15, color 1 (cleanest hue carrier).
      representativeColor: nclr.palettes[15] ? nclr.palettes[15][1] : null,
      palettes: nclr.palettes,
    };
    rgbaToPNG(renderSwatch(nclr, 12), path.join(outDir, f.replace(/\.NCLR$/i, '.png')));
  }
  fs.writeFileSync(
    path.join('assets/launcher/decoded', 'usercolor.json'),
    JSON.stringify(json, null, 2) + '\n');

  // Build a labelled montage of the 16 favorite-color variants, using palette
  // bank 15 (the most colour-distinct frame) as a 16-swatch strip per file.
  const favFiles = files
    .filter((f) => favIndexFromName(f) !== null)
    .sort((a, b) => favIndexFromName(a) - favIndexFromName(b));
  const stripDir = path.join(outDir, 'strips');
  fs.mkdirSync(stripDir, { recursive: true });
  const labelled = [];
  for (const f of favFiles) {
    const nclr = parseNCLR(fs.readFileSync(path.join(dir, f)));
    const idx = favIndexFromName(f);
    // single strip from palette bank 15
    const one = { palettes: [nclr.palettes[15]], colorsPer: nclr.colorsPer };
    const img = renderSwatch(one, 16);
    const p = path.join(stripDir, `${String(idx).padStart(2, '0')}_${FAV_NAMES[idx]}.png`);
    rgbaToPNG(img, p);
    labelled.push({ p, label: `${idx} ${FAV_NAMES[idx]}` });
  }
  const args = labelled.map((l) => `-label "${l.label}" ${l.p}`).join(' ');
  execSync(`montage ${args} -tile 4x4 -geometry +4+4 -background white -pointsize 13 ${path.join(outDir, 'favorites_montage.png')}`);

  console.log('wrote usercolor.json and', files.length, 'swatch PNGs ->', outDir);
  console.log('favorite-color montage -> favorites_montage.png');
  // print the favorite-color summary
  for (const f of favFiles) {
    const idx = favIndexFromName(f);
    console.log(' ', String(idx).padStart(2), FAV_NAMES[idx].padEnd(11), f,
      'rep', JSON.stringify(json[f].representativeColor));
  }
}
