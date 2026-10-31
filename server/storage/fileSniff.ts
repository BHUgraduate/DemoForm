/**
 * Verify uploads by their actual bytes, not just the filename/MIME the browser claims.
 * Returns the canonical MIME type or null when the content is not an accepted format.
 */
export type SniffResult = { mime: string; width?: number; height?: number } | null;

export function sniffAudio(b: Buffer): SniffResult {
  if (b.length < 12) return null;
  if (b.toString('ascii', 0, 4) === 'fLaC') return { mime: 'audio/flac' };
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE') return { mime: 'audio/wav' };
  if (b.toString('ascii', 0, 3) === 'ID3') return { mime: 'audio/mpeg' };
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return { mime: 'audio/mpeg' }; // raw MPEG frame sync
  return null;
}

export function sniffImage(b: Buffer): SniffResult {
  if (b.length < 24) return null;
  // PNG: signature + IHDR (width/height are big-endian at 16/20)
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  // JPEG: walk segments until a Start-Of-Frame marker
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { mime: 'image/jpeg', height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      }
      i += 2 + b.readUInt16BE(i + 2);
    }
    return { mime: 'image/jpeg' };
  }
  return null;
}
