// Minimal PPM (P6) reader + pixel inspector for measuring DSi menu geometry.
const fs = require('fs');

function readPPM(path) {
  const buf = fs.readFileSync(path);
  // header: "P6\n<w> <h>\n<max>\n"
  let pos = 0;
  function token() {
    while (buf[pos] === 0x20 || buf[pos] === 0x0a || buf[pos] === 0x0d || buf[pos] === 0x09) pos++;
    let s = pos;
    while (!(buf[pos] === 0x20 || buf[pos] === 0x0a || buf[pos] === 0x0d || buf[pos] === 0x09)) pos++;
    return buf.toString('ascii', s, pos);
  }
  const magic = token();
  const w = parseInt(token()), h = parseInt(token()), max = parseInt(token());
  pos++; // single whitespace after maxval
  const data = buf.subarray(pos, pos + w * h * 3);
  return { w, h, data };
}

function px(img, x, y) {
  const i = (y * img.w + x) * 3;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}
function hex([r, g, b]) { return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''); }

const cmd = process.argv[2];
const path = process.argv[3];
const img = readPPM(path);

if (cmd === 'info') {
  console.log(`${img.w}x${img.h}`);
} else if (cmd === 'pixel') {
  const x = +process.argv[4], y = +process.argv[5];
  console.log(`(${x},${y}) = ${hex(px(img, x, y))} rgb(${px(img, x, y)})`);
} else if (cmd === 'row') {
  // print color transitions along a horizontal line at y, between x0..x1
  const y = +process.argv[4], x0 = +(process.argv[5] || 0), x1 = +(process.argv[6] || img.w - 1);
  let prev = null;
  for (let x = x0; x <= x1; x++) {
    const c = hex(px(img, x, y));
    if (c !== prev) { console.log(`x=${x}: ${c}`); prev = c; }
  }
} else if (cmd === 'col') {
  const x = +process.argv[4], y0 = +(process.argv[5] || 0), y1 = +(process.argv[6] || img.h - 1);
  let prev = null;
  for (let y = y0; y <= y1; y++) {
    const c = hex(px(img, x, y));
    if (c !== prev) { console.log(`y=${y}: ${c}`); prev = c; }
  }
} else if (cmd === 'bbox') {
  // bounding box of pixels matching a color (with tolerance) within region
  const target = process.argv[4].split(',').map(Number);
  const tol = +(process.argv[5] || 8);
  let minx = 1e9, miny = 1e9, maxx = -1, maxy = -1, n = 0;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const [r, g, b] = px(img, x, y);
    if (Math.abs(r - target[0]) <= tol && Math.abs(g - target[1]) <= tol && Math.abs(b - target[2]) <= tol) {
      minx = Math.min(minx, x); miny = Math.min(miny, y); maxx = Math.max(maxx, x); maxy = Math.max(maxy, y); n++;
    }
  }
  console.log(`bbox x:${minx}..${maxx} (w=${maxx-minx+1}) y:${miny}..${maxy} (h=${maxy-miny+1}) n=${n}`);
} else if (cmd === 'profile') {
  // for each column x, min luminance over y0..y1 (gaps/shadows = minima)
  const y0 = +process.argv[4], y1 = +process.argv[5];
  const out = [];
  for (let x = 0; x < img.w; x++) {
    let mn = 255;
    for (let y = y0; y <= y1; y++) { const [r, g, b] = px(img, x, y); const l = (r + g + b) / 3; if (l < mn) mn = l; }
    out.push(Math.round(mn));
  }
  // print as x:val, marking local minima (gap lines)
  for (let x = 1; x < img.w - 1; x++) {
    if (out[x] < out[x - 1] && out[x] <= out[x + 1] && out[x] < 200) console.log(`gap x=${x} (lum ${out[x]})`);
  }
} else {
  console.log('cmds: info|pixel x y|row y [x0 x1]|col x [y0 y1]|bbox r,g,b [tol]|profile y0 y1');
}
