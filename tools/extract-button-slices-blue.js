// Extracts the SELECTED (favourite-colour blue) variants of the settings
// glossy-capsule sprites from sm_setting_D.ncer/.ncgr, using the runtime
// palette-swap mask sm_setting_D_UC02.NCLR (favourite-colour bank 11 = blue,
// per tools/usercolor.js FAV_NAMES[11] = 'blue').
//
// How this was found (by dissecting the firmware rather than guessing): the static sm_setting_D.NCLR only
// ships a grey ramp for palette bank 0 (and fixed pink/red ramps for banks 1
// and 2). The live "selected" blue is not a procedural gradient - the DSi
// system menu loads a per-user favourite-colour mask NCLR at runtime and
// swaps it into palette RAM, re-using the exact same cell/tile geometry.
// That mask NARC is assets/launcher/szs/set_usercolor_setting.bin; its
// decoded contents live in assets/launcher/narc/usercolor_setting/. Bank 11
// of sm_setting_D_UC02.NCLR was confirmed byte-for-byte identical to the
// blue seen on screen (diff=0 against melonDS captures), for THREE distinct
// real sprites, each verified against an independent melonDS ground truth:
//   - cell 0 (mid/rcap/lcap, the standard 24px list-row/button capsule):
//     against out/settings/sub_language.bot.ppm's selected row.
//   - cell 9 / cell 10 (right/left tall page-turn arrow pill, 32x66):
//     against out/settings/pg1.bot.ppm and pg2.bot.ppm (0-diff at (231,63)
//     and (4,62) respectively).
//   - cell 113 / cell 114 (up/down small scrollbar arrow, 25x32): against
//     out/settings/sub_country.bot.ppm (0-diff at (230,14) and (230,134)).
// All three reuse the identical palOverride=11 mechanism: force every OAM in
// the cell (regardless of its own static .pal field) to sample bank 11 of
// sm_setting_D_UC02.NCLR. That single mask, applied uniformly, reproduces
// every one of these "blue" sprites pixel-exact - it is not a per-shape
// coincidence, it's how the game itself recolours these controls.
const fs = require('fs');
const G = require('./ndsgfx.js');
const N = require('./ncer.js');

const ROOT = '/work/nds';
const ncerBuf = fs.readFileSync(`${ROOT}/assets/launcher/settings_common/sm_setting_D.ncer`);
const ncgrBuf = fs.readFileSync(`${ROOT}/assets/launcher/settings_common/sm_setting_D.ncgr`);
const nclrBuf = fs.readFileSync(`${ROOT}/assets/launcher/narc/usercolor_setting/sm_setting_D_UC02.NCLR`);

const ncer = N.parseNCER(ncerBuf);
const ncgr = G.parseNCGR(ncgrBuf);
const nclr = G.parseNCLR(nclrBuf);
const BLUE_BANK = 11; // FAV_NAMES[11] === 'blue' (tools/usercolor.js)

const tmpDir = '/tmp/btn_extract_blue';
fs.mkdirSync(tmpDir, { recursive: true });
const OUT = `${ROOT}/webapp/public/sprites`;

function singleCell(oam) {
  return { index: 0, nOAM: 1, cellAttr: 0, bounds: null, oams: [{ ...oam, x: 0, y: 0, disable: false }] };
}

// --- standard 24px capsule: cell0's mid/rcap/lcap pieces, same decomposition
// as the grey extraction in extract-button-slices.js, just palette-swapped.
const cell0 = ncer.cells[0];
const oamMid = cell0.oams[0];
const oamRcap = cell0.oams[2];
const oamLcap = cell0.oams[3];

const midImg = N.renderCell(singleCell(oamMid), ncgr, nclr, ncer.mappingMode, BLUE_BANK);
const rcapImg = N.renderCell(singleCell(oamRcap), ncgr, nclr, ncer.mappingMode, BLUE_BANK);
const lcapImg = N.renderCell(singleCell(oamLcap), ncgr, nclr, ncer.mappingMode, BLUE_BANK);
N.writePNG(midImg, `${OUT}/setting_btn_mid_sel.png`, tmpDir);
N.writePNG(rcapImg, `${OUT}/setting_btn_rcap_sel.png`, tmpDir);
N.writePNG(lcapImg, `${OUT}/setting_btn_lcap_sel.png`, tmpDir);
console.log('mid', midImg.w, midImg.h, 'rcap', rcapImg.w, rcapImg.h, 'lcap', lcapImg.w, lcapImg.h);

// --- tall page-turn arrow pill: cell9 (right/next) and cell10 (left/prev),
// whole-cell sprites (capsule + triangle + baked shadow), 32x66.
const arrowRight = N.renderCell(ncer.cells[9], ncgr, nclr, ncer.mappingMode, BLUE_BANK);
const arrowLeft = N.renderCell(ncer.cells[10], ncgr, nclr, ncer.mappingMode, BLUE_BANK);
N.writePNG(arrowRight, `${OUT}/setting_pagearrow_right.png`, tmpDir);
N.writePNG(arrowLeft, `${OUT}/setting_pagearrow_left.png`, tmpDir);
console.log('pagearrow right', arrowRight.w, arrowRight.h, 'ox', arrowRight.ox, 'oy', arrowRight.oy);
console.log('pagearrow left', arrowLeft.w, arrowLeft.h, 'ox', arrowLeft.ox, 'oy', arrowLeft.oy);

// --- small scrollbar arrow: cell113 (up) and cell114 (down), whole-cell
// sprites (mirrored single-tile capsule + triangle), 25x32.
const scrollUp = N.renderCell(ncer.cells[113], ncgr, nclr, ncer.mappingMode, BLUE_BANK);
const scrollDown = N.renderCell(ncer.cells[114], ncgr, nclr, ncer.mappingMode, BLUE_BANK);
N.writePNG(scrollUp, `${OUT}/setting_scrollarrow_up.png`, tmpDir);
N.writePNG(scrollDown, `${OUT}/setting_scrollarrow_down.png`, tmpDir);
console.log('scrollarrow up', scrollUp.w, scrollUp.h, 'ox', scrollUp.ox, 'oy', scrollUp.oy);
console.log('scrollarrow down', scrollDown.w, scrollDown.h, 'ox', scrollDown.ox, 'oy', scrollDown.oy);

console.log('wrote blue sprite slices ->', OUT);
