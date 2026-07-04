// Extracts all 16 favourite-colour variants of the carousel's selection frame
// (cell_00 selFramePlain, cell_02 selFrame) from msk_launcher_D.ncer/.ncgr, using
// the same runtime palette-swap mechanism as tools/extract-button-slices-colors.js
// did for the Settings glossy buttons.
//
// Real melonDS ground truth (scratch NAND patched via melonDS/headless/nandfs.cpp
// setfavcolor, booted to the carousel with scripts/idle_anim.txt) confirmed both
// cells render with palette bank 11 (blue, msk_launcher_D_UC0B.NCLR), matching the
// NCER's own baked-in OAM pal attribute. Verified bank-11 output here is pixel-
// identical to the existing blue-baked cell_00.png/cell_02.png. The clone previously
// always drew those blue-baked PNGs regardless of favColor; this generates the other
// 15 real variants so it can pick the right one.
//
// cell_01 (selFramePressed, OAM pal 12) is deliberately NOT extracted here: it is
// dead code (no draw call in webapp/src/launcher.js references it, only map.json
// lists it) and there is no real melonDS capture of the pressed state at a
// non-default favColor to confirm which mask file/bank it actually uses at runtime.
const fs = require('fs');
const G = require('./ndsgfx.js');
const N = require('./ncer.js');

const ROOT = '/work/nds';
const A = `${ROOT}/assets/launcher/narc/launcher_d`;
const ncerBuf = fs.readFileSync(`${A}/msk_launcher_D.ncer`);
const ncgrBuf = fs.readFileSync(`${A}/msk_launcher_D.ncgr`);
const nclrUC0B = G.parseNCLR(fs.readFileSync(`${ROOT}/assets/launcher/narc/usercolor_launcher/msk_launcher_D_UC0B.NCLR`));

const { cells, mappingMode } = N.parseNCER(ncerBuf);
const ncgr = G.parseNCGR(ncgrBuf);

const FAV_NAMES = [
  'grey', 'brown', 'red', 'pink', 'orange', 'yellow', 'lime', 'green',
  'dark-green', 'turquoise', 'light-blue', 'blue', 'dark-blue', 'violet',
  'magenta', 'rose',
];

const tmpDir = '/tmp/selframe_extract_colors';
fs.mkdirSync(tmpDir, { recursive: true });
const OUT = `${ROOT}/webapp/public/sprites/launcher_d`;

let written = 0;
for (let bank = 0; bank < 16; bank++) {
  const name = FAV_NAMES[bank];
  const plainImg = N.renderCell(cells[0], ncgr, nclrUC0B, mappingMode, bank);
  const frameImg = N.renderCell(cells[2], ncgr, nclrUC0B, mappingMode, bank);
  N.writePNG(plainImg, `${OUT}/cell_00_${name}.png`, tmpDir);
  N.writePNG(frameImg, `${OUT}/cell_02_${name}.png`, tmpDir);
  written += 2;
  console.log(bank, name.padEnd(11), 'ok');
}
console.log('wrote', written, 'PNGs (16 colours x 2 cells) ->', OUT);
