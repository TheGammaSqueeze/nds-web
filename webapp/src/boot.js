// Boot sequence: black -> white -> NINTENDO DSi logo animation + Health & Safety
// -> wait for touch -> menu-enter transition.
// Logo renders from the real `logodemo` NCER+NANR assets when available;
// otherwise falls back to exported reference frames (TEMP, marked for replacement).
import { Assets } from './assets.js';
import { BOOT, FPS } from './config.js';
import { RENDER_SCALE } from './screen.js';

// Boot H&S text, rendered at scale>1 with DSFW, the real DSi firmware typeface (TBF1_m) traced
// from the NFTR glyphs into a TTF (tools/buildttf.mjs), so the letterforms match the original,
// not a lookalike. Each line is scaled independently in x (to its original ink width w) and y
// (to its cap-height) to match the original's exact box, and thinned a touch with edge erosion.
// The warning triangle is a matched traced graphic (hs_triangle.json). scale=1 stays the bitmap.
// w = original ink width px, cap = original cap-height px, base = baseline y, cx = centre (title
// is block-centred), ek = per-line erosion override. All measured from the real capture.
const HS_BG = 'rgb(251,251,251)';
// The real boot H&S text is a thin Helvetica-family geometric sans. Rendering it with the
// system Helvetica/Arial (crisp real-font hinting at any scale) is far clearer than tracing the
// 8px firmware glyphs (which came out wavy). The _line fit + edge-erosion match its box/weight.
const HS_FONT = "'Helvetica', 'Arial', 'Nimbus Sans', sans-serif";
const C_BLACK = '#000', C_BLUE = 'rgb(48,162,195)', C_GRAY = 'rgb(90,90,90)';
const BOOT_LINES = [
  { t: 'WARNING – HEALTH AND SAFETY', base: 28.3, w: 211, cap: 10, color: C_BLACK, bold: true, ek: 0.01 },
  { t: 'BEFORE PLAYING, READ THE HEALTH', cx: 128, base: 54.4, w: 206, cap: 8, color: C_BLACK },
  { t: 'AND SAFETY PRECAUTIONS BOOKLET', cx: 128, base: 73.4, w: 205, cap: 8, color: C_BLACK },
  { t: 'FOR IMPORTANT INFORMATION', cx: 126, base: 92.5, w: 180, cap: 8, color: C_BLACK },
  { t: 'ABOUT YOUR HEALTH AND SAFETY.', cx: 128, base: 111.5, w: 207, cap: 8, color: C_BLACK },
  { t: 'TO GET AN EXTRA COPY FOR YOUR REGION, GO ONLINE AT', cx: 128, base: 136.6, w: 234, cap: 6, color: C_BLACK },
  { t: 'www.nintendo.com/healthsafety/', cx: 128, base: 152.8, w: 196, cap: 8, color: C_BLUE, ek: 0.075 },
];
const BOOT_PROMPT = { t: 'Touch the Touch Screen to continue.', cx: 128, base: 176.8, w: 205, cap: 8, color: C_GRAY };

// Boot logo animation replay data: logo_anim.json holds one fitted state per real frame
// (tools/logo_fit.mjs + logo_smooth.mjs - per-frame optimization against the real captures,
// Chromium-canvas in the loop, mean abs gray diff 4.55 vs a 4.9 static-logo AA floor).
// Per frame: wma[9] per-letter wordmark alphas (the measured left-to-right wipe), i / tm /
// blk fade alphas, and s = every screen instance [cx, cy, w, op] including the duplicate
// screens that slide in and fade out. Geometry constants shared with the fit tools:
const LOGO_S = 0.357, LOGO_OX = 20.29, LOGO_OY = 59.29;   // logo(600x97) -> top screen
const LOGO_SCX = 135.0, LOGO_SCY = 86.7, LOGO_SW = 15.5;  // settled lower-screen pose

// The boot Health & Safety screen is a baked bitmap in the firmware. At native scale=1 we
// keep drawing the exact captured bitmap (byte-identical to melonDS, invariant intact). At
// ?scale=N>1 the upscaled bitmap would only get blockier, so the text is redrawn with the
// DSFW firmware TTF and the triangle with a matched traced graphic.

export class BootSequence {
  constructor(audio) {
    this.audio = audio;
    this.frame = 0;
    this.done = false;
    this.phase = 'boot';       // boot -> wait -> entering -> done
    this.chimePlayed = false;
    this.enterStart = 0;
    this.logoFrames = [];      // fallback captured frames
    for (let i = 0; i < BOOT.logoFrames; i++) {
      const im = Assets.img('boot_top_' + i);
      if (im) this.logoFrames.push(im);
    }
    this._tri = null;                        // cached warning-triangle Path2D layers
  }

  // called when user touches/presses during the wait phase
  proceed() {
    if (this.phase !== 'wait') return;
    this.audio && this.audio.play('touch');
    this.phase = 'entering';
    this.enterStart = this.frame;
    this.audio && this.audio.play('enter');
  }

  update(dt) {
    this.frame += dt * FPS;
    if (this.phase === 'boot') {
      if (!this.chimePlayed && this.frame / FPS >= BOOT.chimeAt) { this.audio && this.audio.playBootChime(); this.chimePlayed = true; }
      // input is accepted when the "Touch the Touch Screen" prompt appears
      // (f180, measured out/boot text-region brightness curve) - matching
      // the real console, not sooner.
      if (this.frame >= BOOT.touchPromptAt) this.phase = 'wait';
    } else if (this.phase === 'entering') {
      // white cross-fade: fade to white ~30f, hold white ~31f, then hand to the
      // menu which fades in over ~21f (RE'd out/wfa/carousel_entrance: 2D grid
      // search of the hand-off frame + fade-in decay against the real capture,
      // AE-minimized at handoff=61 decay=21, tools/_sweep4.mjs).
      if (this.frame - this.enterStart > 61) { this.phase = 'done'; this.done = true; }
    }
  }

  draw(topScreen, bottomScreen) {
    const f = this.frame;
    // TOP: black -> white -> logo
    if (f < BOOT.blackEnd) topScreen.clear('#000');
    else if (f < BOOT.whiteEnd) topScreen.clear('#fff');
    else this._drawLogo(topScreen, f);

    // BOTTOM: black -> white -> health & safety
    if (f < BOOT.blackEnd) bottomScreen.clear('#000');
    else if (f < BOOT.whiteEnd) bottomScreen.clear('#fff');
    else this._drawHealth(bottomScreen, f);

    // white cross-fade cover: also draw it on the final 'done' frame. The phase
    // flips 'entering' -> 'done' on the completion frame, and without covering it
    // here the bare Health & Safety screen shows for one frame before main.js hands
    // off to the menu's white fade (a visible flash between scenes).
    if (this.phase === 'entering' || this.phase === 'done') {
      const t = (this.frame - this.enterStart) / 30;
      const a = Math.min(1, t);
      [topScreen, bottomScreen].forEach(s => { s.c.fillStyle = `rgba(255,255,255,${a})`; s.c.fillRect(0, 0, 256, 192); });
    }
  }

  // Build (once) Path2D parts of the DSi logo SVG (tools/logo_decompose.mjs). Returns null if
  // the data did not load (then scale>1 falls back to the captured frames).
  _logoParts() {
    if (this._logo !== undefined) return this._logo;
    const j = Assets.data && Assets.data.logo_parts;
    const mk = arr => arr.map(p => ({ p2d: new Path2D(p.d), fill: p.fill }));
    this._logo = j ? { wordmark: mk(j.wordmark), squares: mk(j.squares), iDot: mk(j.iDot), tm: mk(j.tm) } : null;
    return this._logo;
  }

  // scale>1: replay the fitted per-frame animation states (logo_anim.json) with the SVG parts.
  // Rendering here is kept IDENTICAL to tools/logo_fit.mjs / logo_smooth.mjs (which verified
  // every frame against the real capture): per-letter wordmark alphas (the measured wipe), the
  // upper screen blackening, the i and TM fades, and every screen instance - including the
  // duplicates that slide in and fade out. A screen at the settled pose renders as the exact
  // SVG path (it is the logo's O); flying screens are stroked rounded rects with rim 0.148*w.
  _drawLogoVector(screen, lf) {
    const ctx = screen.c;
    const anim = Assets.data && Assets.data.logo_anim;
    const P = this._logoParts();
    const st = anim[Math.max(0, Math.min(anim.length - 1, lf))];
    screen.clear('rgb(251,251,251)');
    const base = () => { ctx.translate(LOGO_OX, LOGO_OY); ctx.scale(LOGO_S, LOGO_S); };
    const grp = (list, a) => {
      if (a <= 0) return;
      for (const p of list) { ctx.save(); ctx.globalAlpha = Math.min(1, a); ctx.fillStyle = p.fill; base(); ctx.fill(p.p2d); ctx.restore(); }
    };
    P.wordmark.forEach((p, k) => grp([p], st.wma[k]));
    for (const [cx, cy, w, op] of st.s) {
      if (op <= 0) continue;
      const settled = Math.abs(w - LOGO_SW) <= 1.5 && Math.abs(cx - LOGO_SCX) <= 2 && Math.abs(cy - LOGO_SCY) <= 2;
      ctx.save(); ctx.globalAlpha = Math.min(1, op);
      if (settled) {
        // snap FULLY to the SVG pose (identity), not just to path rendering: the fitted
        // bitmap pose is ~1px off the SVG geometry, which visibly misaligns the settled
        // pair against the black upper screen at high scale. The final lockup must be the
        // provided SVG verbatim.
        ctx.fillStyle = 'rgb(147,149,152)';
        base(); ctx.fill(P.squares[0].p2d);
      } else {
        const rim = 0.148 * w, h = 0.8138 * w;
        ctx.strokeStyle = 'rgb(147,149,152)'; ctx.lineWidth = rim;
        ctx.beginPath();
        ctx.roundRect(cx - w / 2 + rim / 2, cy - h / 2 + rim / 2, w - rim, h - rim, Math.max(0.5, 0.172 * w - rim / 2));
        ctx.stroke();
      }
      ctx.restore();
    }
    grp([P.squares[1]], st.blk);
    grp(P.iDot, st.i);
    // no TM: the real boot animation never shows it (the SVG asset has it, the console does not)
  }

  _drawLogo(screen, f) {
    const lf = Math.floor(f - BOOT.logoStart);
    // scale>1: crisp vector logo from the SVG. scale=1: the captured frames (exact melonDS).
    if (RENDER_SCALE > 1 && this._logoParts() && Assets.data && Assets.data.logo_anim) { this._drawLogoVector(screen, lf); return; }
    screen.clear('#fff');
    const idx = Math.max(0, Math.min(this.logoFrames.length - 1, lf));
    const im = this.logoFrames[idx] || Assets.img('boot_logo_final');
    if (im) screen.drawImage(im, 0, 0);
  }

  // draw the warning triangle (matched traced graphic, hs_triangle.json) at fade alpha a,
  // shifted right by dx px (for centring the title block)
  _drawTriangle(ctx, a, dx = 0) {
    if (this._tri === null) {
      const data = Assets.data && Assets.data.hs_triangle;
      this._tri = data && data.layers ? data.layers.map(L => ({ color: L.color, m: L.m, p2d: new Path2D(L.d) })) : false;
    }
    if (!this._tri) return;
    for (const L of this._tri) {
      ctx.save();
      ctx.globalAlpha = a; ctx.fillStyle = L.color;
      if (dx) ctx.translate(dx, 0);
      ctx.transform(L.m[0], L.m[1], L.m[2], L.m[3], L.m[4], L.m[5]);
      ctx.fill(L.p2d);
      ctx.restore();
    }
  }

  // rendered width (px) of a line in the DSFW firmware font (same math as _line)
  _lineWidth(ctx, L) {
    const EM = 40, MAX_W = 248;
    ctx.save();
    ctx.font = `${L.bold ? '700 ' : ''}${EM}px ${HS_FONT}`;
    const m = ctx.measureText(L.t);
    const asc = m.actualBoundingBoxAscent || EM * 0.72;
    const w0 = m.width || 1;
    ctx.restore();
    return L.w ? L.w : (L.cap / asc) * w0;
  }

  // draw one line with the DSFW firmware TTF, scaled independently in x (to the
  // line's ink width) and y (to its cap-height) so it matches the original box, then thinned
  // to the original's weight by eroding the glyph edges with the background colour (the trace is
  // heavier than the firmware font). cx = centre, x = left, base = baseline. alpha = fade/pulse.
  _line(ctx, L, alpha) {
    if (alpha <= 0) return;
    const EM = 40;
    ctx.save();
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    if (L.bold) {
      // heading: keep the original x-fit + edge-erosion (accepted as-is)
      const ERODE = (L.ek != null ? L.ek : 0.022) * (L.cap || 8);
      ctx.font = `700 ${EM}px ${HS_FONT}`;
      const m = ctx.measureText(L.t);
      const asc = m.actualBoundingBoxAscent || EM * 0.72;
      const w0 = m.width || 1;
      const sx = L.w ? L.w / w0 : L.cap / asc;
      const sy = L.cap ? L.cap / asc : sx;
      const x0 = L.x != null ? L.x : Math.round(L.cx - (w0 * sx) / 2);
      ctx.globalAlpha = alpha; ctx.fillStyle = L.color;
      ctx.translate(x0, L.base); ctx.scale(sx, sy);
      ctx.fillText(L.t, 0, 0);
      ctx.strokeStyle = HS_BG; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
      ctx.lineWidth = ERODE / ((sx + sy) / 2);
      ctx.strokeText(L.t, 0, 0);
      ctx.restore();
      return;
    }
    // main text: UNIFORM scale (never distort the letterforms) + letter-spacing to reach the
    // measured ink width, matching the real text's tracking instead of stretching the aspect
    // ratio. No erosion (the clean system font is already the right weight, not too thin).
    ctx.font = `${EM}px ${HS_FONT}`;
    const m = ctx.measureText(L.t);
    const asc = m.actualBoundingBoxAscent || EM * 0.72;
    const w0 = m.width || 1;
    const s = L.cap ? L.cap / asc : (L.w / w0);          // uniform scale to cap-height
    const targetW0 = (L.w || w0 * s) / s;                // target ink width in EM units
    const n = L.t.length;
    const ls = n > 1 ? (targetW0 - w0) / (n - 1) : 0;    // per-gap letter-spacing (EM units)
    const x0 = L.x != null ? L.x : Math.round(L.cx - (L.w || w0 * s) / 2);
    ctx.globalAlpha = alpha; ctx.fillStyle = L.color;
    ctx.translate(x0, L.base); ctx.scale(s, s);
    ctx.letterSpacing = `${ls}px`;
    ctx.fillText(L.t, 0, 0);
    ctx.restore();
  }

  // scale>1 redraw: the warning triangle (matched traced graphic) + all text in the DSFW firmware TTF
  // web font. Static lines fade in with the boot fade; the prompt keeps its triangle pulse.
  _drawHealthVector(screen, f) {
    const ctx = screen.c;
    screen.clear('#fff');
    const a = Math.min(1, Math.max(0, (f - BOOT.whiteEnd) / 23));   // same fade-in as the bitmap path
    if (a <= 0) return;
    ctx.fillStyle = HS_BG; ctx.globalAlpha = a; ctx.fillRect(0, 0, 256, 192); ctx.globalAlpha = 1;
    // title block = triangle + text, centred on the screen like the original. The triangle
    // (original left edge x13, ~16px wide) is shifted so [triangle][gap][text] centres on 128.
    const title = BOOT_LINES[0];
    const TRI_X = 13, TRI_W = 16, GAP = 2;
    const titleW = this._lineWidth(ctx, title);
    const blockLeft = Math.round(128 - (TRI_W + GAP + titleW) / 2);
    this._drawTriangle(ctx, a, blockLeft - TRI_X);
    this._line(ctx, { ...title, x: blockLeft + TRI_W + GAP }, a);
    for (const L of BOOT_LINES.slice(1)) this._line(ctx, L, a);
    if (f >= BOOT.touchPromptAt) {
      const p = (f - BOOT.touchPromptAt) % BOOT.touchPulsePeriod;
      const pulse = (p < 30 ? p / 30 : (60 - p) / 30) * a;
      if (pulse > 0) this._line(ctx, BOOT_PROMPT, pulse);
    }
  }

  _drawHealth(screen, f) {
    // scale>1: text in the system Helvetica/Arial (a clean crisp match for the real H&S
    // typeface) + the matched triangle. scale=1: the exact captured bitmap (byte-exact).
    if (RENDER_SCALE > 1 && typeof document !== 'undefined') {
      this._drawHealthVector(screen, f);
      return;
    }
    screen.clear('#fff');
    // NB: healthsafety.png carries the "Touch the Touch Screen" text; the
    // *_touch.png is the text-free base (the file names are back to front).
    // Both are verbatim melonDS captures: *_touch.png = out/boot/f_0180.bot.ppm
    // (the real min-ink/"off" phase of the pulse), healthsafety.png =
    // out/boot/f_0210.bot.ppm (the real max-ink/"on" phase, i.e. the trough of
    // the text-region brightness curve, not an arbitrary mid-ramp frame -
    // an earlier extraction had grabbed f205/206, ~83% of the way to full ink,
    // which capped the rendered pulse's darkest frame short of the real one).
    const base = Assets.img('boot_hs_touch');   // H&S with no prompt text
    const withText = Assets.img('boot_hs');      // same H&S + the prompt text
    // the H&S screen fades in over ~f92..115 (measured out/boot)
    const a = Math.min(1, Math.max(0, (f - BOOT.whiteEnd) / 23));
    if (base) { screen.c.globalAlpha = a; screen.drawImage(base, 0, 0); screen.c.globalAlpha = 1; }
    // "Touch the Touch Screen to continue." pulses as a CONTINUOUS linear triangle,
    // period 60f: 0->full over 30f, full->0 over 30f, no off-dwell (RE'd frame by
    // frame from out/wfa/boot_touch_prompt: the DS EVA alpha ramps 16..0 each half).
    if (withText && f >= BOOT.touchPromptAt) {
      const p = (f - BOOT.touchPromptAt) % BOOT.touchPulsePeriod;
      const pulse = p < 30 ? p / 30 : (60 - p) / 30;
      if (pulse > 0) { screen.c.globalAlpha = pulse * a; screen.drawImage(withText, 0, 0); screen.c.globalAlpha = 1; }
    }
  }
}
