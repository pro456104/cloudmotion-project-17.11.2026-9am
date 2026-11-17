import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderMedia, selectComposition } from '@remotion/renderer';
import { generateWhooshPcmSamples } from '../src/utils/sfxEngine';
import { resolveAspectRatio } from '../src/video/aspectRatios';
import {
  SCENE_AUDIO_LEAD_IN_SEC,
  buildAlignedMasterWav,
  computeSceneWindows,
  createSilentWavBuffer,
  getTotalFrames,
} from '../src/video/timeline';
import type { VideoProject } from '../src/video/types';
import { checkFfmpegAvailability } from './voiceEngine';

const execFileAsync = promisify(execFile);

let cachedBundleServeUrl: string | null = null;
let cachedBundleSrcMtimeMs: number = 0;
let bundlingPromise: Promise<string> | null = null;

function getLatestTreeMtimeMs(dir: string): number {
  let latest = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const sub = getLatestTreeMtimeMs(full);
        if (sub > latest) latest = sub;
      } else {
        const stat = fs.statSync(full);
        if (stat.mtimeMs > latest) latest = stat.mtimeMs;
      }
    }
  } catch {
    // Ignore transient fs errors
  }
  return latest;
}

async function getRemotionBundleUrl(rootDir: string): Promise<string> {
  const srcMtimeMs = getLatestTreeMtimeMs(path.resolve(rootDir, 'src'));
  const backgroundsMtimeMs = getLatestTreeMtimeMs(
    path.resolve(rootDir, 'public', 'backgrounds')
  );
  const assetMtimeMs = Math.max(srcMtimeMs, backgroundsMtimeMs);
  if (
    cachedBundleServeUrl &&
    fs.existsSync(cachedBundleServeUrl) &&
    assetMtimeMs <= cachedBundleSrcMtimeMs
  ) {
    return cachedBundleServeUrl;
  }
  if (!bundlingPromise) {
    const entryPoint = path.resolve(rootDir, 'src/remotion/index.ts');
    const publicDir = path.resolve(rootDir, 'public');
    const buildStamp = Math.max(assetMtimeMs, Date.now());
    const prevServeUrl = cachedBundleServeUrl;
    bundlingPromise = bundle({
      entryPoint,
      publicDir,
      onProgress: () => {
        // Bundling progress tracked cleanly by caller
      },
    })
      .then((serveUrl) => {
        cachedBundleServeUrl = serveUrl;
        cachedBundleSrcMtimeMs = buildStamp;
        bundlingPromise = null;
        if (
          prevServeUrl &&
          prevServeUrl !== serveUrl &&
          prevServeUrl.startsWith(os.tmpdir())
        ) {
          try {
            fs.rmSync(prevServeUrl, { recursive: true, force: true });
          } catch {
            // Ignore stale bundle cleanup failures
          }
        }
        return serveUrl;
      })
      .catch((err) => {
        bundlingPromise = null;
        throw err;
      });
  }
  return bundlingPromise;
}

function loadSceneWavBytes(
  audioDataUrl: string | undefined,
  publicDir: string
): Uint8Array | undefined {
  if (!audioDataUrl) return undefined;
  if (audioDataUrl.startsWith('data:')) {
    const base64 = audioDataUrl.split(',')[1] || '';
    return base64 ? new Uint8Array(Buffer.from(base64, 'base64')) : undefined;
  }
  if (audioDataUrl.startsWith('/')) {
    const cleanRel = audioDataUrl.replace(/^\/+/, '');
    const candidate = path.resolve(publicDir, cleanRel);
    const normalizedPublicPrefix = publicDir.endsWith(path.sep)
      ? publicDir
      : `${publicDir}${path.sep}`;
    if (candidate.startsWith(normalizedPublicPrefix) && fs.existsSync(candidate)) {
      return new Uint8Array(fs.readFileSync(candidate));
    }
  }
  return undefined;
}

function mixTransitionWhooshesIntoWav(
  wavBytes: Uint8Array,
  boundarySeconds: number[]
): Uint8Array {
  if (wavBytes.length <= 44 || boundarySeconds.length === 0) return wavBytes;

  const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);
  const channels = view.getUint16(22, true) || 1;
  const sampleRate = view.getUint32(24, true) || 24000;
  const totalSamplesPerChannel = Math.floor((wavBytes.length - 44) / (2 * channels));

  const whooshPcm = generateWhooshPcmSamples(sampleRate, 0.28, 0.09);
  const whooshLen = whooshPcm.length;

  for (const sec of boundarySeconds) {
    const startSample = Math.round(sec * sampleRate);
    for (let i = 0; i < whooshLen; i++) {
      const targetSample = startSample + i;
      if (targetSample < 0 || targetSample >= totalSamplesPerChannel) continue;
      const addVal = Math.round(whooshPcm[i] * 32767);
      for (let c = 0; c < channels; c++) {
        const byteOffset = 44 + (targetSample * channels + c) * 2;
        if (byteOffset + 2 > wavBytes.length) break;
        const cur = view.getInt16(byteOffset, true);
        const mixed = Math.max(-32768, Math.min(32767, cur + addVal));
        view.setInt16(byteOffset, mixed, true);
      }
    }
  }

  return wavBytes;
}

export function mixProjectAudioToWav(
  project: VideoProject,
  fps: number,
  publicDir: string
): Uint8Array {
  const windows = computeSceneWindows(project.scenes, fps);
  const slots = windows.map((w) => ({
    wavBytes: loadSceneWavBytes(w.scene.audioDataUrl, publicDir),
    targetDurationSec: w.durationFrames / fps,
    leadInSec: SCENE_AUDIO_LEAD_IN_SEC,
  }));

  let master = buildAlignedMasterWav(slots);
  if (master.length === 0) {
    const totalSec = windows.length > 0 ? windows[windows.length - 1].endSec : 1;
    master = createSilentWavBuffer(totalSec, 24000);
  }

  if (project.sfxEnabled) {
    const boundaries = windows.slice(1).map((w) => w.startSec);
    master = mixTransitionWhooshesIntoWav(master, boundaries);
  }

  return master;
}

export async function renderUnifiedRemotionMp4(
  rootDir: string,
  project: VideoProject,
  outMp4Path: string,
  onProgress?: (progress: number, label: string) => void
): Promise<{
  sizeBytes: number;
  durationSec: number;
  width: number;
  height: number;
  fps: number;
}> {
  const fps = 60;
  const dims = resolveAspectRatio(project.aspectRatio, project.width, project.height);
  const publicDir = path.resolve(rootDir, 'public');
  const totalFrames = getTotalFrames(project.scenes, fps);
  const totalDurationSec = totalFrames / fps;

  const hasFfmpeg = await checkFfmpegAvailability(true);
  if (!hasFfmpeg) {
    throw new Error(
      'FFmpeg was not found on your system PATH. Install FFmpeg locally (macOS: brew install ffmpeg, Windows: winget install Gyan.FFmpeg, Linux: sudo apt install ffmpeg) to export MP4 with AAC audio.'
    );
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-remotion-'));

  try {
    onProgress?.(0.03, `Mixing synchronized ${project.voiceId || 'Andrew'} master WAV + SFX...`);
    const masterWav = mixProjectAudioToWav(project, fps, publicDir);
    const wavPath = path.join(tmpDir, 'master.wav');
    fs.writeFileSync(wavPath, masterWav);

    onProgress?.(0.08, 'Preparing unified Remotion bundle & headless renderer...');
    const [serveUrl] = await Promise.all([
      getRemotionBundleUrl(rootDir),
      ensureBrowser(),
    ]);

    const inputProps = {
      project: {
        ...project,
        aspectRatio: dims.aspectRatio,
        width: dims.width,
        height: dims.height,
        fps: 60 as const,
      },
      muted: true,
    };

    const composition = await selectComposition({
      serveUrl,
      id: 'CloudMotionVideo',
      inputProps,
    });

    const rawVideoPath = path.join(tmpDir, 'video-only.mp4');
    onProgress?.(0.14, `Rendering ${dims.width}×${dims.height} 60fps via Remotion...`);

    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      crf: 16,
      pixelFormat: 'yuv420p',
      outputLocation: rawVideoPath,
      inputProps,
      muted: true,
      chromeMode: 'headless-shell',
      onProgress: ({ progress, renderedFrames, encodedFrames }) => {
        const mapped = 0.14 + progress * 0.78;
        const pct = Math.min(99, Math.round(progress * 100));
        onProgress?.(
          mapped,
          `Remotion ${dims.aspectRatio} · ${renderedFrames.toLocaleString()} rendered / ${encodedFrames.toLocaleString()} encoded (${pct}%)`
        );
      },
    });

    onProgress?.(0.94, 'Muxing 192kbps AAC master audio with Remotion video stream...');
    const tmpOutMp4 = path.join(tmpDir, 'final.mp4');
    await execFileAsync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-i',
      rawVideoPath,
      '-i',
      wavPath,
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-ar',
      '48000',
      '-ac',
      '2',
      '-movflags',
      '+faststart',
      '-shortest',
      tmpOutMp4,
    ]);

    fs.mkdirSync(path.dirname(outMp4Path), { recursive: true });
    fs.copyFileSync(tmpOutMp4, outMp4Path);
    const stat = fs.statSync(outMp4Path);
    onProgress?.(1, `${dims.aspectRatio} 60fps MP4 ready!`);

    return {
      sizeBytes: stat.size,
      durationSec: Number(totalDurationSec.toFixed(2)),
      width: dims.width,
      height: dims.height,
      fps,
    };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
