// Recreates the button-slice extraction from sm_setting_D.ncer cell 0.
// cell0 OAMs: 0=mid(64x32 tile0), 1=mid dup(x=-64), 2=rcap(32x32 tile4 x=64), 3=lcap(32x32 tile6 x=-96)
const fs = require('fs');
const G = require('./ndsgfx.js');
const N = require('./ncer.js');

const ROOT = '/work/nds';
const ncerBuf = fs.readFileSync(`${ROOT}/assets/launcher/settings_common/sm_setting_D.ncer`);
const ncgrBuf = fs.readFileSync(`${ROOT}/assets/launcher/settings_common/sm_setting_D.ncgr`);
const nclrBuf = fs.readFileSync(`${ROOT}/assets/launcher/settings_common/sm_setting_D.NCLR`);

const ncer = N.parseNCER(ncerBuf);
const ncgr = G.parseNCGR(ncgrBuf);
const nclr = G.parseNCLR(nclrBuf);

const cell0 = ncer.cells[0];
const oamMid = cell0.oams[0];
const oamRcap = cell0.oams[2];
const oamLcap = cell0.oams[3];

function singleCell(oam) {
  return { index: 0, nOAM: 1, cellAttr: 0, bounds: null, oams: [{ ...oam, x: 0, y: 0, disable: false }] };
}

const tmpDir = '/tmp/btn_extract';
const OUT = `${ROOT}/webapp/public/sprites`;

const midImg = N.renderCell(singleCell(oamMid), ncgr, nclr, ncer.mappingMode);
const rcapImg = N.renderCell(singleCell(oamRcap), ncgr, nclr, ncer.mappingMode);
const lcapImg = N.renderCell(singleCell(oamLcap), ncgr, nclr, ncer.mappingMode);

console.log('mid', midImg.w, midImg.h);
console.log('rcap', rcapImg.w, rcapImg.h);
console.log('lcap', lcapImg.w, lcapImg.h);

N.writePNG(midImg, `${OUT}/setting_btn_mid.png`, tmpDir);
N.writePNG(rcapImg, `${OUT}/setting_btn_rcap.png`, tmpDir);
N.writePNG(lcapImg, `${OUT}/setting_btn_lcap.png`, tmpDir);
console.log('wrote', `${OUT}/setting_btn_mid.png`, `${OUT}/setting_btn_rcap.png`, `${OUT}/setting_btn_lcap.png`);
