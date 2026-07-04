const fs = require('fs'), path = require('path');
const G = require('./ndsgfx.js'), N = require('./ncer.js');
const dir = 'assets/launcher/settings_common';
for (const [tag, ncgrF, nclrF, ncerF] of [['D','sm_setting_D.ncgr','sm_setting_D.NCLR','sm_setting_D.ncer'],['U','sm_setting_U.ncgr','sm_setting_U_common.NCLR','sm_setting_U.ncer']]) {
  const ncgr = G.parseNCGR(fs.readFileSync(path.join(dir, ncgrF)));
  const nclr = G.parseNCLR(fs.readFileSync(path.join(dir, nclrF)));
  const { cells, mappingMode } = N.parseNCER(fs.readFileSync(path.join(dir, ncerF)));
  const out = path.join(dir, 'sprites_' + tag); fs.mkdirSync(out, { recursive: true });
  let n = 0, sizes = [];
  cells.forEach((cell, i) => {
    const img = N.renderCell(cell, ncgr, nclr, mappingMode);
    if (i < 5) sizes.push(img ? (img.w + 'x' + img.h + (img.empty?'(e)':'')) : 'null');
    if (img && img.w > 2 && !img.empty) { N.writePNG(img, path.join(out, tag + '_c' + String(i).padStart(3,'0') + '.png'), '/tmp'); n++; }
  });
  console.log(tag, 'rendered', n, '/', cells.length, 'first5:', sizes.join(' '));
}
