import {
  SCENE_AUDIO_LEAD_IN_SEC,
  buildAlignedMasterWav,
  computeSceneWindows,
} from '../video/timeline';
import type { VideoProject } from '../video/types';

export interface ExportProgress {
  progress: number; // 0 to 1
  label: string;
}

export interface RenderedVideoResult {
  url: string;
  sizeBytes: number;
  width: number;
  height: number;
  fps: number;
  format: 'mp4';
}

async function audioUrlToUint8Array(url: string): Promise<Uint8Array> {
  if (url.startsWith('data:')) {
    const base64 = url.split(',')[1] || '';
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch audio asset: ${res.status}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Stitches all generated scene WAV clips into one timeline-synchronized master WAV
 * matching the exact scene start boundaries and durations of the video.
 */
export async function buildMasterNarrationWav(
  project: VideoProject
): Promise<Blob | null> {
  const windows = computeSceneWindows(project.scenes, project.fps);
  const hasAnyAudio = windows.some((w) => Boolean(w.scene.audioDataUrl));
  if (!hasAnyAudio) return null;

  const slots = await Promise.all(
    windows.map(async (w) => ({
      wavBytes: w.scene.audioDataUrl
        ? await audioUrlToUint8Array(w.scene.audioDataUrl)
        : undefined,
      targetDurationSec: w.durationFrames / project.fps,
      leadInSec: SCENE_AUDIO_LEAD_IN_SEC,
    }))
  );

  const merged = buildAlignedMasterWav(slots);

  if (merged.length === 0) return null;
  return new Blob([merged.buffer as ArrayBuffer], { type: 'audio/wav' });
}

/**
 * Triggers the unified Remotion 60fps server renderer,
 * writing the finished MP4 into /public/renders/<projectId>-60fps.mp4 and polling progress.
 */
export async function exportProjectToStudioMp4(
  project: VideoProject,
  onProgress: (p: ExportProgress) => void
): Promise<RenderedVideoResult> {
  onProgress({ progress: 0.01, label: 'Starting unified Remotion 60fps export...' });

  const startRes = await fetch('/api/render-mp4', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project }),
  });

  if (!startRes.ok) {
    const errBody = await startRes.json().catch(() => ({}));
    throw new Error(errBody?.error || 'Could not start 60fps MP4 render on server.');
  }

  const MAX_POLLS = 1350; // ~20 minutes at 900ms interval
  const MAX_CONSECUTIVE_ERRORS = 10;
  let consecutiveErrors = 0;

  for (let poll = 0; poll < MAX_POLLS; poll++) {
    await new Promise((r) => setTimeout(r, 900));
    let statusRes: Response;
    try {
      statusRes = await fetch(
        `/api/render-status?projectId=${encodeURIComponent(project.id)}`
      );
    } catch (err) {
      consecutiveErrors++;
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        throw new Error(
          err instanceof Error
            ? `Lost connection while checking MP4 render status: ${err.message}`
            : 'Lost connection while checking MP4 render status.'
        );
      }
      continue;
    }

    if (!statusRes.ok) {
      consecutiveErrors++;
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        throw new Error(`Render status check failed repeatedly (HTTP ${statusRes.status}).`);
      }
      continue;
    }
    consecutiveErrors = 0;

    const status = (await statusRes.json()) as {
      exists: boolean;
      rendering: boolean;
      progress: number;
      label: string;
      error: string | null;
      url: string;
      sizeBytes: number;
      width: number;
      height: number;
      fps: number;
    };

    if (status.error) {
      throw new Error(status.error);
    }

    onProgress({
      progress: Math.max(0.02, Math.min(1, status.progress || 0.05)),
      label: status.label || 'Rendering Remotion 60fps MP4 on server...',
    });

    if (!status.rendering) {
      if (!status.exists || status.sizeBytes <= 10000) {
        throw new Error('Render finished but output MP4 file was not found.');
      }
      onProgress({ progress: 1, label: '60fps MP4 ready!' });
      return {
        url: status.url,
        sizeBytes: status.sizeBytes,
        width: status.width || 1920,
        height: status.height || 1080,
        fps: status.fps || 60,
        format: 'mp4',
      };
    }
  }

  throw new Error('MP4 render polling timed out after 20 minutes.');
}
