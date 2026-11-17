import type {
  AmbientBackgroundConfig,
  AmbientBgPreset,
  BackgroundTransitionConfig,
  VideoProject,
  VideoScene,
} from './types';

export interface AmbientPresetMeta {
  id: AmbientBgPreset;
  label: string;
  description: string;
  recommendedOpacity: number;
}

export const AMBIENT_BG_PRESETS: AmbientPresetMeta[] = [
  {
    id: 'none',
    label: 'Pure Obsidian Grid',
    description: 'Clean dark blueprint grid with zero background video overlay.',
    recommendedOpacity: 0.25,
  },
  {
    id: 'fiber-streams',
    label: 'Optical Fiber Streams',
    description: 'High-speed Coral and Mint light trails sweeping through dark depth.',
    recommendedOpacity: 0.34,
  },
  {
    id: 'neural-mesh',
    label: 'Ambient Constellation',
    description: 'Slow-drifting geometric network nodes with subtle telemetry filaments.',
    recommendedOpacity: 0.3,
  },
  {
    id: 'circuit-pulses',
    label: 'Microchip Bus Pulses',
    description: 'Orthogonal PCB traces carrying soft synchronized data pulses.',
    recommendedOpacity: 0.32,
  },
  {
    id: 'volumetric-wave',
    label: 'Horizon Data Ribbons',
    description: 'Smooth layered sine ribbons in deep Coral-to-Mint studio tone.',
    recommendedOpacity: 0.3,
  },
  {
    id: 'code-depth',
    label: 'Parallax Token Depth',
    description: 'Out-of-focus protocol streams drifting silently in background space.',
    recommendedOpacity: 0.26,
  },
];

export const DEFAULT_AMBIENT_BG: AmbientBackgroundConfig = {
  preset: 'fiber-streams',
  opacity: 0.34,
};

export const DEFAULT_BG_TRANSITION: BackgroundTransitionConfig = {
  mode: 'crossfade',
  durationSec: 0.8,
  blurPx: 14,
};

export function clampAmbientOpacity(value: number): number {
  if (!Number.isFinite(value)) return 0.32;
  return Math.max(0.05, Math.min(0.65, Number(value.toFixed(2))));
}

export function clampTransitionDuration(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_BG_TRANSITION.durationSec;
  return Math.max(0.2, Math.min(2.0, Number(seconds.toFixed(1))));
}

export function clampTransitionBlur(blurPx: number): number {
  if (!Number.isFinite(blurPx)) return DEFAULT_BG_TRANSITION.blurPx;
  return Math.max(4, Math.min(28, Math.round(blurPx)));
}

export function resolveProjectBgTransition(
  project?: Pick<VideoProject, 'bgTransition'>
): BackgroundTransitionConfig {
  if (!project?.bgTransition) {
    return { ...DEFAULT_BG_TRANSITION };
  }
  return {
    mode: project.bgTransition.mode,
    durationSec: clampTransitionDuration(project.bgTransition.durationSec),
    blurPx: clampTransitionBlur(project.bgTransition.blurPx),
  };
}

export interface BackgroundTransitionState {
  incomingOpacity: number;
  outgoingOpacity: number;
  incomingBlurPx: number;
  outgoingBlurPx: number;
  incomingScale: number;
  outgoingScale: number;
  isTransitioning: boolean;
}

/**
 * Computes deterministic frame-level opacity, motion-blur radius, and optical scale
 * for transitioning from the previous scene's ambient layer into the current scene.
 */
export function computeBackgroundTransitionState(
  localFrame: number,
  sceneDurationFrames: number,
  fps: number,
  config: BackgroundTransitionConfig,
  hasPreviousBackground: boolean
): BackgroundTransitionState {
  if (!hasPreviousBackground || config.mode === 'none') {
    return {
      incomingOpacity: 1,
      outgoingOpacity: 0,
      incomingBlurPx: 0,
      outgoingBlurPx: 0,
      incomingScale: 1,
      outgoingScale: 1,
      isTransitioning: false,
    };
  }

  const safeDurationSec = clampTransitionDuration(config.durationSec);
  const rawTransitionFrames = Math.round(safeDurationSec * fps);
  const maxAllowedFrames = Math.max(1, Math.floor(sceneDurationFrames * 0.45));
  const transitionFrames = Math.max(1, Math.min(rawTransitionFrames, maxAllowedFrames));

  if (localFrame >= transitionFrames) {
    return {
      incomingOpacity: 1,
      outgoingOpacity: 0,
      incomingBlurPx: 0,
      outgoingBlurPx: 0,
      incomingScale: 1,
      outgoingScale: 1,
      isTransitioning: false,
    };
  }

  const linear = Math.max(0, Math.min(1, localFrame / transitionFrames));
  // Cosine ease-in-out for studio crossfades
  const eased = 0.5 - 0.5 * Math.cos(Math.PI * linear);
  const incomingOpacity = Number(eased.toFixed(4));
  const outgoingOpacity = Number((1 - eased).toFixed(4));

  if (config.mode === 'motion-blur') {
    const peakBlur = clampTransitionBlur(config.blurPx);
    const incomingBlurPx = Number(((1 - eased) * peakBlur).toFixed(2));
    const outgoingBlurPx = Number((eased * peakBlur).toFixed(2));
    const incomingScale = Number((1 + (1 - eased) * 0.04).toFixed(4));
    const outgoingScale = Number((1 + eased * 0.04).toFixed(4));
    return {
      incomingOpacity,
      outgoingOpacity,
      incomingBlurPx,
      outgoingBlurPx,
      incomingScale,
      outgoingScale,
      isTransitioning: true,
    };
  }

  return {
    incomingOpacity,
    outgoingOpacity,
    incomingBlurPx: 0,
    outgoingBlurPx: 0,
    incomingScale: 1,
    outgoingScale: 1,
    isTransitioning: true,
  };
}

export function resolveSceneAmbientBg(scene: VideoScene): AmbientBackgroundConfig {
  if (!scene.ambientBg) {
    return { ...DEFAULT_AMBIENT_BG };
  }
  return {
    ...scene.ambientBg,
    opacity: clampAmbientOpacity(scene.ambientBg.opacity),
  };
}

export function applyAmbientBgToScenes(
  scenes: VideoScene[],
  config: AmbientBackgroundConfig
): VideoScene[] {
  const safeConfig: AmbientBackgroundConfig = {
    ...config,
    opacity: clampAmbientOpacity(config.opacity),
  };
  return scenes.map((s) => ({
    ...s,
    ambientBg: { ...safeConfig },
  }));
}
