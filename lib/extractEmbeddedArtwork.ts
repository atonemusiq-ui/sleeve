// Best-effort extraction of cover art already embedded in an audio file's
// own tags — an ID3v2 "APIC" (attached picture) frame in an MP3, or the same
// kind of frame inside an "id3 " RIFF sub-chunk some WAV files carry. The
// point is that a song and its artwork are often already "glued together"
// by whatever DAW or distributor tagged the file, so the artist shouldn't
// have to re-upload artwork Fyby could just read out of the file itself
// (see UploadForm.tsx, which offers it as a one-click confirmation rather
// than silently using it). Returns null for anything unsupported,
// untagged, or that fails to parse — this is always a convenience, never a
// requirement, so a parse failure just falls through to the normal manual
// cover-art upload.
export type EmbeddedArtwork = { blob: Blob; mimeType: string };

export async function extractEmbeddedArtwork(file: File): Promise<EmbeddedArtwork | null> {
  try {
    const buf = new Uint8Array(await file.arrayBuffer());

    // The common case: an ID3v2 tag at the very start of the file (MP3, and
    // some WAV files too).
    const direct = readId3v2Artwork(buf, 0);
    if (direct) return direct;

    // WAV: a RIFF container that can carry its own embedded "id3 " chunk
    // holding a full ID3v2 tag in the same frame format as above.
    if (isRiffWave(buf)) {
      const chunkOffset = findRiffChunk(buf, "id3 ");
      if (chunkOffset != null) {
        const nested = readId3v2Artwork(buf, chunkOffset);
        if (nested) return nested;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function isRiffWave(buf: Uint8Array): boolean {
  return buf.length > 12 && asciiAt(buf, 0, 4) === "RIFF" && asciiAt(buf, 8, 4) === "WAVE";
}

// Walks RIFF sub-chunks looking for one with the given 4-character id.
// Returns the byte offset of that chunk's *data* (just past its own 8-byte
// id+size header), or null if not found.
function findRiffChunk(buf: Uint8Array, id: string): number | null {
  let offset = 12; // past "RIFF"<size>"WAVE"
  while (offset + 8 <= buf.length) {
    const chunkId = asciiAt(buf, offset, 4);
    const size = readUInt32LE(buf, offset + 4);
    const dataStart = offset + 8;
    if (chunkId === id) return dataStart;
    offset = dataStart + size + (size % 2); // chunks are word-aligned
  }
  return null;
}

function asciiAt(buf: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...buf.subarray(offset, offset + length));
}

function readUInt32LE(buf: Uint8Array, offset: number): number {
  return (buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)) >>> 0;
}

function readUInt32BE(buf: Uint8Array, offset: number): number {
  return ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0;
}

function readSyncsafe(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset] & 0x7f) << 21) |
    ((buf[offset + 1] & 0x7f) << 14) |
    ((buf[offset + 2] & 0x7f) << 7) |
    (buf[offset + 3] & 0x7f)
  );
}

// Parses an ID3v2 tag starting at `start` and returns the first APIC
// frame's image data, if any. Supports ID3v2.3 and ID3v2.4 (the two
// versions actually in the wild), including v2.4's syncsafe frame sizes.
function readId3v2Artwork(buf: Uint8Array, start: number): EmbeddedArtwork | null {
  if (start + 10 > buf.length) return null;
  if (asciiAt(buf, start, 3) !== "ID3") return null;

  const majorVersion = buf[start + 3];
  const flags = buf[start + 5];
  const tagSize = readSyncsafe(buf, start + 6);
  let pos = start + 10;
  const tagEnd = Math.min(pos + tagSize, buf.length);

  // Skip an extended header if present (bit 6 of the flags byte).
  if (flags & 0x40) {
    if (pos + 4 > buf.length) return null;
    const extSize = majorVersion >= 4 ? readSyncsafe(buf, pos) : readUInt32BE(buf, pos);
    pos += extSize;
  }

  while (pos + 10 <= tagEnd) {
    const frameId = asciiAt(buf, pos, 4);
    if (!/^[A-Z0-9]{4}$/.test(frameId)) break; // padding/garbage — stop

    const frameSize = majorVersion >= 4 ? readSyncsafe(buf, pos + 4) : readUInt32BE(buf, pos + 4);
    const frameStart = pos + 10;
    if (frameSize <= 0 || frameStart + frameSize > tagEnd) break;

    if (frameId === "APIC") {
      const parsed = parseApicFrame(buf, frameStart, frameSize);
      if (parsed) return parsed;
    }

    pos = frameStart + frameSize;
  }

  return null;
}

function parseApicFrame(buf: Uint8Array, start: number, size: number): EmbeddedArtwork | null {
  if (size < 4) return null;
  let p = start;
  const end = start + size;

  const textEncoding = buf[p];
  p += 1;

  // MIME type: null-terminated ASCII (e.g. "image/jpeg").
  let mimeEnd = p;
  while (mimeEnd < end && buf[mimeEnd] !== 0) mimeEnd++;
  const mimeType = asciiAt(buf, p, mimeEnd - p) || "image/jpeg";
  p = mimeEnd + 1;

  if (p >= end) return null;
  p += 1; // picture type byte (cover front/back/etc — not needed here)

  // Description: null-terminated. Encodings 1 and 2 are UTF-16 (2-byte
  // nulls); 0 and 3 (Latin-1/UTF-8) use a single null byte.
  const isWide = textEncoding === 1 || textEncoding === 2;
  if (isWide) {
    while (p + 1 < end && !(buf[p] === 0 && buf[p + 1] === 0)) p += 2;
    p += 2;
  } else {
    while (p < end && buf[p] !== 0) p++;
    p += 1;
  }

  if (p >= end) return null;

  const imageBytes = buf.slice(p, end);
  if (imageBytes.length < 100) return null; // implausibly small — skip

  return { blob: new Blob([imageBytes], { type: mimeType || "image/jpeg" }), mimeType };
}
