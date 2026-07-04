// Matches tools/verify.js's menu_idle setup exactly (skipBoot, setSlot(17),
// freezeAnim=120) but also forces launcher+topscreen favColor, for pixdiff
// against a real melonDS capture at the same favColor (see
// tools/caplaunchercolor.mjs header for the melonDS-side scratch-NAND steps).
import { chromium } from 'playwright';
import { startServer } from './serve.js';
import fs from 'fs';

const bank = parseInt(process.argv[2] || '2', 10);
const outdir = process.argv[3] || '/tmp/favcolor_verify';
fs.mkdirSync(outdir, { recursive: true });

const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 600, height: 820 } });
const errs = [];
p.on('console', m => errs.push(m.type() + ': ' + m.text()));
p.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
await p.goto(s.url, { waitUntil: 'networkidle' });
await p.waitForFunction('window.DSi && window.DSi.ready');
await p.evaluate((bank) => {
  window.__demoTime = Date.parse('2000-01-01T00:00:00');
  window.__demoClockSpace = true;
  window.__freezeAnim = 120;
  window.DSi.skipBoot();
  window.DSi.launcher.favColor = bank;
  window.DSi.topscreen.settings.favColor = bank;
  window.DSi.setSlot(17);
}, bank);
await p.waitForTimeout(150);
console.log('ERRORS:', errs.filter(e => /warn|err/i.test(e)).join('\n'));
for (const [sc, id] of [['top', 'top'], ['bot', 'bottom']]) {
  const d = await p.evaluate(id => document.getElementById(id).toDataURL('image/png'), id);
  fs.writeFileSync(`${outdir}/idle.${sc}.png`, Buffer.from(d.split(',')[1], 'base64'));
}
await b.close(); s.close();
console.log('captured clone bank', bank, '->', outdir);
