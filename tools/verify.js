// Verification harness: render the web BIOS headlessly, capture each state's
// top+bottom canvases at native 256x192, and pixel-compare against the melonDS
// reference frames. Emits side-by-side images, diff maps, and report.json.
import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';
import { startServer } from './serve.js';

const OUT = '/work/nds/compare';
const REF = '/work/nds/assets/reference';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(OUT + '/shots', { recursive: true });

// states: { name, refTop?, refBot?, setup: fn-string run in page }
const STATES = [
  { name: 'menu_idle', refTop: 'idle.top.png', refBot: 'idle.bot.png', setup: `DSi.skipBoot(); DSi.setSlot(17);` },
  { name: 'sel_settings', refBot: 'sel_settings.bot.png', setup: `DSi.skipBoot(); DSi.setSlot(0);` },
  { name: 'sel_gamecard', refBot: 'sel_gamecard.bot.png', setup: `DSi.skipBoot(); DSi.setSlot(1);` },
  { name: 'empty_slots', refBot: 'empty_slots.bot.png', setup: `DSi.skipBoot(); DSi.setSlot(25);` },
];

async function grab(page, id) {
  const dataUrl = await page.evaluate((cid) => document.getElementById(cid).toDataURL('image/png'), id);
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

function compare(a, b, outDiff) {
  // perceptual: count pixels differing by more than ~8% (fuzz), plus exact AE
  try {
    const fuzzy = execSync(`compare -metric AE -fuzz 8% "${a}" "${b}" "${outDiff}" 2>&1 || true`).toString().trim();
    const ae = parseInt(fuzzy.split(/\s+/)[0]) || 0;
    const pct = (1 - ae / (256 * 192)) * 100;
    return { diffPx: ae, pct: +pct.toFixed(2) };
  } catch (e) { return { diffPx: -1, pct: 0, err: String(e) }; }
}

(async () => {
  const server = await startServer();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 700, height: 900 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error') console.log('PAGE ERR:', m.text()); });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto(server.url, { waitUntil: 'networkidle' });
  const ready = await page.waitForFunction('window.DSi && window.DSi.ready', null, { timeout: 20000 }).then(() => true).catch(() => false);
  if (!ready) { console.log('FATAL: DSi never became ready (app failed to load) -', await page.evaluate(() => window.__err || 'no __err')); process.exit(1); }
  // freeze the clock to match the reference capture's unset RTC (01/01 00 00)
  await page.evaluate(() => { window.__demoTime = Date.parse('2000-01-01T00:00:00'); window.__demoClockSpace = true; window.__freezeAnim = 120; });

  const report = { when: new Date().toISOString(), states: [] };
  for (const st of STATES) {
    await page.evaluate(st.setup);
    await page.waitForTimeout(250); // let it render/settle
    const top = await grab(page, 'top');
    const bot = await grab(page, 'bottom');
    fs.writeFileSync(`${OUT}/shots/${st.name}.top.png`, top);
    fs.writeFileSync(`${OUT}/shots/${st.name}.bot.png`, bot);
    const entry = { name: st.name };
    for (const [scr, ref, mine] of [['top', st.refTop, `${OUT}/shots/${st.name}.top.png`], ['bot', st.refBot, `${OUT}/shots/${st.name}.bot.png`]]) {
      if (!ref) continue;
      const refPath = `${REF}/${ref}`;
      if (!fs.existsSync(refPath)) continue;
      const diff = `${OUT}/shots/${st.name}.${scr}.diff.png`;
      const r = compare(refPath, mine, diff);
      entry[scr] = r;
      // side-by-side: ref | mine | diff (scaled 2x)
      execSync(`montage "${refPath}" "${mine}" "${diff}" -tile 3x1 -geometry +4+4 -filter point -resize 200% -background '#333' "${OUT}/shots/${st.name}.${scr}.cmp.png"`);
    }
    report.states.push(entry);
    console.log(`${st.name}: ${JSON.stringify(entry)}`);
  }
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  // overall status line
  const lines = report.states.map(s => `${s.name}: bot ${s.bot ? s.bot.pct + '%' : '-'} top ${s.top ? s.top.pct + '%' : '-'}`);
  fs.writeFileSync(`${OUT}/STATUS.txt`, `verify @ ${report.when}\n` + lines.join('\n') + '\n');
  console.log('\n' + lines.join('\n'));
  await browser.close();
  server.close();
})();
