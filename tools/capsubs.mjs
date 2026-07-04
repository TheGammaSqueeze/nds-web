// Capture every Settings sub-screen from the clone and rank them by whole-screen
// divergence vs the melonDS references (out/settings/sub_<id>.{top,bot}.ppm).
// Usage: node tools/capsubs.mjs [id]   (no id = all)
import { chromium } from 'playwright';
import { startServer } from './serve.js';
import { execSync } from 'child_process';
import fs from 'fs';

// clone sub id  ->  reference basename in out/settings
const SUBS = [
  ['brightness', 'sub_brightness1', st => { st.brightness = 3; }],
  ['language', 'sub_language', null],
  ['profile', 'sub_profile', null],
  ['wireless', 'sub_wireless', null],
  ['datamgmt', 'sub_datamgmt', null],
  ['sysupdate', 'sub_sysupdate', null],
  ['country', 'sub_country', null],
  ['format', 'sub_format', null],
  ['parental', 'sub_parental', null],
  ['touchscreen', 'sub_touchscreen', null],
  ['mictest', 'sub_mictest_main', null],
  ['internet', 'sub_internet', null],
  ['date', 'sub_date', null],
  ['time', 'sub_time', null],
  ['alarm', 'sub_alarm', null],
];

function readPPM(p) { const b = fs.readFileSync(p); let o = 0; const t = () => { while (b[o] <= 32) o++; let s = o; while (b[o] > 32) o++; return b.slice(s, o).toString(); }; t(); const w = +t(), h = +t(); t(); o++; return { w, h, data: b.slice(o) }; }
function readPNG(p) { const ppm = execSync(`convert "${p}" -depth 8 ppm:-`, { maxBuffer: 1 << 26 }); let o = 0; const t = () => { while ([32, 10, 13, 9].includes(ppm[o])) o++; let s = o; while (![32, 10, 13, 9].includes(ppm[o])) o++; return ppm.toString('ascii', s, o); }; t(); const w = +t(), h = +t(); t(); o++; return { w, h, data: ppm.subarray(o, o + w * h * 3) }; }
function diff(ref, cl) { let n = 0, sum = 0; const W = ref.w, H = ref.h; for (let i = 0; i < W * H * 3; i += 3) { const d = Math.max(Math.abs(ref.data[i] - cl.data[i]), Math.abs(ref.data[i + 1] - cl.data[i + 1]), Math.abs(ref.data[i + 2] - cl.data[i + 2])); sum += d; if (d > 20) n++; } return { n, pct: (100 * n / (W * H)).toFixed(2), mean: (sum / (W * H)).toFixed(2) }; }

const only = process.argv[2];
const list = only ? SUBS.filter(s => s[0] === only) : SUBS;
const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 600, height: 820 } });
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(s.url, { waitUntil: 'networkidle' });
await p.waitForFunction('window.DSi && window.DSi.ready');
await p.evaluate(() => { window.__demoTime = Date.parse('2000-01-01T00:00:00'); window.__demoClockSpace = true; window.DSi.openSettings(); });
fs.mkdirSync('/work/nds/compare/settings', { recursive: true });

const results = [];
for (const [id, ref] of list) {
  await p.evaluate((sid) => { const st = window.DSi.settings; st.trans = null; st.sub = sid; st.stepCol = 0; }, id);
  await p.waitForTimeout(120);
  const out = {};
  for (const [sc, tag] of [['top', 'top'], ['bottom', 'bot']]) {
    const d = await p.evaluate((cid) => document.getElementById(cid).toDataURL('image/png'), sc);
    const path = `/work/nds/compare/settings/${ref}.${tag}.png`;
    fs.writeFileSync(path, Buffer.from(d.split(',')[1], 'base64'));
    const refppm = `/work/nds/out/settings/${ref}.${tag}.ppm`;
    if (fs.existsSync(refppm)) out[tag] = diff(readPPM(refppm), readPNG(path));
  }
  results.push([id, out.top, out.bot]);
  console.log(`${id.padEnd(13)} top ${out.top ? out.top.pct + '% (' + out.top.n + 'px m' + out.top.mean + ')' : '-'}   bot ${out.bot ? out.bot.pct + '% (' + out.bot.n + 'px m' + out.bot.mean + ')' : '-'}`);
}
console.log('\n--- ranked by bot diff px ---');
results.filter(r => r[2]).sort((a, b) => b[2].n - a[2].n).forEach(r => console.log(`${r[0].padEnd(13)} bot ${String(r[2].n).padStart(6)}px  top ${String(r[1] ? r[1].n : 0).padStart(6)}px`));
await b.close(); s.close();
