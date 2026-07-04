// BMG message decoder for Nintendo DSi System Menu (menu_common.bmg).
// Format: 'MESGbmg1' header, then INF1 (entry table) + DAT1 (UTF-16LE strings).
//
// Header (0x20 bytes):
//   0x00  char[8]  'MESGbmg1'
//   0x08  u32      total file size
//   0x0C  u32      number of sections (blocks)
//   0x10  u8       text encoding (2 = UTF-16)
//   0x11..0x1F     reserved (zero)
//
// Each block: char[4] magic + u32 size (size includes the 8-byte block header,
// padded to a multiple of the alignment).
//
// INF1:
//   +0x08  u16  entry count
//   +0x0A  u16  entry length (bytes per entry, here 8)
//   +0x0C  u16  file/group id
//   +0x10  entries[] : each entry = u32 strOffset (relative to DAT1 string pool)
//                      followed by (entryLen-4) attribute bytes.
//
// DAT1:
//   +0x08  string pool. Strings are UTF-16LE, null-terminated (0x0000).
//          Offset 0 is an empty string used by unused entries.
//
// Escape codes: the BMG standard inline escape is the code unit 0x001A followed
// by a u8 total length then a u8 group id and payload. None appear in these
// files. What *does* appear are Unicode Private-Use-Area glyphs (0xE003-0xE005)
// that the DSi font renders as button / camera icons. We surface those as
// readable {icon:Exxx} tokens. Everything else (incl. Japanese) is escaped to
// standard JSON \uXXXX by the ASCII serializer so the output is lossless.

const fs = require('fs');
const path = require('path');

function findBlocks(buf) {
  const blocks = {};
  let pos = 0x20;
  const n = buf.readUInt32LE(0x0C);
  for (let i = 0; i < n && pos + 8 <= buf.length; i++) {
    const magic = buf.toString('latin1', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    blocks[magic] = { off: pos, size };
    if (size < 8) break;
    pos += size;
  }
  return blocks;
}

// Known Private-Use-Area icon glyphs in the DSi menu font.
const ICONS = {
  0xE003: 'icon:E003', // leading glyph used before "Menu" / "Full Screen"
  0xE004: 'icon:E004', // camera glyph (leading,  e.g. "[cam] Camera")
  0xE005: 'icon:E005', // camera glyph (trailing, e.g. "Camera [cam]")
};

// Decode one null-terminated UTF-16LE string starting at absolute byte offset.
// Returns { text, escapes } where text keeps real newlines, maps known PUA
// glyphs to {icon:Exxx} tokens, and renders any 0x1A escape as {esc:...}.
function decodeString(buf, start) {
  let out = '';
  const escapes = [];
  let i = start;
  while (i + 1 < buf.length) {
    const u = buf.readUInt16LE(i);
    if (u === 0x0000) break;
    if (u === 0x001A) {
      // BMG inline escape: 0x1A, u8 length (total bytes incl. the 2 marker
      // bytes), u8 group, then payload.
      const len = buf[i + 2];
      const grp = buf[i + 3];
      const payload = buf.slice(i + 4, i + 2 + len).toString('hex');
      const tok = `esc:grp${grp}:${payload}`;
      escapes.push(tok);
      out += `{${tok}}`;
      i += len;
      continue;
    }
    if (ICONS[u] !== undefined) {
      escapes.push(ICONS[u]);
      out += `{${ICONS[u]}}`;
      i += 2;
      continue;
    }
    out += String.fromCharCode(u);
    i += 2;
  }
  return { text: out, escapes };
}

function parseBMG(buf) {
  if (buf.toString('latin1', 0, 8) !== 'MESGbmg1') throw new Error('not a BMG');
  const encoding = buf[0x10];
  const blocks = findBlocks(buf);
  const inf = blocks['INF1'], dat = blocks['DAT1'];
  if (!inf || !dat) throw new Error('missing INF1/DAT1');
  const count = buf.readUInt16LE(inf.off + 0x08);
  const entryLen = buf.readUInt16LE(inf.off + 0x0A);
  const groupId = buf.readUInt16LE(inf.off + 0x0C);
  const entriesOff = inf.off + 0x10;
  const poolOff = dat.off + 0x08; // DAT1 string pool base
  const entries = [];
  for (let e = 0; e < count; e++) {
    const eo = entriesOff + e * entryLen;
    const strOff = buf.readUInt32LE(eo);
    const attr = buf.slice(eo + 4, eo + entryLen).toString('hex');
    const { text, escapes } = decodeString(buf, poolOff + strOff);
    entries.push({ index: e, strOff, attr, text, escapes });
  }
  return { encoding, groupId, count, entryLen, entries };
}

// Serialize a JS value to JSON but force every char outside printable ASCII to
// a standard \uXXXX escape (lossless, keeps the file pure ASCII, "escapes"
// every control / non-Latin / PUA code point).
function asciiJSON(value) {
  let s = JSON.stringify(value, null, 2);
  return s.replace(/[-￿]/g, (c) =>
    '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

module.exports = { parseBMG, decodeString, asciiJSON, ICONS };

// CLI: node bmg.js <msgRootDir> <outDir>
if (require.main === module) {
  const msgRoot = process.argv[2] || 'assets/launcher/fs/message/ww';
  const outDir = process.argv[3] || 'assets/launcher/decoded/text';
  fs.mkdirSync(outDir, { recursive: true });
  const langs = fs.readdirSync(msgRoot).filter((d) =>
    fs.existsSync(path.join(msgRoot, d, 'menu_common.bmg')));
  const summary = {};
  for (const lang of langs.sort()) {
    const file = path.join(msgRoot, lang, 'menu_common.bmg');
    const parsed = parseBMG(fs.readFileSync(file));
    const strings = parsed.entries.map((e) => e.text);
    fs.writeFileSync(path.join(outDir, lang + '.json'), asciiJSON(strings) + '\n');
    summary[lang] = parsed.count;
    if (lang === 'us_eng') {
      console.log('=== us_eng strings ===');
      parsed.entries.forEach((e) => {
        const t = JSON.stringify(e.text);
        console.log(String(e.index).padStart(2), e.attr, t);
      });
    }
  }
  console.log('\nwrote', Object.keys(summary).length, 'langs ->', outDir);
  console.log(summary);
}
