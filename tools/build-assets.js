// Builds web app assets from the NAND dump:
//  - copies static icon PNGs -> webapp/public/icons/<id>.png
//  - builds animated sprite sheets -> webapp/public/icons/<id>_anim.png
//  - emits webapp/data/apps.json (39-slot carousel layout + per-app metadata)
const fs = require('fs');
const cp = require('child_process');
const ROOT = '/work/nds';
const ICONS_SRC = `${ROOT}/assets/icons`;
const OUT_ICONS = `${ROOT}/webapp/public/icons`;
const OUT_DATA = `${ROOT}/webapp/data`;
fs.mkdirSync(OUT_ICONS, { recursive: true });
fs.mkdirSync(OUT_DATA, { recursive: true });

const titles = JSON.parse(fs.readFileSync(`${ICONS_SRC}/titles.json`, 'utf8'));
const byId = Object.fromEntries(titles.map(t => [t.titleidHex, t]));

// Authoritative on-screen carousel order (captured empirically from the real menu).
const ORDER = [
  '00030015_484e4245', // 0  System Settings
  'GAMECARD',          // 1  Game Card slot (special)
  '00030005_484e4945', // 2  Nintendo DSi Camera
  '00030005_484e4b45', // 3  Nintendo DSi Sound
  '00030004_4b344445', // 4  SUDOKU
  '00030004_4b533345', // 5  Shantae: Risky's Revenge
  '00030004_4b4d4745', // 6  Mighty Flip Champs!
  '00030004_4b435645', // 7  Cave Story
  '00030004_4b513945', // 8  Zelda: Four Swords
  '00030004_4b445645', // 9  Dark Void Zero
  '00030004_4b504145', // 10 A Kappa's Trail
  '00030004_4b444d45', // 11 Mario vs. Donkey Kong: Minis March Again!
  '00030004_4b4e4145', // 12 Petit Computer
  '00030004_4b414145', // 13 AQUIA
  '00030004_4b414845', // 14 BOXLIFE
  '00030004_4b415045', // 15 PiCTOBiTS
  '00030004_4b535245', // 16 Aura-Aura Climber
  '00030004_4b503645', // 17 Bird & Beans
  '00030004_4b414d45', // 18 Paper Airplane Chase
  '00030015_484e4645', // 19 Nintendo DSi Shop
  '00030005_484e4441', // 20 DS Download Play
  '00030005_484e4541', // 21 PictoChat
];
const TOTAL_SLOTS = 39;

function rgbaToPng(rgbaPath, pngPath) {
  // -strip: see tools/ncer.js writePNG for why (ImageMagick's default gAMA/cHRM
  // chunks make Chromium silently shift decoded RGB values by a few levels).
  cp.execSync(`convert -size 32x32 -depth 8 rgba:"${rgbaPath}" -strip "${pngPath}"`);
}

function buildAnim(id, frameCount) {
  // horizontally concatenate frame PNGs into a sprite sheet (frameCount*32 x 32)
  const framePngs = [];
  for (let i = 0; i < 64; i++) {
    const fr = `${ICONS_SRC}/${id}_f${String(i).padStart(2, '0')}.rgba`;
    if (!fs.existsSync(fr)) continue;
    const png = `/tmp/_anim_${id}_${i}.png`;
    rgbaToPng(fr, png);
    framePngs.push(png);
  }
  if (framePngs.length === 0) return 0;
  const sheet = `${OUT_ICONS}/${id}_anim.png`;
  // -strip here too: +append re-encodes the sheet from the (already-stripped)
  // frame PNGs, and ImageMagick's default PNG writer re-adds its own gAMA/cHRM
  // chunks on write regardless of what the inputs carried.
  cp.execSync(`convert ${framePngs.map(p => `"${p}"`).join(' ')} +append -strip "${sheet}"`);
  framePngs.forEach(p => fs.unlinkSync(p));
  return framePngs.length;
}

// language/title parsing: title text is "Name\nPublisher" (sometimes 3 lines)
function parseTitle(t) {
  const raw = (t.title_en || '').split('\n').filter(s => s.length);
  // Last line is publisher; the rest is the name.
  let name = raw.slice(0, Math.max(1, raw.length - 1)).join(' ');
  let pub = raw.length > 1 ? raw[raw.length - 1] : '';
  return { name, publisher: pub, lines: raw };
}

const slots = [];
for (let i = 0; i < TOTAL_SLOTS; i++) {
  const id = ORDER[i];
  if (id === undefined) { slots.push({ slot: i, type: 'empty' }); continue; }
  if (id === 'GAMECARD') {
    slots.push({ slot: i, type: 'gamecard', name: 'There is nothing inserted in the Game Card slot.', launchable: false });
    continue;
  }
  const t = byId[id];
  if (!t) { console.warn('missing title', id); slots.push({ slot: i, type: 'empty' }); continue; }
  // static icon
  rgbaToPng(`${ICONS_SRC}/${id}.rgba`, `${OUT_ICONS}/${id}.png`);
  let animFrames = 0, frameDurations = [];
  if (t.animated && t.frameCount > 0) {
    animFrames = buildAnim(id, t.frameCount);
    frameDurations = t.frameDurations;
  }
  const { name, publisher, lines } = parseTitle(t);
  slots.push({
    slot: i, type: 'app', id, gamecode: t.gamecode,
    name, publisher, lines,
    icon: `icons/${id}.png`,
    anim: animFrames > 0 ? `icons/${id}_anim.png` : null,
    animFrames, frameDurations,
    launchable: true,
  });
}

const data = { totalSlots: TOTAL_SLOTS, defaultSlot: 17, slots };
fs.writeFileSync(`${OUT_DATA}/apps.json`, JSON.stringify(data, null, 2));
console.log(`wrote apps.json: ${slots.length} slots, ${slots.filter(s => s.type==='app').length} apps`);
console.log('animated:', slots.filter(s => s.animFrames).map(s => `${s.name}(${s.animFrames})`).join(', '));
