// Capture the boot Health & Safety bottom screen at a given render scale, straight
// from the canvas backing store (so scale=4 yields the full 1024x768 high-res image).
import { chromium } from 'playwright';
import { startServer } from './serve.js';
import fs from 'fs';

const scale = +(process.argv[2] || 4);
const out = process.argv[3] || `/tmp/hs_vec${scale}.png`;

const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(s.url + (scale > 1 ? `?scale=${scale}` : ''), { waitUntil: 'networkidle' });
await p.waitForFunction('window.DSi && window.DSi.ready');
// let boot advance into the H&S 'wait' phase (touchPromptAt=180f) and settle the fade-in
await p.waitForTimeout(5000);
const dataUrl = await p.evaluate(() => document.getElementById('bottom').toDataURL('image/png'));
fs.writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
console.log('wrote', out);
await b.close(); s.close();
