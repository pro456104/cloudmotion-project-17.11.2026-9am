import type { AspectRatio } from './types';

export interface AspectDimensions {
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  label: string;
  shortLabel: string;
  description: string;
}

export const ASPECT_RATIO_PRESETS: Record<AspectRatio, AspectDimensions> = {
  '16:9': {
    aspectRatio: '16:9',
    width: 1920,
    height: 1080,
    label: '16:9 Widescreen',
    shortLabel: '16:9',
    description: 'YouTube & Long-Form Explainers (1920×1080)',
  },
  '9:16': {
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    label: '9:16 Vertical',
    shortLabel: '9:16',
    description: 'Shorts, Reels & TikTok (1080×1920)',
  },
  '1:1': {
    aspectRatio: '1:1',
    width: 1080,
    height: 1080,
    label: '1:1 Square',
    shortLabel: '1:1',
    description: 'LinkedIn & X Feed Video (1080×1080)',
  },
};

export function resolveAspectRatio(
  aspectRatio?: AspectRatio,
  width?: number,
  height?: number
): AspectDimensions {
  if (aspectRatio && ASPECT_RATIO_PRESETS[aspectRatio]) {
    return ASPECT_RATIO_PRESETS[aspectRatio];
  }
  if (width && height) {
    if (height > width) return ASPECT_RATIO_PRESETS['9:16'];
    if (width === height) return ASPECT_RATIO_PRESETS['1:1'];
  }
  return ASPECT_RATIO_PRESETS['16:9'];
}
