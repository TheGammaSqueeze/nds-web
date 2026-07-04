// Captures the clone's carousel (menu_idle state) with a given favColor bank
// (0..15, see tools/usercolor.js FAV_NAMES) forced into the live Launcher
// instance, for pixdiff against a real melonDS capture of the same favColor.
// To get the melonDS side, patch a SCRATCH COPY of dsinand.bin (never
// bin/dsi/dsinand.bin itself - every regression baseline depends on it):
//   mkdir -p /tmp/scratch && cp bin/dsi/*.bin /tmp/scratch/
//   ./melonDS/build-headless/nandfs /tmp/scratch setfavcolor <bank>
//   ./melonDS/build-headless/melonds-headless /tmp/scratch <outdir> scripts/idle_anim.txt
// then: node tools/pixdiff.js <outdir>/idle_done.top.ppm <cloneoutdir>/idle.top.png top <label>
//       node tools/pixdiff.js <outdir>/idle_done.bot.ppm <cloneoutdir>/idle.bot.png bot <label>
//
// Usage: node tools/caplaunchercolor.mjs <bank 0..15> [outdir]
import { chromium } from 'playwright';
import { startServer } from './serve.js';
import fs from 'fs';

const bank = parseInt(process.argv[2] || '2', 10);
const outdir = process.argv[3] || '/tmp/launcher_color_clone_verify';
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
  window.DSi.setSlot(17);
}, bank);
await p.waitForTimeout(300);
console.log('ERRORS:', errs.filter(e => /warn|err/i.test(e)).join('\n'));
for (const [sc, id] of [['top', 'top'], ['bot', 'bottom']]) {
  const d = await p.evaluate(id => document.getElementById(id).toDataURL('image/png'), id);
  fs.writeFileSync(`${outdir}/idle.${sc}.png`, Buffer.from(d.split(',')[1], 'base64'));
}
await b.close(); s.close();
console.log('captured clone launcher bank', bank, '->', outdir);
