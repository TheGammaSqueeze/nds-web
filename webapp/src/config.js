// Geometry + timing constants, measured from real-hardware/emulator reference frames.
// All coordinates are in native DS pixels (256x192 per screen), 60 fps timeline.

export const FPS = 60;

// ---- Bottom screen (launcher carousel) ----
export const CAROUSEL = {
  centerX: 128,        // selected slot horizontal center
  pitch: 65,           // center-to-center distance between adjacent (near-centre) slots
  // carousel horizontal spacing, decoded from msk_launcher_D.bncl (JNCL): the
  // slots sit at x = [-53, 5, 63, 128, 193, 251, 309] (offsets -3..+3). It is NOT
  // a sine cylinder: the gap from the centre to its neighbour is 65px, and EVERY
  // gap after that is 58px. So offset(n) = 65 + (n-1)*58. Fractional (scrolling)
  // offsets interpolate linearly between the integer anchors.
  firstGap: 65, gap: 58,
  iconSize: 32,        // app icon native size
  tileTop: 82,         // y to draw the 64x64 tile sprite (border lands at y89, matching the reference)
  iconTop: 98,         // y to draw the 32x32 icon (top-left)
  tabTop: 63,          // y to draw the down-tab pointer sprite
  startY: 141,        // START caps at y145..153 (below icon window), measured idle.bot
  selFrame: { top: 79 },               // selected blue frame draw-top
  nameBox: { x: 3, y: 3, w: 250, h: 73 },
  scrollbar: { y: 170, h: 22, trackX0: 19, trackX1: 236, arrowW: 19, thumbW: 29, slotStep: 5 },
};

// ---- Top screen ----
export const TOPBAR = { h: 18 };

// ---- Boot timeline (frames from power-on) ----
export const BOOT = {
  blackEnd: 22,        // 0..22  black
  whiteEnd: 92,        // 22..92 white hold
  logoStart: 92,       // 92..~205 logo + H&S animate in (replayed frames)
  logoFrames: 119,     // number of exported top-logo frames (top_000..118)
  logoEnd: 211,
  chimeAt: 1.94,       // boot chime start, seconds (audio)
  touchPromptAt: 180,  // frame the pulsing "Touch the Touch Screen" prompt starts. Measured by
                        // sampling out/boot/f_*.bot.ppm text bbox (x26-230,y168-177) per frame:
                        // flat/static through f91-179, first oscillation sample at f180, and f180
                        // is the min-ink (brightest) phase repeating exactly every 60f (f180/240/
                        // 300/360/420 all read 252.74). Anchor grid-search over f170-200 against
                        // the measured pulse-fraction curve gives a clean minimum at f180 (RMSE
                        // 0.034) vs the old f195 (RMSE 0.404, ~15f/quarter-period out of phase).
  touchPulsePeriod: 60,// pulse cycle: continuous 30f-in / 30f-out linear triangle, no off-dwell (RE'd out/wfa/boot_touch_prompt)
};

// ---- Animation timings (frames) ----
export const ANIM = {
  // Carousel slide: RE'd from MainRAM. The launcher holds a scroll accumulator at
  // 0x0af3c4c that steps a FIXED 7 px per frame in a 58-px-per-slot space toward
  // the target, then clamps. Per-frame trace of one slot move (nav_capture):
  //   scroll rel = 0, -7, -14, -21, -28, -35, -42, -49, -57, -57, -58
  // That is pure LINEAR motion (not ease-out), ~8.3 frames per slot. slideStepPx
  // is the fixed velocity; slideSlotUnit is the scroll units per slot.
  slideStepPx: 7,
  slideSlotUnit: 58,
  navSlide: 9,         // legacy, kept for reference (58/7 ~= 8.3 real frames)
  launchTotal: 96,     // launch zoom/arc to fade
  // select-landing squash of the blue selection frame. Measured from a real LEFT
  // step (out/idle navL): on the frame the item settles, the blue border shrinks
  // over 3 frames (2px inset at the peak) then returns. Played as a 1,2,1 triangle.
  settlePulseFrames: 3,
  settlePulseInset: [1, 2, 1],
  // held LEFT/RIGHT auto-repeat (RE'd out/wfa/nav_hold_*): one slot immediately,
  // a longer arming gap to the second slot (~15f), then a flat 9f/slot cadence.
  navRepeatDelay: 15,
  navRepeatCadence: 9,
};

// favorite color -> accent (filled in from decoded usercolor.json; blue default)
export const DEFAULT_FAVCOLOR = 9; // blue
