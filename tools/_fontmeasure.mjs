import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--no-sandbox'] });
const p = await b.newPage();
const r = await p.evaluate(() => {
  const cv = document.createElement('canvas'); const ctx = cv.getContext('2d');
  const EM = 40;
  // main text lines: [string, target ink width w, cap height]
  const LINES = [
    ['BEFORE PLAYING, READ THE HEALTH', 206, 8],
    ['AND SAFETY PRECAUTIONS BOOKLET', 205, 8],
    ['ABOUT YOUR HEALTH AND SAFETY.', 207, 8],
    ['TO GET AN EXTRA COPY FOR YOUR REGION, GO ONLINE AT', 234, 6],
  ];
  const fonts = ['Arial','Helvetica','Nimbus Sans','DejaVu Sans','Liberation Sans','Verdana','Tahoma','FreeSans','Noto Sans'];
  const out = {};
  for (const f of fonts) {
    let ratios = [];
    for (const [t, w, cap] of LINES) {
      ctx.font = `${EM}px '${f}', sans-serif`;
      const m = ctx.measureText(t);
      const asc = m.actualBoundingBoxAscent || EM*0.72;
      const w0 = m.width;
      const naturalW = w0 * (cap/asc);   // width if uniformly scaled to cap-height
      ratios.push(naturalW / w);          // >1 = font naturally wider than target, <1 = needs stretching wide
    }
    out[f] = ratios.map(v=>+v.toFixed(2));
  }
  return out;
});
console.log('font              naturalW/targetW per main line (1.0 = perfect aspect, <1 = current stretches wide)');
for (const [f,v] of Object.entries(r)) console.log(f.padEnd(16), v.join('  '), ' avg', (v.reduce((a,c)=>a+c,0)/v.length).toFixed(2));
await b.close();
