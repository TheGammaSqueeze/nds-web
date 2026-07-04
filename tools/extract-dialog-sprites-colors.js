// Extracts all 16 favourite-colour variants of the "Return to DSi Menu?"
// exit-confirmation dialog panel (border) and the SELECTED (coloured) Yes/No
// button (msk_softmanage_D.ncer cell 12, palette bank 14, recoloured through
// each of the 16 FAV_NAMES banks of msk_dialog_BG_UC0E.NCLR). This includes
// bank 0 = 'grey', which is a real, distinct desaturated-teal tint, not a
// synonym for the always-neutral idle button - the idle/unselected button
// (cell 10, static palette bank 12, never recoloured) is a different real
// asset extracted separately by tools/extract-dialog-sprites.js as
// dialog_btn_idle.png, precisely to avoid colliding with this loop's
// dialog_btn_grey.png (bank 0's real selected-state render).
//
// Output naming: dialog_box_<favname>.png, dialog_btn_<favname>.png. Bank 11
// ('blue') is written too and verified byte-identical to the previous
// single-colour dialog_box.png / dialog_btn_blue.png it supersedes.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const G = require('./ndsgfx.js');
const N = require('./ncer.js');

const ROOT = '/work/nds';
const OUT = path.join(ROOT, 'webapp/public/sprites');
const TMP = '/tmp/extract_dialog_sprites_colors';
fs.mkdirSync(TMP, { recursive: true });

const FAV_NAMES = [
  'grey', 'brown', 'red', 'pink', 'orange', 'yellow', 'lime', 'green',
  'dark-green', 'turquoise', 'light-blue', 'blue', 'dark-blue', 'violet',
  'magenta', 'rose',
];

function writeRGBAPng(data, w, h, outPath) {
  const rgba = path.join(TMP, 'tmp.rgba');
  fs.writeFileSync(rgba, data);
  execSync(`convert -size ${w}x${h} -depth 8 rgba:${rgba} -strip ${outPath}`);
}

// ---------------------------------------------------------------------------
// 1. Dialog panel: msk_dialog_BG02.NSCR + msk_dialog_BG.NCGR/.NCLR, bank 14
//    recoloured through msk_dialog_BG_UC0E.NCLR (all 16 banks).
const dlgDir = path.join(ROOT, 'assets/launcher/narc/launcher_dialog');
const ncgr = G.parseNCGR(fs.readFileSync(path.join(dlgDir, 'msk_dialog_BG.NCGR')));
const nclr = G.parseNCLR(fs.readFileSync(path.join(dlgDir, 'msk_dialog_BG.NCLR')));
const nscr = G.parseNSCR(fs.readFileSync(path.join(dlgDir, 'msk_dialog_BG02.NSCR')));
const ucE = G.parseNCLR(fs.readFileSync(path.join(ROOT, 'assets/launcher/narc/usercolor_launcher/msk_dialog_BG_UC0E.NCLR')));
const greyPal12 = nclr.palettes[12];
const REAL_EDGE_TILE = 510;

const W = nscr.w, H = nscr.h;
const tilesW = W / 8;
const CX = 16, CY = 18, CW = 224, CH = 156;

function buildPanel(bluePal) {
  const panel = Buffer.alloc(W * H * 4);
  for (let i = 0; i < nscr.entries.length; i++) {
    const e = nscr.entries[i];
    if (e.pal !== 14) continue;
    const cx = (i % tilesW) * 8, cy = Math.floor(i / tilesW) * 8;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const sx = e.flipH ? 7 - x : x, sy = e.flipV ? 7 - y : y;
      const idx = G.tilePixel(ncgr, e.tile, sx, sy);
      if (idx === 0) continue;
      const c = bluePal[idx];
      const o = ((cy + y) * W + (cx + x)) * 4;
      panel[o] = c[0]; panel[o + 1] = c[1]; panel[o + 2] = c[2]; panel[o + 3] = 255;
    }
  }
  for (let i = 0; i < nscr.entries.length; i++) {
    const e = nscr.entries[i];
    if (e.pal !== 12 || e.tile !== REAL_EDGE_TILE) continue;
    const cx = (i % tilesW) * 8, cy = Math.floor(i / tilesW) * 8;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const sx = e.flipH ? 7 - x : x, sy = e.flipV ? 7 - y : y;
      const idx = G.tilePixel(ncgr, e.tile, sx, sy);
      if (idx === 0) continue;
      const c = greyPal12[idx];
      const o = ((cy + y) * W + (cx + x)) * 4;
      panel[o] = c[0]; panel[o + 1] = c[1]; panel[o + 2] = c[2]; panel[o + 3] = 255;
    }
  }
  for (let y = CY; y < CY + CH; y++) {
    let left = -1, right = -1;
    for (let x = CX; x < CX + CW; x++) {
      const o = (y * W + x) * 4;
      if (panel[o + 3] > 0) { if (left === -1) left = x; right = x; }
    }
    if (left === -1) continue;
    for (let x = left; x <= right; x++) {
      const o = (y * W + x) * 4;
      if (panel[o + 3] === 0) { panel[o] = 251; panel[o + 1] = 251; panel[o + 2] = 251; panel[o + 3] = 255; }
    }
  }
  const crop = Buffer.alloc(CW * CH * 4);
  for (let y = 0; y < CH; y++) {
    panel.copy(crop, y * CW * 4, ((CY + y) * W + CX) * 4, ((CY + y) * W + CX + CW) * 4);
  }
  return crop;
}

// ---------------------------------------------------------------------------
// 2. Yes/No button: msk_softmanage_D.ncer cell 12 (coloured, pal bank 14, UC0E mask).
const smDir = path.join(ROOT, 'assets/launcher/settings_common');
const smNcgr = G.parseNCGR(fs.readFileSync(path.join(smDir, 'msk_softmanage_D.ncgr')));
const smNclr = G.parseNCLR(fs.readFileSync(path.join(smDir, 'msk_softmanage_D.NCLR')));
const { cells, mappingMode } = N.parseNCER(fs.readFileSync(path.join(smDir, 'msk_softmanage_D.ncer')));

for (let bank = 0; bank < 16; bank++) {
  const name = FAV_NAMES[bank];
  const bluePal = ucE.palettes[bank];
  const panelCrop = buildPanel(bluePal);
  writeRGBAPng(panelCrop, CW, CH, path.join(OUT, `dialog_box_${name}.png`));

  const smMerged = { colorsPer: smNclr.colorsPer, palettes: smNclr.palettes.slice() };
  smMerged.palettes[14] = bluePal;
  const btnImg = N.renderCell(cells[12], smNcgr, smMerged, mappingMode);
  N.writePNG(btnImg, path.join(OUT, `dialog_btn_${name}.png`), TMP);
  console.log(bank, name.padEnd(11), 'ok');
}
console.log('wrote 32 PNGs (16 colours x dialog_box + dialog_btn) ->', OUT);
