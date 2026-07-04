// The DSi Menu launcher: icon carousel on the bottom screen.
import { Assets } from './assets.js';
import { Fonts } from './font.js';
import { RENDER_SCALE } from './screen.js';
import { CAROUSEL as C, ANIM, FPS } from './config.js';
import { CARD_PAL, CARD_ROWS } from './gamecard_sprite.js';
import { SETICON_PAL, SETICON_ROWS } from './settingsicon_sprite.js';

// Real per-favourite-colour palette for the carousel scrollbar thumb + L/R
// scroll-arrow buttons, read directly off
// assets/launcher/narc/usercolor_launcher/msk_launcher_D_UC0B.NCLR (one NCLR
// file, 16 palette banks, bank index = the DSi favourite-colour index 0..15 -
// same single-file-per-favColor-bank scheme as Settings' sm_setting_D_UC02.NCLR).
// Confirmed by real melonDS ground truth, not inferred: a scratch NAND patched
// to favColor=2 (red) via melonDS/headless/nandfs.cpp's setfavcolor and booted
// to the carousel (scripts/idle_anim.txt) shows the scrollbar pill and both
// L/R arrows rendering in red, matching this table's bank 2 row exactly; bank
// 11 ('blue') is byte-for-byte the values this code used to hardcode (index 9
// = #499afb 'light', index 8 = #3082fb 'dark', index 6 = #0059f3 'border',
// index 5 = #0049e3 'borderDk'), which is why the blue render is unaffected.
// Indices 0..2 (greys) and 15 (white) are identical across every bank in the
// real file and are also used by unrelated fixed-grey/white chrome elsewhere.
export const FAV_NAMES = [
  'grey', 'brown', 'red', 'pink', 'orange', 'yellow', 'lime', 'green',
  'dark-green', 'turquoise', 'light-blue', 'blue', 'dark-blue', 'violet',
  'magenta', 'rose',
];

// hex '#rrggbb' -> [r,g,b], for feeding LAUNCHER_UC0B rows into drawCenteredLevels.
function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

const LAUNCHER_UC0B = [
  ['#9a9a9a', '#596959', '#828a82', '#496982', '#597192', '#597992', '#61829a', '#6992a2', '#79a2b2', '#9ab2c3', '#a2bac3', '#b2cbd3', '#cbdbdb', '#a2b2c3', '#d3dbe3', '#fbfbfb'], // 0 grey
  ['#9a9a9a', '#596959', '#828a82', '#aa2800', '#ba2800', '#ba3800', '#cb4900', '#d35910', '#db6128', '#eb7149', '#f38a69', '#eb9a71', '#ebaa92', '#d37951', '#f3c3ba', '#fbfbfb'], // 1 brown
  ['#9a9a9a', '#596959', '#828a82', '#cb0028', '#db0020', '#eb0820', '#f32020', '#fb3049', '#fb4961', '#fb6182', '#fb7192', '#fb8aaa', '#fb9aba', '#f35969', '#fbaab2', '#fbfbfb'], // 2 red
  ['#aab2aa', '#596959', '#828a82', '#fb59eb', '#fb69eb', '#fb79eb', '#fb8aeb', '#fb9aeb', '#fba2eb', '#fbb2eb', '#fbcbfb', '#fbd3fb', '#fbdbfb', '#fbb2f3', '#fbdbfb', '#fbfbfb'], // 3 pink
  ['#aab2aa', '#596959', '#828a82', '#fb7120', '#fb7900', '#fb8a00', '#fb9a10', '#fba228', '#fbaa49', '#fbba61', '#fbcb79', '#fbd39a', '#fbe3ba', '#fbc369', '#fbe3b2', '#fbf3f3'], // 4 orange
  ['#aab2aa', '#596959', '#828a82', '#eba200', '#f3aa00', '#ebba00', '#ebc300', '#f3d308', '#fbdb18', '#fbeb28', '#fbf359', '#fbfb8a', '#fbfbba', '#f3db51', '#fbebaa', '#fbfbfb'], // 5 yellow
  ['#aab2aa', '#596959', '#828a82', '#71cb00', '#79db00', '#8adb00', '#92e300', '#aaeb18', '#c3f330', '#d3fb49', '#ebfb61', '#f3fb82', '#fbfbba', '#cbfb51', '#e3fbaa', '#fbfbfb'], // 6 lime
  ['#aab2aa', '#596959', '#828a82', '#08c300', '#10cb00', '#18db00', '#10eb10', '#41f328', '#69fb41', '#9afb61', '#b2fb61', '#cbfb82', '#dbfb9a', '#79f371', '#bafbba', '#fbfbfb'], // 7 green
  ['#aab2aa', '#596959', '#828a82', '#009a28', '#00aa30', '#00b228', '#00c328', '#10cb38', '#20db38', '#51e349', '#79f371', '#9afb9a', '#8afb8a', '#61d379', '#aaebba', '#fbfbfb'], // 8 dark-green
  ['#aab2aa', '#596959', '#828a82', '#00ba61', '#08cb59', '#20d369', '#28e371', '#30eb79', '#10fb71', '#69fba2', '#92fbba', '#b2fbdb', '#c3fbeb', '#82f3b2', '#c3fbdb', '#fbfbfb'], // 9 turquoise
  ['#aab2aa', '#596959', '#828a82', '#188afb', '#209af3', '#28aaf3', '#30baf3', '#49c3fb', '#61cbfb', '#79dbfb', '#92dbfb', '#aae3fb', '#c3ebfb', '#82dbfb', '#c3ebfb', '#fbfbfb'], // 10 light-blue
  ['#aab2aa', '#596959', '#828a82', '#0028ba', '#0038d3', '#0049e3', '#0059f3', '#1871fb', '#3082fb', '#499afb', '#61b2fb', '#79cbfb', '#92dbfb', '#69aaf3', '#b2d3fb', '#fbfbfb'], // 11 blue (real DSi default)
  ['#aab2aa', '#596959', '#828a82', '#000071', '#00008a', '#0000aa', '#0000c3', '#0018e3', '#1038d3', '#1051c3', '#2871eb', '#388af3', '#51a2fb', '#5151db', '#aaaaeb', '#fbfbfb'], // 12 dark-blue
  ['#aab2aa', '#596959', '#828a82', '#59108a', '#6908a2', '#7900ba', '#8a00d3', '#9a18db', '#aa30e3', '#b251e3', '#c369eb', '#d382eb', '#e3a2f3', '#ba61eb', '#dbb2f3', '#fbfbfb'], // 13 violet
  ['#aab2aa', '#596959', '#828a82', '#9200aa', '#aa00c3', '#ba00db', '#c300e3', '#db18f3', '#e338f3', '#e359f3', '#eb79fb', '#f39afb', '#f3bafb', '#eb61fb', '#f3b2fb', '#fbfbfb'], // 14 magenta
  ['#aab2aa', '#596959', '#828a82', '#eb088a', '#eb289a', '#fb18a2', '#fb30ba', '#fb41c3', '#fb51cb', '#fb69d3', '#fb82d3', '#fb92e3', '#fba2e3', '#fb79d3', '#fbbaeb', '#fbfbfb'], // 15 rose
];

export class Launcher {
  constructor(registry, audio, favColor = 11) {
    this.reg = registry;
    this.audio = audio;
    // DSi favourite colour (0..15, tools/usercolor.js FAV_NAMES order). Default
    // 11 = blue, the real NAND default and the only colour with a pixel-exact
    // melonDS baseline (assets/reference/idle.{top,bot}.png); callers can pass
    // the user's actual chosen colour once a shared profile object plumbs it in.
    this.favColor = favColor;
    this.selected = registry.defaultSlot;
    this.camera = this.selected;      // animated float (slot units)
    this.targetCamera = this.selected;
    this.tCursor = 1;                 // 0..1 slide progress
    this.sliding = false;             // true while a nav slide is animating
    this.slideFrom = this.selected;   // slot the slide started from (name-box lag)
    this.settlePulse = 0;             // frames left in the frame's select-landing squash
    this.navHold = 0;                 // held nav direction for auto-repeat (0/-1/1)
    this.navRepeatT = 0;              // frames until the next auto-repeat step
    this.launching = null;            // launch animation state
    this.grab = null;                 // icon-rearrange state (see grabIcon)
    this.thumbHeld = false;           // true while the scrollbar pill is grabbed (RE'd
                                      // scrollbar_thumb_drag: the pill fills pressed
                                      // light-blue and the centre select frame hides)
    this.nameFadeA = 1;               // name-box cross-fade: 1 = item balloon shown,
                                      // 0 = "Nintendo DSi Menu" watermark. Cross-fades
                                      // on empty<->game/settings (RE'd land_on_empty ~8f)
    this.nameFadeItem = registry.get(registry.defaultSlot) || null;  // balloon content,
                                      // kept through a fade-out so the outgoing item's
                                      // bubble fades rather than hard-cutting
    this.fastScroll = false;          // true while a scrollbar blank-track press is doing
                                      // its fast ease-out momentum scroll to a slot
  }

  // Name-box target: 1 when the centred item is populated (app / settings / game-card)
  // and shows its balloon; 0 when it is an empty slot, between items during a scrub, or
  // launching (all show the watermark). An empty SLOT is treated the same as an empty
  // item (no reg entry -> watermark).
  _nameTarget() {
    if (this.launching || this._scrubHidden()) return 0;
    return this.reg.get(this._displaySelected()) ? 1 : 0;
  }
  // snap the fade to its settled value (used by the static debug/render hooks so a
  // single rendered frame reflects the fully-settled name, exactly as update() would).
  snapNameFade() { this.nameFadeA = this._nameTarget(); const a = this.reg.get(this._displaySelected()); if (a) this.nameFadeItem = a; }

  // A held LEFT/RIGHT auto-repeats (RE'd nav_hold_*): one step now, then update()
  // repeats after navRepeatDelay and every navRepeatCadence frames while held.
  // Routes to grab-mode move when grabbing.
  holdNav(dir) {
    if (this.grab) this.moveGrabbed(dir); else this.move(dir);
    this.navHold = dir; this.navRepeatT = ANIM.navRepeatDelay;
  }
  endNav(dir) { if (this.navHold === dir) { this.navHold = 0; this.navRepeatT = 0; } }

  // sprite lookup helper (decoded NCER cells, named)
  spr(name) { return Assets.img('spr_' + name); }

  // The launchable-app tile, rebuilt to the measured reference profile (idle.bot):
  // a bright near-white face (243), a 1px inscribed shadow groove (~186) about 7px
  // in, and a slightly darker inset panel (236) with a soft darker bottom edge. The
  // decoded sprite was a grey (164) bevel that read far too dark; this matches the
  // real tile, which is a bright pillow with only a thin recess line, not a hard bevel.
  _tile(fill = false) {
    const key = fill ? '_tileFillCanvas' : '_tileCanvas';
    if (this[key]) return this[key];
    if (typeof document === 'undefined') return this.spr('tile');
    const c = document.createElement('canvas'); c.width = 64; c.height = 68;   // +4 rows for the drop shadow
    const x = c.getContext('2d');
    const rr = (px, py, w, h, r) => { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); };
    // The card's top border (groove + corner AA below) sits at canvas y7 (screen y89);
    // the face must start THERE, not at y0. Filling from y0 painted a solid 243 block
    // over screen y82..88 where the reference shows the striped field continuing (the
    // 235/243 stripe vs 243 fill is only an 8-level diff, so the 20-threshold pixdiff
    // missed it). Start the face at y7 so the field shows above the card.
    rr(0, 9, 64, 55, 5); x.fillStyle = '#f3f3f3'; x.fill();                 // uniform bright face (243), top at y91; y89 border + y90 field come from the groove/corner AA below
    // The real card is only 50px wide (sprite x7..56); the 8px either side is the
    // inter-tile gap and must read the field behind it, not tile white. The rounded
    // rect above over-fills those columns, so clear them back to transparent
    // (verified idle.bot: sx0..6 and sx57..63 are pure field on every row).
    x.clearRect(0, 0, 7, c.height); x.clearRect(57, 0, 7, c.height);
    // 1px inscribed shadow groove ~7px in, TOP + SIDES only (the reference has no
    // groove line along the bottom; that area is the shaded bottom edge below).
    x.strokeStyle = '#bababa'; x.lineWidth = 1;
    x.beginPath();
    x.moveTo(7.5, 57); x.lineTo(7.5, 11); x.arcTo(7.5, 7.5, 12, 7.5, 5);
    x.lineTo(53, 7.5); x.arcTo(56.5, 7.5, 56.5, 12, 5); x.lineTo(56.5, 57);
    x.stroke();
    // Paint a symmetric run of grey pixels: [sx0,sx1] at value v on the left, and its
    // mirror image (about the vertical centre, sx <-> 63-sx) on the right.
    const putRow = (sy, spans) => {
      for (const [a, b, v] of spans) {
        x.fillStyle = `rgb(${v},${v},${v})`;
        x.fillRect(a, sy, b - a + 1, 1);
        x.fillRect(63 - b, sy, b - a + 1, 1);
      }
    };
    // Top rounded-corner anti-aliasing, reconstructed pixel-exact from idle.bot
    // (tile sprite-y 7..11). The single-radius arc stroke above is close but a hair
    // too bright at the join; overlay the real corner staircase.
    putRow(7, [[10, 10, 219], [11, 12, 186]]);   // top border joins the corner at 186 (was 196/201)
    putRow(8, [[8, 8, 219], [9, 9, 186], [10, 10, 203], [11, 11, 219]]);
    putRow(9, [[8, 8, 186], [9, 9, 211], [10, 10, 227]]);
    putRow(10, [[7, 7, 219], [8, 8, 203], [9, 9, 227], [12, 12, 251]]);   // inner-corner 251 highlight
    putRow(11, [[7, 7, 186], [8, 8, 219], [11, 11, 251]]);
    // Shaded bottom edge + rounded bottom corner + drop shadow (regular app tiles
    // only; channel tiles cover this with the 48px icon). Reconstructed pixel-exact
    // from idle.bot (sprite-y 53..66): the tile is lit from the top so the lower
    // rows fall into a shaded lip that follows the rounded corner, then the card
    // casts a faint two-row drop shadow. Wipe the flat face here first so the corner
    // reads the field behind it (transparent), then repaint every tile pixel.
    if (!fill) {
      x.clearRect(0, 53, 64, 15);
      const bottom = {
        53: [[7, 7, 186], [8, 9, 227], [10, 11, 243], [12, 31, 251]],
        54: [[7, 7, 186], [8, 8, 211], [9, 9, 227], [10, 31, 243]],
        55: [[7, 7, 186], [8, 8, 211], [9, 11, 227], [12, 31, 235]],
        56: [[7, 7, 211], [8, 9, 186], [10, 31, 211]],
        57: [[7, 7, 243], [8, 9, 186], [10, 11, 162], [12, 31, 178]],
        58: [[8, 8, 211], [9, 9, 186], [10, 10, 162], [11, 11, 178], [12, 31, 186]],
        59: [[9, 10, 186], [11, 11, 178], [12, 31, 186]],
        60: [[9, 9, 211], [10, 10, 186], [11, 12, 178], [13, 31, 186]],
        61: [[10, 11, 186], [12, 31, 178]],
        62: [[11, 11, 186], [12, 31, 162]],
        63: [[11, 11, 219], [12, 13, 203], [14, 31, 178]],
        64: [[11, 12, 219], [13, 31, 203]],
        65: [[12, 13, 219], [14, 31, 203]],
        66: [[13, 31, 219]],
      };
      for (const sy in bottom) putRow(+sy, bottom[sy]);
    }
    this[key] = c; return c;
  }

  // The real System Menu does NOT float the selected item at idle. A 100-frame
  // melonDS idle recording (out/idle) shows the selection frame pixel-static from
  // the moment it settles (frame edges top=88, bot=159, left=97, right=158 hold
  // for 90 straight frames); the only idle motion is each app icon playing its
  // own internal animation. So there is no vertical bob.
  _bobOffset() {
    return 0;
  }

  // px the blue selection frame is inset during a select-landing squash. Frozen to
  // 0 by the verify harness so static captures stay at rest.
  _settleInset() {
    if (typeof window !== 'undefined' && window.__freezeAnim != null) return 0;
    if (this.settlePulse <= 0) return 0;
    const idx = ANIM.settlePulseFrames - Math.ceil(this.settlePulse);
    return ANIM.settlePulseInset[idx] || 0;
  }

  move(dir) {
    if (this.launching) return;
    this.scrubbing = false; this.fling = null;
    const n = this.reg.totalSlots;
    const next = Math.max(0, Math.min(n - 1, this.selected + dir));
    if (next === this.selected) return;
    this.slideFrom = this.selected;
    this.selected = next;
    this.targetCamera = next;
    this.sliding = true;
    this.tCursor = 0;
    this.audio && this.audio.play('nav', { gain: 0.9 });
  }

  selectAt(slot) {
    if (this.launching || slot === this.selected) return;
    this.slideFrom = this.selected;
    this.selected = Math.max(0, Math.min(this.reg.totalSlots - 1, slot));
    this.targetCamera = this.selected;
    this.sliding = true;
    this.tCursor = 0;
    this.audio && this.audio.play('nav', { gain: 0.9 });
  }

  // Fast momentum scroll to `slot` (scrollbar blank-track press). Unlike selectAt's slow
  // linear nav slide, update() eases the camera out toward the target quickly (fastScroll),
  // so a far jump crosses in ~0.15s then decelerates in - matching the real DS scroll speed.
  scrollTo(slot) {
    if (this.launching) return;
    slot = Math.max(0, Math.min(this.reg.totalSlots - 1, slot));
    if (slot === this.selected && this.camera === slot) return;
    this.fling = null; this.scrubbing = false; this.thumbHeld = false;
    this.slideFrom = this.selected;
    this.selected = slot;
    this.targetCamera = slot;
    this.sliding = true;
    this.tCursor = 0;
    this.fastScroll = true;
    this.audio && this.audio.play('nav', { gain: 0.9 });
  }

  // ---- icon rearrange (RE'd out/rearr): press UP on a settled carousel to grab
  // the selected launchable icon. It lifts to the top centre with a blue down-arrow
  // while the other icons form a row below; LEFT/RIGHT scrolls that row to pick the
  // insertion gap; A drops it there; B cancels back to its slot.
  grabIcon() {
    if (this.launching || this.grab) return false;
    if (this.camera !== this.targetCamera) return false;   // only when settled
    const app = this.reg.get(this.selected);
    if (!app || !app.launchable) return false;
    const packed = this.reg.slots.filter(Boolean);
    const from = packed.indexOf(app);
    const others = packed.filter((a) => a !== app);
    this.grab = { app, from, others, insertPos: from, liftT: 0, rowCam: from,
      rowCam0: from, anchorX: 0, dragging: false, pendingDrop: false };
    this.audio && this.audio.play('nav', { gain: 0.9 });
    return true;
  }

  moveGrabbed(dir) {
    if (!this.grab) return;
    const max = this.grab.others.length;                   // gaps are 0..others.length
    const next = Math.max(0, Math.min(max, this.grab.insertPos + dir));
    if (next === this.grab.insertPos) return;
    this.grab.insertPos = next;
    this.audio && this.audio.play('nav', { gain: 0.9 });
  }

  // ---- free touch drag of a grabbed icon (RE'd out/rearr/ug2_drag: the grabbed card
  // stays PINNED at top-centre; the ROW of other icons follows the finger 1:1 at pitch
  // 76, holding wherever the finger is, and only snaps to the nearest gap on release).
  // This is the continuous content-drag the D-pad path steps discretely.
  beginGrabDrag(anchorX) {
    if (!this.grab) return;
    this.grab.dragging = true; this.grab.anchorX = anchorX; this.grab.rowCam0 = this.grab.rowCam;
  }
  dragGrabbed(px) {
    if (!this.grab || !this.grab.dragging) return;
    const max = this.grab.others.length;
    // finger right -> content (row) right -> rowCam decreases. Verified rowShift = px-anchor, pitch 76.
    const rc = Math.max(0, Math.min(max, this.grab.rowCam0 - (px - this.grab.anchorX) / 76));
    this.grab.rowCam = rc;
    const ip = Math.max(0, Math.min(max, Math.round(rc)));
    if (ip !== this.grab.insertPos) { this.grab.insertPos = ip; this.audio && this.audio.play('nav', { gain: 0.9 }); }
  }
  releaseGrabDrag() {
    if (!this.grab) return;
    this.grab.dragging = false;
    this.grab.insertPos = Math.max(0, Math.min(this.grab.others.length, Math.round(this.grab.rowCam)));
    this.grab.pendingDrop = true;   // update() eases the row to the gap, then arms the fall
  }

  // On A the tile does not snap: the arrow vanishes, the tile FALLS straight down
  // 74px over 9f with a symmetric ease-in-out bell, a ~2f bare pause, then the
  // reorder commits and the frame pops (RE'd out/wfa/grab_drop). Descent handled
  // in update()/_drawGrabMode; here we just arm it.
  dropGrabbed() {
    if (!this.grab || this.grab.drop) return;
    this.grab.drop = { t: 0 };
    this.audio && this.audio.play('launch', { gain: 0.6 });
  }

  grabbing() { return !!this.grab; }

  // Which slot the name box + selection frame reflect. The launcher's internal
  // selected index (MainRAM 0x0b02798) flips when the scroll accumulator is within
  // ~16px of the target, i.e. at ~72% of a one-slot slide (RE'd: sel flips at scroll
  // -42 of -58). Until that transfer the OLD slot's name stays shown, so the box
  // does not jump at slide start (confirmed navR: still "Bird & Beans" at f6, swaps
  // by f7). Outside a slide it is simply the committed selection.
  _displaySelected() {
    // During a touch/scrollbar scrub (and its release fling) the committed selection
    // has not changed yet, but the name box must reflect the item currently under the
    // centre cursor, not the stale pre-drag selection. Track round(camera): over an
    // empty slot reg.get() is null so the watermark shows, over an app its name shows.
    if (this.scrubbing) return Math.round(this.camera);
    if (!this.sliding || this.slideFrom == null || this.slideFrom === this.selected) return this.selected;
    const prog = (this.camera - this.slideFrom) / (this.selected - this.slideFrom);
    return prog >= 42 / 58 ? this.selected : this.slideFrom;
  }

  // Which slot's TYPE the selection frame/START/chevron reflect. Unlike the name
  // box (72% swap), the frame holds the OLD slot's chrome through the WHOLE slide
  // and switches only at commit (RE'd land_on_gamecard/land_on_empty: frame stays
  // through transit, then the frame/START drop + chevron recolour at slot-commit).
  _frameSelected() {
    // Same as _displaySelected during a scrub: the blue frame + START must reflect the
    // centred item (so they hide over empty slots) instead of the stale pre-drag one.
    if (this.scrubbing) return Math.round(this.camera);
    return (this.sliding && this.slideFrom != null) ? this.slideFrom : this.selected;
  }

  launch() {
    if (this.launching) return false;
    const app = this.reg.get(this.selected);
    if (!app || !app.launchable) return false;
    this.audio && this.audio.play('launch');
    this.launching = { t: 0, app, slot: this.selected };
    return true;
  }

  // the boot->carousel intro: icons spring-fall into place, staggered from the
  // centre outward, then the name box + frame + START fade in (measured out/boot).
  startIntro() { this.intro = { frame: 0 }; }

  // vertical offset (px, from the settled position) of the icon at distance d
  // from centre at the current intro frame; null = not yet visible.
  // `off` is the signed screen offset (slot - selected): the cascade is a
  // RIGHT-TO-LEFT wave (rightmost off=+2 lands first, leftmost off=-2 last) at
  // 4f/slot, each tile dropping ~90px from off the top with one ~24px damped
  // overshoot (RE'd out/wfa/carousel_entrance).
  _introFall(off) {
    const f = this.intro.frame;
    const START = 3, STAGGER = 4, TF = 12, TT = 34, H = 90, OV = 24;
    const t = f - START - (2 - off) * STAGGER;
    if (t < 0) return null;
    if (t >= TT) return 0;
    if (t < TF) { const p = t / TF; return -H + (H + OV) * (p * p * (1.15 - 0.15 * p)); }
    const bt = t - TF;                             // damped bounce back to 0
    return OV * Math.cos(bt * 0.42) * Math.exp(-bt * 0.11);
  }

  update(dt) {
    if (this.intro) { this.intro.frame += dt * FPS; if (this.intro.frame > 78) this.intro = null; }
    // touch-release momentum glide: coast with ease-out decay, then snap
    if (this.fling) {
      if (this.launching) { this.fling = null; }
      else {
        const max = this.reg.totalSlots - 1;
        this.camera = Math.max(0, Math.min(max, this.camera + this.fling.vel * dt * FPS));
        this.fling.vel *= 0.85;
        if (Math.abs(this.fling.vel) < 0.02 || this.camera <= 0 || this.camera >= max) { this.fling = null; this.snap(); }
      }
    }
    // carousel slide: the launcher steps its scroll accumulator a FIXED 7px per
    // frame in a 58px-per-slot space toward the target, then clamps (RE'd from
    // MainRAM 0x0af3c4c: rel 0,-7,-14,...,-49,-57,-58 = pure linear, no easing).
    // Skipped while a momentum fling owns the camera, AND while an active touch
    // scrub owns it: during a drag the camera is set directly from the finger and
    // targetCamera is still the pre-drag slot, so without this guard update() would
    // walk the camera back toward that stale target (the pill drifting on its own).
    if (!this.fling && !this.scrubbing && this.camera !== this.targetCamera) {
      if (this.fastScroll) {
        // FAST momentum scroll (scrollbar blank-track press): ease-out toward the target,
        // covering ~40% of the remaining distance per frame so a far jump snaps across
        // quickly then decelerates in - NOT the slow 7px/frame nav slide. Framerate-scaled.
        const k = 1 - Math.pow(1 - 0.40, dt * FPS);
        this.camera += (this.targetCamera - this.camera) * k;
        if (Math.abs(this.camera - this.targetCamera) < 0.03) this.camera = this.targetCamera;
      } else {
        const step = (ANIM.slideStepPx / ANIM.slideSlotUnit) * dt * FPS; // slot units/frame
        if (this.camera < this.targetCamera) this.camera = Math.min(this.targetCamera, this.camera + step);
        else this.camera = Math.max(this.targetCamera, this.camera - step);
      }
      if (this.camera === this.targetCamera) {
        this.tCursor = 1; this.sliding = false; this.cameraStart = undefined; this.fastScroll = false;
        // when a launchable item lands in the centre, the blue frame does a brief
        // squash-and-release: measured from a real LEFT step (out/idle navL) the
        // frame contracts to 2px inset over 3 frames then springs back. It never
        // fires when landing on an empty slot (no frame there).
        const app = this.reg.get(this.selected);
        if (app && app.launchable) this.settlePulse = ANIM.settlePulseFrames;
      } else this.tCursor = 0;
    }
    if (this.settlePulse > 0) this.settlePulse = Math.max(0, this.settlePulse - dt * FPS);
    // name-box cross-fade toward the current target (~8f, RE'd land_on_empty). Only
    // populated<->empty cross-fades; game->game hard-swaps via _displaySelected.
    const nt = this._nameTarget();
    if (nt === 1) { const a = this.reg.get(this._displaySelected()); if (a) this.nameFadeItem = a; }
    const nStep = (1 / 8) * dt * FPS;
    if (this.nameFadeA < nt) this.nameFadeA = Math.min(nt, this.nameFadeA + nStep);
    else if (this.nameFadeA > nt) this.nameFadeA = Math.max(nt, this.nameFadeA - nStep);
    // held-direction auto-repeat
    if (this.navHold && !this.launching) {
      this.navRepeatT -= dt * FPS;
      if (this.navRepeatT <= 0) {
        if (this.grab) this.moveGrabbed(this.navHold); else this.move(this.navHold);
        this.navRepeatT = ANIM.navRepeatCadence;
      }
    }
    if (this.grab) {
      this.grab.t = (this.grab.t || 0) + dt * FPS;   // grab-mode time, for the arrow bob
      if (this.grab.drop) {
        // drop: fall 9f + ~2f bare pause, then commit the reorder + pop the frame
        this.grab.drop.t += dt * FPS;
        if (this.grab.drop.t >= 11) {
          const idx = this.reg.reorder(this.selected, this.grab.insertPos);
          this.selected = idx; this.targetCamera = idx; this.camera = idx;
          this.slideFrom = idx; this.tCursor = 1; this.sliding = false;
          this.settlePulse = ANIM.settlePulseFrames;   // frame pop on landing
          this.grab = null;
        }
      } else {
        // lift the grabbed tile over ~6 frames (RE'd out/rearr: tile rises f6..f11)
        this.grab.liftT = Math.min(1, this.grab.liftT + dt * FPS / 6);
        // While a touch drag owns the row (dragging), rowCam is driven 1:1 by the finger
        // (dragGrabbed) - do not fight it. Otherwise (D-pad step, or the release-snap) the
        // row slides toward the integer insertPos at the fixed carousel velocity; once the
        // release-snap lands, arm the fall (dropGrabbed) for the touch path.
        if (!this.grab.dragging) {
          const step = (ANIM.slideStepPx / ANIM.slideSlotUnit) * dt * FPS;
          if (this.grab.rowCam < this.grab.insertPos) this.grab.rowCam = Math.min(this.grab.insertPos, this.grab.rowCam + step);
          else if (this.grab.rowCam > this.grab.insertPos) this.grab.rowCam = Math.max(this.grab.insertPos, this.grab.rowCam - step);
          if (this.grab.pendingDrop && Math.abs(this.grab.rowCam - this.grab.insertPos) < 1e-3) { this.grab.pendingDrop = false; this.dropGrabbed(); }
        }
      }
    }
    if (this.launching) {
      this.launching.t += dt * FPS;
      if (this.launching.t >= ANIM.launchTotal) {
        const app = this.launching.app;
        this.launching = null;
        return { launched: app };
      }
    }
    return null;
  }

  // start a slide from current camera
  _beginSlide() { this.cameraStart = this.camera; }

  // live drag: set the camera directly (no easing), clamped to the slot range
  scrub(cam) {
    if (this.launching) return;
    this.fling = null;
    this.camera = Math.max(0, Math.min(this.reg.totalSlots - 1, cam));
    this.tCursor = 1; this.cameraStart = undefined; this.scrubbing = true;
  }

  // During an active touch-scrub, once the camera is between slots the frame +
  // START + app name are suppressed and the "Nintendo DSi Menu" watermark shows
  // (RE'd carousel_touch_drag). A single-slot move keeps the frame (tiles slide
  // through the stationary cursor).
  _scrubHidden() {
    return this.scrubbing && Math.abs(this.camera - Math.round(this.camera)) > 0.2;
  }

  // On touch-drag release the carousel GLIDES with ease-out momentum before it
  // snaps to the nearest slot (RE'd carousel_touch_drag). `vel` is camera-units/
  // frame from the last drag move; a slow release snaps immediately.
  flingScrub(vel) {
    if (this.launching) return;
    if (Math.abs(vel) > 0.03) this.fling = { vel };
    else this.snap();
  }
  // which scrollbar arrow is currently pressed (-1 left, 1 right, 0 none)
  pressArrow(dir) { this.pressedArrow = dir; }

  // screen-x of a slot at fractional offset d from the carousel centre (camera),
  // from the firmware spacing (JNCL): 65px first gap, 58px per gap after; linear
  // interpolation between the integer anchors during a slide.
  _slotOffsetX(d) {
    if (d === 0) return C.centerX;
    const s = Math.sign(d), ad = Math.abs(d), n = Math.floor(ad), frac = ad - n;
    const posN = n === 0 ? 0 : C.firstGap + (n - 1) * C.gap;
    const posN1 = C.firstGap + n * C.gap;
    return C.centerX + s * (posN + frac * (posN1 - posN));
  }
  // inverse: which slot is under screen-x (for taps)
  pixelToSlot(x) {
    const off = x - C.centerX, a = Math.abs(off);
    let d;
    if (a <= C.firstGap) d = a / C.firstGap;
    else d = 1 + (a - C.firstGap) / C.gap;
    return Math.round(this.camera + Math.sign(off) * d);
  }

  // settle to the nearest slot after a drag/scrollbar release
  snap() {
    if (this.launching) return;
    this.scrubbing = false;
    const slot = Math.max(0, Math.min(this.reg.totalSlots - 1, Math.round(this.camera)));
    if (slot !== this.selected) { this.selectAt(slot); }
    else { this.selected = slot; this.targetCamera = slot; this.tCursor = 0; this.cameraStart = this.camera; }
  }

  draw(screen) {
    const ctx = screen.c;
    // background field: 1px horizontal line texture, rows alternate #f3f3f3/#ebebeb
    // (matches the DSi launcher's runtime bg exactly). RE'd from the live BG2 tile
    // layer (engine A, charBase 0/mapBase 0x6000, dumped via melonDS VRAM read and
    // decoded with the real msk_launcher_D_BG.NCLR palette): the alternation isn't a
    // clean y%2 for the full screen height, it repeats once at the y167/168 tile-row
    // seam (243,243 instead of 243,235) and the parity is inverted from y168 on.
    ctx.fillStyle = '#f3f3f3'; ctx.fillRect(0, 0, 256, 192);
    ctx.fillStyle = '#ebebeb';
    for (let y = 0; y < 168; y += 2) ctx.fillRect(0, y, 256, 1);
    for (let y = 168; y < 192; y += 2) ctx.fillRect(0, y + 1, 256, 1);
    // The real lower-screen BG (msk_launcher_D_BG01) has a solid 1px darker edge
    // column #dbdbdb (219) at x0/x255 that the procedural dither omits. Paint both
    // full height as static background; the tiles/chrome/scroll rail composite over
    // the middle, so only the field rows (idle.bot y0..88, y148..169) keep it.
    ctx.fillStyle = '#dbdbdb'; ctx.fillRect(0, 0, 1, 192); ctx.fillRect(255, 0, 1, 192);

    // icon-rearrange (grab) mode is a distinct layout: no name box, the grabbed
    // tile lifted at the top, a row of the other icons below.
    if (this.grab) { this._drawGrabMode(screen); return; }

    // during the boot->carousel intro the name box/frame appear only once the
    // After the icon cascade settles, ONLY the name box + chevron cross-fade in
    // over ~8f from the "Nintendo DSi Menu" watermark (the frame + START hard-pop
    // separately, below). RE'd carousel_entrance: name fade starts with the frame pop.
    const intro = this.intro;
    const chromeA = intro ? Math.max(0, Math.min(1, (intro.frame - 59) / 8)) : 1;
    const chromeIn = chromeA > 0;

    // once the launch effect starts (~3f after the A press) the name balloon is
    // replaced by the faint "Nintendo DSi Menu" watermark and the selected tile
    // lifts out (RE'd out/anim/launch); the normal look holds for the first frames.
    const launching = this.launching;
    const launchFx = launching && launching.t >= 3;

    // name box (balloon) background: only when the selected slot holds an app or
    // the game-card. An empty selected slot (or the launch effect) shows just a
    // faint watermark, no box.
    const scrubHide = this._scrubHidden();
    const emptySel = !this.reg.get(this._displaySelected()) && !launching;
    // name-box balloon background, cross-faded with nameFadeA (folded with the intro
    // fade). It shows for the balloon content (nameFadeItem), fading out to nothing as
    // the item goes empty. The game-card slot has no balloon (its text sits on the field).
    const balloonA = this.nameFadeA * chromeA;
    if (chromeIn && !launchFx && balloonA > 0.004 && this.nameFadeItem) { ctx.globalAlpha = balloonA; this._drawNameBoxBg(screen); ctx.globalAlpha = 1; }
    // scrollbar track
    this._drawScrollTrack(screen);

    // carousel slots. Spacing is the firmware model (JNCL): 65px gap around the
    // centre, 58px per gap after (see _slotOffsetX). x = [-53,5,63,128,193,251,309]
    // for the 7 offsets when a slot is centred.
    const camera = this.camera;
    // end-cap boundary bars just outside the first/last slot (measured out/sweep:
    // a #dbdbdb bar at virtual slot -0.9 and totalSlots-0.1, scrolling with the row)
    if (!intro) this._drawEndCaps(ctx, camera);
    for (let off = -3; off <= 3; off++) {
      const slot = Math.round(camera) + off;
      const x = Math.round(this._slotOffsetX(slot - camera));
      if (x < -C.pitch || x > 256 + C.pitch) continue;
      let yOff = 0;
      if (intro) { yOff = this._introFall(slot - this.selected); if (yOff === null) continue; }
      this._drawSlot(screen, slot, x, yOff, chromeA);
    }
    // re-assert the #dbdbdb (219) edge columns over the FIELD bands (above the tile
    // row y0..88, below it y148..169): the far-left/right tiles bleed their face to
    // x0/x255 there, but the real firmware keeps the field-edge border (idle.bot).
    if (!intro) { ctx.fillStyle = '#dbdbdb'; ctx.fillRect(0, 0, 1, 89); ctx.fillRect(255, 0, 1, 89); ctx.fillRect(0, 148, 1, 22); ctx.fillRect(255, 148, 1, 22); }
    // The blue frame + START HARD-POP in one frame after the cascade settles (not a
    // fade); only the name box + chevron cross-fade (RE'd carousel_entrance). During
    // the intro gate the frame on a fixed pop frame, else full.
    const frameChrome = intro ? (intro.frame >= 59 ? 1 : 0) : 1;
    // While the scrollbar pill is held the blue select frame + START hide entirely
    // (RE'd scrollbar_thumb_drag: the select border is gone until release), even when
    // the camera sits on a slot. The name balloon still follows the centred item.
    if (!scrubHide && !this.thumbHeld) this._drawCenterChrome(screen, frameChrome);

    // launch effect: the lifting tile card + sparkle ring, drawn over the row
    if (launching) this._drawLaunch(screen);

    // name text: the faint launch watermark, else the normal name box (which
    // itself cross-fades with the watermark during the boot intro).
    if (launchFx) {
      // during a launch the faint watermark replaces the balloon
      this._drawWatermark(ctx, '#9a9a9a');
    } else {
      // cross-fade the item balloon text against the watermark. balloon alpha folds the
      // item fade (nameFadeA) with the intro reveal (chromeA); the watermark fills the
      // rest, so a game<->empty change dissolves and the intro reveals the same way.
      const bA = this.nameFadeA * chromeA;
      const wA = 1 - bA;
      if (wA > 0.004) { ctx.globalAlpha = wA; this._drawWatermark(ctx); ctx.globalAlpha = 1; }
      if (bA > 0.004 && this.nameFadeItem) { ctx.globalAlpha = bA; this._drawNameBox(screen, this.nameFadeItem); ctx.globalAlpha = 1; }
    }
    // scrollbar thumb
    this._drawScrollbar(screen);

    // launch fade: BOTH screens wash to white via the DS MASTER_BRIGHT brighten
    // out = in + (255-in)*evy/16, which is a white overlay at alpha evy/16. Bottom
    // ramps from f3, top from f6, both full white at f47 (RE'd out/wfa/launch_*).
    if (launching) this.drawLaunchWhite(screen, false);
  }

  launchWhiteAlpha(isTop) {
    if (!this.launching) return 0;
    const t = this.launching.t;
    return Math.min(1, Math.max(0, isTop ? (t - 6) / 41 : (t - 3) / 44));
  }
  drawLaunchWhite(screen, isTop) {
    const a = this.launchWhiteAlpha(isTop);
    if (a > 0) { const c = screen.c; c.fillStyle = `rgba(255,255,255,${a})`; c.fillRect(0, 0, 256, 192); }
  }

  // the grey boundary bars marking the start/end of the app list (measured
  // out/sweep s00/s38: a #dbdbdb bar ~5px wide, y85..141, at virtual slot -0.9
  // and totalSlots-1+0.9, scrolling with the carousel).
  _drawEndCaps(ctx, camera) {
    // The end-of-list boundary is a light-grey rounded bracket ("]" on the right,
    // "[" on the left), NOT a straight bar: a top arm + rounded corner + a 6px
    // vertical edge + rounded corner + bottom arm, y82..159 (measured idle sw00/
    // sw38, x relative to the cap centre e; top/bottom are symmetric about y120.5).
    // dir=+1 is the right cap, dir=-1 mirrors it into the left cap.
    const top = {
      82: [[-10, 227], [-9, 219], [-8, 211], [-7, 211], [-6, 211], [-5, 211], [-4, 211], [-3, 211], [-2, 227]],
      83: [[-10, 227], [-9, 219], [-8, 219], [-7, 219], [-6, 219], [-5, 219], [-4, 219], [-3, 219], [-2, 211], [-1, 211], [0, 227]],
      84: [[-5, 227], [-4, 219], [-3, 219], [-2, 219], [-1, 219], [0, 211], [1, 227]],
      85: [[-4, 227], [-3, 219], [-2, 219], [-1, 219], [0, 219], [1, 211]],
      86: [[-3, 219], [-2, 219], [-1, 219], [0, 219], [1, 211], [2, 227]],
    };
    const draw = (absSlot, dir, eAdj) => {
      const e = Math.round(this._slotOffsetX(absSlot - camera)) + eAdj;
      if (e < -12 || e > 268) return;
      const put = (relx, y, v) => { ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(e + dir * relx, y, 1, 1); };
      for (const y in top) for (const [rx, v] of top[y]) { put(rx, +y, v); put(rx, 241 - +y, v); }  // mirror top->bottom
      for (let y = 87; y <= 154; y++) for (const [rx, v] of [[-3, 219], [-2, 219], [-1, 219], [0, 219], [1, 219], [2, 211]]) put(rx, y, v);
    };
    // slotOffsetX rounds the mirror position 1px high for the left cap, so nudge it -1.
    draw(-0.9, -1, -1);
    draw(this.reg.totalSlots - 1 + 0.9, 1, 0);
  }

  _drawSlot(screen, slot, x, yOff = 0, chrome = 1) {
    const ctx = screen.c;
    const chromeOn = chrome > 0;
    const app = this.reg.get(slot);
    const inRange = slot >= 0 && slot < this.reg.totalSlots;
    const selected = slot === this.selected && !this.launching;
    const isGamecard = app && app.type === 'gamecard';
    // once the launch lift has started, the launching slot (tile card + icon) is
    // drawn as a lifting unit by _drawLaunch, so skip it here entirely.
    if (this.launching && this.launching.t >= 3 && slot === this.launching.slot) return;
    // tile underlay: white filled tile for launchable apps. The game-card slot
    // (nothing inserted) draws the flat dashed "insert a Game Card" placeholder.
    // yOff shifts the whole slot down during the boot-intro spring-fall.
    if (isGamecard) {
      // real decoded firmware sprite (launcher_d/cell_10, BASE palette): empty-card
      // placeholder with dashed rounded rect + chevron; transparent corners show the field.
      const gc = this.spr('gamecard');
      if (gc) ctx.drawImage(gc, Math.round(x - gc.width / 2), C.tileTop + yOff);
      else this._drawEmptyCard(ctx, x, yOff);
    } else {
      // real decoded firmware sprite (launcher_d/cell_07, BASE palette): white pillow tile.
      const tileSpr = (app) ? (this.spr('appTile') || this._tile(app.fillTile))
        : (this.spr('tileEmpty') || this._tile());
      if (inRange && tileSpr) ctx.drawImage(tileSpr, Math.round(x - tileSpr.width / 2), C.tileTop + yOff);
    }
    // the selected launchable icon gently bobs, but only at rest: during a slide
    // the icons ride flat. The blue frame/tab/START are a stationary cursor drawn
    // once at screen centre by _drawCenterChrome (RE'd from navR: the frame never
    // moves, tiles slide through it), so they are not drawn per slot here.
    const settled = this.camera === this.targetCamera;
    const bob = (selected && settled && app && app.launchable && chromeOn) ? this._bobOffset() : 0;
    if (app && !isGamecard) {
      // Built-in launcher channels (System Settings) use a 48px icon that fills
      // the tile window (measured 48x48, y90..137); DSiWare/cart icons stay 32px.
      const sz = app.fillTile ? 48 : C.iconSize;
      const top = app.fillTile ? 90 : C.iconTop;
      this._drawIcon(screen, app, Math.round(x - sz / 2), top + bob + yOff, sz);
    }
  }

  // Render the icon-rearrange (grab) mode: the grabbed tile lifted at the top
  // centre with a blue down-arrow, the other icons in a row below through which
  // the insertion cursor scrolls. RE'd from out/rearr (up_done / gmovedR).
  _drawGrabMode(screen) {
    const ctx = screen.c;
    const g = this.grab;
    const pitch = 76;                    // grab-row spacing (RE'd out/rearr/ug2_drag: customize-row centres x=14/89.5/165.5/241.5 -> 76)
    // 1) the row of other icons, scrolled so gap[rowCam] sits at screen centre
    for (let k = 0; k < g.others.length; k++) {
      const x = 128 + (k - g.rowCam + 0.5) * pitch;
      if (x < -pitch || x > 256 + pitch) continue;
      const app = g.others[k];
      const tile = this._tile(app.fillTile);
      if (tile) ctx.drawImage(tile, Math.round(x - tile.width / 2), C.tileTop);
      const sz = app.fillTile ? 48 : C.iconSize;
      const top = app.fillTile ? 90 : C.iconTop;
      this._drawIcon(screen, app, Math.round(x - sz / 2), top, sz);
    }
    // 2) insertion markers in the gaps: a rounded-square outline (double grey ring)
    // with a centre dot, per-pixel from up_done (clean palette-sun gap, y108..119).
    for (let k = 0; k <= g.others.length; k++) {
      const x = Math.round(128 + (k - g.rowCam) * pitch);
      if (x < 12 || x > 244) continue;
      this._drawInsertMarker(ctx, x, C.tileTop + 31);
    }
    // 3) the grabbed tile. While lifting it rises to the top (liftT 0->1) with the
    // down-arrow; while DROPPING it falls 74px back to the row over a 9f ease-in-out
    // bell and the arrow is gone (RE'd grab_drop).
    let tileTop;
    if (g.drop) {
      const CUM = [0, 3, 9, 19, 31, 43, 55, 65, 71, 74]; // cumulative fall, 8->82
      tileTop = 8 + CUM[Math.max(0, Math.min(9, Math.floor(g.drop.t)))];
    } else {
      const ease = g.liftT * g.liftT * (3 - 2 * g.liftT);
      tileTop = Math.round(C.tileTop + (8 - C.tileTop) * ease);
    }
    const tile = this._tile(g.app.fillTile);
    if (tile) ctx.drawImage(tile, Math.round(128 - tile.width / 2), tileTop);
    const sz = g.app.fillTile ? 48 : C.iconSize;
    this._drawIcon(screen, g.app, Math.round(128 - sz / 2), tileTop + (g.app.fillTile ? 8 : 16), sz);
    // 4) the blue down-arrow: it HARD-POPS at full size once the tile settles (not a
    // fade during the lift) and then bobs ~8px p-p on a ~40f sine (RE'd grab_lift).
    if (!g.drop && g.liftT >= 1) {
      const bob = Math.round(4 * Math.sin((g.t || 0) * 2 * Math.PI / 40));
      this._drawGrabArrow(ctx, 127, tileTop + (tile ? tile.height : 66) + bob, 1);
    }
    // 5) scrollbar
    this._drawScrollTrack(screen);
    this._drawScrollbar(screen);
  }

  // a gap insertion marker (rounded-square double-ring outline + centre dot),
  // centred at (cx, cy). Per-pixel greys measured from up_done.
  _drawInsertMarker(ctx, cx, cy) {
    const rows = [
      [-5, [[-6, 227], [-5, 211], [-4, 203], [-3, 203], [-2, 203], [-1, 203], [0, 203], [1, 203], [2, 203], [3, 203], [4, 211], [5, 227]]],
      [-4, [[-6, 211], [-5, 203], [-4, 219], [-3, 219], [-2, 219], [-1, 219], [0, 219], [1, 219], [2, 219], [3, 219], [4, 203], [5, 211]]],
      [-3, [[-6, 203], [-5, 219], [4, 219], [5, 203]]],
      [-2, [[-6, 203], [-5, 219], [4, 219], [5, 203]]],
      [-1, [[-6, 203], [-5, 219], [-1, 227], [0, 227], [4, 219], [5, 203]]],
      [0, [[-6, 203], [-5, 219], [-2, 227], [-1, 186], [0, 186], [1, 227], [4, 219], [5, 203]]],
      [1, [[-6, 203], [-5, 219], [-2, 227], [-1, 186], [0, 186], [1, 227], [4, 219], [5, 203]]],
      [2, [[-6, 203], [-5, 219], [-1, 227], [0, 227], [4, 219], [5, 203]]],
      [3, [[-6, 203], [-5, 219], [4, 219], [5, 203]]],
      [4, [[-6, 203], [-5, 219], [4, 219], [5, 203]]],
      [5, [[-6, 211], [-5, 203], [-4, 219], [-3, 219], [-2, 219], [-1, 219], [0, 219], [1, 219], [2, 219], [3, 219], [4, 203], [5, 211]]],
      [6, [[-6, 227], [-5, 211], [-4, 203], [-3, 203], [-2, 203], [-1, 203], [0, 203], [1, 203], [2, 203], [3, 203], [4, 211], [5, 227]]],
    ];
    for (const [dy, px] of rows) for (const [dx, v] of px) { ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(cx + dx, cy + dy, 1, 1); }
  }

  // the blue down-arrow under the lifted tile: a compact 3D arrowhead (AA edge
  // #3082fb, dark rim #0028ba, blue body), per-pixel from up_done (tip x127 y88).
  _drawGrabArrow(ctx, cx, topY, alpha) {
    const rows = [
      [0, [[-8, '#3082fb'], [-7, '#0028ba'], [-6, '#0028ba'], [-5, '#0059f3'], [-4, '#1871fb'], [-3, '#1871fb'], [-2, '#1871fb'], [-1, '#1871fb'], [0, '#1871fb'], [1, '#1871fb'], [2, '#1871fb'], [3, '#1871fb'], [4, '#1871fb'], [5, '#0059f3'], [6, '#0028ba'], [7, '#0028ba'], [8, '#3082fb']]],
      [1, [[-7, '#3082fb'], [-6, '#0028ba'], [-5, '#0038d3'], [-4, '#1871fb'], [-3, '#1871fb'], [-2, '#1871fb'], [-1, '#1871fb'], [0, '#1871fb'], [1, '#1871fb'], [2, '#1871fb'], [3, '#1871fb'], [4, '#1871fb'], [5, '#0038d3'], [6, '#0028ba'], [7, '#3082fb']]],
      [2, [[-7, '#3082fb'], [-6, '#0028ba'], [-5, '#0028ba'], [-4, '#0059f3'], [-3, '#1871fb'], [-2, '#1871fb'], [-1, '#1871fb'], [0, '#1871fb'], [1, '#1871fb'], [2, '#1871fb'], [3, '#1871fb'], [4, '#0059f3'], [5, '#0028ba'], [6, '#0028ba'], [7, '#3082fb']]],
      [3, [[-6, '#3082fb'], [-5, '#0028ba'], [-4, '#0038d3'], [-3, '#3082fb'], [-2, '#1871fb'], [-1, '#1871fb'], [0, '#1871fb'], [1, '#1871fb'], [2, '#1871fb'], [3, '#3082fb'], [4, '#0038d3'], [5, '#0028ba'], [6, '#3082fb']]],
      [4, [[-6, '#3082fb'], [-5, '#0028ba'], [-4, '#0028ba'], [-3, '#0059f3'], [-2, '#3082fb'], [-1, '#3082fb'], [0, '#3082fb'], [1, '#3082fb'], [2, '#3082fb'], [3, '#0059f3'], [4, '#0028ba'], [5, '#0028ba'], [6, '#3082fb']]],
      [5, [[-5, '#3082fb'], [-4, '#0028ba'], [-3, '#0049e3'], [-2, '#3082fb'], [-1, '#3082fb'], [0, '#3082fb'], [1, '#3082fb'], [2, '#3082fb'], [3, '#0049e3'], [4, '#0028ba'], [5, '#3082fb']]],
      [6, [[-5, '#3082fb'], [-4, '#0028ba'], [-3, '#0038d3'], [-2, '#0059f3'], [-1, '#3082fb'], [0, '#3082fb'], [1, '#3082fb'], [2, '#0059f3'], [3, '#0038d3'], [4, '#0028ba'], [5, '#3082fb']]],
      [7, [[-4, '#3082fb'], [-3, '#0028ba'], [-2, '#0049e3'], [-1, '#3082fb'], [0, '#3082fb'], [1, '#3082fb'], [2, '#0049e3'], [3, '#0028ba'], [4, '#3082fb']]],
      [8, [[-4, '#3082fb'], [-3, '#0028ba'], [-2, '#0038d3'], [-1, '#1871fb'], [0, '#3082fb'], [1, '#1871fb'], [2, '#0038d3'], [3, '#0028ba'], [4, '#3082fb']]],
      [9, [[-3, '#3082fb'], [-2, '#0028ba'], [-1, '#0059f3'], [0, '#3082fb'], [1, '#0059f3'], [2, '#0028ba'], [3, '#3082fb']]],
      [10, [[-3, '#3082fb'], [-2, '#0028ba'], [-1, '#0038d3'], [0, '#0059f3'], [1, '#0038d3'], [2, '#0028ba'], [3, '#3082fb']]],
      [11, [[-2, '#3082fb'], [-1, '#0028ba'], [0, '#0038d3'], [1, '#0028ba'], [2, '#3082fb']]],
      [12, [[-2, '#3082fb'], [-1, '#3082fb'], [0, '#0028ba'], [1, '#3082fb'], [2, '#3082fb']]],
      [13, [[-1, '#3082fb'], [0, '#3082fb'], [1, '#3082fb']]],
      [14, [[0, '#3082fb']]],
    ];
    ctx.save();
    if (alpha < 1) ctx.globalAlpha = Math.max(0, alpha);
    for (const [dy, px] of rows) for (const [dx, c] of px) { ctx.fillStyle = c; ctx.fillRect(cx + dx, topY + dy, 1, 1); }
    ctx.restore();
  }

  // The selection frame is a stationary cursor at screen centre (x=128): during a
  // nav slide the tiles scroll through it while it stays put (RE'd from navR). Only
  // launchable apps show it; it fades in with the boot intro (chrome alpha) and is
  // hidden during a launch (the icon lifts out instead). The frame + selected icon
  // share the same idle bob at rest so they float as one unit.
  _drawCenterChrome(screen, chrome = 1) {
    // the frame holds for the first few launch frames, then the tile lifts out
    if ((this.launching && this.launching.t >= 3) || chrome <= 0) return;
    const ctx = screen.c;
    const app = this.reg.get(this._frameSelected());
    const isGamecard = app && app.type === 'gamecard';
    // the down-tab shows for a launchable app AND for the selected game-card slot; the
    // blue frame + notch + START are launchable-only (measured sel_gamecard: tab, no frame).
    if (!(app && (app.launchable || isGamecard))) return;
    const bob = 0; // the real menu holds the selected item static (see _bobOffset)
    const x = C.centerX;
    if (chrome < 1) ctx.globalAlpha = chrome;
    this._drawTab(ctx, x, bob);
    if (app.launchable) {
      // resting frame is cell_00 (64x80). On a select-landing the blue border does
      // a brief squash (measured navL): it insets a couple px for 3 frames then
      // returns. Only the frame moves; tab, notch and START hold their positions.
      const inset = this._settleInset();
      // favColor-tinted frame (RE'd msk_launcher_D.ncer cell_00/cell_02 rendered
      // through each of the 16 msk_launcher_D_UC0B.NCLR banks, see
      // tools/extract-launcher-selframe-colors.js); fall back to the untinted
      // baked PNGs if a variant failed to load.
      const favName = FAV_NAMES[this.favColor];
      const fr = this.spr('selFramePlain_' + favName) || this.spr('selFrame_' + favName)
        || this.spr('selFramePlain') || this.spr('selFrame');
      if (fr) {
        const top = C.selFrame.top + 2 + bob;
        if (inset > 0) {
          const sm = ctx.imageSmoothingEnabled;
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(fr, Math.round(x - fr.width / 2) + inset, top, fr.width - inset * 2, fr.height - inset);
          ctx.imageSmoothingEnabled = sm;
        } else {
          ctx.drawImage(fr, Math.round(x - fr.width / 2), top);
        }
      }
      this._drawFrameNotch(ctx, bob);
      // the DSi draws START as an opaque 3-level ramp that replaces the frame pixels
      // (RE'd idle.bot, bank 11/blue: L1 105,170,243 / L2 178,211,251 / L3 251,251,251
      // = LAUNCHER_UC0B[11][13..15] exactly), not an alpha blend of white over the
      // live frame gradient. Tinted per favColor from the same row as the frame.
      const favRow = LAUNCHER_UC0B[this.favColor];
      const startLevels = { 1: hexRgb(favRow[13]), 2: hexRgb(favRow[14]), 3: hexRgb(favRow[15]) };
      Fonts.m.drawCenteredLevels(ctx, 'START', x, C.startY + bob, 'startFrame', startLevels);
    } else if (isGamecard) {
      // the game-card slot has no frame, so the down-tab continues as a standalone
      // grey chevron pointing at the empty card (measured sel_gamecard y77..87).
      this._drawGamecardChevron(ctx, x);
    }
    ctx.globalAlpha = 1;
  }

  // Below the tab connector, the selected game-card slot draws a hollow grey
  // chevron arrowhead (no frame behind it). Per-pixel greys measured from
  // sel_gamecard.bot; the outer edges match the frame notch, the point reaches y87.
  _drawGamecardChevron(ctx, x) {
    const off = x - 128;
    const rows = [
      [77, [[120, 178], [121, 81], [122, 162], [123, 211], [131, 211], [132, 162], [133, 81], [134, 178]]],
      [78, [[121, 105], [122, 130], [123, 178], [131, 178], [132, 130], [133, 105]]],
      [79, [[122, 81], [123, 162], [124, 211], [130, 211], [131, 162], [132, 81]]],
      [80, [[122, 105], [123, 130], [124, 178], [127, 170], [130, 178], [131, 130], [132, 105]]],
      [81, [[123, 81], [124, 162], [125, 211], [129, 211], [130, 162], [131, 81]]],
      [82, [[123, 105], [124, 130], [125, 178], [129, 178], [130, 130], [131, 105]]],
      [83, [[124, 81], [125, 162], [126, 195], [128, 195], [129, 162], [130, 81]]],
      [84, [[124, 105], [125, 130], [126, 162], [127, 178], [128, 162], [129, 130], [130, 105]]],
      [85, [[125, 105], [126, 170], [127, 162], [128, 170], [129, 105]]],
      [86, [[125, 105], [126, 130], [127, 170], [128, 130], [129, 105]]],
      [87, [[126, 105], [127, 105], [128, 105]]],
    ];
    for (const [y, px] of rows) for (const [xx, v] of px) { ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(xx + off, y, 1, 1); }
  }

  // the down-tab connects into the selection frame as a grey V-notch cut into the
  // frame's top edge (measured idle.bot). The frame sprite is solid, so the notch is
  // drawn on top of it. Pixel greys x122..132, y80..86, centred on the tab.
  _drawFrameNotch(ctx, bob = 0) {
    const rows = [
      [77, [[120, 178], [121, 81], [122, 162], [123, 211], [131, 211], [132, 162], [133, 81], [134, 178]]],
      [78, [[121, 105], [122, 130], [123, 178], [124, 251], [130, 251], [131, 178], [132, 130], [133, 105]]],
      [79, [[122, 81], [123, 162], [124, 211], [130, 211], [131, 162], [132, 81]]],
      [80, [[122, 105], [123, 130], [124, 178], [125, 251], [126, 235], [127, 170], [128, 235], [129, 251], [130, 178], [131, 130], [132, 105]]],
      [81, [[123, 81], [124, 162], [125, 211], [126, 251], [127, 235], [128, 251], [129, 211], [130, 162], [131, 81]]],
      [82, [[123, 105], [124, 130], [125, 178], [126, 235], [127, 251], [128, 235], [129, 178], [130, 130], [131, 105]]],
      [83, [[124, 81], [125, 162], [126, 195], [127, 235], [128, 195], [129, 162], [130, 81]]],
      [84, [[124, 105], [125, 130], [126, 162], [127, 178], [128, 162], [129, 130], [130, 105]]],
      [85, [[125, 105], [126, 170], [127, 162], [128, 170], [129, 105]]],
      [86, [[125, 105], [126, 130], [127, 170], [128, 130], [129, 105]]],
      [87, [[126, 105], [127, 105], [128, 105]]],
    ];
    for (const [y, px] of rows) for (const [xx, v] of px) { ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(xx, y + bob, 1, 1); }
  }

  // Empty Game-Card slot placeholder ("nothing inserted"): a rounded grey card with
  // a dashed rounded-rect outline, an inner dotted-line frame, and a down-arrow.
  // Drawn as a pixel-exact bake from the real melonDS reference (CARD_ROWS/CARD_PAL,
  // baked from out/sbsweep/sw01.bot.ppm), translated with the slot. The rounded
  // corners are left transparent so the live background field shows through, exactly
  // as the real sprite does (see gamecard_sprite.js).
  _drawEmptyCard(ctx, x, yOff = 0) {
    const cx = Math.round(x), ty = 88 + yOff;
    for (const [ry, runs] of CARD_ROWS) {
      const y = ty + ry;
      for (const [c, len, p] of runs) { ctx.fillStyle = CARD_PAL[p]; ctx.fillRect(cx + c, y, len, 1); }
    }
  }

  // The System Settings channel icon, baked pixel-exact from the melonDS reference
  // (48x48). Blitted nearest-neighbour and translated with the slot. Replaces the old
  // bilinear upscale of the 32px source, which lost the wrench highlight and fringed
  // the edges. cx = icon centre x, top = icon top y.
  _drawSettingsIcon(ctx, cx, top) {
    for (const [ry, runs] of SETICON_ROWS) {
      const y = top + ry;
      for (const [c, len, p] of runs) { ctx.fillStyle = SETICON_PAL[p]; ctx.fillRect(cx + c, y, len, 1); }
    }
  }

  _drawIcon(screen, app, x, y, sz = 32) {
    if (!app) return;
    const ctx = screen.c;
    // System Settings channel: use the pixel-exact 48px bake, not a bilinear upscale.
    if (app.fillTile && app.gamecode === 'HNBE' && sz === 48) {
      this._drawSettingsIcon(ctx, x + sz / 2, y);
      return;
    }
    // a tile-filling channel icon is a 32px TWL icon that the launcher upscales to
    // 48px with smoothing; native icons stay nearest-neighbor.
    ctx.imageSmoothingEnabled = sz !== 32;
    if (app.animImg && app.animFrames > 0) {
      const f = this._animFrame(app);
      ctx.drawImage(app.animImg, f * 32, 0, 32, 32, x, y, sz, sz);
    } else if (app.iconImg) {
      ctx.drawImage(app.iconImg, 0, 0, app.iconImg.width, app.iconImg.height, x, y, sz, sz);
    }
    ctx.imageSmoothingEnabled = false;
  }

  _animFrame(app) {
    // step frames by their durations (60Hz units)
    if (!app._seq) {
      app._seq = [];
      app.frameDurations.forEach((d, i) => { for (let k = 0; k < d; k++) app._seq.push(i); });
      if (!app._seq.length) app._seq = app.frameDurations.map((_, i) => i);
    }
    // deterministic icon phase for verification (removes run-to-run diff noise)
    if (typeof window !== 'undefined' && window.__freezeAnim != null) return app._seq[window.__freezeAnim % app._seq.length] || 0;
    const t = (performance.now() / (1000 / 60)) | 0;
    return app._seq[t % app._seq.length] || 0;
  }

  _drawNameBoxBg(screen) {
    const ctx = screen.c;
    // Measured from the reference (idle.bot): outer rect x3..252 y3..76, corner r5.
    // Border profile from the edge inward: dark line #515151(81), then a 3px bevel
    // ramp #a2a2a2(162) / #c3c3c3(195) / #dbdbdb(219), then the white interior
    // #fbfbfb(251). Drawn as concentric crisp (non-AA) rounded rects, outer first.
    // Concentric filled rounded rects (AA corners, matching the reference's
    // smooth rounded balloon corner) build the beveled border outer-first.
    const rr = (x, y, w, h, r, c) => { roundRect(ctx, x, y, w, h, r); ctx.fillStyle = c; ctx.fill(); };
    rr(3, 3, 250, 74, 6, '#515151');
    rr(4, 4, 248, 72, 5, '#a2a2a2');
    rr(5, 5, 246, 70, 4, '#c3c3c3');
    rr(6, 6, 244, 68, 3, '#dbdbdb');
    rr(7, 7, 242, 66, 2, '#fbfbfb');
    // the top and bottom borders read ~170/178 in their two bevel rows, not the
    // 162/195 of the sides (measured idle.bot away from the corners, x9..246).
    ctx.fillStyle = '#b2b2b2'; ctx.fillRect(9, 4, 238, 1);   // top row 1 (178)
    ctx.fillStyle = '#aaaaaa'; ctx.fillRect(9, 5, 238, 1);   // top row 2 (170)
    ctx.fillStyle = '#aaaaaa'; ctx.fillRect(9, 74, 238, 1);  // bottom row 1 (170)
    ctx.fillStyle = '#b2b2b2'; ctx.fillRect(9, 75, 238, 1);  // bottom row 2 (178)
    // The four rounded corners: canvas arcTo washes the real sprite's sharp dark
    // diagonal ridge into a light smooth arc (38px off). Overpaint the exact
    // reference pixels (idle.bot), like _drawTab/_tile.
    const paintCorner = (rows) => { for (const y in rows) for (const [x, v] of rows[y]) { ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(+x, +y, 1, 1); } };
    paintCorner({ // top-left
      3: [[3, 235], [4, 235], [5, 243], [6, 170], [7, 130], [8, 81]], 4: [[3, 235], [4, 235], [5, 130], [6, 105], [7, 130], [8, 178]],
      5: [[3, 235], [4, 130], [5, 105], [6, 162], [7, 195], [8, 195]], 6: [[3, 170], [4, 105], [5, 162], [6, 195], [7, 195], [8, 195]],
      7: [[3, 130], [4, 105], [5, 195], [6, 195], [7, 195], [8, 235]], 8: [[3, 81], [4, 130], [5, 211], [6, 211], [7, 235], [8, 251]],
      9: [[3, 81], [4, 162], [5, 219], [6, 211], [7, 251], [8, 251]], 10: [[3, 81], [4, 162], [5, 219], [6, 219], [7, 251], [8, 251]],
      11: [[5, 211]] });
    paintCorner({ // top-right
      3: [[247, 81], [248, 130], [249, 170], [250, 243], [251, 235], [252, 235]], 4: [[247, 178], [248, 130], [249, 105], [250, 130], [251, 235], [252, 235]],
      5: [[247, 170], [248, 195], [249, 162], [250, 105], [251, 130], [252, 235]], 6: [[247, 219], [248, 195], [249, 195], [250, 162], [251, 105], [252, 170]],
      7: [[247, 251], [248, 195], [249, 195], [250, 195], [251, 105], [252, 130]], 8: [[247, 251], [248, 235], [249, 211], [250, 211], [251, 130], [252, 81]],
      9: [[247, 251], [248, 251], [249, 211], [250, 219], [251, 162], [252, 81]], 10: [[247, 251], [248, 251], [249, 219], [250, 219], [251, 162], [252, 81]],
      11: [[250, 211]] });
    paintCorner({ // bottom-left
      64: [[5, 178]], 65: [[5, 178]], 66: [[5, 178]], 67: [[5, 178]], 68: [[5, 178]],
      69: [[3, 81], [4, 162], [5, 178], [6, 219], [7, 251], [8, 251]], 70: [[3, 81], [4, 130], [5, 178], [6, 211], [7, 251], [8, 251]],
      71: [[3, 81], [4, 130], [5, 178], [6, 195], [7, 235], [8, 251]], 72: [[3, 130], [4, 105], [5, 178], [6, 170], [7, 219], [8, 235]],
      73: [[3, 170], [4, 105], [5, 162], [6, 178], [7, 170], [8, 195]], 74: [[3, 235], [4, 130], [5, 105], [6, 162], [7, 178], [8, 162]],
      75: [[3, 235], [4, 235], [5, 130], [6, 105], [7, 105], [8, 130]], 76: [[3, 235], [4, 235], [5, 235], [6, 170], [7, 130], [8, 81]],
      77: [[3, 235], [4, 235]] });
    paintCorner({ // bottom-right
      64: [[250, 178]], 65: [[250, 178]], 66: [[250, 178]], 67: [[250, 178]], 68: [[250, 178]],
      69: [[247, 251], [248, 251], [249, 219], [250, 178], [251, 162], [252, 81]], 70: [[247, 251], [248, 251], [249, 211], [250, 178], [251, 130], [252, 81]],
      71: [[247, 251], [248, 235], [249, 195], [250, 178], [251, 130], [252, 81]], 72: [[247, 251], [248, 219], [249, 170], [250, 178], [251, 105], [252, 130]],
      73: [[247, 219], [248, 170], [249, 178], [250, 162], [251, 105], [252, 170]], 74: [[247, 170], [248, 178], [249, 162], [250, 105], [251, 130], [252, 235]],
      75: [[247, 178], [248, 105], [249, 105], [250, 130], [251, 235], [252, 235]], 76: [[247, 81], [248, 130], [249, 170], [250, 235], [251, 235], [252, 235]],
      77: [[251, 235], [252, 235]] });
  }

  _drawTab(ctx, x, dy = 0) {
    // The name box's downward balloon tail: a dark (130) core inside bright (251)
    // bevelled edges, narrowing into the top of the selection frame. Reconstructed
    // pixel-exact from idle.bot (y73..79); the previous flat-grey triangle missed
    // the bright bevel entirely. Below y79 the tail runs under the frame sprite and
    // the grey V is re-cut by _drawFrameNotch / _drawGamecardChevron.
    const off = x - 128;
    const rows = {
      73: [[121, 251], [122, 251], [123, 251], [124, 130], [125, 130], [126, 130], [127, 130], [128, 130], [129, 130], [130, 130], [131, 251], [132, 251], [133, 251]],
      74: [[121, 211], [122, 251], [123, 235], [124, 162], [125, 130], [126, 130], [127, 130], [128, 130], [129, 130], [130, 162], [131, 235], [132, 251], [133, 211]],
      75: [[122, 211], [123, 251], [124, 178], [125, 130], [126, 130], [127, 130], [128, 130], [129, 130], [130, 178], [131, 251], [132, 211]],
      76: [[120, 105], [121, 130], [122, 170], [123, 251], [124, 235], [125, 162], [126, 130], [127, 130], [128, 130], [129, 162], [130, 235], [131, 251], [132, 170], [133, 130], [134, 105]],
      77: [[125, 178], [126, 130], [127, 130], [128, 130], [129, 178]],
      78: [[126, 162], [127, 130], [128, 162]],
      79: [[126, 178], [127, 130], [128, 178]],
    };
    for (const y in rows) for (const [xx, v] of rows[y]) { ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(xx + off, +y + dy, 1, 1); }
  }

  _drawScrollTrack(screen) {
    const ctx = screen.c;
    // grey rail baked into msk_launcher_D_BG01, measured column profile y170..191
    const rail = ['#828282', '#a2a2a2', '#d3d3d3', '#ebebeb', '#ebebeb', '#dbdbdb', '#dbdbdb', '#c3c3c3', '#d3d3d3', '#c3c3c3', '#d3d3d3', '#c3c3c3', '#aaaaaa', '#a2a2a2', '#aaaaaa', '#a2a2a2', '#aaaaaa', '#a2a2a2', '#a2a2a2', '#a2a2a2', '#aaaaaa', '#aaaaaa'];
    for (let i = 0; i < rail.length; i++) { ctx.fillStyle = rail[i]; ctx.fillRect(0, 170 + i, 256, 1); }
  }

  // The "Nintendo DSi Menu" watermark (empty slot / launch / scrub / intro). It is the
  // LARGE title font (TBF1_l, ~20px tall) affine-scaled ~1.5x, faint grey, no balloon
  // (measured empty_slots ref: 217w x 20h, centred, top ~y33). This is the ONE true
  // rendering - every caller must use it so the text never changes size/font between
  // frames (the scrub over empty slots used to flip between this and a small banner-
  // font copy, making the watermark visibly expand and shrink).
  _drawWatermark(ctx, color = '#d3d3d3') {
    const wf = Fonts.l.ready() ? Fonts.l : (Fonts.banner.ready() ? Fonts.banner : Fonts.m);
    if (Fonts.l.ready() && typeof document !== 'undefined') {
      const txt = 'Nintendo DSi Menu', w = wf.measure(txt), h = 21, s = 1.5;
      const tmp = this._wmCanvas || (this._wmCanvas = document.createElement('canvas'));
      // rasterize the glyphs at the render resolution so the 1.5x affine enlargement stays
      // crisp at scale>1 (a native-res buffer upscaled here looked like the bitmap font).
      tmp.width = (w + 2) * RENDER_SCALE; tmp.height = (h + 2) * RENDER_SCALE;
      const tg = tmp.getContext('2d');
      tg.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
      tg.clearRect(0, 0, w + 2, h + 2);
      wf.draw(tg, txt, 0, 0, color);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(tmp, 0, 0, w * RENDER_SCALE, h * RENDER_SCALE, Math.round(128 - w * s / 2), 29, w * s, h * s);
      ctx.imageSmoothingEnabled = false;
      return;
    }
    wf.drawCentered(ctx, 'Nintendo DSi Menu', 128, 34, color);
  }

  // Draws the balloon TEXT for `app`. The empty/watermark state is handled by the
  // cross-fade caller (draw()), so a null app is a no-op here (no watermark).
  _drawNameBox(screen, app = this.reg.get(this._displaySelected())) {
    if (!app) return;
    const ctx = screen.c;
    const banner = Fonts.banner.ready() ? Fonts.banner : Fonts.m;
    const lines = app.type === 'gamecard'
      ? ['There is nothing inserted in', 'the Game Card slot.']
      : (app.lines && app.lines.length ? app.lines : [app.name]);
    const cx = 128, total = lines.length, lh = 18;
    const startY = C.nameBox.y + (C.nameBox.h - total * lh) / 2 + 1;
    lines.forEach((ln, i) => banner.drawCentered(ctx, ln, cx, startY + i * lh, '#414141'));
  }

  _drawScrollbar(screen) {
    const ctx = screen.c;
    const total = this.reg.totalSlots;
    const cam = this.camera;
    const p = LAUNCHER_UC0B[this.favColor];
    // Measured model (idle.bot): slot i sits at track-x = 33 + 5*i, slot 0 is a
    // dark anchor dot at x33. The 29px thumb centres on the current slot, so its
    // left edge = 19 + 5*cam. Dense filled ticks run from the anchor to just past
    // the thumb; the rest are sparse dim ticks. Ticks are greenish-grey and show
    // through the thumb's glossy white window.
    const slotX = (i) => 33 + 5 * i;
    // clamp the thumb inside the track (x19..236) so it never collides with the
    // L/R arrow buttons at the first/last slot
    // clamp so the 29px thumb's right pixel lands on the track end x236 (measured
    // slot-38: the real thumb's left border is x208, not x207)
    const thumbLeft = Math.max(19, Math.min(208, Math.round(19 + 5 * cam)));

    // anchor: a small 3D dark dot at slot 0 (x32..35), bright top edge over a dark
    // centre (measured idle.bot, per pixel).
    const anchor = { 180: [157, 65, 65, 157], 181: [48, 97, 97, 48], 182: [0, 35, 35, 0], 183: [130, 0, 0, 130] };
    for (const y in anchor) anchor[y].forEach((v, i) => { ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(32 + i, +y, 1, 1); });

    // Each slot is one tick. OCCUPIED slots (installed apps + channels) are full
    // 3x4 green SQUARES; FREE/empty slots are small 2x2 DOTS. The square/dot split
    // is fixed at the number of installed items, NOT the thumb (measured out/sweep).
    // Measured occupied tick (idle.bot, per pixel relative to cx): y180 light top,
    // y181 dark edge / light centre / dark edge (#..#), y182-183 dark green. The
    // dark edges are the top of a 3px column so they cannot be lost between the
    // light top and the dark bottom.
    const drawSquare = (cx) => {
      ctx.fillStyle = '#828a82'; ctx.fillRect(cx - 1, 180, 4, 2); // light green top (y180-181, 4px)
      ctx.fillStyle = '#596959';
      ctx.fillRect(cx - 1, 181, 1, 3); // dark left edge, y181-183
      ctx.fillRect(cx + 2, 181, 1, 3); // dark right edge, y181-183
      ctx.fillRect(cx, 182, 2, 2);     // dark green bottom centre (y182-183)
    };
    const drawDot = (cx) => {
      ctx.fillStyle = '#828a82'; ctx.fillRect(cx, 181, 2, 2);     // small light-green dot (y181-182)
      ctx.fillStyle = '#a2a2a2'; ctx.fillRect(cx, 183, 2, 1);     // faint foot (y183)
    };
    // the first tick next to the anchor is a flat uniform grey (measured ref 130),
    // not a beveled square like the rest.
    for (let i = 1; i < total; i++) {
      const cx = slotX(i);
      if (cx > 236) break;
      if (i === 1) { ctx.fillStyle = 'rgb(130,130,130)'; ctx.fillRect(cx - 1, 179, 4, 6); }   // flat grey, y179..184 (measured)
      else if (this.reg.get(i)) drawSquare(cx); else drawDot(cx);
    }

    // usercolor arrow buttons at the edges (blue = favourite colour)
    this._scrollArrowBtn(ctx, 0, -1);
    this._scrollArrowBtn(ctx, 237, 1);

    // thumb window: blue frame + glossy white interior, ticks showing through
    const w = 29;
    // blue frame: the border follows the same 21-row vertical gradient as the arrow
    // buttons (measured idle.bot: the thumb side border at x105 matches that ramp),
    // then the white window is punched into the middle.
    const tg = [p[9], p[10], p[11], p[10], p[9], p[8], p[8],
      p[7], p[7], p[7], p[6], p[4], p[4], p[4], p[4],
      p[4], p[5], p[5], p[6], p[7], p[8]];
    // interior window rect (used by the ticks-through-window loop for BOTH scale paths)
    const ix = thumbLeft + 4, iw = w - 8;
    if (RENDER_SCALE > 1) {
      this._drawThumbVec(ctx, thumbLeft, w, tg);
    } else {
    for (let i = 0; i < tg.length; i++) { ctx.fillStyle = tg[i]; ctx.fillRect(thumbLeft, 171 + i, w, 1); }
    // the two outer edge columns are a dark blue rim, not the bright top of the
    // gradient - but NOT flat either (a tight per-pixel re-check of assets/reference/
    // idle.bot.png at x104/x132, every row 171..191, found a real p6 highlight band
    // at rows 173-178 sandwiched inside the mostly-p5 rim: p5,p5, p6*6, p5*12, p6).
    // A single-sample measurement had missed this band and painted the whole column
    // flat p5, off by up to 16 levels on those 6 rows.
    const rimCol = { 171: p[5], 172: p[5], 173: p[6], 174: p[6], 175: p[6],
      176: p[6], 177: p[6], 178: p[6], 179: p[5], 180: p[5], 181: p[5], 182: p[5],
      183: p[5], 184: p[5], 185: p[5], 186: p[5], 187: p[5], 188: p[5], 189: p[5], 190: p[5] };
    for (let y = 171; y <= 190; y++) {
      ctx.fillStyle = rimCol[y]; ctx.fillRect(thumbLeft, y, 1, 1); ctx.fillRect(thumbLeft + w - 1, y, 1, 1);
    }
    // glossy interior (x+4..x+24) - filled CONTINUOUSLY (measured idle.bot x118):
    // white through the tick rows so the gaps between ticks are white, not blue.
    if (this.thumbHeld) {
      // PRESSED state (RE'd scrollbar_thumb_drag f6..f16): the glossy white window
      // fills with a light-blue vertical gradient but stays TRANSPARENT - the track
      // ticks still show through it (measured f7: the green ticks keep their idle value
      // while only the white GAPS turn blue). So only the interior fill changes here;
      // the shared tick loop below still draws over it. This 19-row fill is only
      // measured against the blue capture (no real second-favColor melonDS capture
      // of the pressed/dragging thumb exists yet - that needs a scripted touch-drag,
      // not just setfavcolor) and is NOT a clean multiple of any single LAUNCHER_UC0B
      // index, so it stays hardcoded to blue rather than guessed for other colours;
      // the pressed-state favColor RE is deferred.
      const pf = {
        172: '195,219,251', 173: '195,219,251', 174: '211,227,251', 175: '211,227,251',
        176: '219,227,251', 177: '219,227,251', 178: '219,227,251', 179: '219,227,251',
        180: '219,227,251', 181: '219,227,251', 182: '219,227,251', 183: '211,227,251',
        184: '211,227,251', 185: '195,219,251', 186: '186,211,251', 187: '186,211,251',
        188: '178,211,251', 189: '178,211,251', 190: '186,211,251',
      };
      for (const y in pf) { ctx.fillStyle = `rgb(${pf[y]})`; ctx.fillRect(ix, +y, iw, 1); }
      // the interior edge columns keep the blue top/bottom curve (mirror of idle)
      ctx.fillStyle = p[11]; ctx.fillRect(ix, 172, 1, 1); ctx.fillRect(ix + iw - 1, 172, 1, 1);
      ctx.fillStyle = p[9]; ctx.fillRect(ix, 190, 1, 1); ctx.fillRect(ix + iw - 1, 190, 1, 1);
      ctx.fillStyle = p[8]; ctx.fillRect(thumbLeft, 191, w, 1);
      ctx.fillStyle = p[6]; ctx.fillRect(thumbLeft, 191, 1, 1); ctx.fillRect(thumbLeft + w - 1, 191, 1, 1);
    } else {
      ctx.fillStyle = '#e3e3e3'; ctx.fillRect(ix, 172, iw, 1);
      // the frame curves in at the TOP too: y172 interior edge columns are blue
      // (measured ref x108/x128 = 121,203,251), mirror of the y190 bottom curve.
      ctx.fillStyle = p[11]; ctx.fillRect(ix, 172, 1, 1); ctx.fillRect(ix + iw - 1, 172, 1, 1);
      ctx.fillStyle = '#f3f3f3'; ctx.fillRect(ix, 173, iw, 2);
      ctx.fillStyle = '#fbfbfb'; ctx.fillRect(ix, 175, iw, 9);   // y175..183 solid white
      ctx.fillStyle = '#e3e3e3'; ctx.fillRect(ix, 184, iw, 1);
      ctx.fillStyle = '#dbdbdb'; ctx.fillRect(ix, 185, iw, 2);
      ctx.fillStyle = '#d3d3d3'; ctx.fillRect(ix, 187, iw, 2);
      ctx.fillStyle = '#dbdbdb'; ctx.fillRect(ix, 189, iw, 2);   // interior runs to y190
      // the frame curves in at the bottom: on y190 the two interior edge columns turn
      // blue (measured ref x108/x128 = 73,154,251), then y191 is the bright bottom rim
      // (48,130,251) with darker rounded corners (ref x104/x132 = 0,89,243).
      ctx.fillStyle = p[9]; ctx.fillRect(ix, 190, 1, 1); ctx.fillRect(ix + iw - 1, 190, 1, 1);
      ctx.fillStyle = p[8]; ctx.fillRect(thumbLeft, 191, w, 1);
      ctx.fillStyle = p[6]; ctx.fillRect(thumbLeft, 191, 1, 1); ctx.fillRect(thumbLeft + w - 1, 191, 1, 1);
    }
    }
    // ticks showing through the window (squares/dots). Both states keep them visible -
    // the pressed pill is transparent, so the track ticks remain (measured f7). Clip to
    // the interior so a tick straddling the blue frame shows only its in-window part:
    // measured idle.bot, the left tick stops flush at the frame (x108, not x107) and
    // the right tick shows just its left 2px (x127-128) before the frame. The old
    // "whole tick must fit" test dropped the right tick and let the left tick paint
    // over the frame rim.
    ctx.save();
    ctx.beginPath(); ctx.rect(ix, 179, iw, 6); ctx.clip();   // y179..184 so the flat first tick shows fully
    // the slot-0 anchor dot and the flat first tick show THROUGH the glossy window
    // when the thumb sits at the far left (measured idle sw00), not painted over.
    const anc = { 180: [157, 65, 65, 157], 181: [48, 97, 97, 48], 182: [0, 35, 35, 0], 183: [130, 0, 0, 130] };
    for (const y in anc) anc[y].forEach((v, i) => { ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(32 + i, +y, 1, 1); });
    for (let i = 1; i < total; i++) {
      const cx = slotX(i);
      if (cx + 2 < ix || cx - 1 > ix + iw - 1) continue;   // body fully outside the window
      if (i === 1) { ctx.fillStyle = 'rgb(130,130,130)'; ctx.fillRect(cx - 1, 179, 4, 6); }   // flat grey first tick
      else if (this.reg.get(i)) {
        ctx.fillStyle = '#828a82'; ctx.fillRect(cx - 1, 180, 4, 2);
        ctx.fillStyle = '#596959';
        ctx.fillRect(cx - 1, 181, 1, 3); ctx.fillRect(cx + 2, 181, 1, 3);
        ctx.fillRect(cx, 182, 2, 2);
      } else { ctx.fillStyle = '#828a82'; ctx.fillRect(cx, 181, 2, 2); }
    }
    ctx.restore();
  }

  // favourite-colour accent used by the scrollbar thumb + arrows (reference = blue),
  // read from the live LAUNCHER_UC0B bank for this.favColor.
  _accent() {
    const p = LAUNCHER_UC0B[this.favColor];
    return { light: p[9], dark: p[8], border: p[6], borderDk: p[5] };
  }

  // a usercolor arrow button (x..x+18, y171..191) with a white directional
  // triangle. The glossy blue vertical gradient is measured from idle.bot: a
  // specular highlight near the top (y171..175), mid body, a dark lower half,
  // and a bottom rim light. Pressed = shifted one step darker.
  // Smooth vector arrow button for scale>1: the same 19x21 favColour pill and embossed
  // chevron as the per-pixel version, but the body is a rounded rect with the real 21-stop
  // vertical gradient and the chevron is a clean triangle (white top face + accent-blue
  // shadow face). Geometry taken from the measured per-pixel model below, not eyeballed.
  _scrollArrowBtnVec(ctx, x, dir) {
    const p = LAUNCHER_UC0B[this.favColor];
    const grad = [p[9], p[10], p[11], p[10], p[9], p[8], p[8], p[7], p[7], p[7], p[6], p[4], p[4], p[4], p[4], p[4], p[5], p[5], p[6], p[7], p[8]];
    const pressed = this.pressedArrow === dir;
    const g = ctx.createLinearGradient(0, 171, 0, 192);
    for (let i = 0; i < grad.length; i++) g.addColorStop(i / (grad.length - 1), pressed ? grad[grad.length - 1 - i] : grad[i]);
    // rounded pill body (outer corners rounder than the track-facing inner edge)
    const ro = 3, ri = 1.5;
    ctx.beginPath();
    if (dir < 0) { this._rrPath(ctx, x, 171, 19, 21, [ro, ri, ri, ro]); }
    else { this._rrPath(ctx, x, 171, 19, 21, [ri, ro, ro, ri]); }
    ctx.fillStyle = g; ctx.fill();
    // grey outer rim (measured 105) as a hairline on the rounded corners
    ctx.strokeStyle = 'rgb(105,105,105)'; ctx.lineWidth = 0.6; ctx.stroke();
    // embossed chevron: base = vertical edge, tip toward the scroll direction; white upper
    // face over an accent-blue lower face (p[12]); measured span dy6..14 (y177..185), dx5..15
    const baseX = dir < 0 ? x + 14 : x + 5, tipX = dir < 0 ? x + 4 : x + 15;
    const midY = 181;
    ctx.fillStyle = p[15];                                   // shared white top-lit face
    ctx.beginPath(); ctx.moveTo(baseX, 177); ctx.lineTo(baseX, midY); ctx.lineTo(tipX, midY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = p[12];                                   // accent shadow face
    ctx.beginPath(); ctx.moveTo(baseX, midY); ctx.lineTo(baseX, 185); ctx.lineTo(tipX, midY); ctx.closePath(); ctx.fill();
  }

  // Smooth vector scrollbar thumb for scale>1: rounded blue favColour-gradient pill with an
  // inset glossy interior window (white at rest, light-blue when held). Same 21-stop border
  // gradient and interior band colours as the measured per-pixel model. The ticks-through-
  // window loop still runs after this (unchanged), so the anchor/first tick show through.
  _drawThumbVec(ctx, thumbLeft, w, tg) {
    const g = ctx.createLinearGradient(0, 171, 0, 192);
    for (let i = 0; i < tg.length; i++) g.addColorStop(i / (tg.length - 1), tg[i]);
    ctx.beginPath(); this._rrPath(ctx, thumbLeft, 171, w, 21, 3);
    ctx.fillStyle = g; ctx.fill();
    const ix = thumbLeft + 4, iw = w - 8, iy = 172, ih = 19;
    ctx.beginPath(); this._rrPath(ctx, ix, iy, iw, ih, 2);
    const gi = ctx.createLinearGradient(0, iy, 0, iy + ih);
    if (this.thumbHeld) {
      gi.addColorStop(0, 'rgb(195,219,251)'); gi.addColorStop(0.5, 'rgb(219,227,251)'); gi.addColorStop(1, 'rgb(178,211,251)');
    } else {
      // measured interior bands: e3 top -> f3 -> solid fb white -> e3 -> db/d3 foot
      gi.addColorStop(0, '#e3e3e3'); gi.addColorStop(0.12, '#f3f3f3'); gi.addColorStop(0.3, '#fbfbfb');
      gi.addColorStop(0.68, '#fbfbfb'); gi.addColorStop(0.78, '#e3e3e3'); gi.addColorStop(0.9, '#d3d3d3'); gi.addColorStop(1, '#dbdbdb');
    }
    ctx.fillStyle = gi; ctx.fill();
  }

  // rounded-rect path with optional per-corner radii [tl,tr,br,bl]
  _rrPath(ctx, x, y, w, h, r) {
    const [tl, tr, br, bl] = Array.isArray(r) ? r : [r, r, r, r];
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y); ctx.arcTo(x + w, y, x + w, y + tr, tr);
    ctx.lineTo(x + w, y + h - br); ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
    ctx.lineTo(x + bl, y + h); ctx.arcTo(x, y + h, x, y + h - bl, bl);
    ctx.lineTo(x, y + tl); ctx.arcTo(x, y, x + tl, y, tl);
    ctx.closePath();
  }

  _scrollArrowBtn(ctx, x, dir) {
    if (RENDER_SCALE > 1) { this._scrollArrowBtnVec(ctx, x, dir); return; }
    const p = LAUNCHER_UC0B[this.favColor];
    const grad = [p[9], p[10], p[11], p[10], p[9], p[8], p[8],
      p[7], p[7], p[7], p[6], p[4], p[4], p[4], p[4],
      p[4], p[5], p[5], p[6], p[7], p[8]];
    const pressed = this.pressedArrow === dir;
    for (let i = 0; i < grad.length; i++) {
      // press feedback: the vertical gradient FLIPS (dark end lifts to bright),
      // net-brighter, not darker (RE'd out/wfa/arrow_R_tap: region mean 141->167).
      const c = pressed ? grad[grad.length - 1 - i] : grad[i];
      ctx.fillStyle = c; ctx.fillRect(x, 171 + i, 19, 1);
    }
    // grey rounded outer corners (measured ref: 105 at the outer edge top/bottom)
    const oc = dir < 0 ? x : x + 18;       // outer edge column
    ctx.fillStyle = 'rgb(105,105,105)';
    ctx.fillRect(oc, 171, 1, 2); ctx.fillRect(oc, 190, 1, 2);
    ctx.fillRect(dir < 0 ? x + 1 : x + 17, 171, 1, 1);
    ctx.fillRect(dir < 0 ? x + 1 : x + 17, 191, 1, 1);
    // inner edge (toward the track) carries a lighter blue rim (measured ref x18)
    const ie = dir < 0 ? x + 18 : x;
    if (!pressed) { ctx.fillStyle = p[7]; ctx.fillRect(ie, 176, 1, 2); ctx.fillStyle = p[6]; ctx.fillRect(ie, 178, 1, 12); }
    // outer edge specular rim: the glossy pill catches light down its outer 2px so
    // the flat horizontal gradient is wrong there. Per-pixel from idle.bot (x0/x1,
    // identical and mirrored for both arrows); only at rest.
    if (!pressed) {
      const rimA = { 173: p[8], 174: p[8], 175: p[8], 176: p[8], 177: p[8], 178: p[7], 179: p[7], 180: p[7], 181: p[6], 182: p[5], 183: p[5], 184: p[5], 185: p[5], 186: p[5], 187: p[7], 188: p[7], 189: p[7] };
      const rimB = { 172: p[8], 173: p[9], 174: p[10], 175: p[10], 176: p[9], 177: p[9], 178: p[8], 179: p[8], 180: p[8], 181: p[7], 182: p[7], 183: p[6], 184: p[6], 185: p[5], 186: p[5], 187: p[5], 188: p[7], 189: p[7], 190: p[6] };
      const colB = dir < 0 ? x + 1 : x + 17;
      for (const yy in rimA) { ctx.fillStyle = rimA[yy]; ctx.fillRect(oc, +yy, 1, 1); }
      for (const yy in rimB) { ctx.fillStyle = rimB[yy]; ctx.fillRect(colB, +yy, 1, 1); }
      // third outer column carries the specular peak (measured x2/x253, y172..176)
      const rimC = { 172: p[9], 173: p[10], 174: p[11], 175: p[10], 176: p[9] };
      const colC = dir < 0 ? x + 2 : x + 16;
      for (const yy in rimC) { ctx.fillStyle = rimC[yy]; ctx.fillRect(colC, +yy, 1, 1); }
      // inner edge (toward track) specular top + bottom corner (measured x18/x237)
      const ieTop = { 172: p[9], 173: p[9], 174: p[9], 175: p[8] };
      for (const yy in ieTop) { ctx.fillStyle = ieTop[yy]; ctx.fillRect(ie, +yy, 1, 1); }
      const colIE2 = dir < 0 ? x + 17 : x + 1;
      ctx.fillStyle = p[10]; ctx.fillRect(colIE2, 173, 1, 1);
      ctx.fillStyle = p[7]; ctx.fillRect(ie, 191, 1, 1); ctx.fillRect(colIE2, 191, 1, 1);   // inner bottom corner
    }
    // the directional arrowhead is a 3D EMBOSS, not a flat white triangle: a white
    // top-lit face (y177..181) over a light-blue shadowed face (y182..185), with a
    // #79cbfb AA edge, tip toward the scroll direction. Per-pixel from idle.bot
    // (right arrow); the left arrow is the horizontal mirror. W (idx15) is the one
    // constant white shared by every favColor bank; B/E (idx12/idx11) are the same
    // accent family as the rest of the pill, so they retint with favColor too.
    const W = p[15], B = p[12], E = p[11];
    // shadow-face rows (12..14) carry one more diagonal AA pixel past E, in the
    // accent family's p[5] (measured idle.bot right arrow x244-250,y182-185;
    // clone was falling through to the flat gradient's p[4] there instead).
    const tri = [
      [6, [[5, W], [6, E]]],
      [7, [[5, W], [6, W], [7, W], [8, E]]],
      [8, [[5, W], [6, W], [7, W], [8, W], [9, W], [10, E]]],
      [9, [[5, W], [6, W], [7, W], [8, W], [9, W], [10, W], [11, W], [12, E]]],
      [10, [[5, W], [6, W], [7, W], [8, W], [9, W], [10, W], [11, W], [12, W], [13, W], [14, E]]],
      [11, [[5, B], [6, B], [7, B], [8, B], [9, B], [10, B], [11, B], [12, E], [13, p[5]]]],
      [12, [[5, B], [6, B], [7, B], [8, B], [9, B], [10, E], [11, p[5]]]],
      [13, [[5, B], [6, B], [7, B], [8, E], [9, p[5]]]],
      [14, [[5, B], [6, E], [7, p[5]]]],
    ];
    for (const [dy, cells] of tri) for (const [dx, c] of cells) {
      const px = dir < 0 ? x + (18 - dx) : x + dx;   // mirror for the left arrow
      ctx.fillStyle = c; ctx.fillRect(px, 171 + dy, 1, 1);
    }
  }

  // Game launch (RE'd out/anim/launch + NANR seq02). A few frames after the A press
  // the selected tile (white card + icon) lifts STRAIGHT UP at a constant 5px/frame
  // with NO scaling and flies off the top; a sparkle ring of blue dots (cells 53..88,
  // one per frame) plays at the FIXED launch origin (128,114) while the tile passes
  // through it. The scene wash to white is applied in draw() over everything.
  _drawLaunch(screen) {
    const ctx = screen.c;
    const f = this.launching.t;            // frames since launch (60 fps)
    const START = 3;                       // effect begins ~3f after the A press
    if (f < START) return;
    const app = this.launching.app;
    const x = C.centerX;
    // sparkle ring at the fixed origin: the 128x144 cell has its origin baked at
    // (64,72), so drawing it at (x-64, 114-72) lands the ring centre at (128,114).
    const rf = f - START;
    if (rf <= 35) {
      const ring = Assets.img('ring_' + (53 + rf));
      if (ring) ctx.drawImage(ring, Math.round(x - 64), 114 - 72);
    }
    // the lifting tile card + icon, rising at a constant 5px/frame from rest
    const rise = rf * 5;
    if (rise < 210) {
      const tileSpr = this._tile();
      if (tileSpr) ctx.drawImage(tileSpr, Math.round(x - tileSpr.width / 2), C.tileTop - rise);
      if (app) {
        const sz = app.fillTile ? 48 : C.iconSize;
        const top = (app.fillTile ? 90 : C.iconTop) - rise;
        this._drawIcon(screen, app, Math.round(x - sz / 2), top, sz);
      }
    }
  }
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

// crisp (pixel-aligned, no anti-aliasing) rounded-rect helpers
function cornerInset(r) {
  // quarter-circle horizontal inset per row from the corner; monotonic, step<=1
  const ins = new Array(r).fill(0);
  for (let k = 0; k <= r; k++) {
    // row at which inset becomes k
    const row = Math.round(r - Math.sqrt(Math.max(0, r * r - (r - k) * (r - k))));
    for (let i = row; i < r; i++) if (ins[i] < k) ins[i] = k;
  }
  // invert: ins[i] currently grows toward center; we want inset large at row0
  const out = [];
  for (let i = 0; i < r; i++) out.push(ins[r - 1 - i]);
  return out;
}
function crispRoundFill(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  const ins = cornerInset(r);
  for (let row = 0; row < h; row++) {
    let inset = 0;
    if (row < r) inset = ins[row];
    else if (row >= h - r) inset = ins[h - 1 - row];
    ctx.fillRect(x + inset, y + row, w - inset * 2, 1);
  }
}
function crispRoundStroke(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  const ins = cornerInset(r);
  for (let row = 0; row < h; row++) {
    let inset = 0;
    if (row < r) inset = ins[row]; else if (row >= h - r) inset = ins[h - 1 - row];
    if (row === 0 || row === h - 1 || row < r || row >= h - r) {
      // top/bottom caps and corner rows: draw the run minus nothing
      if (row === 0 || row === h - 1) ctx.fillRect(x + inset, y + row, w - inset * 2, 1);
      else { ctx.fillRect(x + inset, y + row, 1, 1); ctx.fillRect(x + w - inset - 1, y + row, 1, 1); }
    } else {
      ctx.fillRect(x, y + row, 1, 1); ctx.fillRect(x + w - 1, y + row, 1, 1);
    }
  }
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
