import { chromium } from 'playwright';
import { startServer } from './serve.js';
import { execSync } from 'child_process';
import fs from 'fs';
function readPPM(p) { const b = fs.readFileSync(p); let o = 0; const t = () => { while (b[o] <= 32) o++; let s = o; while (b[o] > 32) o++; return b.slice(s, o).toString(); }; t(); const w = +t(), h = +t(); t(); o++; return { w, h, d: b.slice(o) }; }
function readPNG(p) { const ppm = execSync(`convert "${p}" -depth 8 ppm:-`, { maxBuffer: 1 << 26 }); let o = 0; const t = () => { while ([32, 10, 13, 9].includes(ppm[o])) o++; let s = o; while (![32, 10, 13, 9].includes(ppm[o])) o++; return ppm.toString('ascii', s, o); }; t(); const w = +t(), h = +t(); t(); o++; return { w, h, d: ppm.subarray(o) }; }
// scrollbar band y170..191 diff
function sbDiff(ref, cl) { let n = 0, mx = 0, worstY = -1, worstX = -1; for (let y = 170; y < 192; y++) for (let x = 0; x < 256; x++) { const i = (y * 256 + x) * 3; const d = Math.max(Math.abs(ref.d[i] - cl.d[i]), Math.abs(ref.d[i + 1] - cl.d[i + 1]), Math.abs(ref.d[i + 2] - cl.d[i + 2])); if (d > 20) { n++; if (d > mx) { mx = d; worstY = y; worstX = x; } } } return { n, mx, worstX, worstY }; }

const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 600, height: 820 } });
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(s.url, { waitUntil: 'networkidle' });
await p.waitForFunction('window.DSi && window.DSi.ready');
const N = +(process.argv[2] || 39);
const rows = [];
for (let i = 0; i < N; i++) {
  await p.evaluate((sl) => window.DSi.renderCam(sl, sl, sl), i);
  await p.waitForTimeout(12);
  const d = await p.evaluate(() => document.getElementById('bottom').toDataURL('image/png'));
  const f = `/tmp/sb_${String(i).padStart(2, '0')}.png`; fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64'));
  const ref = `out/sbsweep/sw${String(i).padStart(2, '0')}.bot.ppm`;
  if (!fs.existsSync(ref)) continue;
  const r = sbDiff(readPPM(ref), readPNG(f));
  rows.push({ i, ...r });
}
await b.close(); s.close();
rows.sort((a, b) => b.n - a.n);
console.log('scrollbar diff per slot (worst first): slot  diffPx  maxDelta  @worst(x,y)');
for (const r of rows) console.log(`  slot ${String(r.i).padStart(2)}  ${String(r.n).padStart(4)}px  max ${String(r.mx).padStart(3)}  @(${r.worstX},${r.worstY})`);
const total = rows.reduce((a, r) => a + r.n, 0);
console.log(`total scrollbar diff across ${rows.length} positions: ${total}px, worst slot ${rows[0] ? rows[0].i : '-'} (${rows[0] ? rows[0].n : 0}px)`);
