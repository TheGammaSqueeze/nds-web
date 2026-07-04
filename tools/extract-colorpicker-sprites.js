// Extracts the real Settings > Profile > Color picker sprites from
// sm_setting_D.ncer/.ncgr/.NCLR:
//  - cells 77..92: the 16 small (19x19) favourite-colour swatch dots, in
//    exact FAV_NAMES order (tools/usercolor.js), palette banks 8/9. These
//    are NOT favourite-colour-dependent - all 16 are baked as distinct
//    tiles so the whole grid can be shown at once.
//  - cell 75: the (29x29) selection-ring cursor at its rest pose. Confirmed
//    via sm_setting_D.NANR animation sequence 0 (cellIndex 75 dur=1 ->
//    74 dur=2 -> 76 dur=4 -> 75 dur=100, i.e. a quick pop pulse settling
//    back to the cell-75 rest frame - matches the 29px ring measured in a
//    real melonDS capture of the Color screen, out/settings_color/color2).
//    cells 74 (27x27) and 76 (31x31) are the pulse in/out frames, extracted
//    too in case the pulse-in animation is implemented later.
//
// Grid layout (position/pitch) comes from sm_setting_userColor_D.bnbl (a
// real JNBL-format cell/box table shipped for this exact screen): 16
// records of (x,y,w,h)-ish fields, x/y matching the melonDS-captured swatch
// centres to within 1px (rounding convention only).
const fs = require('fs');
const path = require('path');
const G = require('./ndsgfx.js');
const N = require('./ncer.js');

const ROOT = '/work/nds';
const dir = path.join(ROOT, 'assets/launcher/settings_common');
const OUT = path.join(ROOT, 'webapp/public/sprites');
const TMP = '/tmp/extract_colorpicker';
fs.mkdirSync(TMP, { recursive: true });

const ncgr = G.parseNCGR(fs.readFileSync(path.join(dir, 'sm_setting_D.ncgr')));
const nclr = G.parseNCLR(fs.readFileSync(path.join(dir, 'sm_setting_D.NCLR')));
const { cells, mappingMode } = N.parseNCER(fs.readFileSync(path.join(dir, 'sm_setting_D.ncer')));

const FAV_NAMES = [
  'grey', 'brown', 'red', 'pink', 'orange', 'yellow', 'lime', 'green',
  'dark-green', 'turquoise', 'light-blue', 'blue', 'dark-blue', 'violet',
  'magenta', 'rose',
];

let n = 0;
for (let i = 0; i < 16; i++) {
  const cellIdx = 77 + i;
  const name = FAV_NAMES[i];
  const img = N.renderCell(cells[cellIdx], ncgr, nclr, mappingMode);
  N.writePNG(img, path.join(OUT, `color_swatch_${name}.png`), TMP);
  n++;
}

for (const [cellIdx, tag] of [[74, 'in'], [75, 'rest'], [76, 'out']]) {
  const img = N.renderCell(cells[cellIdx], ncgr, nclr, mappingMode);
  N.writePNG(img, path.join(OUT, `color_ring_${tag}.png`), TMP);
  n++;
}

console.log('wrote', n, 'PNGs (16 swatches + 3 ring pulse frames) ->', OUT);
