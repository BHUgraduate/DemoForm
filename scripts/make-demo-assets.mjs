// Generates tiny, license-free sample files for the live demo: a 6s WAV tone and a 1600x1600 PNG cover.
import fs from 'node:fs';
import zlib from 'node:zlib';

// WAV: 22.05kHz mono 16-bit, gentle two-note arpeggio
const rate = 22050, secs = 6, n = rate * secs;
const pcm = Buffer.alloc(n * 2);
const notes = [220, 277.18, 329.63, 440];
for (let i = 0; i < n; i++) {
  const f = notes[Math.floor((i / rate) * 2) % notes.length];
  const env = Math.exp(-((i / rate) * 2 % 1) * 3);
  pcm.writeInt16LE(Math.round(Math.sin((2 * Math.PI * f * i) / rate) * 9000 * env), i * 2);
}
const h = Buffer.alloc(44);
h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
fs.writeFileSync('demo-assets/sample-track.wav', Buffer.concat([h, pcm]));

// PNG: concentric-ring cover
const S = 1600, raw = Buffer.alloc((S * 3 + 1) * S);
for (let y = 0; y < S; y++) {
  raw[y * (S * 3 + 1)] = 0;
  for (let x = 0; x < S; x++) {
    const d = Math.hypot(x - S / 2, y - S / 2), ring = Math.sin(d / 22) > 0.55;
    const o = y * (S * 3 + 1) + 1 + x * 3;
    const t = y / S;
    raw[o] = ring ? 255 : 18 + t * 20; raw[o + 1] = ring ? 91 : 18 + t * 10; raw[o + 2] = ring ? 46 : 20;
  }
}
const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  let r = 0xffffffff; for (const x of b) r = t[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.writeFileSync('demo-assets/sample-cover.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('wrote demo-assets/sample-track.wav, sample-cover.png');
