// SWAR/SWAV decoder for the DSi firmware wave archives. Decodes each embedded SWAV sample
// (PCM8 / PCM16 / IMA-ADPCM) to raw 16-bit PCM and writes a WAV. These are the clean source
// sound effects (no BGM mixed in, unlike the melonDS recordings). Used to restore the real
// UI SFX and, together with the SSEQ/SBNK path, the firmware BGM. NITRO SWAR layout:
// 'SWAR' hdr -> 'DATA' block -> 32 reserved bytes -> u32 nSamples -> nSamples*u32 abs offsets
// -> each SWAV info: u8 type, u8 loop, u16 rate, u16 timer, u16 loopStart(words), u32 len(words).
'use strict';
const fs = require('fs');

const IMA_STEP = [7,8,9,10,11,12,13,14,16,17,19,21,23,25,28,31,34,37,41,45,50,55,60,66,73,80,88,97,107,118,130,143,157,173,190,209,230,253,279,307,337,371,408,449,494,544,598,658,724,796,876,963,1060,1166,1282,1411,1552,1707,1878,2066,2272,2499,2749,3024,3327,3660,4026,4428,4871,5358,5894,6484,7132,7845,8630,9493,10442,11487,12635,13899,15289,16818,18500,20350,22385,24623,27086,29794,32767];
const IMA_INDEX = [-1,-1,-1,-1,2,4,6,8,-1,-1,-1,-1,2,4,6,8];

function decodeADPCM(buf, start, end) {
  // header: int16 initial predictor, u8 index, u8 pad
  let pred = buf.readInt16LE(start);
  let index = buf[start + 2];
  if (index > 88) index = 88;
  const out = [pred];
  for (let p = start + 4; p < end; p++) {
    const byte = buf[p];
    for (let n = 0; n < 2; n++) {
      const code = n === 0 ? (byte & 0xf) : (byte >> 4);
      const step = IMA_STEP[index];
      let diff = step >> 3;
      if (code & 1) diff += step >> 2;
      if (code & 2) diff += step >> 1;
      if (code & 4) diff += step;
      if (code & 8) pred -= diff; else pred += diff;
      if (pred > 32767) pred = 32767; else if (pred < -32768) pred = -32768;
      index += IMA_INDEX[code];
      if (index < 0) index = 0; else if (index > 88) index = 88;
      out.push(pred);
    }
  }
  return out;
}

function parseSWAR(buf) {
  if (buf.toString('latin1', 0, 4) !== 'SWAR') throw new Error('not a SWAR');
  // DATA block at 0x10; reserved 0x18..0x37; count at 0x38; offsets at 0x3C
  const nSamples = buf.readUInt32LE(0x38);
  const offs = [];
  for (let i = 0; i < nSamples; i++) offs.push(buf.readUInt32LE(0x3C + i * 4));
  const samples = [];
  for (let i = 0; i < nSamples; i++) {
    const o = offs[i];
    const type = buf[o], loop = buf[o + 1], rate = buf.readUInt16LE(o + 2);
    const loopStart = buf.readUInt16LE(o + 6), lenWords = buf.readUInt32LE(o + 8);
    const dataStart = o + 12;
    const dataEnd = Math.min(dataStart + (loopStart + lenWords) * 4, i + 1 < nSamples ? offs[i + 1] : buf.length);
    let pcm;
    if (type === 0) { pcm = []; for (let p = dataStart; p < dataEnd; p++) pcm.push(buf.readInt8(p) << 8); }
    else if (type === 1) { pcm = []; for (let p = dataStart; p + 1 < dataEnd; p += 2) pcm.push(buf.readInt16LE(p)); }
    else if (type === 2) pcm = decodeADPCM(buf, dataStart, dataEnd);
    else pcm = [];
    samples.push({ index: i, type, loop, rate, loopStart, lenWords, nPcm: pcm.length, seconds: +(pcm.length / (rate || 1)).toFixed(3), pcm });
  }
  return samples;
}

function writeWAV(path, pcm, rate) {
  const n = pcm.length, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, pcm[i] | 0)), 44 + i * 2);
  fs.writeFileSync(path, buf);
}

module.exports = { parseSWAR, decodeADPCM, writeWAV };

if (require.main === module) {
  const src = process.argv[2], outdir = process.argv[3];
  const samples = parseSWAR(fs.readFileSync(src));
  const TYPE = ['PCM8', 'PCM16', 'ADPCM'];
  console.log(`${src}: ${samples.length} samples`);
  for (const s of samples) console.log(`  #${String(s.index).padStart(2)} ${TYPE[s.type] || s.type} rate=${s.rate} loop=${s.loop} nPcm=${s.nPcm} ${s.seconds}s`);
  if (outdir) { fs.mkdirSync(outdir, { recursive: true }); for (const s of samples) writeWAV(`${outdir}/s${String(s.index).padStart(2, '0')}_${s.rate}hz.wav`, s.pcm, s.rate || 22050); console.log('wrote WAVs ->', outdir); }
}
