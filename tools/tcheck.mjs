import { chromium } from 'playwright';
import { startServer } from './serve.js';
import { execSync } from 'child_process';
import fs from 'fs';
const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 600, height: 820 } });
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.goto(s.url, { waitUntil: 'networkidle' });
await p.waitForFunction('window.DSi && window.DSi.ready');
fs.mkdirSync('/tmp/tc', { recursive: true });
const shot = async (id, name) => { const d = await p.evaluate((i) => document.getElementById(i).toDataURL('image/png'), id); const f = `/tmp/tc/${name}.png`; fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64')); return f; };

const kind = process.argv[2] || 'enter';   // enter | back
const frames = [0, 8, 13, 18, 23, 28, 33];
if (kind === 'enter') await p.evaluate(() => { const st = window.DSi.openSettings(); st.trans = null; st.page = 1; st.sub = null; st._startEnter(1, 'date'); });
else await p.evaluate(() => { const st = window.DSi.openSettings(); st.trans = null; st.page = 1; st.sub = 'date'; st._startBack(); });
const bots = [], tops = [];
for (const t of frames) {
  await p.evaluate((t) => { const st = window.DSi.settings; st.trans.t = t; window.DSi.drawSettings(); }, t);
  await p.waitForTimeout(15);
  bots.push(await shot('bottom', `${kind}_bot_${t}`));
  tops.push(await shot('top', `${kind}_top_${t}`));
}
await b.close(); s.close();
// reference frames (g_0000..) at the same indices
const refbot = frames.map(t => { const n = String(t).padStart(4, '0'); const f = `/tmp/tc/ref_bot_${t}.png`; execSync(`convert out/settings_trans/${kind}/g_${n}.bot.ppm ${f}`); return f; });
const reftop = frames.map(t => { const n = String(t).padStart(4, '0'); const f = `/tmp/tc/ref_top_${t}.png`; execSync(`convert out/settings_trans/${kind}/g_${n}.top.ppm ${f}`); return f; });
execSync(`montage ${reftop.join(' ')} ${refbot.join(' ')} ${tops.join(' ')} ${bots.join(' ')} -tile 7x4 -geometry +2+2 -background '#111' /tmp/tcheck_${kind}.png`);
console.log(`wrote /tmp/tcheck_${kind}.png (rows: ref-top, ref-bot, clone-top, clone-bot; cols t=${frames.join(',')})`);
