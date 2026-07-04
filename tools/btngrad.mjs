// Extract the de-dithered gloss gradient from the real settings button sprites, per variant.
// The DS fakes the gloss ramp with a 2-colour horizontal dither; averaging each row recovers
// the exact smooth gradient it approximates. At scale>1 the app fills a rounded rect with this
// gradient instead of blitting the dithered sprite (scale=1 keeps the exact dithered bitmap).
// Output: webapp/public/sprites/button_grads.json { menu:{variant:[[t,"r,g,b"],...]}, dialog:{...} }
import fs from 'fs';
import { loadPNG } from './veccontour.mjs';

const FAV = ['grey', 'brown', 'red', 'pink', 'orange', 'yellow', 'lime', 'green', 'dark-green', 'turquoise', 'light-blue', 'blue', 'dark-blue', 'violet', 'magenta', 'rose'];

// per-row average colour over opaque pixels, for rows [y0,y1)
function rowGrad(png, y0, y1) {
  const stops = [];
  for (let y = y0; y < y1; y++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let x = 0; x < png.w; x++) { const p = png.px[y][x]; if (p.a > 40) { r += p.r; g += p.g; b += p.b; n++; } }
    if (!n) continue;
    stops.push([(y - y0) / (y1 - 1 - y0), `${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)}`]);
  }
  // drop consecutive duplicate colours (gradient interpolates)
  return stops.filter((s, i) => i === 0 || i === stops.length - 1 || s[1] !== stops[i - 1][1]);
}

function tryPNG(path) { try { return loadPNG(path); } catch { return null; } }

// vertical gloss gradient of a favColour pill sprite: per-row average of the coloured pixels
// (excluding the white arrow glyph and transparency) over [y0,y1) -> de-dithered ramp.
function pillGrad(png, y0, y1) {
  const stops = [];
  for (let y = y0; y < y1; y++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let x = 0; x < png.w; x++) { const p = png.px[y][x]; if (p.a > 40 && !(p.r > 200 && p.g > 200 && p.b > 200)) { r += p.r; g += p.g; b += p.b; n++; } }
    if (n < 3) continue;
    stops.push([(y - y0) / (y1 - 1 - y0), `${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)}`]);
  }
  return stops.filter((s, i) => i === 0 || i === stops.length - 1 || s[1] !== stops[i - 1][1]);
}

const out = { menu: {}, dialog: {}, pagearrow: {}, scrollarrow: {} };
// menu button gloss = setting_btn_mid rows 3..26 (24-row face; 27..29 are the drop shadow)
for (const v of ['idle', ...FAV]) {
  const f = v === 'idle' ? 'setting_btn_mid' : `setting_btn_mid_${v}`;
  const png = tryPNG(`webapp/public/sprites/${f}.png`);
  if (png) out.menu[v] = rowGrad(png, 3, 27);
}
// dialog Yes/No = dialog_btn full 32-row face (own baked caps)
for (const v of ['idle', ...FAV]) {
  const f = v === 'idle' ? 'dialog_btn_idle' : `dialog_btn_${v}`;
  const png = tryPNG(`webapp/public/sprites/${f}.png`);
  if (png) out.dialog[v] = rowGrad(png, 0, png.h);
}
// page arrows (32x66 vertical pill, face rows ~2..61) and scroll arrows (25x32, rows ~13..28),
// per favourite colour (these sprites are only recoloured, not idle-grey)
for (const v of FAV) {
  const pa = tryPNG(`webapp/public/sprites/setting_pagearrow_left_${v}.png`);
  if (pa) out.pagearrow[v] = pillGrad(pa, 2, 62);
  const sa = tryPNG(`webapp/public/sprites/setting_scrollarrow_up_${v}.png`);
  if (sa) out.scrollarrow[v] = pillGrad(sa, 13, 29);
}
fs.writeFileSync('webapp/public/sprites/button_grads.json', JSON.stringify(out));
console.log('menu variants:', Object.keys(out.menu).length, 'dialog variants:', Object.keys(out.dialog).length);
console.log('menu idle stops:', out.menu.idle.length, JSON.stringify(out.menu.idle.slice(0, 4)));
console.log('menu blue stops:', out.menu.blue.length, JSON.stringify(out.menu.blue.slice(0, 4)));
