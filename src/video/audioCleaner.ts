/**
 * Studio-grade PCM WAV silence tightening without robotic chopping or clicks.
 * Trims excessive leading/trailing dead air and compresses long internal pauses (>0.38s)
 * down to natural conversational breathing room (~0.24s–0.30s) using raised-cosine crossfades.
 */
import { writePcmWavHeader } from './timeline';

export interface SilenceCleanStats {
  originalDurationSec: number;
  cleanedDurationSec: number;
  removedSec: number;
  compressedPauses: number;
}

export interface SilenceCleanOptions {
  /** RMS threshold in 16-bit integer scale (0..32767) below which audio is treated as silence/room-tone */
  rmsThreshold?: number;
  /** Maximum leading silence kept before first spoken syllable (seconds) */
  leadKeepSec?: number;
  /** Maximum trailing silence kept after final spoken syllable (seconds) */
  tailKeepSec?: number;
  /** Minimum silent span length eligible for compression (seconds) */
  minPauseToCompressSec?: number;
  /** Target duration to retain for compressed internal pauses (seconds) */
  targetPauseSec?: number;
  /** Crossfade window length at splice boundaries (seconds) */
  crossfadeSec?: number;
}

function readWavHeaderInfo(wavBytes: Uint8Array): {
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataOffset: number;
  dataSize: number;
} | null {
  if (wavBytes.length <= 44) return null;
  const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);
  const riff =
    wavBytes[0] === 0x52 &&
    wavBytes[1] === 0x49 &&
    wavBytes[2] === 0x46 &&
    wavBytes[3] === 0x46;
  const wave =
    wavBytes[8] === 0x57 &&
    wavBytes[9] === 0x41 &&
    wavBytes[10] === 0x56 &&
    wavBytes[11] === 0x45;
  if (!riff || !wave) return null;

  const channels = view.getUint16(22, true) || 1;
  const sampleRate = view.getUint32(24, true) || 24000;
  const bitsPerSample = view.getUint16(34, true) || 16;

  // Locate 'data' subchunk cleanly in case extra chunks exist before data
  let offset = 12;
  while (offset + 8 <= wavBytes.length) {
    const id =
      String.fromCharCode(wavBytes[offset]) +
      String.fromCharCode(wavBytes[offset + 1]) +
      String.fromCharCode(wavBytes[offset + 2]) +
      String.fromCharCode(wavBytes[offset + 3]);
    const chunkSize = view.getUint32(offset + 4, true);
    if (id === 'data') {
      const dataOffset = offset + 8;
      const available = Math.max(0, wavBytes.length - dataOffset);
      return {
        channels,
        sampleRate,
        bitsPerSample,
        dataOffset,
        dataSize: Math.min(chunkSize, available),
      };
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  return {
    channels,
    sampleRate,
    bitsPerSample,
    dataOffset: 44,
    dataSize: wavBytes.length - 44,
  };
}

export function tightenNaturalSilencesWav(
  wavBytes: Uint8Array,
  options: SilenceCleanOptions = {}
): { wavBytes: Uint8Array; stats: SilenceCleanStats } {
  const info = readWavHeaderInfo(wavBytes);
  if (!info || info.bitsPerSample !== 16 || info.dataSize < 256) {
    return {
      wavBytes,
      stats: {
        originalDurationSec: 0,
        cleanedDurationSec: 0,
        removedSec: 0,
        compressedPauses: 0,
      },
    };
  }

  const {
    rmsThreshold = 310,
    leadKeepSec = 0.025,
    tailKeepSec = 0.075,
    minPauseToCompressSec = 0.34,
    targetPauseSec = 0.22,
    crossfadeSec = 0.02,
  } = options;

  const { channels, sampleRate, dataOffset, dataSize } = info;
  const bytesPerFrame = channels * 2;
  const totalFrames = Math.floor(dataSize / bytesPerFrame);
  const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);

  // Convert interleaved PCM to mono energy envelope for analysis while keeping exact samples
  const pcm = new Int16Array(totalFrames * channels);
  for (let i = 0; i < pcm.length; i++) {
    pcm[i] = view.getInt16(dataOffset + i * 2, true);
  }

  const winFrames = Math.max(1, Math.round(sampleRate * 0.01)); // 10ms analysis windows
  const numBins = Math.ceil(totalFrames / winFrames);
  const binRms = new Float32Array(numBins);
  const binActive = new Uint8Array(numBins);

  for (let b = 0; b < numBins; b++) {
    const startF = b * winFrames;
    const endF = Math.min(totalFrames, startF + winFrames);
    let sumSq = 0;
    let count = 0;
    for (let f = startF; f < endF; f++) {
      for (let c = 0; c < channels; c++) {
        const val = pcm[f * channels + c];
        sumSq += val * val;
        count++;
      }
    }
    const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
    binRms[b] = rms;
    binActive[b] = rms >= rmsThreshold ? 1 : 0;
  }

  // Suppress isolated 10-20ms inhale spikes (< 440 RMS) surrounded by quiet room-tone bins
  for (let b = 1; b < numBins - 1; b++) {
    if (binActive[b] && binRms[b] < 440 && !binActive[b - 1] && !binActive[b + 1]) {
      binActive[b] = 0;
    }
  }

  let firstActiveBin = -1;
  let lastActiveBin = -1;
  for (let b = 0; b < numBins; b++) {
    if (binActive[b]) {
      if (firstActiveBin === -1) firstActiveBin = b;
      lastActiveBin = b;
    }
  }

  // If clip has no detectable audio above threshold, return unchanged
  if (firstActiveBin === -1) {
    const dur = totalFrames / sampleRate;
    return {
      wavBytes,
      stats: {
        originalDurationSec: Number(dur.toFixed(2)),
        cleanedDurationSec: Number(dur.toFixed(2)),
        removedSec: 0,
        compressedPauses: 0,
      },
    };
  }

  const leadKeepFrames = Math.round(leadKeepSec * sampleRate);
  const tailKeepFrames = Math.round(tailKeepSec * sampleRate);
  const minPauseFrames = Math.round(minPauseToCompressSec * sampleRate);
  const targetPauseFrames = Math.round(targetPauseSec * sampleRate);
  const fadeFrames = Math.max(1, Math.round(crossfadeSec * sampleRate));

  const clipStartFrame = Math.max(0, firstActiveBin * winFrames - leadKeepFrames);
  const clipEndFrame = Math.min(totalFrames, (lastActiveBin + 1) * winFrames + tailKeepFrames);

  // Detect internal silent runs strictly inside [clipStartFrame, clipEndFrame]
  const keepSegments: Array<{ start: number; end: number }> = [];
  let cursorFrame = clipStartFrame;
  let compressedPauses = 0;

  let b = firstActiveBin;
  while (b <= lastActiveBin) {
    if (binActive[b]) {
      b++;
      continue;
    }
    const silBinStart = b;
    while (b <= lastActiveBin && !binActive[b]) {
      b++;
    }
    const silStartFrame = silBinStart * winFrames;
    const silEndFrame = Math.min(clipEndFrame, b * winFrames);
    const silLen = silEndFrame - silStartFrame;

    if (silLen >= minPauseFrames) {
      // Keep ~55% of target pause as release tail after speech, ~45% as pre-speech breath attack
      const postSpeechKeep = Math.round(targetPauseFrames * 0.55);
      const preSpeechKeep = Math.max(fadeFrames, targetPauseFrames - postSpeechKeep);
      const cutStart = silStartFrame + postSpeechKeep;
      const cutEnd = silEndFrame - preSpeechKeep;

      if (cutEnd - cutStart > fadeFrames * 2) {
        keepSegments.push({ start: cursorFrame, end: cutStart + fadeFrames });
        cursorFrame = Math.max(clipStartFrame, cutEnd - fadeFrames);
        compressedPauses++;
      }
    }
  }

  keepSegments.push({ start: cursorFrame, end: clipEndFrame });

  // Assemble tightened PCM buffer with raised-cosine crossfades across joins
  let outTotalFrames = 0;
  for (let i = 0; i < keepSegments.length; i++) {
    const segLen = keepSegments[i].end - keepSegments[i].start;
    outTotalFrames += i === 0 ? segLen : Math.max(0, segLen - fadeFrames);
  }
  outTotalFrames = Math.max(1, outTotalFrames);

  const outPcm = new Int16Array(outTotalFrames * channels);
  let writeFrame = 0;

  for (let sIdx = 0; sIdx < keepSegments.length; sIdx++) {
    const seg = keepSegments[sIdx];
    const segLen = seg.end - seg.start;
    if (segLen <= 0) continue;

    if (sIdx === 0) {
      for (let f = 0; f < segLen; f++) {
        for (let c = 0; c < channels; c++) {
          outPcm[(writeFrame + f) * channels + c] = pcm[(seg.start + f) * channels + c];
        }
      }
      writeFrame += segLen;
    } else {
      // Overlap-add raised-cosine crossfade over fadeFrames
      const actualFade = Math.min(fadeFrames, writeFrame, segLen);
      const overlapStart = writeFrame - actualFade;
      for (let f = 0; f < actualFade; f++) {
        const t = f / Math.max(1, actualFade);
        const fadeOut = 0.5 * (1 + Math.cos(Math.PI * t));
        const fadeIn = 1 - fadeOut;
        for (let c = 0; c < channels; c++) {
          const prevSample = outPcm[(overlapStart + f) * channels + c];
          const nextSample = pcm[(seg.start + f) * channels + c];
          outPcm[(overlapStart + f) * channels + c] = Math.max(
            -32768,
            Math.min(32767, Math.round(prevSample * fadeOut + nextSample * fadeIn))
          );
        }
      }
      const remStart = seg.start + actualFade;
      const remLen = segLen - actualFade;
      for (let f = 0; f < remLen; f++) {
        for (let c = 0; c < channels; c++) {
          outPcm[(writeFrame + f) * channels + c] = pcm[(remStart + f) * channels + c];
        }
      }
      writeFrame += remLen;
    }
  }

  // Gentle 10ms fade-in at start & 28ms fade-out at end to guarantee zero click/pop
  const edgeIn = Math.min(Math.round(sampleRate * 0.01), outTotalFrames);
  for (let f = 0; f < edgeIn; f++) {
    const gain = f / Math.max(1, edgeIn);
    for (let c = 0; c < channels; c++) {
      outPcm[f * channels + c] = Math.round(outPcm[f * channels + c] * gain);
    }
  }
  const edgeOut = Math.min(Math.round(sampleRate * 0.028), outTotalFrames);
  for (let f = 0; f < edgeOut; f++) {
    const idx = outTotalFrames - 1 - f;
    const gain = f / Math.max(1, edgeOut);
    for (let c = 0; c < channels; c++) {
      outPcm[idx * channels + c] = Math.round(outPcm[idx * channels + c] * gain);
    }
  }

  // Write canonical 44-byte RIFF PCM WAV header
  const outDataBytes = outTotalFrames * bytesPerFrame;
  const outWav = new Uint8Array(44 + outDataBytes);
  const outView = new DataView(outWav.buffer);
  writePcmWavHeader(outWav, outDataBytes, sampleRate, channels, 16);

  for (let i = 0; i < outPcm.length; i++) {
    outView.setInt16(44 + i * 2, outPcm[i], true);
  }

  const origDur = totalFrames / sampleRate;
  const cleanDur = outTotalFrames / sampleRate;
  return {
    wavBytes: outWav,
    stats: {
      originalDurationSec: Number(origDur.toFixed(2)),
      cleanedDurationSec: Number(cleanDur.toFixed(2)),
      removedSec: Number(Math.max(0, origDur - cleanDur).toFixed(2)),
      compressedPauses,
    },
  };
}
