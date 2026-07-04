// TASK D: render NSCR background layers for every launcher screen to PNG.
// Core rendering uses the verified ndsgfx.js renderBG (transparent palette index 0).
// For full-screen BASE layers we additionally flatten the transparent (index-0)
// pixels onto the hardware backdrop colour (= palette[0][0]), because on real DS
// hardware a transparent BG pixel shows the backdrop, not nothing.
// Overlay layers (balloon, photo widget, dialog boxes) keep index-0 transparent
// so they composite over whatever is behind them.
//
// Usage: node tools/render-bg.js
// Outputs PNGs + bg.json manifest under assets/launcher/decoded/bg/

const fs = require('fs');
const { execFileSync } = require('child_process');
const path = require('path');
const { parseNCLR, parseNCGR, parseNSCR, renderBG } = require('./ndsgfx.js');

const NARC = path.resolve(__dirname, '../assets/launcher/narc');
const OUT = path.resolve(__dirname, '../assets/launcher/decoded/bg');
const ROOT = path.resolve(__dirname, '..');
fs.mkdirSync(OUT, { recursive: true });

function rgbaToPng(img, pngPath) {
  const rgbaPath = pngPath.replace(/\.png$/, '.rgba');
  fs.writeFileSync(rgbaPath, img.data);
  execFileSync('convert', ['-size', `${img.w}x${img.h}`, '-depth', '8', `rgba:${rgbaPath}`, pngPath]);
  fs.unlinkSync(rgbaPath);
}

// Replace transparent pixels with the backdrop colour (opaque). Returns a new img.
function flattenBackdrop(img, bg) {
  const out = Buffer.from(img.data);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] === 0) { out[i] = bg[0]; out[i + 1] = bg[1]; out[i + 2] = bg[2]; out[i + 3] = 255; }
  }
  return { w: img.w, h: img.h, data: out };
}

// Composite overlay (transparent index0) over a base img (both same size). New img.
function composite(base, over) {
  const out = Buffer.from(base.data);
  for (let i = 0; i < out.length; i += 4) {
    if (over.data[i + 3] !== 0) { out[i] = over.data[i]; out[i + 1] = over.data[i + 1]; out[i + 2] = over.data[i + 2]; out[i + 3] = 255; }
  }
  return { w: base.w, h: base.h, data: out };
}

const jobs = [
  // ---- bottom screen ----
  { name: 'launcher_D_BG01', screen: 'bottom', role: 'base',
    nscr: 'launcher_d/msk_launcher_D_BG01.NSCR', ncgr: 'launcher_d/msk_launcher_D.ncgr', nclr: 'launcher_d/msk_launcher_D_BG.NCLR' },
  { name: 'balloon_D', screen: 'bottom', role: 'overlay',
    nscr: 'launcher_d/msk_balloon_D.NSCR', ncgr: 'launcher_d/msk_launcher_D.ncgr', nclr: 'launcher_d/msk_launcher_D_BG.NCLR' },

  // ---- top screen ----
  { name: 'launcher_U_BG00', screen: 'top', role: 'base',
    nscr: 'launcher_u/msk_launcher_U_BG00.NSCR', ncgr: 'launcher_u/msk_launcher_U_BG.NCGR', nclr: 'launcher_u/msk_launcher_U_BG.NCLR' },
  { name: 'photo_U', screen: 'top', role: 'overlay',
    nscr: 'launcher_u/msk_photo_U.NSCR', ncgr: 'launcher_u/msk_launcher_U_BG.NCGR', nclr: 'launcher_u/msk_launcher_U_BG.NCLR' },

  // ---- dialogs (overlays over the dimmed menu) ----
  { name: 'dialog_BG00', screen: 'dialog', role: 'overlay',
    nscr: 'launcher_dialog/msk_dialog_BG00.NSCR', ncgr: 'launcher_dialog/msk_dialog_BG.NCGR', nclr: 'launcher_dialog/msk_dialog_BG.NCLR' },
  { name: 'dialog_BG01', screen: 'dialog', role: 'overlay',
    nscr: 'launcher_dialog/msk_dialog_BG01.NSCR', ncgr: 'launcher_dialog/msk_dialog_BG.NCGR', nclr: 'launcher_dialog/msk_dialog_BG.NCLR' },
  { name: 'dialog_BG02', screen: 'dialog', role: 'overlay',
    nscr: 'launcher_dialog/msk_dialog_BG02.NSCR', ncgr: 'launcher_dialog/msk_dialog_BG.NCGR', nclr: 'launcher_dialog/msk_dialog_BG.NCLR' },
  { name: 'dialog_BG03', screen: 'dialog', role: 'overlay',
    nscr: 'launcher_dialog/msk_dialog_BG03.NSCR', ncgr: 'launcher_dialog/msk_dialog_BG.NCGR', nclr: 'launcher_dialog/msk_dialog_BG.NCLR' },
  { name: 'dialog_BG04', screen: 'dialog', role: 'overlay',
    nscr: 'launcher_dialog/msk_dialog_BG04.NSCR', ncgr: 'launcher_dialog/msk_dialog_BG.NCGR', nclr: 'launcher_dialog/msk_dialog_BG.NCLR' },
];

const manifest = [];
const rendered = {}; // name -> {img, job}
for (const job of jobs) {
  const nscr = parseNSCR(fs.readFileSync(path.join(NARC, job.nscr)));
  const ncgr = parseNCGR(fs.readFileSync(path.join(NARC, job.ncgr)));
  const nclr = parseNCLR(fs.readFileSync(path.join(NARC, job.nclr)));

  // core decode via the verified renderBG (transparent index 0)
  const layer = renderBG(nscr, ncgr, nclr);

  // primary PNG: base layers flattened onto the hardware backdrop colour, overlays left transparent
  let img = layer;
  let backdrop = null;
  if (job.role === 'base') {
    backdrop = nclr.palettes[0][0];           // DS backdrop = colour 0 of palette 0
    img = flattenBackdrop(layer, backdrop);
  }
  const png = path.join(OUT, job.name + '.png');
  rgbaToPng(img, png);
  rendered[job.name] = { img, layer, job };

  const palsUsed = new Set();
  let tilesMax = 0;
  for (const e of nscr.entries) { palsUsed.add(e.pal); if (e.tile > tilesMax) tilesMax = e.tile; }

  manifest.push({
    name: job.name,
    screen: job.screen,
    role: job.role,
    out: path.relative(ROOT, png),
    w: img.w, h: img.h,
    index0: job.role === 'base' ? 'opaque-backdrop' : 'transparent',
    backdrop: backdrop ? `rgb(${backdrop.join(',')})` : null,
    sources: { nscr: job.nscr, ncgr: job.ncgr, nclr: job.nclr },
    ncgrTiles: ncgr.nTiles, ncgrBpp: ncgr.is8 ? 8 : 4,
    nclrPalettes: nclr.palettes.length,
    palettesUsed: [...palsUsed].sort((a, b) => a - b),
    maxTileRef: tilesMax,
  });
  console.log(`${job.name} (${job.role}): ${img.w}x${img.h} pals[${[...palsUsed].sort((a,b)=>a-b).join(',')}] maxTile=${tilesMax}/${ncgr.nTiles}`);
}

// ---- composite previews for self-verification against the reference frames ----
// Bottom: BG01 IS the full bottom background (stripes + white name box + scrollbar).
//   balloon_D is a frame-components sheet assembled at runtime, so it is NOT a 1:1
//   full-screen overlay and is left out of the representative preview.
// Top: BG00 (base) + photo_U (the teal photo widget panel) is the representative view.
{
  const png = path.join(OUT, '_preview_bottom.png');
  rgbaToPng(rendered['launcher_D_BG01'].img, png);
  console.log('_preview_bottom: launcher_D_BG01 (full bottom background)');
}
{
  const comp = composite(rendered['launcher_U_BG00'].img, rendered['photo_U'].layer);
  const png = path.join(OUT, '_preview_top.png');
  rgbaToPng(comp, png);
  console.log('_preview_top: composite launcher_U_BG00 + photo_U');
}

fs.writeFileSync(path.join(OUT, 'bg.json'), JSON.stringify(manifest, null, 2));
console.log('wrote bg.json (' + manifest.length + ' layers)');
