// Permanent AE-diff verification for the three Settings transitions (page slide,
// sub-screen enter, sub-screen back) against the real melonDS captures in
// out/settings_trans/{page,enter,back}. Companion to tools/bootentercmp.mjs -
// same "clone at frame n vs real capture frame n" pattern, run after any change
// to webapp/src/settings.js's transition timing (_startPage/_startEnter/_startBack).
import { chromium } from 'playwright';
import { startServer } from './serve.js';
import { execSync } from 'child_process';
import fs from 'fs';

const CASES = [
  {
    name: 'page', dir: 'out/settings_trans/page',
    setup: `const st = window.DSi.openSettings(); st.page = 0; st.sub = null; st.trans = null; st._startPage(1);`,
  },
  {
    name: 'enter', dir: 'out/settings_trans/enter',
    setup: `const st = window.DSi.openSettings(); st.page = 1; st.sub = null; st.trans = null; st._startEnter(1, 'date');`,
  },
  {
    name: 'back', dir: 'out/settings_trans/back',
    setup: `const st = window.DSi.openSettings(); st.page = 1; st.sub = 'date'; st.trans = null; st._startBack();`,
  },
];

const s = await startServer();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 600, height: 820 } });
await p.goto(s.url, { waitUntil: 'networkidle' });
await p.waitForFunction('window.DSi && window.DSi.ready');

fs.mkdirSync('/tmp/settingstranscmp', { recursive: true });
let grandTotal = 0;
for (const c of CASES) {
  let total = 0, worst = { n: -1, ae: -1 };
  for (let n = 0; n < 35; n++) {
    const ppm = `${c.dir}/g_${String(n).padStart(4, '0')}.bot.ppm`;
    if (!fs.existsSync(ppm)) continue;
    await p.evaluate(({ setup, n }) => {
      // eslint-disable-next-line no-eval
      eval(setup);
      window.DSi.settings.trans.t = n;
      window.DSi.drawSettings();
    }, { setup: c.setup, n });
    const d = await p.evaluate(() => document.getElementById('bottom').toDataURL('image/png'));
    const clonePng = `/tmp/settingstranscmp/${c.name}_clone_${n}.png`;
    fs.writeFileSync(clonePng, Buffer.from(d.split(',')[1], 'base64'));
    const realPng = `/tmp/settingstranscmp/${c.name}_real_${n}.png`;
    execSync(`convert ${ppm} ${realPng}`);
    const ae = parseInt(execSync(`compare -metric AE -fuzz 8% ${realPng} ${clonePng} /tmp/settingstranscmp/${c.name}_diff_${n}.png 2>&1 || true`).toString().trim(), 10) || 0;
    total += ae;
    if (ae > worst.ae) worst = { n, ae };
  }
  console.log(`${c.name}: totalAE=${total} worst f${worst.n}=${worst.ae}`);
  execSync(`convert ${'/tmp/settingstranscmp/' + c.name + '_real_' + worst.n + '.png'} ${'/tmp/settingstranscmp/' + c.name + '_clone_' + worst.n + '.png'} -append -bordercolor '#444' -border 2 /tmp/settingstranscmp_${c.name}_worst.png`);
  grandTotal += total;
}
console.log('grandTotal', grandTotal);
await b.close(); s.close();
