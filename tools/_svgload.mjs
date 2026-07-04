import { chromium } from 'playwright';
import { startServer } from '/work/nds/tools/serve.js';
const s = await startServer();
const b = await chromium.launch({ args: ['--no-sandbox'] });
const p = await b.newPage();
const url = s.url + 'public/sprites/color_swatch_blue.svg';
const resp = await p.goto(url, { waitUntil: 'load' }).catch(e => ({ err: e.message }));
const status = resp.status ? resp.status() : resp.err;
const body = resp.status ? (await resp.text()).slice(0, 120) : '';
// try loading as an <img>
await p.goto(s.url, { waitUntil: 'domcontentloaded' });
const loadOk = await p.evaluate(async (u) => {
  const img = new Image();
  try { await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej('onerror'); img.src = u; }); return 'loaded ' + img.naturalWidth + 'x' + img.naturalHeight; }
  catch (e) { return 'FAIL ' + e; }
}, url);
console.log('HTTP', status, '| img:', loadOk, '| body:', body);
await b.close(); s.close();
