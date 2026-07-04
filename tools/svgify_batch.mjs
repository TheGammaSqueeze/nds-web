// Batch-run svgify.mjs over a curated list of static UI chrome PNGs (backgrounds,
// buttons, borders, scrollbar, gradients) and report per-file lossless verification.
// Deliberately excludes per-game icons/anim and boot animation frames.
import { chromium } from 'playwright';
import { svgify } from './svgify.mjs';

const FILES = process.argv.slice(2);
if (!FILES.length) { console.error('usage: node tools/svgify_batch.mjs <file1.png> [file2.png ...]'); process.exit(1); }

const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--no-sandbox'] });
const page = await b.newPage();
let fail = 0;
for (const f of FILES) {
  const out = f.replace(/\.png$/i, '.svg');
  try {
    const r = await svgify(page, f, out, {});
    const tag = r.tilePeriod ? `tile ${r.tilePeriod.join('x')}` : (r.usedGradients ? `${r.gradientRuns} gradient runs` : 'exact rects');
    const status = r.maxDiff === 0 ? 'OK' : `DIFF maxDiff=${r.maxDiff} count=${r.diffCount}`;
    if (r.maxDiff !== 0) fail++;
    console.log(`${status.padEnd(6)} ${f.replace('webapp/public/', '')}  ${r.width}x${r.height}  rects=${r.rectCount}  ${tag}  ${r.bytes}B`);
  } catch (e) {
    fail++;
    console.log(`ERROR  ${f}  ${e.message}`);
  }
}
await b.close();
console.log(fail ? `\n${fail} file(s) NOT lossless` : `\nall ${FILES.length} lossless`);
process.exit(fail ? 1 : 0);
