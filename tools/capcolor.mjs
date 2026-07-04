// Captures the clone's Settings page1 (top+bottom) with a given favColor bank
// (0..15, see tools/usercolor.js FAV_NAMES for the order) forced into the live
// SettingsApp instance, for pixdiff against a real melonDS capture of the
// same favColor. To get the melonDS side, patch a SCRATCH COPY of dsinand.bin
// (never bin/dsi/dsinand.bin itself - all regression baselines depend on it):
//   cp bin/dsi/dsinand.bin /tmp/scratch/dsinand.bin (+ symlink the other bin/dsi/*.bin)
//   ./melonDS/build-headless/nandfs /tmp/scratch setfavcolor <bank>
//   ./melonDS/build-headless/melonds-headless /tmp/scratch <outdir> scripts/settings_pages.txt
// then: node tools/pixdiff.js <outdir>/page1.top.ppm  <cloneoutdir>/page1.top.png    top <label>
//       node tools/pixdiff.js <outdir>/page1.bot.ppm  <cloneoutdir>/page1.bottom.png bot <label>
//
// Usage: node tools/capcolor.mjs <bank 0..15> [outdir]
import { chromium } from 'playwright';
import { startServer } from './serve.js';
import fs from 'fs';

const bank = parseInt(process.argv[2] || '2', 10);
const outdir = process.argv[3] || '/tmp/color_clone_verify';
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
  const st = window.DSi.openSettings();
  st.profile.favColor = bank;
  st.page = 0; st.sel = 0;
}, bank);
await p.waitForTimeout(300);
console.log('ERRORS:', errs.filter(e => /warn|err/i.test(e)).join('\n'));
for (const sc of ['top', 'bottom']) {
  const d = await p.evaluate(id => document.getElementById(id).toDataURL('image/png'), sc);
  fs.writeFileSync(`${outdir}/page1.${sc}.png`, Buffer.from(d.split(',')[1], 'base64'));
}
await b.close(); s.close();
console.log('captured clone bank', bank, '->', outdir);
