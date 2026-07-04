// Record the live web BIOS running (boot + menu navigation + launch) by
// grabbing both canvases each tick, then encode to video and build a
// side-by-side (emulator | clone) comparison strip.
import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';
import { startServer } from './serve.js';

const OUT = '/work/nds/compare/video';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT + '/frames', { recursive: true });

async function grabBoth(page) {
  return await page.evaluate(() => {
    const t = document.getElementById('top').toDataURL('image/png');
    const b = document.getElementById('bottom').toDataURL('image/png');
    return [t, b];
  });
}
function save(i, [t, b]) {
  const ti = Buffer.from(t.split(',')[1], 'base64');
  const bi = Buffer.from(b.split(',')[1], 'base64');
  fs.writeFileSync(`${OUT}/frames/t_${String(i).padStart(4, '0')}.png`, ti);
  fs.writeFileSync(`${OUT}/frames/b_${String(i).padStart(4, '0')}.png`, bi);
}

(async () => {
  const server = await startServer();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 600, height: 820 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto(server.url, { waitUntil: 'networkidle' });
  await page.waitForFunction('window.DSi && window.DSi.ready', null, { timeout: 15000 });
  await page.evaluate(() => { window.__demoTime = Date.parse('2000-01-01T00:00:00'); window.__demoClockSpace = true; });

  let i = 0;
  const cap = async (n, gapMs = 33) => { for (let k = 0; k < n; k++) { save(i++, await grabBoth(page)); await page.waitForTimeout(gapMs); } };
  const press = (key) => page.evaluate((k) => window.DSi && window.__press && window.__press(k), key);

  // 1) boot sequence (let it play ~5s)
  await page.evaluate(() => { window.DSi.seekBootFrame(0); });
  await cap(120, 40);
  // 2) tap to continue -> menu enter
  await page.evaluate(() => { window.DSi.boot && window.DSi.boot.proceed(); });
  await cap(30, 40);
  await page.evaluate(() => { window.DSi.skipBoot(); window.DSi.setSlot(17); });
  await cap(15, 40);
  // 3) navigate right a few times
  for (let n = 0; n < 6; n++) { await page.evaluate(() => window.DSi.launcher.move(1)); await cap(10, 33); }
  // 4) navigate left back to settings
  for (let n = 0; n < 8; n++) { await page.evaluate(() => window.DSi.launcher.move(-1)); await cap(8, 33); }
  // 5) launch settings
  await page.evaluate(() => { window.DSi.setSlot(0); });
  await cap(10, 40);

  await browser.close();
  server.close();

  // encode clone-only video (top over bottom)
  execSync(`cd ${OUT}/frames && for f in t_*.png; do n=\${f#t_}; convert "t_$n" "b_$n" -append "stack_$n"; done`, { shell: '/bin/bash' });
  execSync(`ffmpeg -hide_banner -loglevel error -y -framerate 30 -pattern_type glob -i '${OUT}/frames/stack_*.png' -vf "scale=512:-1:flags=neighbor" -pix_fmt yuv420p ${OUT}/clone.mp4`);
  console.log('wrote', OUT + '/clone.mp4', 'frames:', i);
})();
