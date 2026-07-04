// Per-pixel, per-region diff analyzer. For a given screen state it compares the
// clone render vs the melonDS reference pixel-by-pixel, then reports WHERE the
// gaps are (by semantic region), ranked by severity, plus a delta heatmap.
//
// Usage: node pixdiff.js <ref.png> <clone.png> <screen:top|bot> <label> [outdir]
const fs = require('fs');
const { execSync } = require('child_process');

function readPNG(path) {
  // convert to raw RGB via ImageMagick (opaque canvases)
  const ppm = execSync(`convert "${path}" -depth 8 ppm:-`, { maxBuffer: 1 << 26 });
  let pos = 0;
  const tok = () => { while ([32, 10, 13, 9].includes(ppm[pos])) pos++; let s = pos; while (![32, 10, 13, 9].includes(ppm[pos])) pos++; return ppm.toString('ascii', s, pos); };
  tok(); const w = +tok(), h = +tok(); tok(); pos++;
  return { w, h, data: ppm.subarray(pos, pos + w * h * 3) };
}
function px(im, x, y) { const i = (y * im.w + x) * 3; return [im.data[i], im.data[i + 1], im.data[i + 2]]; }
function delta(a, b) { return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])); }

const REGIONS = {
  bot: [
    ['name_box', 3, 3, 250, 74],
    ['name_text', 40, 22, 176, 38],
    ['tab_pointer', 112, 74, 32, 10],
    ['sel_frame', 95, 79, 66, 82],
    ['sel_icon', 111, 96, 34, 34],
    ['start_label', 100, 132, 56, 24],
    ['slot_left1', 33, 84, 60, 76],
    ['slot_right1', 161, 84, 60, 76],
    ['slot_left2', -32, 84, 60, 76],
    ['slot_right2', 226, 84, 60, 76],
    ['scrollbar', 0, 180, 256, 12],
    ['bg_field_upper', 0, 78, 256, 6],
  ],
  top: [
    ['top_bar', 0, 0, 256, 18],
    ['top_bar_user', 24, 2, 60, 14],
    ['top_bar_clock', 150, 2, 70, 14],
    ['top_bar_battery', 232, 2, 24, 14],
    ['photo_panel', 8, 20, 240, 150],
    ['photo_camera_icon', 116, 38, 24, 20],
    ['photo_text', 60, 70, 136, 86],
    ['camera_labels', 0, 170, 256, 22],
  ],
};

const ref = readPNG(process.argv[2]);
const clone = readPNG(process.argv[3]);
const screen = process.argv[4];
const label = process.argv[5];
const outdir = process.argv[6] || '/work/nds/compare/pixdiff';
fs.mkdirSync(outdir, { recursive: true });

const W = ref.w, H = ref.h;
const THRESH = 20; // per-channel delta above which a pixel "differs" notably
const heat = Buffer.alloc(W * H * 3);
let totalDiff = 0, totalDelta = 0;
const colDiff = new Array(W).fill(0), rowDiff = new Array(H).fill(0);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const d = delta(px(ref, x, y), px(clone, x, y));
  totalDelta += d;
  const o = (y * W + x) * 3;
  if (d > THRESH) { totalDiff++; colDiff[x]++; rowDiff[y]++; heat[o] = Math.min(255, d * 2); heat[o + 1] = 0; heat[o + 2] = 0; }
  else { heat[o] = heat[o + 1] = heat[o + 2] = d; }
}
fs.writeFileSync(`${outdir}/_heat.ppm`, Buffer.concat([Buffer.from(`P6\n${W} ${H}\n255\n`), heat]));
execSync(`convert "${outdir}/_heat.ppm" -filter point -resize 300% "${outdir}/${label}.${screen}.heat.png" && rm -f "${outdir}/_heat.ppm"`);

function regionStats(rx, ry, rw, rh) {
  let n = 0, diff = 0, sum = 0, mx = 0;
  for (let y = Math.max(0, ry); y < Math.min(H, ry + rh); y++)
    for (let x = Math.max(0, rx); x < Math.min(W, rx + rw); x++) {
      const d = delta(px(ref, x, y), px(clone, x, y)); n++; sum += d; if (d > mx) mx = d; if (d > THRESH) diff++;
    }
  return { px: n, diffPx: diff, diffPct: +(100 * diff / n).toFixed(1), meanDelta: +(sum / n).toFixed(1), maxDelta: mx };
}

const regions = (REGIONS[screen] || []).map(([name, x, y, w, h]) => ({ region: name, rect: [x, y, w, h], ...regionStats(x, y, w, h) }));
regions.sort((a, b) => b.diffPx - a.diffPx);

// dominant diff columns/rows (to spot systematic shifts)
const topCols = colDiff.map((v, x) => [x, v]).filter(([, v]) => v > 3).sort((a, b) => b[1] - a[1]).slice(0, 8);
const report = {
  label, screen,
  overall: { diffPx: totalDiff, diffPct: +(100 * totalDiff / (W * H)).toFixed(2), meanDelta: +(totalDelta / (W * H)).toFixed(2) },
  worstRegions: regions.slice(0, 8),
  allRegions: regions,
};
fs.writeFileSync(`${outdir}/${label}.${screen}.json`, JSON.stringify(report, null, 2));
console.log(`\n[${label} ${screen}] overall diff ${report.overall.diffPct}% (${totalDiff}px), meanDelta ${report.overall.meanDelta}`);
console.log('worst regions:');
for (const r of regions.slice(0, 8)) console.log(`  ${r.region.padEnd(16)} ${String(r.diffPx).padStart(5)}px  ${r.diffPct}%  mean ${r.meanDelta}  max ${r.maxDelta}`);
