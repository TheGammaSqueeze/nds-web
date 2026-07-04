// System Settings app (launched from the carousel). 4-page menu reconstructed
// from the real captures + stg_common text. Each item links to a sub-screen
// (sub-screens are stubbed for now; structure is data-driven for 1:1 build-out).
import { Fonts } from './font.js';
import { Assets } from './assets.js';
import { System } from './system.js';
import { RENDER_SCALE } from './screen.js';

const PAGES = [
  ['Data Management', 'Wireless Communications', 'Brightness Settings'],
  ['Profile', 'Date', 'Time', 'Alarm'],
  ['Parental Controls', 'Touch Screen', 'Mic Test', 'Internet'],
  ['Language', 'Country', 'System Update', 'Format System Memory'],
];

// The 16 DSi favourite colours, in the DSi's own bank order (tools/usercolor.js
// FAV_NAMES, cross-checked against sm_setting_D.ncer cells 77..92 - the real
// pre-rendered swatch dots used by the Color picker, see _drawColorBottom).
// Every glossy control the DSi tints (list buttons, page/scroll arrows, the
// exit dialog) is recoloured at runtime by swapping in the matching bank of a
// shared favourite-colour NCLR mask - see tools/extract-button-slices-colors.js
// and tools/extract-dialog-sprites-colors.js. Index 11 ('blue') is the only
// colour melonDS ground truth exists for on this NAND (the default profile),
// so it is also this app's default and every non-blue variant is the same
// proven mechanism applied to a different (also real, not invented) palette
// bank; some banks are independently pixdiff-verified, others are
// extrapolated from the proven mechanism.
const FAV_NAMES = [
  'grey', 'brown', 'red', 'pink', 'orange', 'yellow', 'lime', 'green',
  'dark-green', 'turquoise', 'light-blue', 'blue', 'dark-blue', 'violet',
  'magenta', 'rose',
];

// Real "Return to DSi Menu?" dim-behind effect, measured frame-by-frame from a
// fresh melonDS capture (scripts/settings_dlg3.txt -> out/settings_trans3/dlg2,
// pre-tap frame vs each animation frame). It is the GBA/NDS 2D engine's hardware
// brightness-decrease special effect (melonDS src/GPU2D_Soft.cpp case 3 ->
// GPU_ColorOp.h ColorBrightnessDown, called with bias 0x7), NOT a semi-transparent
// black rect: new6 = old6 - (((old6*EVY)+7)>>4) per channel in the console's
// native 6-bit-per-channel blend space (8-bit framebuffer channel v8 <-> 6-bit
// v6 via v8=(v6<<2)|(v6>>4), i.e. v6=v8>>2). EVY ramps 0->12 over the first 23
// frames after the tap then holds at 12 - measured with a 100% exact match
// (12288/12288 sample channels every single frame) against the y=0..15 strip,
// which is never covered by the dialog box at any point in the animation.
const EXIT_DIALOG_EVY_RAMP = [
  0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 3, 4, 5, 6, 6, 7, 8, 9, 10, 11, 11, 12,
];
const EXIT_DIALOG_EVY_BIAS = 7;

// Selected Yes/No label ink, one [lvl1,lvl2,lvl3] triple per favourite colour -
// read directly off assets/launcher/narc/usercolor_launcher/msk_dialog_BG_UC0E
// .NCLR bank[favColor] indices 13/14/15 (the same bank the button sprite itself
// is recoloured through, see tools/extract-dialog-sprites-colors.js). Index 11
// ('blue': [16,73,195]/[8,40,146]/[0,0,97]) matches the original hand-measured
// value exactly, confirming the other 15 rows (same real NCLR, not invented).
const EXIT_DIALOG_INK = [
  { 1: [73, 130, 138], 2: [32, 89, 97], 3: [0, 56, 65] },     // 0 grey
  { 1: [146, 48, 0], 2: [105, 24, 0], 3: [56, 0, 0] },        // 1 brown
  { 1: [195, 24, 56], 2: [146, 8, 32], 3: [89, 0, 16] },      // 2 red
  { 1: [203, 89, 211], 2: [154, 40, 162], 3: [105, 0, 113] }, // 3 pink
  { 1: [211, 113, 0], 2: [170, 81, 0], 3: [130, 48, 0] },     // 4 orange
  { 1: [195, 178, 0], 2: [146, 130, 0], 3: [97, 81, 0] },     // 5 yellow
  { 1: [130, 186, 0], 2: [89, 121, 0], 3: [48, 56, 0] },      // 6 lime
  { 1: [0, 203, 0], 2: [8, 146, 0], 3: [8, 89, 0] },          // 7 green
  { 1: [0, 162, 40], 2: [0, 113, 16], 3: [8, 65, 0] },        // 8 dark-green
  { 1: [48, 178, 105], 2: [24, 130, 65], 3: [0, 81, 32] },    // 9 turquoise
  { 1: [32, 146, 195], 2: [16, 97, 146], 3: [0, 56, 97] },    // 10 light-blue
  { 1: [16, 73, 195], 2: [8, 40, 146], 3: [0, 0, 97] },       // 11 blue (verified)
  { 1: [24, 32, 178], 2: [8, 16, 121], 3: [0, 0, 65] },       // 12 dark-blue
  { 1: [113, 0, 170], 2: [81, 0, 130], 3: [56, 0, 89] },      // 13 violet
  { 1: [162, 0, 186], 2: [105, 0, 130], 3: [48, 0, 81] },     // 14 magenta
  { 1: [195, 40, 138], 2: [146, 24, 97], 3: [97, 0, 56] },    // 15 rose
];

// Blue "chrome" border tint shared by every white-body/blue-border panel in
// Settings (the Profile card top accent + Birthday bar, and the Color picker
// panel border - see _profileCard, COLOR_PANEL_CORNER_COLORS): read directly
// off assets/launcher/narc/usercolor_launcher/msk_dialog_BG_UC0E.NCLR
// bank[favColor] indices 12/11/10 - the SAME file EXIT_DIALOG_INK already
// reads (indices 13/14/15) for the exit-dialog panel/button, confirming this
// one NCLR supplies the whole family of blue chrome accents in Settings.
// [line, lo, hi] = [#..12, #..11, #..10]. Bank 11 ('blue') is exactly
// 1859ba/0059f3/2879fb, the values already hand-measured and hardcoded here
// before this table existed - proving the other 15 rows are the same real
// asset, not invented. Caught by a real melonDS capture at a non-blue
// favColor (bank 2 'red', scripts/settings_pages.txt against a NAND scratch
// copy with shared1/TWLCFG0/1.dat's FavoriteColor patched via
// `nandfs <dir> setfavcolor <n>`) that showed _profileCard still rendering
// blue - this table is the root-cause fix, not the missing sprite wiring
// alone.
const CARD_BORDER_TINT = [
  ['#496979', '#61829a', '#7992aa'],  // 0 grey
  ['#9a4110', '#b24100', '#d35918'],  // 1 brown
  ['#ba0020', '#db0020', '#fb1830'],  // 2 red
  ['#db71a2', '#f382fb', '#fb9afb'],  // 3 pink
  ['#db5908', '#f37900', '#fb9208'],  // 4 orange
  ['#c3aa08', '#ebcb00', '#f3e300'],  // 5 yellow
  ['#61ba18', '#a2db00', '#aafb00'],  // 6 lime
  ['#10b238', '#28db10', '#41f308'],  // 7 green
  ['#008a28', '#00a230', '#00c349'],  // 8 dark-green
  ['#009a59', '#18c361', '#59db82'],  // 9 turquoise
  ['#309adb', '#00aaeb', '#59cbfb'],  // 10 light-blue
  ['#1859ba', '#0059f3', '#2879fb'],  // 11 blue (verified)
  ['#182879', '#00009a', '#0000ba'],  // 12 dark-blue
  ['#61009a', '#8a00d3', '#a220fb'],  // 13 violet
  ['#9a00b2', '#d300eb', '#e338fb'],  // 14 magenta
  ['#c31082', '#eb109a', '#fb30b2'],  // 15 rose
];

// Profile card rounded corner: measured directly off out/settings/page1.top.ppm at all
// 4 corner instances (accent-bar top-left/top-right, birthday-bar bottom-left/bottom-right)
// - cross-checked for exact left/right mirror symmetry (leftEdge+rightEdge==255 on every
// row) and exact top/bottom mirror symmetry (top's 6 rows read outer-edge-inward equal
// birthday-bar's 6 rows read outer-edge-inward, modulo the expected bg-dither parity).
// Per row, from the outer edge inward: bg, then a run of the flat border colour L, then
// (only on rows whose steady-state fill is c2) a short run of c0 before reaching c2 - a
// real rasterized stair-step, not a soft AA blend (every sampled pixel is one of the 4
// exact named colours, no intermediate blends). d=0 is the row against the flat 1px L
// line (handled separately, see _profileCard); d=1..5 are these per-row segments.
const CARD_CORNER_CURVE = [
  { bg: 2, segs: [[3, 'L'], [40, 'c0']] },        // d1
  { bg: 1, segs: [[3, 'L'], [2, 'c0'], [40, 'c2']] }, // d2
  { bg: 1, segs: [[2, 'L'], [40, 'c0']] },        // d3
  { bg: 0, segs: [[3, 'L'], [1, 'c0'], [40, 'c2']] }, // d4
  { bg: 0, segs: [[3, 'L'], [40, 'c0']] },        // d5
];

// Status-bar "User" nickname label: a real OPAQUE 3-level anti-alias ramp (the
// same "DSi replaces, doesn't blend" rendering drawLevels reproduces for the
// dialog title/labels), not the CARD_BORDER_TINT flat colour alpha-blended
// over the background - caught because out/settings/page1.top.ppm's label
// pixels are exactly 3 distinct RGB values regardless of which background
// dither cell (#303030/#383838) sits underneath, which a real alpha blend
// over a checkered background could not produce. Indices [7,8,9] of
// assets/launcher/narc/usercolor_setting/sm_setting_U_common_UC0f.NCLR
// bank[favColor] match those 3 values exactly for bank 11 ('blue', the
// default profile, the only favColor an actual capture exists for) - found
// by a brute-force nearest-colour search across every usercolor_* NCLR file
// in assets/launcher for a bank containing all 3 measured RGB triples. Same
// bank ordering as CARD_BORDER_TINT (grey/brown/red/pink/orange/yellow/lime/
// green/dark-green/turquoise/light-blue/blue/dark-blue/violet/magenta/rose).
const STATUS_USER_INK = [
  [[65, 73, 81], [81, 105, 121], [97, 130, 154]],      // 0 grey
  [[97, 56, 32], [146, 65, 16], [186, 73, 0]],         // 1 brown
  [[121, 32, 40], [186, 16, 32], [251, 0, 24]],        // 2 red
  [[121, 81, 121], [186, 113, 186], [251, 138, 251]],  // 3 pink
  [[121, 81, 32], [186, 113, 16], [251, 146, 0]],      // 4 orange
  [[121, 113, 32], [178, 170, 16], [243, 227, 0]],     // 5 yellow
  [[89, 121, 32], [130, 186, 16], [170, 251, 0]],      // 6 lime
  [[32, 121, 32], [16, 186, 16], [0, 251, 0]],         // 7 green
  [[32, 105, 56], [16, 154, 56], [0, 203, 65]],        // 8 dark-green
  [[56, 113, 81], [65, 162, 113], [73, 219, 138]],     // 9 turquoise
  [[48, 97, 121], [48, 146, 178], [48, 186, 243]],     // 10 light-blue
  [[48, 81, 121], [40, 97, 186], [40, 121, 251]],      // 11 blue (verified)
  [[40, 40, 121], [32, 32, 186], [16, 24, 251]],       // 12 dark-blue
  [[81, 32, 105], [113, 16, 162], [138, 0, 211]],      // 13 violet
  [[105, 32, 113], [162, 16, 178], [211, 0, 235]],     // 14 magenta
  [[121, 32, 81], [186, 16, 113], [251, 0, 146]],      // 15 rose
];

// Profile card title ("User" in Fonts.l, large size): the same opaque 3-level
// ramp mechanism as STATUS_USER_INK, same source file, indices [10,11,12]
// of the bank instead of [7,8,9] - this NCLR evidently holds both the small
// status-bar ramp and the large card-title ramp for each favColor. Found the
// same way: measured 4 distinct colours (bg + 2 AA levels + full ink) in the
// real capture over the card's plain white body, then searched every NCLR
// bank for an exact match to all 3 non-background values. Blue/bank 11's
// full-ink level (index 12) is exactly CARD_BORDER_TINT[11][1] (#0059f3),
// which is how the font/size mismatch (Fonts.banner instead of Fonts.l) was
// first caught - the flat CARD_BORDER_TINT fill was the right full-ink
// colour but wrong AA method, masking the real bug (wrong font).
const PROFILE_NAME_INK = [
  [[203, 211, 219], [146, 170, 186], [97, 130, 154]],   // 0 grey
  [[235, 195, 170], [211, 130, 81], [186, 73, 0]],      // 1 brown
  [[251, 170, 178], [251, 81, 97], [251, 0, 24]],       // 2 red
  [[251, 219, 251], [251, 178, 251], [251, 138, 251]],  // 3 pink
  [[251, 219, 170], [251, 186, 81], [251, 146, 0]],     // 4 orange
  [[251, 243, 170], [251, 235, 81], [243, 227, 0]],     // 5 yellow
  [[227, 251, 170], [203, 251, 81], [170, 251, 0]],     // 6 lime
  [[170, 251, 170], [81, 251, 81], [0, 251, 0]],        // 7 green
  [[170, 227, 186], [81, 195, 121], [0, 162, 56]],      // 8 dark-green
  [[195, 243, 219], [130, 235, 178], [73, 219, 138]],   // 9 turquoise
  [[186, 235, 251], [113, 211, 251], [48, 186, 243]],   // 10 light-blue
  [[170, 203, 251], [81, 146, 251], [0, 89, 243]],      // 11 blue (verified)
  [[170, 170, 219], [81, 81, 186], [0, 0, 146]],        // 12 dark-blue
  [[219, 170, 243], [178, 81, 227], [138, 0, 211]],     // 13 violet
  [[243, 170, 251], [227, 81, 243], [211, 0, 235]],     // 14 magenta
  [[251, 170, 219], [251, 81, 186], [251, 0, 146]],     // 15 rose
];

// Profile card message ("Hello! :P" in Fonts.m): fixed dark grey, not favColor-tinted -
// same opaque-ramp mechanism, sourced from settings_common/sm_setting_D.NCLR bank 15,
// indices [10,11,12] (a plain 3-step 195/130/65 ramp shared by generic UI text, distinct
// from the per-favColor usercolor_setting file used for the name/status ramps above).
const PROFILE_MESSAGE_INK = { 1: [195, 195, 195], 2: [130, 130, 130], 3: [65, 65, 65] };

// 5-stop vertical gradient (top->bottom) for the selected page-tab box
// outline on the Settings main menu header ("System Settings 1 2 3 4"),
// read off assets/launcher/narc/usercolor_setting/sm_setting_D_UC02.NCLR
// bank[favColor] indices [8,7,5,4,3] - the SAME mask _glossyButton/_pageArrow/
// _scrollArrow already use. Bank 11 ('blue': 41aadb/18a2e3/0882db/1069f3/
// 0059eb) matches a fresh pixel-row measurement of out/settings/pg1.bot.ppm's
// tab-outline vertical edge exactly, replacing a single hand-picked flat
// average (#2b7fe8) that was wrong for every other favColor - caught by the
// same real red-favColor capture that caught _profileCard.
const PAGE_TAB_GRADIENT = [
  ['#9aa2aa', '#929aa2', '#798a9a', '#718292', '#69798a'],  // 0 grey
  ['#cb7159', '#cb6938', '#cb5120', '#ba4910', '#ba4108'],  // 1 brown
  ['#fb6179', '#fb5971', '#fb4959', '#fb3851', '#fb2038'],  // 2 red
  ['#fbbafb', '#fbb2fb', '#fb9aeb', '#fb8ae3', '#fb79db'],  // 3 pink
  ['#f3b292', '#fbaa82', '#fb9a41', '#fb9a30', '#fb9218'],  // 4 orange
  ['#f3d392', '#fbd379', '#fbd338', '#fbcb28', '#fbcb10'],  // 5 yellow
  ['#d3f351', '#c3eb38', '#aae310', '#bae310', '#aad308'],  // 6 lime
  ['#92f361', '#8afb51', '#51fb20', '#38fb08', '#00f300'],  // 7 green
  ['#59aa51', '#41aa49', '#209238', '#208230', '#087928'],  // 8 dark-green
  ['#9afbba', '#82fbaa', '#20eb71', '#20d379', '#20cb71'],  // 9 turquoise
  ['#9afbfb', '#61fbfb', '#20d3eb', '#30badb', '#20aacb'],  // 10 light-blue
  ['#41aadb', '#18a2e3', '#0882db', '#1069f3', '#0059eb'],  // 11 blue (verified)
  ['#08419a', '#104182', '#083079', '#102082', '#081879'],  // 12 dark-blue
  ['#cb49fb', '#c341fb', '#aa28fb', '#a210fb', '#9208db'],  // 13 violet
  ['#fb69aa', '#fb59cb', '#eb38eb', '#e320fb', '#d300fb'],  // 14 magenta
  ['#fb61ba', '#fb59aa', '#fb38ba', '#fb28aa', '#fb109a'],  // 15 rose
];

// Rounded-corner pixel pattern for the Color picker panel border, read
// pixel-by-pixel off out/settings_color/c80.bot (verified against the raw
// PPM: x6..23/y34..39 for the top-left corner, x6..23/y142..151 for the
// bottom-left corner, x232..249/y34..39 for the top-right corner - all three
// match this single 13-column table exactly, confirming the panel uses one
// canonical corner reflected horizontally (right = PX1-dx) and vertically
// (bottom row-offset dy uses table row 5-dy, i.e. mirrored around the body)).
// dx is the column distance from the panel's outer edge (PX0 for the left
// side, PX1 for the right side, both inclusive of dx=0). Codes: '.' =
// background (untouched, the scanline dither already painted underneath),
// 'L' = the AA line colour, '0'/'2' = the two border dither colours - all
// three keyed per favColor through CARD_BORDER_TINT (measured on the default
// blue profile: L=#1859ba, 0=#0059f3, 2=#2879fb - the same shared chrome
// tint as _profileCard). This is NOT a simple per-row inset (the earlier
// approximation): the real corner has a genuine diagonal AA line that bleeds
// 2-3px into what would otherwise be flat dither, e.g. row2 is
// ".LLL002222222" - an L band at dx1-3 then a 2px '0' band before the row's
// own '2' fill resumes at dx6. Beyond dx12 every row is flat (its last
// column's colour repeats to the panel's flat middle span).
const COLOR_PANEL_CORNER_ROWS = [
  '....LLLLLLLLL',
  '..LLL00000000',
  '.LLL002222222',
  '.LL0000000000',
  'LLL0022222222',
  'LLL0000000000',
];

export class SettingsApp {
  constructor(audio, onExit) {
    this.audio = audio;
    this.onExit = onExit;
    this.page = 0;
    this.sel = 0;
    this.profile = { name: 'User', message: 'Hello! :P', birthday: '01/01', favColor: 11 };  // 11 = 'blue' (real DSi default, verified)
    this.version = 'Ver 1.4.5U';
    this.sub = null;          // active sub-screen ('brightness' | 'language')
    this.brightness = 5;      // 1..5
    this.langs = ['English', 'Français', 'Español'];
    this.langSel = 0;
    this.profileItems = ['User Name', 'Message', 'Color', 'Birthday'];
    this.profileSel = 0;
    this.colorSel = this.profile.favColor;   // cursor in the Color picker grid, synced on entry
    this.date = { m: 1, d: 1, y: 2000 };
    this.time = { h: 0, min: 0 };
    this.alarm = { h: 0, min: 0 };
    this.stepCol = 0;   // selected column in a stepper screen
    // transition state (page slide, sub-screen enter/back cross-fade). RE'd from
    // out/settings_trans: page change = the middle button panel slides horizontally
    // (~12f, ease-in-out), enter/back = the tapped button flashes blue then the whole
    // screen cross-fades (dissolve) to/from the sub-screen. null = no transition.
    this.trans = null;
    this._pressSel = -1;    // button index flashing blue during an enter press
    this.wireless = true;   // Wireless Communications ON/OFF
    // Country: a scrollable list; captured window is the U/V region with USA set
    this.countries = ['United Arab Emirates', 'United States', 'Uruguay', 'US Virgin Islands', 'Venezuela'];
    this.countrySel = 1;    // United States
    this.dataTab = 0;   // Data Management: 0 System Memory, 1 SD Card
    // real installed DSiWare on this NAND (names + icons dumped from the NAND,
    // block counts read from the authoritative melonDS capture)
    this.dsiware = [
      { name: 'AQUIA', blocks: 91, id: '00030004_4b414145' },
      { name: 'Aura-Aura Climber', blocks: 38, id: '00030004_4b535245' },
      { name: "A Kappa's Trail", blocks: 80, id: '00030004_4b504145' },
    ];
    this.dataPages = 5;   // real system reports "1 / 5"
    for (const t of this.dsiware) Assets.loadImage('dm_' + t.id, `public/icons/${t.id}.png`);
    // real big date/time digit sprites (setting_common NCER cells 37..48)
    Assets.loadImage('setting_digits', 'public/sprites/setting_digits.png');
    Assets.loadJSON('setting_digits_meta', 'public/sprites/setting_digits.json');
    Assets.loadImage('setting_console', 'public/sprites/setting_console_art.png');   // real DSi console line-art (BG01)
    Assets.loadImage('setting_sysmem', 'public/sprites/setting_sysmem_console.png'); // real filled DSi console (U cell 15)
    Assets.loadImage('setting_mic', 'public/sprites/setting_mic.png');               // real mic panel (BG06)
    Assets.loadImage('setting_sd_empty', 'public/sprites/setting_sd_empty.png');     // real dashed SD-card outline (U cell 22)
    // real status-bar volume/battery icons (sm_setting_U.ncer cells 21/33/14/32),
    // see tools/extract-settop-icons.js. Replaces the hand-drawn vector approximation.
    Assets.loadImage('spr_settop_vol', 'public/sprites/spr_settop_vol.png');
    Assets.loadImage('spr_settop_batt_full', 'public/sprites/spr_settop_batt_full.png');
    Assets.loadImage('spr_settop_batt_low', 'public/sprites/spr_settop_batt_low.png');
    Assets.loadImage('spr_settop_batt_charge', 'public/sprites/spr_settop_batt_charge.png');
    // real grey list-button texture (setting_common D cell 0, base palette 0): left
    // cap / seamless-tileable middle / right cap, decoded from the actual OAM pieces.
    Assets.loadImage('setting_btn_lcap', 'public/sprites/setting_btn_lcap.png');
    Assets.loadImage('setting_btn_mid', 'public/sprites/setting_btn_mid.png');
    Assets.loadImage('setting_btn_rcap', 'public/sprites/setting_btn_rcap.png');
    // real SELECTED variant of the same cell 0 pieces, one full set per favourite
    // colour: the DSi recolours them at runtime via the favourite-colour palette
    // mask (see tools/extract-button-slices-colors.js and the _glossyButton
    // comment). Same mask covers the tall page-turn arrow pill (cell 9/10) and
    // small scrollbar arrow (cell 113/114). All 16 loaded up front (cheap - 96
    // small PNGs) so switching favColor never stalls on a network fetch.
    for (const name of FAV_NAMES) {
      Assets.loadImage('setting_btn_lcap_' + name, `public/sprites/setting_btn_lcap_${name}.png`);
      Assets.loadImage('setting_btn_mid_' + name, `public/sprites/setting_btn_mid_${name}.png`);
      Assets.loadImage('setting_btn_rcap_' + name, `public/sprites/setting_btn_rcap_${name}.png`);
      Assets.loadImage('setting_pagearrow_right_' + name, `public/sprites/setting_pagearrow_right_${name}.png`);
      Assets.loadImage('setting_pagearrow_left_' + name, `public/sprites/setting_pagearrow_left_${name}.png`);
      Assets.loadImage('setting_scrollarrow_up_' + name, `public/sprites/setting_scrollarrow_up_${name}.png`);
      Assets.loadImage('setting_scrollarrow_down_' + name, `public/sprites/setting_scrollarrow_down_${name}.png`);
      // real "Return to DSi Menu?" exit-confirmation dialog panel (msk_dialog_BG02
      // .NSCR/.NCGR/.NCLR) and the coloured Yes/No button (msk_softmanage_D.ncer
      // cell 12), see tools/extract-dialog-sprites-colors.js and _drawExitDialog.
      Assets.loadImage('dialog_box_' + name, `public/sprites/dialog_box_${name}.png`);
      Assets.loadImage('dialog_btn_' + name, `public/sprites/dialog_btn_${name}.png`);
    }
    // the idle/unselected Yes-No button (cell 10) is NOT favourite-colour
    // dependent - a separate real asset from dialog_btn_grey (favColor 0's
    // own selected-state tint, loaded above in the FAV_NAMES loop), see
    // tools/extract-dialog-sprites.js.
    Assets.loadImage('dialog_btn_idle', 'public/sprites/dialog_btn_idle.png');
    // Profile > Color picker: 16 real pre-rendered swatch dots (sm_setting_D.ncer
    // cells 77..92, palette banks 8/9 - always all 16 shown at once, so these are
    // NOT recoloured via palOverride, unlike everything else above) + the real
    // selection-ring cursor (cell 75, rest pose). See _drawColorBottom and
    // tools/extract-colorpicker-sprites.js.
    for (const name of FAV_NAMES) Assets.loadImage('color_swatch_' + name, `public/sprites/color_swatch_${name}.png`);
    Assets.loadImage('color_ring_rest', 'public/sprites/color_ring_rest.png');
    // de-dithered per-variant gloss gradients for the smooth scale>1 button path (tools/btngrad.mjs).
    // Load ONCE - re-fetching on every settings open risks a transient failure nulling it (which
    // would drop the buttons back to the dithered sprite path).
    if (!Assets.data.button_grads) Assets.loadJSON('button_grads', 'public/sprites/button_grads.json');
  }

  // ---- transitions (RE'd out/settings_trans) ----------------------------------
  // Page change slides the middle button panel horizontally under the static
  // header/arrows. press=5f/slide=18f (ease-in-out) is a 2D grid search
  // (tools/_sweep_pageslide.mjs) AE-minimizing the clone against the real
  // out/settings_trans/page capture frame by frame - the button panel is still
  // sliding when the page tab digit flips, not settled+held (reveal=0, was 4).
  // Sub-screen enter/back flashes the tapped button blue for ~8f then
  // cross-fades the whole screen (~10f).
  _startPage(dir) {
    const np = Math.max(0, Math.min(3, this.page + dir));
    if (np === this.page || this.trans) return;
    this.blip();
    this.trans = { type: 'page', dir, oldPage: this.page, newPage: np, t: 0, press: 5, slide: 18, reveal: 0 };
  }
  // fromSub: the sub-screen the press happened on (null = root menu). Lets a
  // nested sub-screen (e.g. Profile's "Color" row) reuse this same real,
  // measured cross-fade instead of always assuming the root menu is behind it.
  //
  // press=8f/fadeOut=9f/hold=4f/fadeIn=10f (was 8/10/5/10) is a 3D grid search
  // (tools/_sweep_enter.mjs) AE-minimizing the clone against the real
  // out/settings_trans/enter capture frame by frame - a clean interior minimum
  // (all 6 neighbours in the searched cube score higher), totalAE 317598 ->
  // 243715. out/settings_trans/back's per-frame mean brightness traces the
  // same envelope shape (measured, not assumed), so the same constants are
  // applied to _startBack below.
  _startEnter(sel, sub, fromSub = null) {
    if (this.trans || !sub) { if (!sub) this.blip(); return; }
    this.audio && this.audio.play('settingsEnter');
    // sequential fade THROUGH the dark bg (RE'd out/settings_trans/enter): the
    // tapped button flashes, the old menu fades out to the bare bg, a short hold,
    // then the sub-screen fades in. Linear ramps, ~31 frames total. The button's
    // own flash during the press window is a real 3-stage colour sequence (grey
    // -> a brighter cyan flash for 2f -> the steady selected blue for the rest)
    // measured directly off out/settings_trans/enter, not yet reproduced here.
    this.trans = { type: 'enter', page: this.page, sel, newSub: sub, fromSub, t: 0, press: 8, fadeOut: 9, hold: 4, fadeIn: 10 };
  }
  // toSub: where Back returns to (null = root menu). Lets a nested sub-screen's
  // Back button return to its parent sub-screen instead of always the root.
  _startBack(toSub = null) {
    if (this.trans) return;
    this.audio && this.audio.play('settingsBack');
    this.trans = { type: 'back', page: this.page, oldSub: this.sub, toSub, t: 0, press: 8, fadeOut: 9, hold: 4, fadeIn: 10 };
  }

  // advance the active transition (called once per frame from main.js)
  update(dt) {
    if (this.confirmExit) this.confirmExit.t += dt * 60;
    if (!this.trans) return;
    const tr = this.trans;
    tr.t += dt * 60;
    const total = tr.type === 'page' ? tr.press + tr.slide + (tr.reveal || 0) : tr.press + tr.fadeOut + tr.hold + tr.fadeIn;
    if (tr.t >= total) {
      if (tr.type === 'page') { this.page = tr.newPage; this.sel = 0; }
      else if (tr.type === 'enter') { this.sub = tr.newSub; this.stepCol = 0; }
      else { this.sub = tr.toSub || null; this.stepCol = 0; }
      this._pressSel = -1;
      this.trans = null;
    }
  }

  // an offscreen canvas, cached by id, for compositing transitions. Sized to the render
  // resolution (256N x 192N) so vector fonts / SVG chrome rasterize crisp inside it at
  // scale>1 - a native 256x192 buffer would render everything at 1x and the scaled blit
  // would upscale it, making fonts + SVG assets visibly "fall back" to the bitmap look for
  // the length of a page/enter transition (see _blitOff for the matching 1:1 device blit).
  _off(id) {
    if (!this._offs) this._offs = {};
    if (!this._offs[id]) { const c = document.createElement('canvas'); c.width = 256 * RENDER_SCALE; c.height = 192 * RENDER_SCALE; this._offs[id] = c; }
    return this._offs[id];
  }
  // blit a full-screen _off buffer onto the (already scale-N) screen ctx, mapping the whole
  // N x backing store to the 256x192 DS rect = 1:1 device pixels, crisp at any scale.
  _blitOff(ctx, buf, alpha = 1) {
    if (alpha !== 1) { ctx.save(); ctx.globalAlpha = alpha; }
    ctx.drawImage(buf, 0, 0, buf.width, buf.height, 0, 0, 256, 192);
    if (alpha !== 1) ctx.restore();
  }
  // render a specific (page, sub, pressSel) state to a canvas, restoring live state
  _renderStateTo(canvas, st, isTop) {
    const g = canvas.getContext('2d');
    g.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);   // DS coords -> N x raster, like DSScreen
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, 256, 192);
    const sp = this.page, ss = this.sub, spr = this._pressSel, str = this.trans;
    if (st.page != null) this.page = st.page;
    this.sub = st.sub != null ? st.sub : null;
    this._pressSel = st.pressSel != null ? st.pressSel : -1;
    this.trans = null;
    if (isTop) this._renderTop({ c: g }); else this._renderBottom({ c: g });
    this.page = sp; this.sub = ss; this._pressSel = spr; this.trans = str;
    return canvas;
  }

  drawBottom(screen) {
    const tr = this.trans;
    if (!tr) { this._renderBottom(screen); if (this.confirmExit) this._drawExitDialog(screen.c); return; }
    const ctx = screen.c;
    if (tr.type === 'page') {
      const p = tr.t <= tr.press ? 0 : easeInOut(Math.min(1, (tr.t - tr.press) / tr.slide));
      const s = tr.dir;   // +1 next (content moves left), -1 prev
      this._drawMenuBg(ctx, tr.oldPage);
      this._drawMenuButtons(ctx, tr.oldPage, -1, -s * 256 * p);
      this._drawMenuButtons(ctx, tr.newPage, -1, s * 256 * (1 - p));
      this._drawMenuArrows(ctx, tr.oldPage);
      return;
    }
    // enter / back: sequential fade THROUGH the bare dark bg (not a dissolve). Fill
    // the persistent bg, fade the old full state out over it, hold, fade the new in.
    // fromSub/toSub let a nested sub-screen (Profile -> Color) fade to/from its
    // parent sub-screen instead of always assuming the root menu.
    const outState = tr.type === 'enter' ? { page: tr.page, sub: tr.fromSub || null, pressSel: tr.sel } : { page: tr.page, sub: tr.oldSub };
    const inState = tr.type === 'enter' ? { page: tr.page, sub: tr.newSub } : { page: tr.page, sub: tr.toSub || null };
    this._scanBg(ctx, '#383838', '#414141');
    const { outA, inA } = this._fadePhases(tr);
    if (outA > 0) { this._renderStateTo(this._off('ba'), outState, false); this._blitOff(ctx, this._off('ba'), outA); }
    if (inA > 0) { this._renderStateTo(this._off('bb'), inState, false); this._blitOff(ctx, this._off('bb'), inA); }
    ctx.globalAlpha = 1;
  }

  // out-alpha (old state) and in-alpha (new state) for the phased enter/back fade:
  // old holds through press, ramps 1->0 over fadeOut; new stays 0 through the hold
  // then ramps 0->1 over fadeIn. Linear (measured constant ~0.095/frame).
  _fadePhases(tr) {
    const { press, fadeOut, hold, fadeIn, t } = tr;
    const outA = t <= press ? 1 : (t <= press + fadeOut ? 1 - (t - press) / fadeOut : 0);
    const inStart = press + fadeOut + hold;
    const inA = t <= inStart ? 0 : Math.min(1, (t - inStart) / fadeIn);
    return { outA, inA };
  }

  drawTop(screen) {
    const tr = this.trans;
    if (!tr || tr.type === 'page') { this._renderTop(screen); return; }  // top is unchanged across pages
    const ctx = screen.c;
    const outState = tr.type === 'enter' ? { sub: tr.fromSub || null } : { sub: tr.oldSub };
    const inState = tr.type === 'enter' ? { sub: tr.newSub } : { sub: tr.toSub || null };
    if (tr.type === 'enter') {
      // symmetric fade through the bare dark bg (same as the bottom screen)
      this._scanBg(ctx, '#303030', '#383838');
      const { outA, inA } = this._fadePhases(tr);
      if (outA > 0) { this._renderStateTo(this._off('ta'), outState, true); this._blitOff(ctx, this._off('ta'), outA); }
      if (inA > 0) { this._renderStateTo(this._off('tb'), inState, true); this._blitOff(ctx, this._off('tb'), inA); }
      ctx.globalAlpha = 1;
      return;
    }
    // BACK top is asymmetric: the sub-screen holds opaque through press+fadeOut+hold,
    // then a single shallow cross-fade sub->menu over the fadeIn phase (no dark dip).
    this._renderStateTo(this._off('ta'), outState, true);
    this._blitOff(ctx, this._off('ta'));
    const inStart = tr.press + tr.fadeOut + tr.hold;
    const inA = tr.t <= inStart ? 0 : Math.min(1, (tr.t - inStart) / tr.fadeIn);
    if (inA > 0) {
      this._renderStateTo(this._off('tb'), inState, true);
      this._blitOff(ctx, this._off('tb'), inA);
    }
  }

  // blit the real DSi digit sprites for a value string, centred at cx, top at topY
  _drawDigits(ctx, str, cx, topY) {
    const img = Assets.img('setting_digits');
    const meta = Assets.data && Assets.data['setting_digits_meta'];
    if (!img || !meta) {
      // fallback for the brief window before the digit atlas loads: a clean system font (not
      // the rounded vector font scaled 2x, which looked squiggly), sized/tracked to the ~32px
      // real digits so the position barely shifts when the real sprites take over.
      ctx.save();
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = "30px 'Helvetica','Arial','Nimbus Sans',sans-serif";
      ctx.letterSpacing = '5px';
      ctx.fillText(str, cx, topY + 27);
      ctx.restore(); return;
    }
    let total = 0; for (const ch of str) { const g = meta.glyphs[ch]; if (g) total += g.w; }
    let x = Math.round(cx - total / 2);
    // scale=1 blits the exact digit atlas nearest; scale>1 loads the potrace SVG of the
    // digit sheet and must draw smoothed so the vector re-rasterizes crisp (was pixellated).
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = RENDER_SCALE > 1;
    for (const ch of str) { const g = meta.glyphs[ch]; if (!g) continue; ctx.drawImage(img, g.x, 0, g.w, g.h, x, topY, g.w, g.h); x += g.w; }
    ctx.imageSmoothingEnabled = sm;
  }

  _subFor(page, sel) {
    if (page === 0 && sel === 0) return 'datamgmt';
    if (page === 0 && sel === 1) return 'wireless';
    if (page === 0 && sel === 2) return 'brightness';
    if (page === 2 && sel === 0) return 'parental';
    if (page === 2 && sel === 1) return 'touchscreen';
    if (page === 2 && sel === 2) return 'mictest';
    if (page === 2 && sel === 3) return 'internet';
    if (page === 1 && sel === 0) return 'profile';
    if (page === 1 && sel === 1) return 'date';
    if (page === 1 && sel === 2) return 'time';
    if (page === 1 && sel === 3) return 'alarm';
    if (page === 3 && sel === 0) return 'language';
    if (page === 3 && sel === 1) return 'country';
    if (page === 3 && sel === 2) return 'sysupdate';
    if (page === 3 && sel === 3) return 'format';
    return null;
  }

  // column layouts + value formatting for the three stepper screens
  _stepper(kind) {
    const pad = n => String(n).padStart(2, '0');
    if (kind === 'date') return {
      title: 'Date', value: `${pad(this.date.m)}/${pad(this.date.d)}/${this.date.y}`,
      fields: [pad(this.date.m), pad(this.date.d), String(this.date.y)], seps: ['/', '/'],
      cols: [{ label: 'Month', cx: 36, w: 49 }, { label: 'Day', cx: 102, w: 49 }, { label: 'Year', cx: 192, w: 95 }],
    };
    const t = kind === 'time' ? this.time : this.alarm;
    return {
      title: kind === 'time' ? 'Time' : 'Alarm', value: `${pad(t.h)}:${pad(t.min)}`,
      fields: [pad(t.h), pad(t.min)], seps: [':'],
      cols: [{ label: 'Hour', cx: 87, w: 49 }, { label: 'Minute', cx: 167, w: 49 }],
    };
  }
  _stepBump(kind, col, dir) {
    if (kind === 'date') { const k = ['m', 'd', 'y'][col]; const max = k === 'm' ? 12 : k === 'd' ? 31 : 2099; const min = k === 'y' ? 2000 : 1; this.date[k] = Math.max(min, Math.min(max, this.date[k] + dir)); }
    else { const t = kind === 'time' ? this.time : this.alarm; const k = ['h', 'min'][col]; const max = k === 'h' ? 23 : 59; t[k] = (t[k] + dir + (max + 1)) % (max + 1); }
    this.blip();
  }

  handle(action, data) {
    if (action !== 'press') return;
    if (this.confirmExit) {   // "Return to DSi Menu?" dialog is up
      if (data === 'left' || data === 'right') { this.confirmExit.sel = data === 'left' ? 0 : 1; this.blip(); }
      else if (data === 'B') { this.confirmExit = null; this.blip(); }
      else if (data === 'A' || data === 'START') { const yes = this.confirmExit.sel !== 1; this.confirmExit = null; if (yes) this.exit(); else this.blip(); }
      return;
    }
    if (this.trans) return;   // ignore input while a page/sub-screen transition plays
    if (this.sub === 'brightness') {
      if (data === 'up' || data === 'right') { this.brightness = Math.min(5, this.brightness + 1); this.blip(); }
      else if (data === 'down' || data === 'left') { this.brightness = Math.max(1, this.brightness - 1); this.blip(); }
      else if (data === 'A' || data === 'START' || data === 'B') { this._startBack(); }
      return;
    }
    if (this.sub === 'language') {
      if (data === 'down') { this.langSel = Math.min(this.langs.length - 1, this.langSel + 1); this.blip(); }
      else if (data === 'up') { this.langSel = Math.max(0, this.langSel - 1); this.blip(); }
      else if (data === 'A' || data === 'START' || data === 'B') { this._startBack(); }
      return;
    }
    if (this.sub === 'profile') {
      if (data === 'down') { this.profileSel = Math.min(this.profileItems.length - 1, this.profileSel + 1); this.blip(); }
      else if (data === 'up') { this.profileSel = Math.max(0, this.profileSel - 1); this.blip(); }
      else if ((data === 'A' || data === 'START') && this.profileSel === 2) { this._startEnter(2, 'color', 'profile'); }
      else if (data === 'B') { this._startBack(); }
      return;
    }
    if (this.sub === 'color') {
      const col = this.colorSel % 8, row = Math.floor(this.colorSel / 8);
      if (data === 'right') { this.colorSel = row * 8 + Math.min(7, col + 1); this.blip(); }
      else if (data === 'left') { this.colorSel = row * 8 + Math.max(0, col - 1); this.blip(); }
      else if (data === 'down') { this.colorSel = Math.min(1, row + 1) * 8 + col; this.blip(); }
      else if (data === 'up') { this.colorSel = Math.max(0, row - 1) * 8 + col; this.blip(); }
      else if (data === 'A' || data === 'START') { this.profile.favColor = this.colorSel; this._startBack('profile'); }
      else if (data === 'B') { this.colorSel = this.profile.favColor; this._startBack('profile'); }
      return;
    }
    if (this.sub === 'wireless') {
      if (data === 'up' || data === 'down') { this.wireless = !this.wireless; this.blip(); }
      else if (data === 'A' || data === 'START' || data === 'B') { this._startBack(); }
      return;
    }
    if (this.sub === 'datamgmt') {
      if (data === 'left' || data === 'right' || data === 'L' || data === 'R') { this.dataTab = data === 'left' || data === 'L' ? 0 : 1; this.blip(); }
      else if (data === 'B') { this._startBack(); }
      return;
    }
    if (this.sub === 'sysupdate') {
      if (data === 'A' || data === 'START' || data === 'B') { this._startBack(); }
      return;
    }
    if (this.sub === 'country') {
      if (data === 'down') { this.countrySel = Math.min(this.countries.length - 1, this.countrySel + 1); this.blip(); }
      else if (data === 'up') { this.countrySel = Math.max(0, this.countrySel - 1); this.blip(); }
      else if (data === 'A' || data === 'START' || data === 'B') { this._startBack(); }
      return;
    }
    if (this.sub === 'format' || this.sub === 'parental') {
      if (data === 'A' || data === 'START' || data === 'B') { this._startBack(); }
      return;
    }
    if (this.sub === 'touchscreen') {
      if (data === 'B') { this._startBack(); }   // cancel
      return;
    }
    if (this.sub === 'mictest') {
      if (data === 'A' || data === 'START' || data === 'B') { this._startBack(); }  // Quit
      return;
    }
    if (this.sub === 'internet') {
      if (data === 'B') { this._startBack(); }
      return;
    }
    if (this.sub === 'date' || this.sub === 'time' || this.sub === 'alarm') {
      const cols = this._stepper(this.sub).cols.length;
      if (data === 'left') { this.stepCol = Math.max(0, this.stepCol - 1); this.blip(); }
      else if (data === 'right') { this.stepCol = Math.min(cols - 1, this.stepCol + 1); this.blip(); }
      else if (data === 'up') this._stepBump(this.sub, this.stepCol, 1);
      else if (data === 'down') this._stepBump(this.sub, this.stepCol, -1);
      else if (data === 'A' || data === 'START' || data === 'B') { this._startBack(); this.stepCol = 0; }
      return;
    }
    const items = PAGES[this.page];
    if (data === 'down') { this.sel = Math.min(items.length - 1, this.sel + 1); this.blip(); }
    else if (data === 'up') { this.sel = Math.max(0, this.sel - 1); this.blip(); }
    else if (data === 'right' || data === 'R') this._startPage(1);
    else if (data === 'left' || data === 'L') this._startPage(-1);
    else if (data === 'A' || data === 'START') this._startEnter(this.sel, this._subFor(this.page, this.sel));
    else if (data === 'B') { this._askExit(); }
  }

  // the "DSi Menu" bar (or B on the main menu) does not exit immediately: it raises
  // a "Return to DSi Menu?" confirmation dialog (RE'd out/settings_trans/exit).
  _askExit() { if (this.confirmExit || this.trans || this.sub) return; this.confirmExit = { t: 0, sel: -1 }; this.audio && this.audio.play('touch'); }
  touch({ x, y }) {
    if (this.confirmExit) {   // Yes (x37..126) / No (x134..223), split at the ~130px gap centre
      if (y >= 136 && y <= 168) {
        if (x >= 30 && x < 130) { this.confirmExit = null; this.exit(); }
        else if (x >= 130 && x <= 230) { this.confirmExit = null; this.blip(); }
      }
      return;
    }
    if (this.trans) return;   // ignore taps while a transition plays
    if (this.sub === 'brightness') {
      if (y > 178) { this._startBack(); return; }  // OK
      if (x > 60 && x < 196) {
        if (y >= 60 && y < 92) { this.brightness = Math.min(5, this.brightness + 1); this.blip(); }   // +
        else if (y >= 135 && y < 165) { this.brightness = Math.max(1, this.brightness - 1); this.blip(); } // -
      }
      return;
    }
    if (this.sub === 'language') {
      if (y > 178) { this._startBack(); return; } // Back/OK
      for (let i = 0; i < this.langs.length; i++) { const ly = 42 + i * 40; if (y >= ly && y < ly + 24 && x >= 34 && x < 220) { this.langSel = i; this.blip(); break; } }
      return;
    }
    if (this.sub === 'profile') {
      if (y > 170) { this._startBack(); return; } // Back
      for (let i = 0; i < this.profileItems.length; i++) {
        const ly = this._btnY(this.profileItems.length, i);
        if (y >= ly && y < ly + 24 && x >= 34 && x < 220) {
          this.profileSel = i;
          if (i === 2) { this._startEnter(2, 'color', 'profile'); } else { this.blip(); }
          break;
        }
      }
      return;
    }
    if (this.sub === 'color') {
      if (y > 170) {
        if (x < 128) { this.colorSel = this.profile.favColor; this._startBack('profile'); }   // Back (cancel)
        else { this.profile.favColor = this.colorSel; this._startBack('profile'); }            // OK (confirm)
        return;
      }
      for (let i = 0; i < 16; i++) {
        const col = i % 8, row = Math.floor(i / 8);
        const cx = 26 + col * 29, cy = 68 + row * 46;
        if (x >= cx - 14 && x < cx + 15 && y >= cy - 14 && y < cy + 15) { this.colorSel = i; this.blip(); break; }
      }
      return;
    }
    if (this.sub === 'datamgmt') {
      if (y > 172) { this._startBack(); return; } // Back
      if (y < 28) { this.dataTab = x < 128 ? 0 : 1; this.blip(); }                        // tabs
      return;
    }
    if (this.sub === 'sysupdate') {
      if (y > 170) { this._startBack(); }  // Yes / No
      return;
    }
    if (this.sub === 'country') {
      if (y > 170) { this._startBack(); return; }  // Back/OK
      for (let i = 0; i < this.countries.length; i++) { const ry = 28 + i * 25; if (y >= ry && y < ry + 23 && x >= 7 && x < 229) { this.countrySel = i; this.blip(); break; } }
      return;
    }
    if (this.sub === 'format' || this.sub === 'parental') {
      if (y > 170) { this._startBack(); }  // bar buttons
      return;
    }
    if (this.sub === 'touchscreen') { this.blip(); return; }  // taps are calibration points; cancel is B
    if (this.sub === 'mictest') { if (y > 170) { this._startBack(); } return; }  // Quit
    if (this.sub === 'internet') { if (y > 170) { this._startBack(); } return; }  // Back
    if (this.sub === 'wireless') {
      if (y > 170) { this._startBack(); return; } // Back/OK
      if (x >= 34 && x < 220) {
        if (y >= 55 && y < 79) { this.wireless = true; this.blip(); }
        else if (y >= 108 && y < 132) { this.wireless = false; this.blip(); }
      }
      return;
    }
    if (this.sub === 'date' || this.sub === 'time' || this.sub === 'alarm') {
      if (y > 170) { this._startBack(); this.stepCol = 0; return; } // Back/OK
      const cols = this._stepper(this.sub).cols;
      for (let i = 0; i < cols.length; i++) {
        const c = cols[i]; if (x >= c.cx - c.w / 2 && x <= c.cx + c.w / 2) {
          if (y >= 42 && y <= 68) { this.stepCol = i; this._stepBump(this.sub, i, 1); }        // up arrow
          else if (y >= 114 && y <= 140) { this.stepCol = i; this._stepBump(this.sub, i, -1); } // down arrow
          break;
        }
      }
      return;
    }
    // DSi Menu return bar at bottom
    if (y > 180) { this._askExit(); return; }
    // right/left arrow -> next/prev page (slides)
    if (x > 222 && y > 70 && y < 120) { this._startPage(1); return; }
    if (x < 34 && y > 70 && y < 120 && this.page > 0) { this._startPage(-1); return; }
    // button hit-test
    const items = PAGES[this.page];
    for (let i = 0; i < items.length; i++) {
      const by = this._btnY(items.length, i);
      if (y >= by && y < by + 24 && x > 34 && x < 220) {
        this.sel = i; this._startEnter(i, this._subFor(this.page, i));
        break;
      }
    }
  }
  blip() { this.audio && this.audio.play('settingsNav', { gain: 0.8 }); }
  exit() { this.audio && this.audio.play('touch'); this.onExit && this.onExit(); }

  // "Return to DSi Menu?" confirmation dialog. The panel is the real
  // msk_dialog_BG02.NSCR/.NCGR/.NCLR asset (bank 12 = the panel's own fixed
  // grey/white corner-and-edge antialiasing, bank 14 = the blue rim, recoloured
  // at runtime through msk_dialog_BG_UC0E.NCLR bank 11 the same way buttons
  // are - see tools/extract-dialog-sprites.js), at rest x16..239 (224w)
  // y18..173 (156h). The Yes/No buttons are msk_softmanage_D.ncer cells 10
  // (grey) / 12 (blue, same UC0E mask), 96x32 each, touching at x128 (Yes
  // 32..128, No 128..224), y136..168. Verified 0 diff outside the text labels
  // against out/settings_trans/dlg/g_0044 (idle, grey) and
  // out/settings_trans2/yes_release (confirmed, blue) - scripts/settings_dlg.txt
  // and settings_dlg2.txt. Text is drawn separately as a fixed 3-level opaque
  // ink ramp (not alpha-blended), sourced from the same palette banks as the
  // sprite it sits on - see Fonts.drawCenteredLevels.

  // Real hardware brightness-decrease blend (see EXIT_DIALOG_EVY_RAMP above),
  // applied per-pixel to whatever is already drawn on ctx (the settings menu
  // behind the dialog) in the console's native 6-bit colour space.
  _darkenExitDialogBg(ctx) {
    const evy = EXIT_DIALOG_EVY_RAMP[Math.min(EXIT_DIALOG_EVY_RAMP.length - 1, Math.max(0, Math.floor(this.confirmExit.t)))];
    if (evy === 0) return;
    const img = ctx.getImageData(0, 0, 256, 192);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const v6 = d[i + c] >> 2;
        const n6 = v6 - (((v6 * evy) + EXIT_DIALOG_EVY_BIAS) >> 4);
        d[i + c] = (n6 << 2) | (n6 >> 4);
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  _drawExitDialog(ctx) {
    const slide = easeInOut(Math.min(1, this.confirmExit.t / 12));
    const yo = Math.round((1 - slide) * 100);          // slide up from the bottom
    // NOTE: this yo/slide entrance curve for the box's own position is still an
    // approximation - the dim-behind effect below, however,
    // is the real measured hardware brightness-decrease blend, not a guess.
    this._darkenExitDialogBg(ctx);
    const by = 18 + yo;
    const panel = Assets.img('dialog_box_' + FAV_NAMES[this.profile.favColor]);
    if (panel) {
      const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
      ctx.drawImage(panel, 16, by);
      ctx.imageSmoothingEnabled = sm;
    }
    // title ink: msk_dialog_BG.NCLR bank 12 idx 9/11/12 (same bank as the
    // panel's own corner antialiasing, measured 195,195,195 / 113,113,113 /
    // 81,81,81 against the real capture). Baseline y re-measured by
    // row-profile cross-correlation against out/settings_trans/dlg/g_0044.bot
    // (best match at shift 0, err 0 over the whole glyph block).
    Fonts.m.drawCenteredLevels(ctx, 'Return to DSi Menu?', 128, by + 54, 'dlgTitle',
      { 1: [195, 195, 195], 2: [113, 113, 113], 3: [81, 81, 81] });
    const sel = this.confirmExit.sel;   // -1 = no cursor highlight (touch-first, both grey)
    // measured on the real dialog (out/settings_trans/dlg/g_0047): the two 89px capsules sit
    // at x37 and x134 with an ~8px gap between them (not edge-to-edge 96px capsules).
    this._glossyButton(ctx, 37, by + 118, 89, 32, sel === 0, 4);     // Yes
    this._glossyButton(ctx, 134, by + 118, 89, 32, sel === 1, 4);    // No
    // label ink: grey state from msk_softmanage_D.NCLR bank 12 idx 13/14/15
    // (178,178,178 / 113,113,113 / 65,65,65); selected state from the same
    // UC0E-recoloured bank 14 idx 13/14/15 as the button itself, one triple per
    // favourite colour (EXIT_DIALOG_INK below) - read directly off msk_dialog_BG_
    // UC0E.NCLR bank[favColor][13,14,15]; 'blue' (16,73,195 / 8,40,146 / 0,0,97)
    // matches the previously hand-measured value exactly. Baseline y re-measured
    // the same way as the title (shift 0, err 0 against g_0044.bot).
    const greyInk = { 1: [178, 178, 178], 2: [113, 113, 113], 3: [65, 65, 65] };
    const selInk = EXIT_DIALOG_INK[this.profile.favColor];
    Fonts.m.drawCenteredLevels(ctx, 'Yes', 81, by + 126, sel === 0 ? 'dlgInk' + this.profile.favColor : 'dlgInkGrey', sel === 0 ? selInk : greyInk);
    Fonts.m.drawCenteredLevels(ctx, 'No', 178, by + 126, sel === 1 ? 'dlgInk' + this.profile.favColor : 'dlgInkGrey', sel === 1 ? selInk : greyInk);
  }

  _statusBar(ctx) {
    this._volumeIcon(ctx);
    // "User" nickname label: real opaque 3-level AA ramp, not a flat alpha
    // fill - see STATUS_USER_INK's own comment for the NCLR source and how
    // this was distinguished from CARD_BORDER_TINT (which was wrong here).
    const userInk = STATUS_USER_INK[this.profile.favColor];
    Fonts.m.drawLevels(ctx, 'User', 27, 2, 'statUser' + this.profile.favColor, { 1: userInk[0], 2: userInk[1], 3: userInk[2] });
    // real capture (out/settings/page1.top.ppm) shows this as an opaque 3-level AA
    // ramp, not an alpha-blended flat fill - same "DSi replaces, doesn't blend"
    // rendering drawLevels already reproduces for the dialog title/labels. Levels
    // read directly off the capture: 105/170/251, increasing with stroke coverage
    // (light text on the dark #303030/#383838 status bar dither).
    // Date and time are two independently right-anchored fields, not one string:
    // the time field's own internal space ("00 00") already measures pixel-exact
    // with the font table's plain 4px space advance, but the gap between the date
    // and time fields measures 5px, not 4 - segment-boundary reconstruction against
    // the real capture found the time field's ink columns land at the exact x the
    // font table predicts (rx=231) while the date field sits exactly 1px further
    // left than a single drawRight() call with one shared space glyph would place it.
    const clockInk = { 1: [105, 105, 105], 2: [170, 170, 170], 3: [251, 251, 251] };
    const CLOCK_RIGHT = 231, CLOCK_GAP = 5, CLOCK_Y = 5;
    const timeStr = '00 00', dateStr = '01/01';
    const timeX = Math.round(CLOCK_RIGHT - Fonts.s.measure(timeStr));
    Fonts.s.drawLevels(ctx, timeStr, timeX, CLOCK_Y, 'statClockTime', clockInk);
    Fonts.s.drawLevels(ctx, dateStr, timeX - CLOCK_GAP - Fonts.s.measure(dateStr), CLOCK_Y, 'statClockDate', clockInk);
    this._battery(ctx);
  }

  // shared "instruction" top screen: centred title, bright dashed rule at y76,
  // centred subtitle at y122 (measured on the real Language/Brightness/Date tops)
  _infoTop(ctx, title, subtitle) {
    this._scanBg(ctx, '#303030', '#383838'); this._statusBar(ctx);
    Fonts.l.drawCentered(ctx, title, 128, 39, '#fbfbfb');
    ctx.fillStyle = '#cbcbcb';
    for (let x = 16; x <= 236; x += 4) ctx.fillRect(x, 76, 2, 1);
    const lines = Array.isArray(subtitle) ? subtitle : [subtitle];
    const n = lines.length;
    // single line sits at y124; a multi-line block is centred on base y124
    // (measured out/settings/sub_*.top.ppm: 4 lines land at 103/119/135/151,
    // 2 lines at 125/141).
    lines.forEach((ln, i) => {
      const y = n === 1 ? 124 : Math.round(124 + (i - (n - 1) / 2) * 16);
      Fonts.m.drawCentered(ctx, ln, 128, y, '#fbfbfb');
    });
  }

  _renderTop(screen) {
    const ctx = screen.c;
    const INFO = {
      brightness: ['Brightness Settings', 'Adjust screen brightness.'],
      language: ['Language', 'Select language.'],
      date: ['Date', "Set today's date."],
      time: ['Time', 'Set the current time.'],
      alarm: ['Alarm', 'Set a time for the alarm to sound.'],
      wireless: ['Wireless Communications', ['Set to ON to use Wireless', 'Communications. Set to', 'OFF to disable Wireless', 'Communications.']],
      sysupdate: ['System Update', ['Update your', 'Nintendo DSi system.']],
      country: ['Country', 'Select your country of residence.'],
      format: ['Format System Memory', 'Format system memory.'],
      internet: ['Internet', ['Configure your Internet settings.', 'Tap the settings you want to adjust.']],
      parental: ['Parental Controls', ['Set up Parental Controls to', 'limit access to certain content.']],
    };
    if (INFO[this.sub]) { this._infoTop(ctx, INFO[this.sub][0], INFO[this.sub][1]); return; }
    if (this.sub === 'mictest') {
      this._scanBg(ctx, '#303030', '#383838'); this._statusBar(ctx);
      // real DSi console line-art (BG01) with the mic location ringed
      const con = Assets.img('setting_console');
      if (con) ctx.drawImage(con, 82, 40);
      this._targetRing(ctx, 128, 92, '#ffb400');                     // mic ring at the hinge
      Fonts.m.drawCentered(ctx, 'Speak into the mic to', 128, 141, '#e0e0e0');
      Fonts.m.drawCentered(ctx, 'test the sensitivity.', 128, 157, '#e0e0e0');
      return;
    }
    if (this.sub === 'touchscreen') {
      this._scanBg(ctx, '#303030', '#383838'); this._statusBar(ctx);
      Fonts.l.drawCentered(ctx, 'Touch Screen', 128, 40, '#ffffff');
      ctx.fillStyle = '#cbcbcb';
      for (let x = 16; x <= 236; x += 4) ctx.fillRect(x, 76, 2, 1);
      Fonts.m.drawCentered(ctx, 'Calibrate Touch Screen input.', 128, 122, '#e0e0e0');
      // real bullseye glyph (U+25CE) from the DSi font
      Fonts.m.drawCentered(ctx, 'Tap ◎ with the stylus.', 128, 138, '#e0e0e0');
      return;
    }
    if (this.sub === 'datamgmt') {
      this._scanBg(ctx, '#303030', '#383838'); this._statusBar(ctx);
      Fonts.l.drawCentered(ctx, 'Data Management', 128, 39, '#fbfbfb');
      ctx.fillStyle = '#cbcbcb';
      for (let x = 16; x <= 236; x += 4) ctx.fillRect(x, 76, 2, 1);
      // left: the real filled DSi console sprite (U cell 15), ghosted at ~55%,
      // with the "System Memory" caption + free-block count centred on its axis x70.
      const con = Assets.img('setting_sysmem');
      if (con) { ctx.imageSmoothingEnabled = false; ctx.save(); ctx.globalAlpha = 0.55; ctx.drawImage(con, 38, 88); ctx.restore(); }
      Fonts.m.drawCentered(ctx, 'System Memory', 70, 117, '#c8c8c8');
      Fonts.m.drawCentered(ctx, 'Blocks Free:', 68, 157, '#d8d8d8');
      Fonts.m.drawCentered(ctx, '20', 68, 174, '#ffffff');
      // right: the real dashed SD-card outline (U cell 22), centred under the text
      const sd = Assets.img('setting_sd_empty');
      if (sd) ctx.drawImage(sd, 160, 88);
      else { ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); this._round(ctx, 196, 98, 52, 60, 4); ctx.stroke(); ctx.setLineDash([]); }
      Fonts.m.drawCentered(ctx, 'There is no SD', 186, 104, '#e8e8e8');
      Fonts.m.drawCentered(ctx, 'Card inserted.', 186, 124, '#e8e8e8');
      return;
    }
    if (this.sub === 'profile' || this.sub === 'color') {
      // Color is a nested sub-screen of Profile; its top screen is the same
      // User card with the same caption - confirmed 0 diff on the card/caption
      // region in a real capture (out/settings_color/c80.top.ppm vs
      // profile.top.ppm; the only pixels that differ are the volatile
      // clock/battery status-bar glyphs, which tick between the two captures
      // and are not sourced from either ppm in this app anyway).
      this._scanBg(ctx, '#303030', '#383838'); this._statusBar(ctx);
      this._profileCard(ctx);
      Fonts.m.drawCentered(ctx, 'Edit your profile.', 128, 174, '#fbfbfb');
      return;
    }
    // real settings top is fully dark (~#303030) with light text/icons on it
    this._scanBg(ctx, '#303030', '#383838'); this._statusBar(ctx);
    this._profileCard(ctx);
    // version, below the card: real capture shows the same opaque 3-level AA
    // ramp (105/170/251) as the status-bar clock/User text, not an alpha blend,
    // plus the same +1px per-glyph tracking the profile message needs, plus a
    // right anchor of x253 (not x248) and a y of 175 (not 178) - all derived
    // from a row-by-row ink pattern match against out/settings/page1.top.ppm:
    // the clone's full glyph shape sequence at y=178..187 was identical to
    // real's at y=175..184, a uniform 3px-too-low offset, not a per-glyph bug.
    Fonts.m.drawRightLevels(ctx, this.version, 253, 175, 'settingsVersion', { 1: [105, 105, 105], 2: [170, 170, 170], 3: [251, 251, 251] }, 1);
  }

  // The user profile card shared by the Settings top and the Profile sub-screen.
  // Measured: grey side bevel x16..18, white body x19..236 y40..154, blue top
  // accent y36..39, blue divider y68, blue Birthday bar y136..153. The
  // accent/divider/Birthday-bar colours are favColor-tinted - see
  // CARD_BORDER_TINT (real melonDS capture at favColor=2 'red',
  // scripts/settings_pages.txt against a NAND scratch copy patched via
  // `nandfs <dir> setfavcolor 2`, showed this card still rendering blue
  // before this fix).
  _profileCard(ctx) {
    const [L, c0, c2] = CARD_BORDER_TINT[this.profile.favColor];
    ctx.fillStyle = '#fbfbfb'; ctx.fillRect(19, 40, 218, 114);       // white body x19..236
    // grey side bevel: measured 3px gradient (#a2a2a2->#c3c3c3->#dbdbdb toward the white).
    // Only spans the white-body height (y40-135) - over the blue birthday bar real shows
    // 2px flat L then a 1px flat solid c0 line (not dithered, unlike the fill past it),
    // and only for y136-159: y160-165 is the bottom rounded corner's own stairstep,
    // painted below by _cardCornerCurve, so this flat run must stop short of it.
    const bev = ['#a2a2a2', '#c3c3c3', '#dbdbdb'];
    for (let i = 0; i < 3; i++) { ctx.fillStyle = bev[i]; ctx.fillRect(16 + i, 40, 1, 96); ctx.fillRect(239 - i, 40, 1, 96); }
    ctx.fillStyle = L; ctx.fillRect(16, 136, 2, 24); ctx.fillRect(238, 136, 2, 24);
    ctx.fillStyle = c0; ctx.fillRect(18, 136, 1, 24); ctx.fillRect(237, 136, 1, 24);
    // blue top accent: a 1px darker AA line then a 5px 2-row scanline dither. The apex
    // row (y34) is 1px narrower on each side than the body (x20..235, not x19..236) -
    // it's the tightest row of the rounded corner curve below, not the body's full width.
    ctx.fillStyle = L; ctx.fillRect(20, 34, 216, 1);
    this._scanFill(ctx, c2, c0, 19, 35, 218, 5);
    const nameInk = PROFILE_NAME_INK[this.profile.favColor];
    Fonts.l.drawCenteredLevels(ctx, this.profile.name, 127, 46, 'profileName' + this.profile.favColor, { 1: nameInk[0], 2: nameInk[1], 3: nameInk[2] });
    ctx.fillStyle = c0; ctx.fillRect(32, 68, 192, 1);         // divider under name
    // track=1: the free-typed profile message measures pixel-exact only with 1px extra
    // pen advance per glyph versus the tight system-label spacing used by fixed UI text
    // like the status-pill "User" - derived from real capture glyph boundaries (see
    // TODO.md), not a guess.
    Fonts.m.drawCenteredLevels(ctx, this.profile.message, 128, 94, 'profileMsg', PROFILE_MESSAGE_INK, 1);
    // Birthday bar: measured 2-row scanline dither #0059f3 / #2879fb, ~29px tall
    this._scanFill(ctx, c0, c2, 19, 136, 218, 29);
    ctx.fillStyle = L; ctx.fillRect(20, 165, 216, 1);
    // Rounded corners: real capture shows a HARD-edged (no AA) staircase curve at both
    // ends of the accent bar (y34-39) and birthday bar (y160-165), identical in all 4
    // corner instances once accounted for left/right and top/bottom mirroring (verified:
    // top-left reversed == top-right, and top curve == birthday-bar curve read from its
    // own outer edge inward, exact zero-residual match on every one of 4 corners x 6 rows).
    // Not a soft circular AA blend - a genuine multi-segment stair the real hardware
    // rasterizes this way. See CARD_CORNER_CURVE for the measured per-row segments.
    this._cardCornerCurve(ctx, L, c0, c2, 34, 1);
    this._cardCornerCurve(ctx, L, c0, c2, 165, -1);
    // "Birthday" and the date are two fields with a real measured gap of 7px between
    // them (wider than the font's plain space advance of 4) and a right anchor of x224
    // (not the card's naive right margin of 229) - each field's own glyphs measure
    // pixel-exact with plain (untracked) advances; only the label/value gap and the
    // anchor were off. Reconstructed from 5 independently-confirmed digit/slash
    // boundaries plus 4 independently-confirmed letter boundaries in the real capture.
    // white-on-blue opaque ramp: the two blend steps are the SAME [170,203,251]/
    // [81,146,251] pair as PROFILE_NAME_INK's blue-on-white ramp (same underlying
    // white<->favColor blend, read from the opposite end), full ink is plain white.
    // Coverage direction is reversed from the name ramp (ink is white here, not
    // blue), so level1 (least coverage, closest to the blue bg) takes the DARKER
    // of the pair and level2 (more coverage, closest to white) takes the lighter one.
    const nameRamp = PROFILE_NAME_INK[this.profile.favColor];
    const birthdayInk = { 1: nameRamp[1], 2: nameRamp[0], 3: [251, 251, 251] };
    const BIRTHDAY_RIGHT = 224, BIRTHDAY_GAP = 7;
    const dateW = Fonts.m.measure(this.profile.birthday);
    Fonts.m.drawLevels(ctx, this.profile.birthday, BIRTHDAY_RIGHT - dateW, 143, 'birthdayDate' + this.profile.favColor, birthdayInk);
    const labelW = Fonts.m.measure('Birthday');
    Fonts.m.drawLevels(ctx, 'Birthday', BIRTHDAY_RIGHT - dateW - BIRTHDAY_GAP - labelW, 143, 'birthdayLabel' + this.profile.favColor, birthdayInk);
  }

  _renderBottom(screen) {
    const ctx = screen.c;
    if (this.sub === 'brightness') { this._drawBrightnessBottom(screen); return; }
    if (this.sub === 'language') { this._drawLanguageBottom(screen); return; }
    if (this.sub === 'profile') { this._drawProfileBottom(screen, this._pressSel); return; }
    if (this.sub === 'color') { this._drawColorBottom(screen); return; }
    if (this.sub === 'date' || this.sub === 'time' || this.sub === 'alarm') { this._drawStepperBottom(screen); return; }
    if (this.sub === 'wireless') { this._drawWirelessBottom(screen); return; }
    if (this.sub === 'datamgmt') { this._drawDataMgmtBottom(screen); return; }
    if (this.sub === 'sysupdate') { this._drawConfirmBottom(screen, 'System Update', ['Connect to the Internet', 'and update system?']); return; }
    if (this.sub === 'parental') { this._drawConfirmBottom(screen, 'Parental Controls', ['Use Parental Controls?'], 'Yes', 'No'); return; }
    if (this.sub === 'country') { this._drawCountryBottom(screen); return; }
    if (this.sub === 'touchscreen') { this._drawTouchCalib(screen); return; }
    if (this.sub === 'mictest') { this._drawMicTest(screen); return; }
    if (this.sub === 'internet') { this._drawInternetBottom(screen); return; }
    if (this.sub === 'format') {
      this._drawConfirmBottom(screen, 'Format System Memory',
        ['This will delete added software and', 'all save data. Software copied to an', 'SD Card cannot be restored, nor can', 'any deleted data.', 'Do you still want to format?'],
        'Back', 'Format');
      return;
    }
    // the main menu is drawn as three layers so the page-change slide can move the
    // buttons under the static header/arrows: bg + header/footer, then the buttons
    // (offset during a slide), then the arrows + scrollbar on top.
    this._drawMenuBg(ctx, this.page);
    this._drawMenuButtons(ctx, this.page, this._pressSel, 0);
    this._drawMenuArrows(ctx, this.page);
  }

  // menu background + "System Settings 1 2 3 4" header (tabPage boxed) + footer bar
  _drawMenuBg(ctx, tabPage) {
    this._scanBg(ctx, '#383838', '#414141'); this._scanFill(ctx, '#303030', '#383838', 0, 0, 256, 23);
    Fonts.banner.draw(ctx, 'System Settings', 6, 2, '#fbfbfb');
    for (let p = 0; p < 4; p++) {
      const tx = 179 + p * 20;   // digit x (real centres ~180/199/220/241, pitch 20)
      if (p === tabPage) {
        // the selected page tab is a HOLLOW outline box (dark textured interior
        // showing through), not a solid fill - a top-to-bottom gradient through
        // the real favColor ramp (PAGE_TAB_GRADIENT), not a flat colour (see
        // its comment for the source and the real-capture pixel-row measurement).
        const y0 = 3.5, y1 = 16.5, stops = PAGE_TAB_GRADIENT[this.profile.favColor];
        const g = ctx.createLinearGradient(0, y0, 0, y1);
        stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
        ctx.strokeStyle = g; ctx.lineWidth = 1;
        this._round(ctx, tx - 4.5, y0, 15, 13, 2); ctx.stroke();
      }
      Fonts.m.draw(ctx, String(p + 1), tx, 3, p === tabPage ? '#fff' : '#cfcfcf');
    }
    ctx.fillStyle = '#7d7d7d';
    for (let x = 2; x < 256; x += 4) { ctx.fillStyle = '#828282'; ctx.fillRect(x, 21, 1, 1); ctx.fillStyle = '#717171'; ctx.fillRect(x + 1, 21, 1, 1); }   // dashed header rule
    this._settingsBottomBar(ctx, 'DSi Menu');
  }

  // the button stack for a page, shifted horizontally by xoff (for the slide);
  // pressSel (>=0) draws that button blue while entering a sub-screen.
  _drawMenuButtons(ctx, page, pressSel, xoff) {
    const items = PAGES[page];
    for (let i = 0; i < items.length; i++) {
      const by = this._btnY(items.length, i);
      const pressed = i === pressSel;
      this._glossyButton(ctx, 34 + xoff, by, 186, 24, pressed);
      Fonts.banner.drawCentered(ctx, items[i], 128 + xoff, by + 4, pressed ? '#ffffff' : '#282828');
    }
  }

  // static right-edge scrollbar + the tall blue page-turn arrows (kept above the
  // sliding buttons during a page change).
  _drawMenuArrows(ctx, page) {
    ctx.fillStyle = '#202020'; ctx.fillRect(250, 32, 6, 122);
    for (const ny of [34, 130]) {
      const g = ctx.createLinearGradient(0, ny, 0, ny + 22);
      g.addColorStop(0, '#d3d3d3'); g.addColorStop(1, '#9a9a9a');
      ctx.fillStyle = g; ctx.fillRect(250, ny, 5, 22);
    }
    if (page < 3) this._pageArrow(ctx, 231, 1);
    if (page > 0) this._pageArrow(ctx, 4, -1);
  }

  _drawBrightnessBottom(screen) {
    const ctx = screen.c;
    this._scanBg(ctx, '#383838', '#414141'); this._scanFill(ctx, '#303030', '#383838', 0, 0, 256, 23);
    Fonts.banner.draw(ctx, 'Brightness Settings', 7, 2, '#fbfbfb');
    ctx.fillStyle = '#7d7d7d';
    for (let x = 2; x < 256; x += 4) { ctx.fillStyle = '#828282'; ctx.fillRect(x, 21, 1, 1); ctx.fillStyle = '#717171'; ctx.fillRect(x + 1, 21, 1, 1); }
    Fonts.l.drawCentered(ctx, 'Tap + or -', 128, 34, '#ffffff');
    // +/- buttons (measured x68..187, y62..88 and y132..158). The button at the
    // limit is greyed out flat, exactly like the real screen at level 5 / 1.
    const bx = 67, bw = 121, bh = 26;
    this._stepButton(ctx, bx, 62, bw, bh, '+', this.brightness >= 5);
    // big level number using the real digit sprites (measured bbox y97..124)
    this._drawDigits(ctx, String(this.brightness), 128, 95);
    this._stepButton(ctx, bx, 132, bw, bh, '-', this.brightness <= 1);
    this._settingsBottomBar(ctx, 'OK');
  }

  // a +/- push button. Enabled = glossy grey; disabled (at limit) = flat #696971
  // with a dim symbol, matching the real greyed-out state.
  _stepButton(ctx, x, y, w, h, sym, disabled) {
    if (disabled) {
      ctx.fillStyle = '#202020'; this._round(ctx, x, y + 1, w, h, 4); ctx.fill();
      ctx.fillStyle = '#696971'; this._round(ctx, x, y, w, h, 4); ctx.fill();
      Fonts.l.drawCentered(ctx, sym, 128, y + 5, '#4e4e56');
    } else {
      this._glossyButton(ctx, x, y, w, h, false);
      Fonts.l.drawCentered(ctx, sym, 128, y + 5, '#1a1a1a');
    }
  }

  _drawLanguageBottom(screen) {
    const ctx = screen.c;
    this._scanBg(ctx, '#383838', '#414141'); this._scanFill(ctx, '#303030', '#383838', 0, 0, 256, 23);
    Fonts.banner.draw(ctx, 'Language', 7, 2, '#fbfbfb');
    // dashed rule under the header (real: y21, full width, 2px dash / 2px gap)
    ctx.fillStyle = '#7d7d7d';
    for (let x = 2; x < 256; x += 4) { ctx.fillStyle = '#828282'; ctx.fillRect(x, 21, 1, 1); ctx.fillStyle = '#717171'; ctx.fillRect(x + 1, 21, 1, 1); }
    // language list: full-width glossy buttons; selected = glossy blue. Text is
    // always dark (measured: even the selected label is near-black, not white).
    const bx = 34, bw = 186, bh = 24;
    for (let i = 0; i < this.langs.length; i++) {
      const ly = 42 + i * 40;
      this._glossyButton(ctx, bx, ly, bw, bh, i === this.langSel);
      // banner_lm: the large label font that still carries the ç/ñ accents
      // (TBF1_l lacks Latin-1). Measured glyph band y48..64 for a y42 button.
      Fonts.banner.drawCentered(ctx, this.langs[i], 128, ly + 4, '#282828');
    }
    this._settingsBottomBar(ctx, 'Back', 'OK');
  }

  // Profile sub-menu: four grey action buttons (no blue cursor, except a brief
  // press-flash when one is tapped to enter it - same pattern as _drawMenuButtons)
  // + a Back bar.
  _drawProfileBottom(screen, pressSel = -1) {
    const ctx = screen.c;
    this._scanBg(ctx, '#383838', '#414141'); this._scanFill(ctx, '#303030', '#383838', 0, 0, 256, 23);
    Fonts.banner.draw(ctx, 'Profile', 7, 2, '#fbfbfb');
    ctx.fillStyle = '#7d7d7d';
    for (let x = 2; x < 256; x += 4) { ctx.fillStyle = '#828282'; ctx.fillRect(x, 21, 1, 1); ctx.fillStyle = '#717171'; ctx.fillRect(x + 1, 21, 1, 1); }
    for (let i = 0; i < this.profileItems.length; i++) {
      const ly = this._btnY(this.profileItems.length, i);
      const pressed = i === pressSel;
      this._glossyButton(ctx, 34, ly, 186, 24, pressed);
      Fonts.banner.drawCentered(ctx, this.profileItems[i], 128, ly + 4, pressed ? '#ffffff' : '#282828');
    }
    this._settingsBottomBar(ctx, 'Back');
  }

  // Draws one border row of the Color picker panel from a 13-column corner
  // pattern (see COLOR_PANEL_CORNER_ROWS): the left corner at dx=0..12
  // (x=PX0+dx), the mirrored right corner at x=PX1-dx, and a flat fill for
  // the middle span using the pattern's own flat (last-column) colour - see
  // _drawColorBottom for how this was measured off the real capture. colors
  // is [L, lo, hi] from CARD_BORDER_TINT[favColor] (favColor-tinted, same as
  // _profileCard's border).
  _drawColorCornerRow(ctx, y, pattern, PX0, PX1, colors) {
    const [L, c0, c2] = colors;
    const lut = { L, 0: c0, 2: c2 };
    for (let dx = 0; dx < 13; dx++) {
      const code = pattern[dx];
      if (code === '.') continue;
      ctx.fillStyle = lut[code];
      ctx.fillRect(PX0 + dx, y, 1, 1);
      ctx.fillRect(PX1 - dx, y, 1, 1);
    }
    ctx.fillStyle = lut[pattern[12]];
    ctx.fillRect(PX0 + 13, y, (PX1 - 13) - (PX0 + 13) + 1, 1);
  }

  // Profile > Color picker: a real, previously-uncaptured screen (RE'd this
  // session - scripts/settings_profile_color.txt -> out/settings_color,
  // profile.bot/c20..c80). 16 real pre-rendered swatch dots (sm_setting_D.ncer
  // cells 77..92) in an 8 col x 2 row grid, pitch (29,46) from centre (26,68) -
  // measured pixel-exact off out/settings_color/c80.bot (swatch spans e.g.
  // x104..122/y105..123 for the 4th swatch, centre 113,114) and cross-checked
  // against the real firmware position table sm_setting_userColor_D.bncl
  // (JNCL format: 35 records, the first 16 are cellIndex 77..92 at exactly this
  // grid - col*29+27, row*46+69 - a consistent +1px vs the measured/rendered
  // centre, the same rounding-convention offset already documented for .bnbl;
  // the measured centre is used here since it is what reproduces the captured
  // pixels exactly). The other 19 JNCL records (cells 74..76, 93..108) all sit
  // at y=213, off the visible 192px screen - confirms cells 93..108 (a second,
  // 27x27 favourite-colour sprite set found alongside 77..92) are NOT used for
  // this on-screen grid, just tool/preview metadata; not chased further.
  //
  // The panel is the same rounded-corner blue/white frame family as
  // _drawExitDialog's dialog_box: the corner pixel pattern (COLOR_PANEL_CORNER_ROWS,
  // measured pixel-by-pixel off the real capture, see comment there) is the
  // same shape family as the real dialog_box_blue.png corner (4,2,1,1,0 inset
  // envelope there vs this panel's 4,2,1,1,0,0), strongly suggesting a shared
  // underlying corner tile. No standalone NCGR/NSCR was tracked down for this
  // exact panel size in the time available, so it is drawn procedurally using
  // the exact measured pixel values (position, corner AA, bevel and border
  // colours all read off the real capture, not invented) rather than a
  // blitted sprite; sourcing the real tile asset is a follow-up.
  //
  // The selection ring is the real cell-75 rest-pose sprite (29x29), measured
  // bbox x99..127/y100..128 around the same swatch centre - i.e. drawn at
  // (cx-14, cy-14), exact.
  _drawColorBottom(screen) {
    const ctx = screen.c;
    this._scanBg(ctx, '#383838', '#414141'); this._scanFill(ctx, '#303030', '#383838', 0, 0, 256, 23);
    Fonts.banner.draw(ctx, 'Color', 7, 2, '#fbfbfb');
    ctx.fillStyle = '#7d7d7d';
    for (let x = 2; x < 256; x += 4) { ctx.fillStyle = '#828282'; ctx.fillRect(x, 21, 1, 1); ctx.fillStyle = '#717171'; ctx.fillRect(x + 1, 21, 1, 1); }
    const PX0 = 8, PX1 = 247;   // panel x8..247 (240 wide)
    const tint = CARD_BORDER_TINT[this.profile.favColor];
    // blue top border (y34..39) and bottom border (y144..149): 1px AA line
    // then a scanline dither (#2879fb/#0059f3 on the default blue profile),
    // drawn per-row from the measured corner pattern - see
    // COLOR_PANEL_CORNER_ROWS above. Bottom uses the same table read
    // row-mirrored (table row 5-dy), which is what reproduces the real
    // capture's swapped even/odd dither exactly.
    for (let dy = 0; dy < 6; dy++) this._drawColorCornerRow(ctx, 34 + dy, COLOR_PANEL_CORNER_ROWS[dy], PX0, PX1, tint);
    // white body (y40..143) with the same 3-level grey bevel as _profileCard
    ctx.fillStyle = '#fbfbfb'; ctx.fillRect(PX0, 40, PX1 - PX0 + 1, 104);
    const bev = ['#a2a2a2', '#c3c3c3', '#dbdbdb'];
    for (let i = 0; i < 3; i++) { ctx.fillStyle = bev[i]; ctx.fillRect(PX0 + i, 40, 1, 104); ctx.fillRect(PX1 - i, 40, 1, 104); }
    for (let dy = 0; dy < 6; dy++) this._drawColorCornerRow(ctx, 144 + dy, COLOR_PANEL_CORNER_ROWS[5 - dy], PX0, PX1, tint);
    // 16 real swatch dots, 8 cols x 2 rows. SVG-backed at scale>1 (smooth circle fit), so
    // draw smoothed there; scale=1 keeps the exact PNG nearest.
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = RENDER_SCALE > 1;
    for (let i = 0; i < 16; i++) {
      const col = i % 8, row = Math.floor(i / 8);
      const cx = 26 + col * 29, cy = 68 + row * 46;
      const img = Assets.img('color_swatch_' + FAV_NAMES[i]);
      if (img) ctx.drawImage(img, cx - 9, cy - 9);
    }
    // real selection-ring cursor on the current pick
    const scol = this.colorSel % 8, srow = Math.floor(this.colorSel / 8);
    const scx = 26 + scol * 29, scy = 68 + srow * 46;
    const ring = Assets.img('color_ring_rest');
    if (ring) ctx.drawImage(ring, scx - 14, scy - 14);
    ctx.imageSmoothingEnabled = sm;
    this._settingsBottomBar(ctx, 'Back', 'OK');
  }

  // Wireless Communications: an ON/OFF choice (active option = glossy blue) + a
  // Back|OK bar. Measured buttons x34..220, ON y55..78, OFF y108..131.
  _drawWirelessBottom(screen) {
    const ctx = screen.c;
    this._scanBg(ctx, '#383838', '#414141'); this._scanFill(ctx, '#303030', '#383838', 0, 0, 256, 23);
    Fonts.banner.draw(ctx, 'Wireless Communications', 7, 2, '#fbfbfb');
    ctx.fillStyle = '#7d7d7d';
    for (let x = 2; x < 256; x += 4) { ctx.fillStyle = '#828282'; ctx.fillRect(x, 21, 1, 1); ctx.fillStyle = '#717171'; ctx.fillRect(x + 1, 21, 1, 1); }
    this._glossyButton(ctx, 34, 55, 186, 24, this.wireless);
    Fonts.banner.drawCentered(ctx, 'ON', 128, 59, '#282828');
    this._glossyButton(ctx, 34, 108, 186, 24, !this.wireless);
    Fonts.banner.drawCentered(ctx, 'OFF', 128, 112, '#282828');
    this._settingsBottomBar(ctx, 'Back', 'OK');
  }

  // Internet: three tall grey menu buttons (Connection Settings has a small
  // access-point glyph) + a Back bar. Measured buttons x12..243, y29+i*46 h40.
  _drawInternetBottom(screen) {
    const ctx = screen.c;
    this._scanBg(ctx, '#383838', '#414141'); this._scanFill(ctx, '#303030', '#383838', 0, 0, 256, 23);
    Fonts.banner.draw(ctx, 'Internet', 7, 2, '#fbfbfb');
    ctx.fillStyle = '#7d7d7d';
    for (let x = 2; x < 256; x += 4) { ctx.fillStyle = '#828282'; ctx.fillRect(x, 21, 1, 1); ctx.fillStyle = '#717171'; ctx.fillRect(x + 1, 21, 1, 1); }
    const items = ['Connection Settings', 'Options', 'User Agreement'];
    const bx = 12, bw = 231;
    for (let i = 0; i < items.length; i++) {
      const ry = 29 + i * 46;
      this._glossyButton(ctx, bx, ry, bw, 40, false);
      Fonts.banner.drawCentered(ctx, items[i], bx + bw / 2, ry + 13, '#282828');
    }
    // small access-point glyph on the Connection Settings button (approximated)
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(216, 48, 15, 8); ctx.fillStyle = '#d0a030'; ctx.fillRect(217, 49, 13, 3);
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(219, 43, 1, 5); ctx.fillRect(227, 43, 1, 5);
    this._settingsBottomBar(ctx, 'Back');
  }

  // Mic Test main screen: "Speak into the mic." + a grey mic-icon panel + "Check
  // mic sensitivity." + a Quit bar. (icon box measured x72..183 y48..124 #828282.)
  _drawMicTest(screen) {
    const ctx = screen.c;
    this._scanBg(ctx, '#383838', '#414141'); this._scanFill(ctx, '#303030', '#383838', 0, 0, 256, 23);
    Fonts.banner.draw(ctx, 'Mic Test', 7, 2, '#fbfbfb');
    ctx.fillStyle = '#7d7d7d';
    for (let x = 2; x < 256; x += 4) { ctx.fillStyle = '#828282'; ctx.fillRect(x, 21, 1, 1); ctx.fillStyle = '#717171'; ctx.fillRect(x + 1, 21, 1, 1); }
    Fonts.l.drawCentered(ctx, 'Speak into the mic.', 128, 22, '#ffffff');
    // real mic panel sprite (setting_common BG06)
    const mic = Assets.img('setting_mic');
    if (mic) ctx.drawImage(mic, 72, 48);
    else { ctx.fillStyle = '#828282'; this._round(ctx, 72, 48, 111, 76, 8); ctx.fill(); }
    Fonts.m.drawCentered(ctx, 'Check mic sensitivity.', 128, 139, '#e0e0e0');
    this._settingsBottomBar(ctx, 'Quit');
  }

  // Touch Screen calibration: a dashed crosshair over the current target point
  // (measured (31,31)), an orange bullseye, and "Press (B) to cancel." near y130.
  _drawTouchCalib(screen) {
    const ctx = screen.c;
    this._scanBg(ctx, '#383838', '#414141'); this._scanFill(ctx, '#303030', '#383838', 0, 0, 256, 23);
    ctx.fillStyle = '#828282';
    for (let x = 0; x < 256; x += 4) ctx.fillRect(x, 31, 2, 1);   // horizontal dashed
    for (let y = 0; y < 192; y += 4) ctx.fillRect(31, y, 1, 2);   // vertical dashed
    this._targetRing(ctx, 31, 31);
    // real B-button glyph (U+E001) from the DSi font, as the firmware renders it
    Fonts.m.drawCentered(ctx, 'Press  to cancel.', 128, 124, '#ffffff');
  }

  // a calibration bullseye (~9px, hollow ring + centre dot); orange on the
  // touch screen, grey in the top-screen instruction line.
  _targetRing(ctx, cx, cy, color = '#ff5a00') {
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 7); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, 1, 0, 7); ctx.fill();
  }

  // Country: a scrollable list (rows x7..228, pitch 25) with the selection in
  // blue, a right-edge scrollbar (blue up/down arrows + a grey thumb), Back|OK.
  _drawCountryBottom(screen) {
    const ctx = screen.c;
    this._scanBg(ctx, '#383838', '#414141'); this._scanFill(ctx, '#303030', '#383838', 0, 0, 256, 23);
    Fonts.banner.draw(ctx, 'Country', 7, 2, '#fbfbfb');
    ctx.fillStyle = '#7d7d7d';
    for (let x = 2; x < 256; x += 4) { ctx.fillStyle = '#828282'; ctx.fillRect(x, 21, 1, 1); ctx.fillStyle = '#717171'; ctx.fillRect(x + 1, 21, 1, 1); }
    const bx = 7, bw = 222;
    // list top cap (bright lip over a 1px dark line) above the first row
    ctx.fillStyle = '#9a9a9a'; ctx.fillRect(7, 24, 222, 2);
    ctx.fillStyle = '#b2b2b2'; ctx.fillRect(7, 26, 222, 1);
    ctx.fillStyle = '#202020'; ctx.fillRect(7, 27, 222, 1);
    for (let i = 0; i < this.countries.length; i++) {
      const ry = 28 + i * 25;
      this._glossyButton(ctx, bx, ry, bw, 24, i === this.countrySel);
      Fonts.m.drawCentered(ctx, this.countries[i], bx + bw / 2, ry + 3, '#282828');
    }
    // scrollbar: a recessed groove between the two arrows, blue up/down arrows,
    // and a blue glossy thumb with a white grip (position is capture-state)
    ctx.fillStyle = '#414141'; ctx.fillRect(233, 43, 19, 94);
    ctx.fillStyle = '#595959'; ctx.fillRect(235, 43, 15, 94);
    ctx.fillStyle = '#9a9a9a'; ctx.fillRect(235, 43, 1, 94); ctx.fillRect(249, 43, 1, 94);
    this._scrollArrow(ctx, 233, 26, 1);
    this._scrollArrow(ctx, 233, 137, -1);
    const thumbY = 122;
    this._glossyButton(ctx, 233, thumbY, 19, 14, true, 3);
    ctx.fillStyle = '#fbfbfb'; this._round(ctx, 237, thumbY + 4, 11, 7, 2); ctx.fill();
    ctx.fillStyle = '#1069f3';
    for (let gy = thumbY + 5; gy <= thumbY + 9; gy += 2) ctx.fillRect(238, gy, 9, 1);
    this._settingsBottomBar(ctx, 'Back', 'OK');
  }

  // Small blue scrollbar arrow button: a real whole-cell sprite
  // (sm_setting_D.ncer cell 113 = up, cell 114 = down; mirrored single-tile
  // capsule + triangle, same favourite-colour blue mask as _glossyButton),
  // not a procedural pill + drawn triangle. (x,y) is the visible pill's
  // top-left, matching this function's original 19x17 call-site coordinates
  // (233,26) / (233,137) in _drawCountryBottom, which already lined up
  // exactly with the groove edges. The real sprite canvas is 25x32 with the
  // visible pill inset by a fixed 3px left of canvas and a per-direction
  // vertical inset (12px for the up tile, 3px for the down tile - both
  // baked into the source tile, not a rounding choice); verified pixel-exact
  // (0 diff) against out/settings/sub_country.bot at (230,14) and (230,134).
  _scrollArrow(ctx, x, y, dir) {
    const name = FAV_NAMES[this.profile.favColor];
    if (RENDER_SCALE > 1) {
      const grads = Assets.data && Assets.data.button_grads;
      const stops = grads && grads.scrollarrow && grads.scrollarrow[name];
      if (stops) { this._scrollArrowVec(ctx, x, y, dir, stops); return; }
    }
    const img = Assets.img(dir > 0 ? 'setting_scrollarrow_up_' + name : 'setting_scrollarrow_down_' + name);
    if (img) {
      const rowInset = dir > 0 ? 12 : 3;
      const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, x - 3, y - rowInset);
      ctx.imageSmoothingEnabled = sm;
      return;
    }
    this._scrollArrowVec(ctx, x, y, dir, null);
  }

  _scrollArrowVec(ctx, x, y, dir, stops) {
    if (stops) this._glossyButtonVec(ctx, x, y, 19, 17, 3, stops, '#202020');
    else this._glossyButton(ctx, x, y, 19, 17, true, 3);
    ctx.fillStyle = '#ffffff';
    const cx = x + 10, cy = y + 9;
    ctx.beginPath();
    if (dir > 0) { ctx.moveTo(cx, cy - 4); ctx.lineTo(cx + 5, cy + 3); ctx.lineTo(cx - 5, cy + 3); }
    else { ctx.moveTo(cx, cy + 4); ctx.lineTo(cx + 5, cy - 3); ctx.lineTo(cx - 5, cy - 3); }
    ctx.closePath(); ctx.fill();
  }

  // A generic confirm screen: header + dashed rule + a centred message block
  // (centred on y90, lh16) + a two-label bar. Labels default to Yes|No.
  _drawConfirmBottom(screen, title, question, left = 'Yes', right = 'No') {
    const ctx = screen.c;
    this._scanBg(ctx, '#383838', '#414141'); this._scanFill(ctx, '#303030', '#383838', 0, 0, 256, 23);
    Fonts.banner.draw(ctx, title, 7, 2, '#fbfbfb');
    ctx.fillStyle = '#7d7d7d';
    for (let x = 2; x < 256; x += 4) { ctx.fillStyle = '#828282'; ctx.fillRect(x, 21, 1, 1); ctx.fillStyle = '#717171'; ctx.fillRect(x + 1, 21, 1, 1); }
    const n = question.length;
    question.forEach((ln, i) => Fonts.m.drawCentered(ctx, ln, 128, Math.round(88 + (i - (n - 1) / 2) * 16), '#fbfbfb'));
    this._settingsBottomBar(ctx, left, right);
  }

  // Data Management: System Memory / SD Card tabs over a list of the real
  // installed DSiWare (icon + name + block count), a page arrow, "n / 5", Back.
  _drawDataMgmtBottom(screen) {
    const ctx = screen.c;
    this._scanBg(ctx, '#383838', '#414141'); this._scanFill(ctx, '#303030', '#383838', 0, 0, 256, 23);
    // light-grey scanline list-container field behind the rows (measured y27..155)
    this._scanFill(ctx, '#8a8a8a', '#929292', 0, 27, 256, 128);
    this._dmTab(ctx, 5, 121, 'System Memory', this.dataTab === 0);
    this._dmTab(ctx, 129, 122, 'SD Card', this.dataTab === 1);
    const rows = this.dataTab === 0 ? this.dsiware : [];
    for (let i = 0; i < 3; i++) {
      const ry = 32 + i * 43;                 // firmware row pitch (msk_softmanage_D.bnbl)
      // rows sit on the light list field, so the drop shadow is a soft grey (89),
      // not the dark-bg #202020; body is 37px (measured y32..68)
      this._glossyButton(ctx, 33, ry, 189, 37, false, 3, '#595959');
      const t = rows[i]; if (!t) continue;
      const icon = Assets.img('dm_' + t.id);
      if (icon) { ctx.imageSmoothingEnabled = false; ctx.drawImage(icon, 37, ry + 3, 30, 30); }
      else { ctx.fillStyle = '#181818'; ctx.fillRect(37, ry + 3, 30, 30); }
      Fonts.m.draw(ctx, t.name, 74, ry + 1, '#1a1a1a');
      ctx.fillStyle = '#7a7a7a'; ctx.fillRect(74, ry + 19, 140, 1);
      Fonts.m.drawRight(ctx, `Blocks: ${t.blocks}`, 214, ry + 21, '#2a2a2a');
    }
    // tall blue page arrow (real y63..152) + page indicator
    this._glossyButton(ctx, 231, 63, 21, 89, true, 8);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(237, 85); ctx.lineTo(246, 95); ctx.lineTo(237, 105); ctx.closePath(); ctx.fill();
    Fonts.settings.drawCentered(ctx, `1 / ${this.dataPages}`, 128, 158, '#e0e0e0');
    this._settingsBottomBar(ctx, 'Back');
  }

  // a rounded-top System Memory / SD Card tab
  _dmTab(ctx, x, w, label, active) {
    const y = 3, h = 24, r = 6;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    if (active) { g.addColorStop(0, '#41aadb'); g.addColorStop(0.4, '#1c8fe8'); g.addColorStop(1, '#0059eb'); }
    else { g.addColorStop(0, '#ebebeb'); g.addColorStop(0.5, '#c4c4c4'); g.addColorStop(1, '#9a9a9a'); }
    ctx.fillStyle = g; this._roundTop(ctx, x, y, w, h, r); ctx.fill();
    Fonts.banner.drawCentered(ctx, label, x + w / 2, y + 4, active ? '#0e2833' : '#2a2a2a');
  }

  _roundTop(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h); ctx.closePath();
  }

  // Date / Time / Alarm steppers: per-column up arrow, big value, down arrow,
  // column label, + a Back|OK bar. Measured: up-arrows y42..68, value y75..103
  // (Fonts.l scaled x2), down-arrows y114..140, labels y150.
  _drawStepperBottom(screen) {
    const ctx = screen.c;
    const { title, fields, seps, cols } = this._stepper(this.sub);
    this._scanBg(ctx, '#383838', '#414141'); this._scanFill(ctx, '#303030', '#383838', 0, 0, 256, 23);
    Fonts.banner.draw(ctx, title, 7, 2, '#fbfbfb');
    for (let x = 2; x < 256; x += 4) { ctx.fillStyle = '#828282'; ctx.fillRect(x, 21, 1, 1); ctx.fillStyle = '#717171'; ctx.fillRect(x + 1, 21, 1, 1); }
    // Each field is centred on its stepper column (measured real centres: Month 36, Day 102,
    // Year 192), and each separator sits in the GAP between the adjacent fields' ink edges - not
    // at the column midpoint, which pushed the '/' into the 4-digit year and overlapped it
    // (measured out/settings/sub_date.bot: fields at 12-61 / 73-127 / 145-240, slashes between).
    const DIGIT_Y = 72;
    const meta = Assets.data && Assets.data['setting_digits_meta'];
    const fieldW = f => [...f].reduce((a, ch) => a + (meta && meta.glyphs[ch] ? meta.glyphs[ch].w : 24), 0);
    for (const c of cols) {
      this._stepArrow(ctx, c.cx - c.w / 2 + 1, 42, c.w, 27, 1);    // up
      this._stepArrow(ctx, c.cx - c.w / 2 + 1, 114, c.w, 27, -1);  // down
      Fonts.l.drawCentered(ctx, c.label, c.cx, 145, '#ffffff');
    }
    cols.forEach((c, i) => this._drawDigits(ctx, fields[i], c.cx, DIGIT_Y));
    seps.forEach((s, i) => {
      const rightEdge = cols[i].cx + fieldW(fields[i]) / 2;
      const leftEdge = cols[i + 1].cx - fieldW(fields[i + 1]) / 2;
      this._drawDigits(ctx, s, (rightEdge + leftEdge) / 2, DIGIT_Y);
    });
    this._settingsBottomBar(ctx, 'Back', 'OK');
  }


  // a grey glossy stepper button carrying a white up/down triangle (measured:
  // the triangle is white with a soft grey edge, not a dark glyph)
  _stepArrow(ctx, x, y, w, h, dir) {
    this._glossyButton(ctx, x, y, w, h, false, 2);
    ctx.fillStyle = '#f8f8f8';
    const cx = x + w / 2, cy = y + h / 2;
    ctx.beginPath();
    if (dir > 0) { ctx.moveTo(cx, cy - 6); ctx.lineTo(cx + 12, cy + 6); ctx.lineTo(cx - 12, cy + 6); }
    else { ctx.moveTo(cx, cy + 6); ctx.lineTo(cx + 12, cy - 6); ctx.lineTo(cx - 12, cy - 6); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#9a9a9a'; ctx.lineWidth = 1; ctx.stroke();
  }

  // glossy DSi list button: bright top edge fading to a mid tone, with a 1px
  // dark bottom lip. Measured gradients from the real Language screen.
  // smooth-gradient glossy button for scale>1: fill a rounded rect with the de-dithered gloss
  // gradient of the real sprite variant (no visible dither at high res), plus the drop shadow.
  _glossyButtonVec(ctx, x, y, w, h, r, stops, shadowCol) {
    ctx.fillStyle = shadowCol || '#202020';
    this._round(ctx, x, y + 2, w, h, r); ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    for (const [t, c] of stops) g.addColorStop(Math.max(0, Math.min(1, t)), `rgb(${c})`);
    ctx.fillStyle = g;
    this._round(ctx, x, y, w, h, r); ctx.fill();
  }

  _glossyButton(ctx, x, y, w, h, sel, r = 5, shadowCol = '#202020') {
    // scale>1: replace the dithered sprite with the smooth de-dithered gloss gradient. The DS
    // fakes the ramp with a 2-colour dither that looks blocky upscaled; button_grads.json holds
    // the exact per-variant gradient it approximates. scale=1 keeps the pixel-exact dither below.
    if (RENDER_SCALE > 1) {
      const grads = Assets.data && Assets.data.button_grads;
      const type = (h === 32 && r === 4) ? 'dialog' : 'menu';   // Yes/No capsule (any width)
      const variant = sel ? FAV_NAMES[this.profile ? this.profile.favColor : 11] : 'idle';
      const stops = grads && grads[type] && (grads[type][variant] || grads[type].idle);
      if (stops) { this._glossyButtonVec(ctx, x, y, w, h, r, stops, shadowCol); return; }
    }
    // 24px-tall buttons at the standard r=5 corner: use the real decoded
    // button texture (setting_common D cell 0) instead of a guessed
    // gradient. Verified pixel-exact against out/settings/pg1.bot at the
    // Data Management button (24 rows, y42..65): every dithered grey level
    // (235/211/195/178/170/154/...) and its row position matched the source
    // cell's rows 3..26 with zero deviation. Caps are the real rounded-corner
    // OAM pieces (32px); the middle is the real tile, seamlessly period-2
    // tileable (confirmed both in the source cell and in the reference itself,
    // where columns 64px apart carry an identical dither sequence).
    //
    // The SELECTED (blue) variant is the exact same cell/tile geometry: the
    // DSi system menu recolours these controls at runtime by swapping in the
    // user's favourite-colour palette mask (assets/launcher/szs/
    // set_usercolor_setting.bin -> sm_setting_D_UC02.NCLR, bank 11 = 'blue',
    // see tools/usercolor.js FAV_NAMES). It is not a procedural gradient -
    // confirmed pixel-exact (0 diff, including the dithered gradient levels)
    // against out/settings/sub_language.bot's selected "English" row.
    // The exit-confirmation dialog's Yes/No buttons are a different real
    // sprite family (msk_softmanage_D.ncer cells 10/12, 96x32, no caps/mid
    // split - the whole capsule is one cell): see _drawExitDialog and
    // tools/extract-dialog-sprites.js. 0 diff outside the text label against
    // out/settings_trans/dlg/g_0044 (grey) and out/settings_trans2/yes_release
    // (blue).
    // dithered sprite paths run ONLY at scale=1 (byte-exact). At scale>1 the gradient gate above
    // handles it; if button_grads was momentarily unavailable there, fall through to the smooth
    // procedural gradient below rather than the dithered sprite (fixes buttons reverting to dither).
    if (h === 32 && r === 4 && RENDER_SCALE === 1) {
      const img = Assets.img(sel ? 'dialog_btn_' + FAV_NAMES[this.profile.favColor] : 'dialog_btn_idle');
      if (img) {
        const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, img.width, img.height, x, y, w, h);   // fit to the button width
        ctx.imageSmoothingEnabled = sm;
        return;
      }
    }
    const suffix = sel ? '_' + FAV_NAMES[this.profile.favColor] : '';
    const lcap = RENDER_SCALE === 1 && h === 24 && r === 5 && shadowCol === '#202020' && Assets.img('setting_btn_lcap' + suffix);
    const mid = lcap && Assets.img('setting_btn_mid' + suffix);
    const rcap = lcap && Assets.img('setting_btn_rcap' + suffix);
    if (lcap && mid && rcap) {
      // draw the real pieces directly (their own alpha carries the actual
      // hardware corner mask, an asymmetric per-row cut, not a circular arc -
      // clipping with the procedural _round() shape here would fight it).
      // Measured directly on the full composited cell (D_c000.png, 192px):
      // its real content spans columns 2..190 (189px), not the full 192px
      // tile grid. The left cap's flat rows start 2px in from local x=0
      // (rows nearer the corner start 1px further still - that IS the
      // rounded-corner taper, keep it). The right cap bakes its own drop
      // shadow into its last two opaque columns (local 29-30, dark grey)
      // before a fully transparent trailing column - on a real screen this
      // shadow sits 2px past the button's nominal right edge (confirmed
      // against out/settings/pg1.bot: the Data Management button is grey
      // through x220 with the shadow visible at x221-222 before the
      // background resumes at x223, and that shadow is absent on the very
      // top button row where the corner taper clips it away - both fall out
      // naturally once the cap is placed by its real content, not by w).
      //
      // The drop shadow BELOW the button is baked into the same sprite too:
      // rows 27..29 (3 rows past the 24-row face) carry the shadow's own
      // dither (32,32,48) with the same asymmetric corner taper as the face
      // (lcap/rcap pull the shadow in at the rounded corners, mid stays full
      // width). Confirmed against out/settings/pg1.bot rows y+24..y+26: the
      // reference's corner falloff is a hard cut (opaque grey then straight
      // to background), not the soft antialiased edge a procedural rounded
      // shadow fill produces - so draw the sprite tall enough to cover the
      // shadow too instead of filling a separate procedural shadow shape.
      const sy = 3, sh = h + 3, lPad = 2, lcapW = 32 - lPad, rcapW = 31, rcapInset = 28;
      const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
      const midW = mid.width || 64;
      for (let mx = x + lcapW; mx < x + w - rcapInset; mx += midW) {
        const seg = Math.min(midW, x + w - rcapInset - mx);
        ctx.drawImage(mid, 0, sy, seg, sh, mx, y, seg, sh);
      }
      ctx.drawImage(lcap, lPad, sy, lcapW, sh, x, y, lcapW, sh);
      ctx.drawImage(rcap, 0, sy, rcapW, sh, x + w - rcapInset, y, rcapW, sh);
      ctx.imageSmoothingEnabled = sm;
      return;
    }
    // Fallback procedural gradient: only reached for shapes/sizes without a
    // known real sprite (the stepper up/down arrows at r=2, and _pageArrow's
    // own unreached fallback at w=19/h=63 - both real sprites now cover their
    // normal path, this is dead code kept only as a safety net).
    ctx.fillStyle = shadowCol; this._round(ctx, x, y + 2, w, h, r); ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    if (sel) {
      // blue: light-cyan specular, mid body, dark base, then a bright bottom rim
      g.addColorStop(0, '#41aadb'); g.addColorStop(0.16, '#18a2e3'); g.addColorStop(0.34, '#1892eb');
      g.addColorStop(0.7, '#0d78e6'); g.addColorStop(0.94, '#0059eb'); g.addColorStop(1, '#1069f3');
    } else {
      // grey: 6-level dithered gloss ramp; final light stop is the 1px bottom bevel
      g.addColorStop(0, '#ebebeb'); g.addColorStop(0.10, '#d3d3d3'); g.addColorStop(0.30, '#c3c3c3');
      g.addColorStop(0.55, '#b2b2b2'); g.addColorStop(0.75, '#aaaaaa'); g.addColorStop(0.94, '#9a9a9a'); g.addColorStop(1, '#b2b2b2');
    }
    ctx.fillStyle = g; this._round(ctx, x, y, w, h, r); ctx.fill();
  }

  // Tall glossy blue page-turn pill with a white triangle: a real whole-cell
  // sprite (sm_setting_D.ncer cell 9 = right/next, cell 10 = left/prev, both
  // recoloured through the same favourite-colour blue mask as _glossyButton),
  // not a procedural capsule + drawn triangle. Verified pixel-exact (0 diff)
  // against out/settings/pg1.bot (right arrow at x231,y63) and pg2.bot (left
  // arrow at x4,y62) - the 1px y difference between the two is real, present
  // in the source OAM offsets, not a rounding choice.
  _pageArrow(ctx, x, dir) {
    const name = FAV_NAMES[this.profile.favColor];
    // scale>1: smooth de-dithered pill (favColour vertical gloss gradient from button_grads)
    // + white chevron, instead of the dithered sprite.
    if (RENDER_SCALE > 1) {
      const grads = Assets.data && Assets.data.button_grads;
      const stops = grads && grads.pagearrow && grads.pagearrow[name];
      if (stops) { this._pageArrowVec(ctx, x, dir, stops); return; }
    }
    const img = Assets.img(dir > 0 ? 'setting_pagearrow_right_' + name : 'setting_pagearrow_left_' + name);
    if (img) {
      const y = dir > 0 ? 63 : 62;
      const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, x, y);
      ctx.imageSmoothingEnabled = sm;
      return;
    }
    this._pageArrowVec(ctx, x, dir, null);
  }

  _pageArrowVec(ctx, x, dir, stops) {
    const y = 62, w = 19, h = 63;
    if (stops) this._glossyButtonVec(ctx, x, y, w, h, 4, stops, '#202020');
    else this._glossyButton(ctx, x, y, w, h, true, 4);
    ctx.fillStyle = '#ffffff';
    const cx = x + w / 2, cy = y + h / 2;
    ctx.beginPath();
    if (dir > 0) { ctx.moveTo(cx - 4, cy - 7); ctx.lineTo(cx + 5, cy); ctx.lineTo(cx - 4, cy + 7); }
    else { ctx.moveTo(cx + 4, cy - 7); ctx.lineTo(cx - 5, cy); ctx.lineTo(cx + 4, cy + 7); }
    ctx.closePath(); ctx.fill();
  }

  // subtle raised strip at the bottom carrying two labels split by a divider.
  // Measured: 1px #717171 highlight at y171, gradient #595959->#303030 below,
  // solid #595959 divider at x128, white labels.
  _settingsBottomBar(ctx, left, right) {
    ctx.fillStyle = '#717171'; ctx.fillRect(0, 171, 256, 1);
    const g = ctx.createLinearGradient(0, 172, 0, 186);
    g.addColorStop(0, '#595959'); g.addColorStop(1, '#303030');
    // fill down to y191 so the gradient tail (not the scanline bg) shows y186..191
    ctx.fillStyle = g; ctx.fillRect(0, 172, 256, 20);
    if (right != null) {
      ctx.fillStyle = '#595959'; ctx.fillRect(128, 171, 1, 21);
      Fonts.settings.drawCentered(ctx, left, 64, 175, '#fbfbfb');
      Fonts.settings.drawCentered(ctx, right, 192, 175, '#fbfbfb');
    } else {
      Fonts.settings.drawCentered(ctx, left, 128, 175, '#fbfbfb');
    }
  }

  // y of the i-th list button: the stack is vertically centred on y94, with a
  // 40px pitch for <=3 items and 32px for 4 (measured from the real menus).
  _btnY(count, i) { const pitch = count >= 4 ? 32 : 40; return Math.round(94 - (count - 1) * pitch / 2 - 12) + i * pitch; }

  // The DSi settings background is a 2-row horizontal scanline dither: even
  // rows one shade, odd rows one step lighter (top #303030/#383838, bottom
  // #383838/#414141). Cached as a 1x2 pattern per colour pair.
  _scanBg(ctx, even, odd) {
    if (!this._bgPat) this._bgPat = new Map();
    const key = even + odd;
    let pat = this._bgPat.get(key);
    if (!pat) {
      const c = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
      if (c) {
        c.width = 1; c.height = 2; const cc = c.getContext('2d');
        cc.fillStyle = even; cc.fillRect(0, 0, 1, 1);
        cc.fillStyle = odd; cc.fillRect(0, 1, 1, 1);
        pat = ctx.createPattern(c, 'repeat');
      }
      this._bgPat.set(key, pat);
    }
    if (pat) { ctx.fillStyle = pat; ctx.fillRect(0, 0, 256, 192); }
    else { ctx.fillStyle = even; ctx.fillRect(0, 0, 256, 192); }
  }

  // the status-bar volume icon: real decoded sprite (sm_setting_U.ncer cell 21,
  // see tools/extract-settop-icons.js), origin (4,3) confirmed pixel-exact
  // against out/settings/page1.top.ppm. Vector fallback only covers the brief
  // window before Assets finishes loading.
  _volumeIcon(ctx) {
    const vi = Assets.img('spr_settop_vol');
    // scale=1 keeps the exact firmware bitmap (pixel-exact, nearest). scale>1 uses the clean
    // hand-drawn vector (speaker + 2 stroked arcs) - the same crisp shape shown briefly before
    // the sprite loads, which reads far better upscaled than any trace of the dotted-arc bitmap.
    if (vi && RENDER_SCALE === 1) {
      const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
      ctx.drawImage(vi, 4, 3); ctx.imageSmoothingEnabled = sm; return;
    }
    this._drawVolumeVector(ctx, '#d0d0d0');
  }

  // the clean vector volume icon (speaker cone + 2 sound arcs), origin matched to the sprite.
  _drawVolumeVector(ctx, color) {
    ctx.fillStyle = color;
    ctx.fillRect(5, 9, 3, 3);
    ctx.beginPath(); ctx.moveTo(7, 9); ctx.lineTo(11, 6); ctx.lineTo(11, 15); ctx.lineTo(7, 12); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(11, 10.5, 4.5, -0.85, 0.85); ctx.stroke();
    ctx.beginPath(); ctx.arc(11, 10.5, 7.5, -0.85, 0.85); ctx.stroke();
  }

  // the status-bar battery: real decoded sprite family (sm_setting_U.ncer cells
  // 33/14/32, full/low/charging), see tools/extract-settop-icons.js. Origin
  // (223,3) confirmed pixel-exact against out/settings/page1.top.ppm (full
  // state, the only state any real capture exercises). State selection mirrors
  // System.batterySprite() used by the launcher top bar. Vector fallback only
  // covers the brief window before Assets finishes loading.
  _battery(ctx) {
    const batt = System.batterySprite('spr_settop_batt_');
    if (batt) {
      const sm = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = RENDER_SCALE > 1;   // smooth SVG at scale>1, exact PNG at 1
      ctx.drawImage(batt, 223, 3);
      ctx.imageSmoothingEnabled = sm;
      return;
    }
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(238, 5, 13, 1); ctx.fillRect(238, 14, 13, 1);   // top / bottom
    ctx.fillRect(237, 5, 1, 10); ctx.fillRect(250, 5, 1, 10);    // left / right
    ctx.fillRect(234, 8, 3, 5);                                  // left terminal
    ctx.fillStyle = '#fb6928'; ctx.fillRect(239, 7, 11, 7);      // orange base
    ctx.fillStyle = '#fb9a49'; ctx.fillRect(239, 8, 11, 2);      // lighter highlight
    ctx.fillStyle = '#fb2000'; ctx.fillRect(239, 11, 11, 2);     // red segment
  }

  // fill a sub-rect with the same 2-row scanline pattern (parity stays aligned
  // to absolute y). Used for the light list-container field on Data Management.
  _scanFill(ctx, even, odd, x, y, w, h) {
    if (!this._bgPat) this._bgPat = new Map();
    const key = even + odd;
    let pat = this._bgPat.get(key);
    if (!pat) {
      const c = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
      if (c) { c.width = 1; c.height = 2; const cc = c.getContext('2d'); cc.fillStyle = even; cc.fillRect(0, 0, 1, 1); cc.fillStyle = odd; cc.fillRect(0, 1, 1, 1); pat = ctx.createPattern(c, 'repeat'); }
      this._bgPat.set(key, pat);
    }
    ctx.fillStyle = pat || even; ctx.fillRect(x, y, w, h);
  }

  // Paint the rounded-corner stair at both ends of one horizontal bar (the accent bar's
  // top or the birthday bar's bottom). rowY0 is the bar's outer 1px L line row; dir=+1
  // walks down into the bar (top corner), dir=-1 walks up into it (bottom corner). See
  // CARD_CORNER_CURVE for how these per-row segments were measured.
  _cardCornerCurve(ctx, L, c0, c2, rowY0, dir) {
    const colors = { L, c0, c2 };
    CARD_CORNER_CURVE.forEach((row, i) => {
      const y = rowY0 + dir * (i + 1);
      let x = 16 + row.bg;
      for (const [w, key] of row.segs) {
        ctx.fillStyle = colors[key];
        ctx.fillRect(x, y, w, 1);                 // left side
        ctx.fillRect(255 - (x + w - 1), y, w, 1);  // right side, mirrored about x=255
        x += w;
      }
    });
  }

  _arrow(ctx, x, y, dir) {
    ctx.fillStyle = '#1f6fe0'; this._round(ctx, x - 8, y - 14, 16, 28, 4); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    if (dir > 0) { ctx.moveTo(x - 3, y - 7); ctx.lineTo(x + 4, y); ctx.lineTo(x - 3, y + 7); }
    else { ctx.moveTo(x + 3, y - 7); ctx.lineTo(x - 4, y); ctx.lineTo(x + 3, y + 7); }
    ctx.closePath(); ctx.fill();
  }
  _round(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
}

// smoothstep ease-in-out for the settings page slide (accelerate then decelerate)
function easeInOut(t) { return t * t * (3 - 2 * t); }
