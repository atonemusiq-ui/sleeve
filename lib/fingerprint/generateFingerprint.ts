// Client-side audio fingerprinting — no native binary (fpcalc/chromaprint)
// required, so this works in Vercel's serverless environment where a
// brew-installed CLI tool would not be available. Runs in the browser at
// upload time, same place app/dashboard/UploadForm.tsx already generates the
// 15-second preview clip (see lib/generatePreviewClip.ts).
//
// How it works (a compact "temporal gradient" fingerprint, the same family
// of technique Chromaprint and Shazam-style hashes use under the hood):
//   1. Decode the file and downmix/resample to a low mono sample rate — fine
//      detail isn't needed to detect "this is the same recording."
//   2. Slide a window across the audio, computing a magnitude spectrum (FFT)
//      per frame.
//   3. Fold each frame's spectrum into a small number of log-spaced
//      frequency bands (like a coarse chroma/Bark scale).
//   4. For each frame, turn adjacent-band energy comparisons into bits
//      (band[i] louder than band[i+1] => 1, else 0) — this "shape" of the
//      spectrum is robust to volume changes and light re-encoding.
//   5. Concatenate the per-frame bit-words into one fingerprint, base64-ish
//      encoded as plain text for storage in tracks.audio_fingerprint.
//
// Limitation (documented, not hidden): comparison in check-duplicate.ts
// aligns fingerprints from the start with no time-shift search, so this
// catches the practical case this feature targets — the same file
// (re-)uploaded under a different title — but won't catch a duplicate that's
// been trimmed, remixed, or has a different intro length. Good enough for a
// v1 duplicate-upload guard; real cross-correlation alignment would be a
// follow-up if that gap matters in practice.

const TARGET_SAMPLE_RATE = 5512; // low but enough for coarse spectral shape
const FRAME_SIZE = 4096; // power of two, required by the FFT below
const HOP_SIZE = 2048; // 50% overlap
const NUM_BANDS = 17; // -> 16 adjacent-band diffs -> one 16-bit word/frame
const MIN_FREQ = 100; // Hz
const MAX_FREQ = 2000; // Hz — covers most melodic/harmonic content
const MAX_FRAMES = 300; // cap fingerprint length (~110s of audio) so huge
// files don't produce unbounded fingerprints; duplicate-detection only needs
// this much to be reliable.

export type AudioFingerprint = {
  fingerprint: string; // comma-separated 16-bit words, base36-encoded
  durationSeconds: number;
};

export async function generateAudioFingerprint(file: File): Promise<AudioFingerprint> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();
  const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  const durationSeconds = decoded.duration;

  // Downmix to mono at a low sample rate via OfflineAudioContext — same
  // rendering trick generatePreviewClip.ts uses, just for analysis instead
  // of a playable clip.
  const frameCount = Math.ceil(decoded.duration * TARGET_SAMPLE_RATE);
  const offlineContext = new OfflineAudioContext(1, frameCount, TARGET_SAMPLE_RATE);
  const source = offlineContext.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineContext.destination);
  source.start(0);
  const rendered = await offlineContext.startRendering();
  const samples = rendered.getChannelData(0);

  const words: number[] = [];
  const bandEdges = logSpacedBandEdges(MIN_FREQ, MAX_FREQ, NUM_BANDS, TARGET_SAMPLE_RATE, FRAME_SIZE);

  for (
    let start = 0;
    start + FRAME_SIZE <= samples.length && words.length < MAX_FRAMES;
    start += HOP_SIZE
  ) {
    const frame = new Float64Array(FRAME_SIZE);
    for (let i = 0; i < FRAME_SIZE; i++) {
      // Hann window to reduce spectral leakage at frame edges.
      const windowed = samples[start + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME_SIZE - 1)));
      frame[i] = windowed;
    }

    const magnitudes = fftMagnitudes(frame);
    const bandEnergies = bandEdges.slice(0, -1).map((lowBin, i) => {
      const highBin = bandEdges[i + 1];
      let sum = 0;
      for (let bin = lowBin; bin < highBin; bin++) sum += magnitudes[bin] ?? 0;
      return sum / Math.max(1, highBin - lowBin);
    });

    let word = 0;
    for (let i = 0; i < bandEnergies.length - 1; i++) {
      word = (word << 1) | (bandEnergies[i] > bandEnergies[i + 1] ? 1 : 0);
    }
    words.push(word);
  }

  return {
    fingerprint: words.map((w) => w.toString(36)).join(","),
    durationSeconds,
  };
}

// Log-spaced FFT bin edges between minFreq and maxFreq, split into `bands`
// bands (returns `bands + 1` bin-index edges).
function logSpacedBandEdges(
  minFreq: number,
  maxFreq: number,
  bands: number,
  sampleRate: number,
  fftSize: number
): number[] {
  const nyquist = sampleRate / 2;
  const clampedMax = Math.min(maxFreq, nyquist);
  const edges: number[] = [];
  for (let i = 0; i <= bands; i++) {
    const freq = minFreq * Math.pow(clampedMax / minFreq, i / bands);
    const bin = Math.round((freq / nyquist) * (fftSize / 2));
    edges.push(Math.min(bin, fftSize / 2 - 1));
  }
  // Ensure strictly increasing (dedupe collisions from rounding at low freqs).
  for (let i = 1; i < edges.length; i++) {
    if (edges[i] <= edges[i - 1]) edges[i] = edges[i - 1] + 1;
  }
  return edges;
}

// Iterative radix-2 Cooley-Tukey FFT. `input` length must be a power of two
// (FRAME_SIZE = 4096 satisfies this). Returns magnitude spectrum for bins
// [0, N/2).
function fftMagnitudes(input: Float64Array): Float64Array {
  const n = input.length;
  const real = Float64Array.from(input);
  const imag = new Float64Array(n);

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const angleStep = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < half; k++) {
        const angle = angleStep * k;
        const wr = Math.cos(angle);
        const wi = Math.sin(angle);
        const evenIndex = i + k;
        const oddIndex = i + k + half;
        const tr = real[oddIndex] * wr - imag[oddIndex] * wi;
        const ti = real[oddIndex] * wi + imag[oddIndex] * wr;
        real[oddIndex] = real[evenIndex] - tr;
        imag[oddIndex] = imag[evenIndex] - ti;
        real[evenIndex] += tr;
        imag[evenIndex] += ti;
      }
    }
  }

  const half = n / 2;
  const magnitudes = new Float64Array(half);
  for (let i = 0; i < half; i++) {
    magnitudes[i] = Math.hypot(real[i], imag[i]);
  }
  return magnitudes;
}
