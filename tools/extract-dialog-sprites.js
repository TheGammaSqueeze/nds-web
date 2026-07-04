// Extracts the one real asset behind the Settings "Return to DSi Menu?" dialog
// that is NOT favourite-colour dependent: the idle/unselected Yes-No button.
//
// How this was found (2026-07-03, following the no-approximations
// directive): the Yes/No buttons are msk_softmanage_D.ncer cells 10 (grey, pal
// bank 12, static - used whenever a button is NOT the highlighted one) and 12
// (pal bank 14, recoloured through the user's favourite-colour mask - used for
// the highlighted button, one real render per favColor). Both are 96x32, at
// real screen position (32,136) for Yes and (128,136) for No (touching at
// x=128, no gap). Verified against out/settings_trans/dlg/g_0044 (grey/idle)
// - 0 diff over the whole 96x32 cell except the "Yes"/"No" text label itself
// (drawn separately by the game as its own layer; see _drawExitDialog in
// settings.js for how it is coloured).
//
// Cell 10 is written here as dialog_btn_idle.png - deliberately NOT
// dialog_btn_grey.png, because 'grey' (favColor index 0) is itself a real,
// distinct favourite-colour tint of cell 12 (a desaturated teal, not neutral
// grey - see msk_dialog_BG_UC0E.NCLR bank 0), produced alongside the other 15
// colours by tools/extract-dialog-sprites-colors.js. Naming both "grey" would
// silently collide two unrelated real assets under one filename.
//
// The panel (msk_dialog_BG02.NSCR) and the recoloured cell-12 button for all
// 16 favourite colours are extracted by tools/extract-dialog-sprites-colors.js,
// which supersedes this script's former panel/blue-button output.
const fs = require('fs');
const path = require('path');
const G = require('./ndsgfx.js');
const N = require('./ncer.js');

const ROOT = '/work/nds';
const OUT = path.join(ROOT, 'webapp/public/sprites');
const TMP = '/tmp/extract_dialog_sprites';
fs.mkdirSync(TMP, { recursive: true });

const smDir = path.join(ROOT, 'assets/launcher/settings_common');
const smNcgr = G.parseNCGR(fs.readFileSync(path.join(smDir, 'msk_softmanage_D.ncgr')));
const smNclr = G.parseNCLR(fs.readFileSync(path.join(smDir, 'msk_softmanage_D.NCLR')));
const { cells, mappingMode } = N.parseNCER(fs.readFileSync(path.join(smDir, 'msk_softmanage_D.ncer')));

const idleImg = N.renderCell(cells[10], smNcgr, smNclr, mappingMode);
N.writePNG(idleImg, path.join(OUT, 'dialog_btn_idle.png'), TMP);
console.log('wrote dialog_btn_idle.png', idleImg.w + 'x' + idleImg.h);
