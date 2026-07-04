import { chromium } from 'playwright';
import fs from 'fs';
const b = await chromium.launch({ args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 800, height: 900 } });
// load DSVec (current) for reference
await p.goto('data:text/html,<body></body>');
await p.addStyleTag({ content: `@font-face{font-family:'DSVec';src:url('file:///work/nds/webapp/public/font/dsvec.ttf')}` });
const fonts = ['DSVec (current)','DejaVu Sans','Liberation Sans','Nimbus Sans','FreeSans','Verdana','Noto Sans'];
const map = {'DSVec (current)':'DSVec'};
const html = `<body style="margin:0;background:#333;color:#fff">` + fonts.map(f=>{
  const fam = map[f]||f;
  return `<div style="height:64px;display:flex;align-items:center;gap:40px;border-bottom:1px solid #555"><span style="font-family:'${fam}';font-size:34px">System Settings</span><span style="font-family:'${fam}';font-size:30px">Month  Day  Year</span><span style="position:absolute;right:6px;font:12px sans-serif;color:#8cf">${f}</span></div>`;
}).join('') + `</body>`;
await p.setContent(html);
await p.evaluate(async()=>{ if(document.fonts) await document.fonts.ready; });
await p.waitForTimeout(300);
await p.screenshot({ path: '/tmp/uifonts.png' });
await b.close(); console.log('ok');
