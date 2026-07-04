import { chromium } from 'playwright';
import fs from 'fs';
const [svg, out, scale] = [process.argv[2], process.argv[3], +process.argv[4]];
const b = await chromium.launch({ args: ['--no-sandbox'] });
const p = await b.newPage();
const data = fs.readFileSync(svg).toString();
const m = data.match(/width="(\d+)" height="(\d+)"/);
const w = +m[1], h = +m[2];
const png = await p.evaluate(async ({ data, w, h, scale }) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/svg+xml;base64,' + btoa(data); });
  const cv = document.createElement('canvas'); cv.width = w * scale; cv.height = h * scale;
  const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = true;
  cx.drawImage(img, 0, 0, w * scale, h * scale);
  return cv.toDataURL('image/png');
}, { data, w, h, scale });
fs.writeFileSync(out, Buffer.from(png.split(',')[1], 'base64'));
await b.close();
