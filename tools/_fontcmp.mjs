import { chromium } from 'playwright';
import fs from 'fs';
const b = await chromium.launch({ args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
const text = 'BEFORE PLAYING, READ THE HEALTH';
const fonts = ['Arial', 'Helvetica', 'Liberation Sans', 'Nimbus Sans', 'DejaVu Sans', 'FreeSans'];
// draw each fit to a target ink width, cap-height ~ 60px, on white
const html = `<body style="margin:0;background:#fff">` + fonts.map((f,i)=>
  `<div style="height:96px;display:flex;align-items:center"><span style="font-family:'${f}';font-size:78px;letter-spacing:1px;white-space:nowrap;transform:scaleX(0.92);transform-origin:left">${text}</span><span style="position:absolute;right:8px;font:14px sans-serif;color:#999">${f}</span></div>`
).join('') + `</body>`;
await p.setContent(html);
await p.waitForTimeout(200);
await p.screenshot({ path: '/tmp/fontcmp.png' });
await b.close();
console.log('ok');
