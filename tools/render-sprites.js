// Render launcher NCER cells with the correct favorite-color (usercolor) palette.
// Outputs themed sprite PNGs + a sprites manifest for the web app.
const fs = require('fs');
const path = require('path');
const G = require('./ndsgfx.js');
const N = require('./ncer.js');

function renderLayout(layoutDir, ncgrFile, nclrFile, outDir, label) {
  const ncgr = G.parseNCGR(fs.readFileSync(path.join(layoutDir, ncgrFile)));
  const nclr = G.parseNCLR(fs.readFileSync(nclrFile));
  const ncerBuf = fs.readFileSync(path.join(layoutDir, fs.readdirSync(layoutDir).find(f => /\.ncer$/i.test(f))));
  const { cells, mappingMode } = N.parseNCER(ncerBuf);
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = [];
  cells.forEach((cell, i) => {
    const img = N.renderCell(cell, ncgr, nclr, mappingMode);
    if (!img || !img.w || !img.h) { manifest.push({ cell: i, w: 0, h: 0 }); return; }
    const out = path.join(outDir, `cell_${String(i).padStart(2, '0')}.png`);
    N.writePNG(img, out, '/tmp');
    manifest.push({ cell: i, w: img.w, h: img.h, file: `cell_${String(i).padStart(2, '0')}.png` });
  });
  console.log(`${label}: rendered ${manifest.filter(m => m.w).length}/${cells.length} cells -> ${outDir}`);
  return manifest;
}

const A = '/work/nds/assets/launcher';
const out = '/work/nds/webapp/public/sprites';

// bottom screen, blue theme (UC0B)
const dman = renderLayout(
  `${A}/narc/launcher_d`, 'msk_launcher_D.ncgr',
  `${A}/narc/usercolor_launcher/msk_launcher_D_UC0B.NCLR`,
  `${out}/launcher_d`, 'launcher_d(blue)');

// top screen, its themed palette (UC0F) -- falls back to base if absent
const uNclr = fs.existsSync(`${A}/narc/usercolor_launcher/msk_launcher_U_UC0F.NCLR`)
  ? `${A}/narc/usercolor_launcher/msk_launcher_U_UC0F.NCLR`
  : `${A}/narc/launcher_u/msk_launcher_U.NCLR`;
const uman = renderLayout(`${A}/narc/launcher_u`, 'msk_launcher_U.ncgr', uNclr, `${out}/launcher_u`, 'launcher_u');

fs.writeFileSync(`${out}/sprites_themed.json`, JSON.stringify({ launcher_d: dman, launcher_u: uman }, null, 2));
console.log('wrote sprites_themed.json');
