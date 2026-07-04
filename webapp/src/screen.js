// DSScreen: a 256x192 canvas with pixel-accurate draw helpers.
export const SCREEN_W = 256, SCREEN_H = 192;

// Optional supersampled rendering: ?scale=N or ?2x/?3x/?4x renders the WHOLE pipeline at
// N x the native resolution via a base context transform, so every draw call keeps using
// DS coordinates unchanged. At scale 1 the transform is identity, so the native output is
// byte-identical to the pixel-exact 1x pipeline (the 1:1 match with melonDS is preserved).
// At N>1 the procedural drawing + per-pixel bakes render crisp at high res; the canvas
// backing store is 256N x 192N and the browser resamples it to the display size.
export const RENDER_SCALE = (() => {
  if (typeof location === 'undefined') return 1;
  const q = new URLSearchParams(location.search);
  let s = q.get('scale');
  if (!s) { for (const k of ['4x', '3x', '2x', '1x']) if (q.has(k)) { s = k[0]; break; } }
  s = parseInt(s || '1', 10);
  return Math.max(1, Math.min(4, Number.isFinite(s) ? s : 1));
})();

export class DSScreen {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    // set the backing store to the render resolution; this resets the context state, so
    // configure smoothing + the base scale transform AFTER. DS coords are used everywhere.
    this.canvas.width = SCREEN_W * RENDER_SCALE;
    this.canvas.height = SCREEN_H * RENDER_SCALE;
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    if (RENDER_SCALE !== 1) {
      this.ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
      // smooth the high-res backing when the browser resamples it to the display size
      // (nearest-neighbour 'pixelated' would re-block it); native (1x) stays pixelated.
      this.canvas.style.imageRendering = 'auto';
    }
  }
  clear(color = '#000') { this.ctx.fillStyle = color; this.ctx.fillRect(0, 0, SCREEN_W, SCREEN_H); }
  get c() { return this.ctx; }

  // draw a full-screen or positioned image (HTMLImageElement/Canvas)
  drawImage(img, x = 0, y = 0) { if (img) this.ctx.drawImage(img, x | 0, y | 0); }

  // draw a sub-rect of a sprite sheet
  drawSub(img, sx, sy, sw, sh, dx, dy, dw = sw, dh = sh) {
    if (img) this.ctx.drawImage(img, sx, sy, sw, sh, dx | 0, dy | 0, dw, dh);
  }
  rect(x, y, w, h, color) { this.ctx.fillStyle = color; this.ctx.fillRect(x | 0, y | 0, w, h); }
}

// scale the device to fit the viewport (keeps integer-ish pixels crisp)
export function fitDevice() {
  const dev = document.getElementById('device');
  const margin = 24;
  const availW = window.innerWidth - margin;
  const availH = window.innerHeight - margin;
  // device is 256 wide and (192*2 + gap) tall
  const gap = 16;
  const totalH = 192 * 2 + gap;
  const scale = Math.max(1, Math.min(availW / 256, availH / totalH));
  document.documentElement.style.setProperty('--scale', scale.toFixed(3));
}
window.addEventListener('resize', fitDevice);
