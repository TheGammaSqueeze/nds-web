import { chromium } from 'playwright';
import fs from 'fs';
const b = await chromium.launch({ args: ['--use-gl=swiftshader','--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 300, height: 250 } });
// replicate the _line fitting for a few lines, in a candidate font, at 4x
const LINES = [
  { t:'WARNING – HEALTH AND SAFETY', base:28.3, w:211, cap:10, bold:true, x:34 },
  { t:'BEFORE PLAYING, READ THE HEALTH', cx:128, base:54.4, w:206, cap:8 },
  { t:'AND SAFETY PRECAUTIONS BOOKLET', cx:128, base:73.4, w:205, cap:8 },
  { t:'FOR IMPORTANT INFORMATION', cx:126, base:92.5, w:180, cap:8 },
  { t:'ABOUT YOUR HEALTH AND SAFETY.', cx:128, base:111.5, w:207, cap:8 },
];
const font = process.argv[2] || 'Nimbus Sans';
const S = 4;
const img = await p.evaluate(({LINES,font,S}) => {
  const cv = document.createElement('canvas'); cv.width=256*S; cv.height=120*S;
  const ctx = cv.getContext('2d'); ctx.setTransform(S,0,0,S,0,0);
  ctx.fillStyle='rgb(251,251,251)'; ctx.fillRect(0,0,256,120);
  ctx.fillStyle='#000'; ctx.textBaseline='alphabetic'; ctx.textAlign='left';
  const EM=40;
  for (const L of LINES){
    ctx.font = `${L.bold?'700 ':''}${EM}px '${font}', sans-serif`;
    const m=ctx.measureText(L.t); const asc=m.actualBoundingBoxAscent||EM*0.72; const w0=m.width||1;
    const sx=L.w/w0, sy=L.cap/asc; const x0 = L.x!=null?L.x:Math.round(L.cx-(w0*sx)/2);
    ctx.save(); ctx.translate(x0, L.base); ctx.scale(sx,sy); ctx.fillText(L.t,0,0); ctx.restore();
  }
  return cv.toDataURL('image/png');
}, {LINES,font,S});
fs.writeFileSync('/tmp/hsfont.png', Buffer.from(img.split(',')[1],'base64'));
await b.close(); console.log('ok',font);
