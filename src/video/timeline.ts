import type { CaptionCue, SceneWindow, VideoScene } from './types';

export const VIDEO_FPS = 60;
export const VIDEO_WIDTH = 1920;
export const VIDEO_HEIGHT = 1080;

export const MIN_SCENE_DURATION_SEC = 2;
export const MAX_SCENE_DURATION_SEC = 60;
export const DEFAULT_SCENE_DURATION_SEC = 10;

export function clampSceneDurationSec(
  sec?: number,
  fallback: number = DEFAULT_SCENE_DURATION_SEC
): number {
  const num = typeof sec === 'number' && Number.isFinite(sec) ? sec : fallback;
  return Math.max(MIN_SCENE_DURATION_SEC, Math.min(MAX_SCENE_DURATION_SEC, num));
}

export function computeVoiceFittedDurationSec(audioDurationSec: number): number {
  const safe = Number.isFinite(audioDurationSec) ? audioDurationSec : 0;
  return Number(clampSceneDurationSec(Math.max(4, safe + 0.25), 4).toFixed(2));
}

export function clearSceneAudio(scene: VideoScene): VideoScene {
  return {
    ...scene,
    audioDataUrl: undefined,
    audioDurationSec: undefined,
    audioProvider: undefined,
  };
}

/**
 * Computes deterministic frame windows for an ordered list of scenes.
 * Ensures every scene has at least 1 second of frames and contiguous boundaries.
 */
export function computeSceneWindows(
  scenes: VideoScene[],
  fps: number = VIDEO_FPS
): SceneWindow[] {
  let cursorFrame = 0;
  return scenes.map((scene) => {
    const safeSec = Math.max(1, Number.isFinite(scene.durationSec) ? scene.durationSec : 5);
    const durationFrames = Math.round(safeSec * fps);
    const startFrame = cursorFrame;
    const endFrame = startFrame + durationFrames;
    const startSec = startFrame / fps;
    const endSec = endFrame / fps;
    cursorFrame = endFrame;
    return {
      scene,
      startFrame,
      endFrame,
      durationFrames,
      startSec,
      endSec,
    };
  });
}

export function getTotalFrames(scenes: VideoScene[], fps: number = VIDEO_FPS): number {
  const windows = computeSceneWindows(scenes, fps);
  if (windows.length === 0) return fps;
  return windows[windows.length - 1].endFrame;
}

export function getSceneAtFrame(
  windows: SceneWindow[],
  frame: number
): SceneWindow | null {
  if (windows.length === 0) return null;
  const clamped = Math.max(0, frame);
  for (const w of windows) {
    if (clamped >= w.startFrame && clamped < w.endFrame) {
      return w;
    }
  }
  return windows[windows.length - 1];
}

export const SCENE_AUDIO_LEAD_IN_SEC = 1 / 15; // ~0.067s crisp lead-in after transition cut (4 frames @ 60fps)

/**
 * Splits a scene narration into clean, readable kinetic caption chunks
 * proportional to word count. When spokenDurationFrames is provided,
 * cues pace across the active speech window instead of trailing silently.
 */
export function buildCaptionCues(
  narration: string,
  durationFrames: number,
  maxWordsPerCue: number = 8,
  spokenDurationFrames?: number
): CaptionCue[] {
  const cleaned = narration.trim().replace(/\s+/g, ' ');
  if (!cleaned || durationFrames <= 0) return [];

  const words = cleaned.split(' ');
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += maxWordsPerCue) {
    chunks.push(words.slice(i, i + maxWordsPerCue).join(' '));
  }

  const leadInFrames = spokenDurationFrames ? Math.min(4, Math.floor(durationFrames * 0.1)) : 0;
  const activeSpan = spokenDurationFrames
    ? Math.max(30, Math.min(durationFrames, leadInFrames + Math.round(spokenDurationFrames)))
    : durationFrames;

  const totalWords = words.length;
  let frameCursor = leadInFrames;
  return chunks.map((chunk, idx) => {
    const chunkWords = chunk.split(' ').length;
    const isFirst = idx === 0;
    const isLast = idx === chunks.length - 1;
    const startFrame = isFirst ? 0 : frameCursor;
    const targetEnd = isLast
      ? durationFrames
      : Math.min(
          activeSpan,
          frameCursor + Math.max(15, Math.round((chunkWords / totalWords) * (activeSpan - leadInFrames)))
        );
    frameCursor = targetEnd;
    return {
      text: chunk,
      startFrame,
      endFrame: targetEnd,
    };
  });
}

export function formatTimecode(frame: number, fps: number = VIDEO_FPS): string {
  const safeFrames = Math.max(0, Math.floor(frame));
  const totalSeconds = Math.floor(safeFrames / fps);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Parses a standard 44-byte RIFF WAV header to compute exact audio duration in seconds.
 */
export function getWavDurationSeconds(wavBytes: Uint8Array): number {
  if (wavBytes.length <= 44) return 0;
  const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);
  const byteRate = view.getUint32(28, true);
  if (byteRate <= 0) {
    // Fallback for 24kHz mono 16-bit (48000 bytes/sec)
    return (wavBytes.length - 44) / 48000;
  }
  return (wavBytes.length - 44) / byteRate;
}

/**
 * Writes a canonical 44-byte RIFF PCM WAV header into `target` at offset 0.
 */
export function writePcmWavHeader(
  target: Uint8Array,
  dataBytes: number,
  sampleRate: number = 24000,
  channels: number = 1,
  bitsPerSample: number = 16
): void {
  const bytesPerFrame = channels * (bitsPerSample / 8);
  const view = new DataView(target.buffer, target.byteOffset, target.byteLength);
  target.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  view.setUint32(4, 36 + dataBytes, true);
  target.set([0x57, 0x41, 0x56, 0x45], 8); // WAVE
  target.set([0x66, 0x6d, 0x74, 0x20], 12); // fmt 
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerFrame, true);
  view.setUint16(32, bytesPerFrame, true);
  view.setUint16(34, bitsPerSample, true);
  target.set([0x64, 0x61, 0x74, 0x61], 36); // data
  view.setUint32(40, dataBytes, true);
}

/**
 * Creates a valid silent 16-bit mono PCM WAV buffer for the requested duration.
 */
export function createSilentWavBuffer(
  durationSec: number,
  sampleRate: number = 24000
): Uint8Array {
  const dataBytes = Math.max(2, Math.round(Math.max(0.1, durationSec) * sampleRate) * 2);
  const out = new Uint8Array(44 + dataBytes);
  writePcmWavHeader(out, dataBytes, sampleRate, 1, 16);
  return out;
}

/**
 * Concatenates multiple 24kHz mono 16-bit WAV buffers into a single valid WAV file
 * with optional silence padding between clips, updating RIFF and data chunk sizes.
 */
export function concatenateWavBuffers(
  clips: Uint8Array[],
  gapSeconds: number = 0.25,
  sampleRate: number = 24000
): Uint8Array {
  const validClips = clips.filter((c) => c.length > 44);
  if (validClips.length === 0) return new Uint8Array(0);

  const bytesPerSample = 2; // 16-bit mono
  const gapBytes = Math.max(0, Math.round(gapSeconds * sampleRate)) * bytesPerSample;
  const pcmParts: Uint8Array[] = [];
  let totalPcmBytes = 0;

  validClips.forEach((clip, idx) => {
    const pcm = clip.subarray(44);
    pcmParts.push(pcm);
    totalPcmBytes += pcm.length;
    if (idx < validClips.length - 1 && gapBytes > 0) {
      pcmParts.push(new Uint8Array(gapBytes));
      totalPcmBytes += gapBytes;
    }
  });

  const out = new Uint8Array(44 + totalPcmBytes);
  // Copy 44-byte header template from first clip
  out.set(validClips[0].subarray(0, 44), 0);

  const view = new DataView(out.buffer);
  // Update ChunkSize (4 bytes at offset 4) = 36 + totalPcmBytes
  view.setUint32(4, 36 + totalPcmBytes, true);
  // Update Subchunk2Size (4 bytes at offset 40) = totalPcmBytes
  view.setUint32(40, totalPcmBytes, true);

  let offset = 44;
  for (const part of pcmParts) {
    out.set(part, offset);
    offset += part.length;
  }

  return out;
}

export interface TimelineAudioSlot {
  wavBytes?: Uint8Array;
  targetDurationSec: number;
  leadInSec?: number;
}

/**
 * Builds a single timeline-synchronized master WAV where every scene slot occupies
 * its exact `targetDurationSec` window with leading/trailing silence padding.
 */
export function buildAlignedMasterWav(slots: TimelineAudioSlot[]): Uint8Array {
  const templateClip = slots.find((s) => s.wavBytes && s.wavBytes.length > 44)?.wavBytes;
  if (!templateClip) return new Uint8Array(0);

  const headerView = new DataView(
    templateClip.buffer,
    templateClip.byteOffset,
    templateClip.byteLength
  );
  const byteRate = headerView.getUint32(28, true) || 48000;
  const blockAlign = headerView.getUint16(32, true) || 2;
  const alignBytes = (bytes: number) => Math.floor(Math.max(0, bytes) / blockAlign) * blockAlign;

  const slotBuffers: Uint8Array[] = [];
  let totalPcmBytes = 0;

  for (const slot of slots) {
    const targetBytes = alignBytes(Math.round(Math.max(0.5, slot.targetDurationSec) * byteRate));
    const slotBuf = new Uint8Array(targetBytes);

    if (slot.wavBytes && slot.wavBytes.length > 44) {
      const leadBytes = alignBytes(Math.round((slot.leadInSec ?? SCENE_AUDIO_LEAD_IN_SEC) * byteRate));
      const srcPcm = slot.wavBytes.subarray(44);
      const copyLen = Math.min(srcPcm.length, Math.max(0, targetBytes - leadBytes));
      if (copyLen > 0) {
        slotBuf.set(srcPcm.subarray(0, copyLen), leadBytes);
      }
    }

    slotBuffers.push(slotBuf);
    totalPcmBytes += targetBytes;
  }

  const out = new Uint8Array(44 + totalPcmBytes);
  out.set(templateClip.subarray(0, 44), 0);
  const outView = new DataView(out.buffer);
  outView.setUint32(4, 36 + totalPcmBytes, true);
  outView.setUint32(40, totalPcmBytes, true);

  let offset = 44;
  for (const buf of slotBuffers) {
    out.set(buf, offset);
    offset += buf.length;
  }

  return out;
}
