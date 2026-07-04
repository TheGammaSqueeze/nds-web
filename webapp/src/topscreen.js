// Top screen: status bar (volume, user, date/time, battery) + photo widget.
import { Assets } from './assets.js';
import { Fonts } from './font.js';
import { System } from './system.js';
import { RENDER_SCALE } from './screen.js';
import { CAM_TEXT_L, CAM_TEXT_R, CAM_LEVELS } from './camera_scrim.js';

// Real placeholder text from the launcher BMG (message/ww/us_eng/menu_common.bmg #39)
const PHOTO_TEXT = [
  'Photos will be displayed',
  'on the top screen. If you have',
  'lots of photos, a different one',
  'will be shown every time you',
  'turn the system on.',
];

// Top-screen "User" label: the DSi renders 2bpp text as a fixed OPAQUE 3-level
// anti-alias ramp that replaces the pixels underneath, not an alpha blend of ink
// over the live background (same mechanism as launcher.js's startFrame levels;
// see font.js's drawLevels doc comment). Confirmed directly: a real melonDS
// capture at favColor=2 (scratch NAND, setfavcolor) contains exactly the 3 colours
// #fbaab2/#fb5161/#fb0018 in the label glyphs and nothing else (no intermediate
// blend shades), which are indices 7/8/9 of
// assets/launcher/narc/usercolor_launcher/msk_launcher_U_UC0F.NCLR bank 2 exactly.
// The existing verified favColor=11 reference (assets/reference/idle.top.png)
// independently contains exactly #9ac3fb/#4992fb/#0059f3 = the same file's bank 11
// indices 7/8/9 - so this is the real per-favColor source, not a single flat ink.
const TOP_USER_LEVELS = [
  { 1: [203, 211, 219], 2: [146, 170, 186], 3: [97, 130, 154] },   // 0 grey
  { 1: [235, 195, 170], 2: [211, 130, 81], 3: [186, 73, 0] },      // 1 brown
  { 1: [251, 170, 178], 2: [251, 81, 97], 3: [251, 0, 24] },       // 2 red
  { 1: [251, 203, 251], 2: [251, 154, 251], 3: [251, 105, 251] },  // 3 pink
  { 1: [251, 211, 146], 2: [251, 186, 81], 3: [251, 146, 0] },     // 4 orange
  { 1: [243, 227, 130], 2: [235, 219, 89], 3: [227, 203, 0] },     // 5 yellow
  { 1: [203, 243, 130], 2: [178, 243, 0], 3: [146, 203, 0] },      // 6 lime
  { 1: [138, 251, 138], 2: [65, 251, 56], 3: [0, 251, 0] },        // 7 green
  { 1: [130, 219, 154], 2: [65, 186, 105], 3: [0, 162, 56] },      // 8 dark-green
  { 1: [154, 235, 195], 2: [105, 227, 162], 3: [32, 219, 113] },   // 9 turquoise
  { 1: [138, 219, 251], 2: [73, 203, 251], 3: [8, 178, 243] },     // 10 light-blue
  { 1: [154, 195, 251], 2: [73, 146, 251], 3: [0, 89, 243] },      // 11 blue (real DSi default)
  { 1: [162, 162, 219], 2: [89, 89, 186], 3: [0, 0, 146] },        // 12 dark-blue
  { 1: [203, 154, 243], 2: [170, 73, 227], 3: [138, 0, 211] },     // 13 violet
  { 1: [243, 146, 251], 2: [227, 73, 243], 3: [211, 0, 235] },     // 14 magenta
  { 1: [251, 146, 227], 2: [251, 65, 186], 3: [251, 0, 146] },     // 15 rose
];

export class TopScreen {
  constructor(settings) {
    this.settings = settings || { username: 'User', favColor: 11 };
  }
  draw(screen) {
    const ctx = screen.c;
    const bg = Assets.img('bg_launcher_u');
    if (bg) ctx.drawImage(bg, 0, 0, 256, 192, 0, 0, 256, 192);
    else screen.clear('#f6f6f6');

    // photo widget (static placeholder panel, real decoded asset)
    const photo = Assets.img('bg_photo_u');
    if (photo) ctx.drawImage(photo, 0, 18, 256, Math.min(photo.height, 174), 0, 18, 256, Math.min(photo.height, 174));

    this._drawPhotoContent(screen);
    this._drawTopBar(screen);
    // real upper-screen BG edge frame: solid 1px #dbdbdb (219) at x0/x255
    ctx.fillStyle = 'rgb(219,219,219)'; ctx.fillRect(0, 0, 1, 192); ctx.fillRect(255, 0, 1, 192);
  }

  _drawPhotoContent(screen) {
    const ctx = screen.c;
    // measured photo-placeholder ink is #59a29a (89,162,154); lines at y73 pitch 16
    const teal = '#59a29a';
    const startY = 73, lh = 16;
    PHOTO_TEXT.forEach((ln, i) => Fonts.m.drawCentered(ctx, ln, 128, startY + i * lh, teal));
    // light grey scrim panels behind the L/R camera labels (measured: y171..192,
    // left x0..72 / right x183..256): the real captured panel (text inpainted out)
    // plus the real "Camera" bitmap font text drawn on top (see camera_scrim.js).
    this._blitScrim(ctx, 'spr_camScrimL', 0, CAM_TEXT_L);
    this._blitScrim(ctx, 'spr_camScrimR', 183, CAM_TEXT_R);
  }

  _blitScrim(ctx, imgKey, ox, text) {
    const img = Assets.img(imgKey);
    if (img) { const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false; ctx.drawImage(img, ox, 171); ctx.imageSmoothingEnabled = sm; }
    Fonts.m.drawLevels(ctx, text.str, ox + text.x, 171 + text.y, imgKey, CAM_LEVELS);
  }

  _cameraScrim(ctx) {
    // semi-transparent light grey so the teal photo panel shows through, with the
    // measured glossy profile (a sheen band at y176): darker edges (215) / body
    // (223) / highlight (231) / brightening below. grey 240 over teal 170,211,203.
    const grad = ctx.createLinearGradient(0, 171, 0, 192);
    grad.addColorStop(0.00, 'rgba(240,240,240,0.64)'); // y171 top edge
    grad.addColorStop(0.10, 'rgba(240,240,240,0.76)'); // y173 body
    grad.addColorStop(0.24, 'rgba(240,240,240,0.87)'); // y176 sheen highlight
    grad.addColorStop(0.38, 'rgba(240,240,240,0.64)'); // y179 lower edge
    grad.addColorStop(0.70, 'rgba(240,240,240,0.82)');
    grad.addColorStop(1.00, 'rgba(240,240,240,1.0)');  // y192 bottom
    ctx.fillStyle = grad;
    // hard-edged integer staircase corners (the real scrim is a sprite, not an AA
    // arc; measured last-column per row idle.top: y171=68 y172=70 y173/174=71 y>=175=72)
    ctx.fillRect(-8, 171, 77, 1); ctx.fillRect(-8, 172, 79, 1); ctx.fillRect(-8, 173, 80, 1); ctx.fillRect(-8, 174, 80, 1); ctx.fillRect(-8, 175, 81, 17);
    ctx.fillRect(187, 171, 77, 1); ctx.fillRect(185, 172, 79, 1); ctx.fillRect(184, 173, 80, 1); ctx.fillRect(184, 174, 80, 1); ctx.fillRect(183, 175, 81, 17);
  }

  // the DSi status-bar volume icon (speaker + 3 sound-wave arcs), baked per-pixel
  // dark-on-light from assets/reference/idle.top (full volume). 3 greys: 65/105/195,
  // with 154 the mid AA. Drawn at its measured x1..21, y4..17 slot.
  _drawVolIcon(ctx) {
    const rows = {
      5: [[17, 154], [18, 195]],
      6: [[9, 195], [10, 105], [18, 105], [19, 154]],
      7: [[8, 195], [9, 65], [10, 65], [15, 154], [16, 195], [19, 65], [20, 195]],
      8: [[7, 195], [8, 65], [9, 65], [10, 154], [13, 195], [16, 65], [17, 195], [19, 105], [20, 105]],
      9: [[4, 65], [5, 65], [6, 65], [7, 65], [8, 65], [9, 154], [10, 105], [13, 105], [14, 154], [16, 154], [17, 105], [19, 195], [20, 65], [21, 195]],
      10: [[4, 105], [5, 154], [6, 154], [7, 154], [8, 154], [9, 105], [10, 65], [14, 65], [17, 65], [20, 65], [21, 195]],
      11: [[4, 65], [5, 65], [6, 65], [7, 65], [8, 65], [9, 65], [10, 65], [14, 65], [17, 65], [20, 65], [21, 195]],
      12: [[4, 65], [5, 65], [6, 65], [7, 65], [8, 65], [9, 65], [10, 65], [13, 105], [14, 154], [16, 154], [17, 105], [19, 195], [20, 65], [21, 195]],
      13: [[7, 195], [8, 65], [9, 65], [10, 65], [13, 195], [16, 65], [17, 195], [19, 105], [20, 105]],
      14: [[8, 195], [9, 65], [10, 65], [15, 154], [16, 195], [19, 65], [20, 195]],
      15: [[9, 195], [10, 105], [18, 105], [19, 154]],
      16: [[17, 154], [18, 195]],
    };
    // scale>1: the clean hand-drawn vector (speaker + 2 arcs), dark-on-light to match the
    // real icon's ink - reads far better upscaled than a trace of the dotted-arc bitmap.
    if (RENDER_SCALE > 1) { this._drawVolumeVector(ctx, '#414141'); return; }
    // scale=1: the REAL decoded firmware sprite (launcher_u/cell_10), 0-diff at (4,3) vs
    // idle.top, nearest; fall back to the per-pixel bake before it loads.
    const vi = Assets.img('spr_volIcon');
    if (vi) { const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false; ctx.drawImage(vi, 4, 3); ctx.imageSmoothingEnabled = sm; return; }
    for (const y in rows) for (const [x, v] of rows[y]) { ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(x, +y, 1, 1); }
  }

  // clean vector volume icon (speaker cone + 2 sound arcs), matching the settings-bar version.
  _drawVolumeVector(ctx, color) {
    ctx.fillStyle = color;
    ctx.fillRect(5, 9, 3, 3);
    ctx.beginPath(); ctx.moveTo(7, 9); ctx.lineTo(11, 6); ctx.lineTo(11, 15); ctx.lineTo(7, 12); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(11, 10.5, 4.5, -0.85, 0.85); ctx.stroke();
    ctx.beginPath(); ctx.arc(11, 10.5, 7.5, -0.85, 0.85); ctx.stroke();
  }

  _drawTopBar(screen) {
    const ctx = screen.c;
    // volume speaker icon: the shipped spr_vol* is a garbled decode, so bake the
    // real dark-on-light icon (speaker + 3 sound-wave arcs) per-pixel from idle.top.
    ctx.imageSmoothingEnabled = false;
    this._drawVolIcon(ctx);
    // username, opaque 3-level ramp per favColor (RE'd above); baseline-top y2
    const favColor = this.settings.favColor != null ? this.settings.favColor : 11;
    Fonts.m.drawLevels(ctx, this.settings.username || 'User', 27, 2, 'topUser_' + favColor, TOP_USER_LEVELS[favColor]);
    // date/time, right aligned before battery
    const now = (typeof window !== 'undefined' && window.__demoTime != null) ? new Date(window.__demoTime) : new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    // the clock colon BLINKS at 1 Hz (60f drawn / 60f blank, RE'd top_screen_idle).
    // The verify freezes the RTC and captured the colon-off half, so
    // __demoClockSpace forces the blank state to keep idle.top pixel-exact.
    const blinkOff = (typeof window !== 'undefined' && window.__demoClockSpace)
      || (typeof performance !== 'undefined' && Math.floor(performance.now() / 1000) % 2 === 1);
    const sep = blinkOff ? ' ' : ':';
    const batt = System.batterySprite();
    // align the sprite's battery ink (sprite-x 12) to the real status-bar slot (~x237)
    const battInkX = 237;
    // The status bar draws the date and time as two right-aligned fields, not one
    // string: measured on idle.top the gap between "MM/DD" and the time is 5px, one
    // px wider than a plain space (advance 4). Drawing them together left the date
    // block 1px right (its runs at +1, the time aligned). Draw them separately.
    const dateStr = `${mm}/${dd}`;
    const timeStr = `${hh}${sep}${mi}`;
    const clockRight = battInkX - 6;
    Fonts.s.drawRight(ctx, timeStr, clockRight, 5, '#414141');
    Fonts.s.drawRight(ctx, dateStr, clockRight - Fonts.s.measure(timeStr) - 5, 5, '#414141');
    if (batt) { const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = RENDER_SCALE > 1; ctx.drawImage(batt, battInkX - 14, 3); ctx.imageSmoothingEnabled = sm; }
    else {
      // DSi battery icon: dark frame, orange fill segments, terminal nub
      const bx = 237, by = 5, bw = 13, bh = 9;
      ctx.fillStyle = '#3a3a3a'; ctx.fillRect(bx, by, bw, bh);            // frame
      ctx.fillStyle = '#cfcfcf'; ctx.fillRect(bx + 1, by + 1, bw - 2, bh - 2); // inner
      ctx.fillStyle = '#e8732a';                                          // orange charge
      ctx.fillRect(bx + 2, by + 2, 2, bh - 4); ctx.fillRect(bx + 5, by + 2, 2, bh - 4); ctx.fillRect(bx + 8, by + 2, 2, bh - 4);
      ctx.fillStyle = '#3a3a3a'; ctx.fillRect(bx + bw, by + 2, 2, bh - 4); // terminal
    }
  }
}
