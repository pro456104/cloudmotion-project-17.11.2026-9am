import type {
  SceneTransitionConfig,
  SceneTransitionMode,
  VideoProject,
} from './types';

export interface SceneTransitionPresetMeta {
  id: SceneTransitionMode;
  label: string;
  hint: string;
}

export const SCENE_TRANSITION_PRESETS: SceneTransitionPresetMeta[] = [
  {
    id: 'fade-blur',
    label: 'Dissolve',
    hint: 'Depth fade',
  },
  {
    id: 'slide-left',
    label: 'Slide Left',
    hint: 'Editorial push',
  },
  {
    id: 'zoom-push',
    label: 'Zoom Push',
    hint: 'Focus morph',
  },
  {
    id: 'wipe-reveal',
    label: 'Studio Wipe',
    hint: 'Laser edge',
  },
  {
    id: 'none',
    label: 'Hard Cut',
    hint: 'Instant 0s',
  },
];

export const DEFAULT_SCENE_TRANSITION: SceneTransitionConfig = {
  mode: 'fade-blur',
  durationSec: 0.6,
};

export function clampSceneTransitionDuration(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_SCENE_TRANSITION.durationSec;
  return Math.max(0.2, Math.min(1.5, Number(seconds.toFixed(1))));
}

export function resolveProjectSceneTransition(
  project?: Pick<VideoProject, 'sceneTransition'>
): SceneTransitionConfig {
  if (!project?.sceneTransition) {
    return { ...DEFAULT_SCENE_TRANSITION };
  }
  return {
    mode: project.sceneTransition.mode,
    durationSec: clampSceneTransitionDuration(project.sceneTransition.durationSec),
  };
}

/**
 * Computes exact transition overlap length in frames between scenes,
 * safely capped to 35% of the incoming scene duration.
 */
export function computeSceneTransitionFrames(
  config: SceneTransitionConfig,
  fps: number,
  incomingDurationFrames: number
): number {
  if (config.mode === 'none' || incomingDurationFrames <= 2) return 0;
  const rawFrames = Math.round(clampSceneTransitionDuration(config.durationSec) * fps);
  const maxAllowed = Math.max(2, Math.floor(incomingDurationFrames * 0.35));
  return Math.max(2, Math.min(rawFrames, maxAllowed));
}

export interface SceneLayerTransformState {
  opacity: number;
  translateXFraction: number;
  scale: number;
  blurPx: number;
  /** Clip revealed fraction from left to right (0 = hidden, 1 = full width) */
  wipeRevealFraction: number;
}

export interface SceneTransitionState {
  isTransitioning: boolean;
  progress: number;
  incoming: SceneLayerTransformState;
  outgoing: SceneLayerTransformState;
  seam: {
    opacity: number;
    xFraction: number;
  };
}

const IDENTITY_LAYER: SceneLayerTransformState = {
  opacity: 1,
  translateXFraction: 0,
  scale: 1,
  blurPx: 0,
  wipeRevealFraction: 1,
};

const HIDDEN_LAYER: SceneLayerTransformState = {
  opacity: 0,
  translateXFraction: 0,
  scale: 1,
  blurPx: 0,
  wipeRevealFraction: 0,
};

/**
 * Computes synchronized deterministic styles for both the outgoing previous shot
 * and the incoming next shot during `[0, transitionFrames)`.
 */
export function computeSceneTransitionStyles(
  localFrame: number,
  transitionFrames: number,
  mode: SceneTransitionMode,
  hasPreviousScene: boolean
): SceneTransitionState {
  if (!hasPreviousScene || mode === 'none' || transitionFrames <= 0 || localFrame >= transitionFrames) {
    return {
      isTransitioning: false,
      progress: 1,
      incoming: IDENTITY_LAYER,
      outgoing: HIDDEN_LAYER,
      seam: { opacity: 0, xFraction: 0 },
    };
  }

  const linear = Math.max(0, Math.min(1, localFrame / transitionFrames));
  // Smooth cosine ease-in-out curve
  const eased = 0.5 - 0.5 * Math.cos(Math.PI * linear);
  const seamFade = Math.sin(Math.PI * linear);

  if (mode === 'slide-left') {
    const slideX = Number((1 - eased).toFixed(4));
    return {
      isTransitioning: true,
      progress: Number(eased.toFixed(4)),
      incoming: {
        opacity: 1,
        translateXFraction: slideX,
        scale: 1,
        blurPx: 0,
        wipeRevealFraction: 1,
      },
      outgoing: {
        opacity: Number((1 - eased * 0.25).toFixed(4)),
        translateXFraction: Number((-eased).toFixed(4)),
        scale: Number((1 - eased * 0.03).toFixed(4)),
        blurPx: 0,
        wipeRevealFraction: 1,
      },
      seam: {
        opacity: Number((seamFade * 0.95).toFixed(4)),
        xFraction: slideX,
      },
    };
  }

  if (mode === 'zoom-push') {
    return {
      isTransitioning: true,
      progress: Number(eased.toFixed(4)),
      incoming: {
        opacity: Number(eased.toFixed(4)),
        translateXFraction: 0,
        scale: Number((0.88 + eased * 0.12).toFixed(4)),
        blurPx: Number(((1 - eased) * 6).toFixed(2)),
        wipeRevealFraction: 1,
      },
      outgoing: {
        opacity: Number((1 - eased).toFixed(4)),
        translateXFraction: 0,
        scale: Number((1 + eased * 0.14).toFixed(4)),
        blurPx: Number((eased * 8).toFixed(2)),
        wipeRevealFraction: 1,
      },
      seam: { opacity: 0, xFraction: 0 },
    };
  }

  if (mode === 'wipe-reveal') {
    const reveal = Number(eased.toFixed(4));
    return {
      isTransitioning: true,
      progress: reveal,
      incoming: {
        opacity: 1,
        translateXFraction: 0,
        scale: 1,
        blurPx: 0,
        wipeRevealFraction: reveal,
      },
      outgoing: {
        opacity: 1,
        translateXFraction: 0,
        scale: Number((1 - eased * 0.025).toFixed(4)),
        blurPx: 0,
        wipeRevealFraction: 1,
      },
      seam: {
        opacity: Number((seamFade * 0.95).toFixed(4)),
        xFraction: reveal,
      },
    };
  }

  // Default: 'fade-blur' (Optical Dissolve)
  return {
    isTransitioning: true,
    progress: Number(eased.toFixed(4)),
    incoming: {
      opacity: Number(eased.toFixed(4)),
      translateXFraction: 0,
      scale: Number((1.04 - eased * 0.04).toFixed(4)),
      blurPx: Number(((1 - eased) * 7).toFixed(2)),
      wipeRevealFraction: 1,
    },
    outgoing: {
      opacity: Number((1 - eased).toFixed(4)),
      translateXFraction: 0,
      scale: Number((1 - eased * 0.04).toFixed(4)),
      blurPx: Number((eased * 7).toFixed(2)),
      wipeRevealFraction: 1,
    },
    seam: { opacity: 0, xFraction: 0 },
  };
}
