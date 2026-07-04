// Manifest of which PNG assets actually have an .svg sibling, so the scale>1 loader only
// requests .svg for those (instead of trying - and 404ing - a .svg for every PNG).
import fs from 'fs';
import path from 'path';
const root = 'webapp/public';
const out = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.svg')) {
      const png = p.slice(0, -4) + '.png';
      if (fs.existsSync(png)) out.push(path.relative('webapp', png).split(path.sep).join('/'));
    }
  }
}
walk(root);
out.sort();
fs.writeFileSync('webapp/public/svg_manifest.json', JSON.stringify(out));
console.log('svg_manifest.json:', out.length, 'png assets have an svg (of', fs.readdirSync(root).length, 'top entries)');
