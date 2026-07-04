// Capture the live carousel + a settings screen at a given render scale, from the
// canvas backing store, to inspect font quality (vector-swap vs bitmap) at scale>1.
import { chromium } from 'playwright';
import { startServer } from './serve.js';
import fs from 'fs';

const scale = +(process.argv[2] || 4);
const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(s.url + (scale > 1 ? `?scale=${scale}` : ''), { waitUntil: 'networkidle' });
await p.waitForFunction('window.DSi && window.DSi.ready');
await p.waitForTimeout(5200);                    // let boot reach the touch-prompt wait phase
const grab = async (tag) => { const u = await p.evaluate(() => document.getElementById('top').toDataURL('image/png')); fs.writeFileSync(`/tmp/ui_${tag}_top.png`, Buffer.from(u.split(',')[1], 'base64')); const v = await p.evaluate(() => document.getElementById('bottom').toDataURL('image/png')); fs.writeFileSync(`/tmp/ui_${tag}_bot.png`, Buffer.from(v.split(',')[1], 'base64')); };
// tap the bottom screen to advance boot -> carousel
const box = await p.$eval('#bottom', el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await p.mouse.click(box.x, box.y);
await p.waitForTimeout(2500);
await grab('carousel');
console.log('captured carousel at scale', scale);
await b.close(); s.close();
