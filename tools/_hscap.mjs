import { chromium } from 'playwright';
import { startServer } from '/work/nds/tools/serve.js';
import fs from 'fs';
const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 900, height: 1400 } });
await p.goto(s.url + '?scale=4', { waitUntil: 'networkidle' });
await p.waitForFunction('window.DSi && window.DSi.ready');
// wait for the DSFW font to load, then render the H&S frame (well after touchPromptAt)
await p.evaluate(async () => { if (document.fonts) { try { await document.fonts.load("20px 'DSFW'"); } catch(e){} } });
await p.waitForTimeout(200);
await p.evaluate(() => { window.DSi.seekBootFrame(240); });
await p.waitForTimeout(80);
const png = await p.evaluate(() => document.getElementById('bottom').toDataURL('image/png'));
fs.writeFileSync('/tmp/hs_scale4.png', Buffer.from(png.split(',')[1], 'base64'));
await b.close(); s.close(); console.log('ok');
