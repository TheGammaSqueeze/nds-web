// Extracts the real decoded volume/battery icons for the Settings top-screen
// status bar (item 8: "wrong assets and placement, use the real sprites").
//
// settings.js's _volumeIcon()/_battery() were hand-drawn canvas curves/rects
// (comment: "shipped spr_vol*/spr_batt_* is a garbled decode"), a real
// no-approximations violation left over from an earlier pass that scoped this
// fix but never finished it. The real icons exist, decoded, in sm_setting_U.ncer - a
// distinct cell family from the launcher top screen's spr_volIcon/spr_batt_*
// (same subject, different palette/shading: settings top bar is dark, the
// launcher top bar is light).
//
// Cells identified by dimension + colour signature, then confirmed pixel-
// exact (after accounting for the known gAMA/cHRM ImageMagick shift, which
// N.writePNG's -strip already fixes) against out/settings/page1.top.ppm at a
// measured origin:
//   volume (U_c021, 18x16, 3 sound-wave arcs = the always-max default state
//     every existing capture shows) at screen origin (4,3): avg diff 6.25/px
//     across 3 channels before -strip, 94 opaque px checked.
//   battery-full (U_c033, 32x15) at screen origin (223,3): avg diff ~2/ch
//     before -strip, 135 opaque px checked, 0 positional error.
// Battery-low (U_c014) and battery-charging (U_c032) are the same cell
// family/slot as U_c033 (identical 32x15 dims, same frame geometry, only the
// fill differs) so they share that same origin; no real capture exists of
// those two states to verify pixel-exact (the settings captures are always
// full/not-charging), same caveat System.batterySprite() already carries for
// the launcher top screen.
const fs = require('fs');
const path = require('path');
const G = require('./ndsgfx.js');
const N = require('./ncer.js');

const ROOT = '/work/nds';
const OUT = path.join(ROOT, 'webapp/public/sprites');
const TMP = '/tmp/extract_settop_icons';
fs.mkdirSync(TMP, { recursive: true });

const dir = path.join(ROOT, 'assets/launcher/settings_common');
const ncgr = G.parseNCGR(fs.readFileSync(path.join(dir, 'sm_setting_U.ncgr')));
const nclr = G.parseNCLR(fs.readFileSync(path.join(dir, 'sm_setting_U_common.NCLR')));
const { cells, mappingMode } = N.parseNCER(fs.readFileSync(path.join(dir, 'sm_setting_U.ncer')));

for (const [idx, name] of [[21, 'spr_settop_vol'], [33, 'spr_settop_batt_full'], [14, 'spr_settop_batt_low'], [32, 'spr_settop_batt_charge']]) {
  const img = N.renderCell(cells[idx], ncgr, nclr, mappingMode);
  N.writePNG(img, path.join(OUT, name + '.png'), TMP);
  console.log('wrote', name + '.png', img.w + 'x' + img.h);
}
