// Extracts all 16 favourite-colour variants of the settings glossy-capsule
// sprites from sm_setting_D.ncer/.ncgr, using the runtime palette-swap mask
// sm_setting_D_UC02.NCLR (see tools/extract-button-slices-blue.js, which did
// this for bank 11 = 'blue' only, the sole colour with melonDS ground truth
// on this NAND). This script is that same extraction looped over all 16
// FAV_NAMES banks (tools/usercolor.js) - the mask NCLR already ships every
// favourite colour's ramp in one file, so no new capture or NARC decode is
// needed, just palOverride 0..15 instead of hardcoding 11.
//
// Output naming: <base>_<favname>.png, e.g. setting_btn_mid_red.png,
// setting_pagearrow_left_violet.png. bank 11 ('blue') is written too and
// verified byte-identical to the existing *_sel.png / unsuffixed pagearrow/
// scrollarrow files it supersedes (see verify step in the caller / TODO.md).
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

const FAV_NAMES = [
  'grey', 'brown', 'red', 'pink', 'orange', 'yellow', 'lime', 'green',
  'dark-green', 'turquoise', 'light-blue', 'blue', 'dark-blue', 'violet',
  'magenta', 'rose',
];

const tmpDir = '/tmp/btn_extract_colors';
fs.mkdirSync(tmpDir, { recursive: true });
const OUT = `${ROOT}/webapp/public/sprites`;

function singleCell(oam) {
  return { index: 0, nOAM: 1, cellAttr: 0, bounds: null, oams: [{ ...oam, x: 0, y: 0, disable: false }] };
}

const cell0 = ncer.cells[0];
const oamMid = cell0.oams[0];
const oamRcap = cell0.oams[2];
const oamLcap = cell0.oams[3];

let written = 0;
for (let bank = 0; bank < 16; bank++) {
  const name = FAV_NAMES[bank];
  const midImg = N.renderCell(singleCell(oamMid), ncgr, nclr, ncer.mappingMode, bank);
  const rcapImg = N.renderCell(singleCell(oamRcap), ncgr, nclr, ncer.mappingMode, bank);
  const lcapImg = N.renderCell(singleCell(oamLcap), ncgr, nclr, ncer.mappingMode, bank);
  N.writePNG(midImg, `${OUT}/setting_btn_mid_${name}.png`, tmpDir);
  N.writePNG(rcapImg, `${OUT}/setting_btn_rcap_${name}.png`, tmpDir);
  N.writePNG(lcapImg, `${OUT}/setting_btn_lcap_${name}.png`, tmpDir);

  const arrowRight = N.renderCell(ncer.cells[9], ncgr, nclr, ncer.mappingMode, bank);
  const arrowLeft = N.renderCell(ncer.cells[10], ncgr, nclr, ncer.mappingMode, bank);
  N.writePNG(arrowRight, `${OUT}/setting_pagearrow_right_${name}.png`, tmpDir);
  N.writePNG(arrowLeft, `${OUT}/setting_pagearrow_left_${name}.png`, tmpDir);

  const scrollUp = N.renderCell(ncer.cells[113], ncgr, nclr, ncer.mappingMode, bank);
  const scrollDown = N.renderCell(ncer.cells[114], ncgr, nclr, ncer.mappingMode, bank);
  N.writePNG(scrollUp, `${OUT}/setting_scrollarrow_up_${name}.png`, tmpDir);
  N.writePNG(scrollDown, `${OUT}/setting_scrollarrow_down_${name}.png`, tmpDir);

  written += 7;
  console.log(bank, name.padEnd(11), 'ok');
}
console.log('wrote', written, 'PNGs (16 colours x 7 elements) ->', OUT);
