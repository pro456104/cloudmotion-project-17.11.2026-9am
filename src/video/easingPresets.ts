import type {
  AnimationEasingConfig,
  AnimationEasingPreset,
  VideoProject,
} from './types';

export interface EasingPresetMeta {
  id: AnimationEasingPreset;
  label: string;
  caption: string;
}

export const ANIMATION_EASING_PRESETS: EasingPresetMeta[] = [
  { id: 'spring', label: 'Studio Spring', caption: 'Elastic overshoot + settle' },
  { id: 'cubic-bezier', label: 'Cubic-Bezier', caption: 'Custom P1 / P2 curve' },
  { id: 'ease-in-out', label: 'Ease In-Out', caption: 'Symmetrical flow' },
  { id: 'ease-out', label: 'Expo Ease-Out', caption: 'Punchy launch · silk stop' },
];

export interface NamedBezierCurve {
  id: string;
  label: string;
  points: [number, number, number, number];
}

export const CUBIC_BEZIER_NAMED_CURVES: NamedBezierCurve[] = [
  { id: 'keynote', label: 'Keynote', points: [0.22, 1, 0.36, 1] },
  { id: 'expo', label: 'Expo Out', points: [0.16, 1, 0.3, 1] },
  { id: 'overshoot', label: 'Overshoot', points: [0.34, 1.56, 0.64, 1] },
  { id: 'material', label: 'Balanced', points: [0.4, 0, 0.2, 1] },
];

export const DEFAULT_ANIMATION_EASING: AnimationEasingConfig = {
  preset: 'spring',
  bezier: [0.22, 1, 0.36, 1],
  springDamping: 14,
  springStiffness: 160,
  tempoScale: 1.0,
};

export function clampBezierX(v: number): number {
  if (!Number.isFinite(v)) return 0.5;
  return Math.round(Math.max(0.01, Math.min(0.99, v)) * 100) / 100;
}

export function clampBezierY(v: number): number {
  if (!Number.isFinite(v)) return 0.5;
  return Math.round(Math.max(-0.4, Math.min(1.8, v)) * 100) / 100;
}

export function clampSpringDamping(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_ANIMATION_EASING.springDamping;
  return Math.round(Math.max(8, Math.min(30, v)));
}

export function clampSpringStiffness(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_ANIMATION_EASING.springStiffness;
  return Math.round(Math.max(80, Math.min(260, v)));
}

export function clampTempoScale(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_ANIMATION_EASING.tempoScale;
  return Math.round(Math.max(0.6, Math.min(1.6, v)) * 10) / 10;
}

export function resolveProjectAnimationEasing(
  project?: Pick<VideoProject, 'animationEasing'>
): AnimationEasingConfig {
  const cfg = project?.animationEasing;
  if (!cfg) return DEFAULT_ANIMATION_EASING;
  const b = Array.isArray(cfg.bezier) && cfg.bezier.length === 4 ? cfg.bezier : DEFAULT_ANIMATION_EASING.bezier;
  return {
    preset: cfg.preset || DEFAULT_ANIMATION_EASING.preset,
    bezier: [
      clampBezierX(b[0]),
      clampBezierY(b[1]),
      clampBezierX(b[2]),
      clampBezierY(b[3]),
    ],
    springDamping: clampSpringDamping(cfg.springDamping),
    springStiffness: clampSpringStiffness(cfg.springStiffness),
    tempoScale: clampTempoScale(cfg.tempoScale),
  };
}

function sampleCubic(u: number, p1: number, p2: number): number {
  const inv = 1 - u;
  return 3 * inv * inv * u * p1 + 3 * inv * u * u * p2 + u * u * u;
}

function sampleCubicDerivative(u: number, p1: number, p2: number): number {
  const inv = 1 - u;
  return 3 * inv * inv * p1 + 6 * inv * u * (p2 - p1) + 3 * u * u * (1 - p2);
}

/**
 * Evaluates cubic-bezier(x1, y1, x2, y2) accurately for x in [0, 1].
 * Preserves intentional overshoot/anticipation when y1 < 0 or y1,y2 > 1.
 */
export function solveCubicBezier(
  x: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const cx1 = clampBezierX(x1);
  const cx2 = clampBezierX(x2);

  let u = x;
  for (let i = 0; i < 6; i++) {
    const err = sampleCubic(u, cx1, cx2) - x;
    if (Math.abs(err) < 1e-5) {
      return sampleCubic(u, y1, y2);
    }
    const slope = sampleCubicDerivative(u, cx1, cx2);
    if (Math.abs(slope) < 1e-6) break;
    u = Math.max(0, Math.min(1, u - err / slope));
  }

  // Bisection fallback for steep curves
  let lo = 0;
  let hi = 1;
  u = x;
  for (let i = 0; i < 12; i++) {
    const val = sampleCubic(u, cx1, cx2);
    if (Math.abs(val - x) < 1e-5) break;
    if (val < x) lo = u;
    else hi = u;
    u = 0.5 * (lo + hi);
  }
  return sampleCubic(u, y1, y2);
}

/**
 * Deterministic damped harmonic spring solution (mass = 1).
 * Matches Remotion-style spring physics with zero step drift across FPS rates.
 */
export function evaluateDampedSpring(
  tSec: number,
  damping: number,
  stiffness: number,
  mass: number = 1
): number {
  if (tSec <= 0) return 0;
  const c = Math.max(1, damping);
  const k = Math.max(10, stiffness);
  const m = Math.max(0.1, mass);

  const omega0 = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));

  if (zeta < 1) {
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
    const env = Math.exp(-zeta * omega0 * tSec);
    const val =
      1 -
      env *
        (Math.cos(omegaD * tSec) +
          ((zeta * omega0) / omegaD) * Math.sin(omegaD * tSec));
    return Math.abs(1 - val) < 0.001 && tSec > 0.35 ? 1 : val;
  }

  if (Math.abs(zeta - 1) < 1e-4) {
    const env = Math.exp(-omega0 * tSec);
    return 1 - env * (1 + omega0 * tSec);
  }

  const s = Math.sqrt(zeta * zeta - 1);
  const r1 = -omega0 * (zeta - s);
  const r2 = -omega0 * (zeta + s);
  const c1 = r2 / (r2 - r1);
  const c2 = -r1 / (r2 - r1);
  return 1 - (c1 * Math.exp(r1 * tSec) + c2 * Math.exp(r2 * tSec));
}

/**
 * Evaluates a normalized progress value `t` in [0, 1] under the given AnimationEasingConfig.
 */
export function evaluateEasing(t: number, config: AnimationEasingConfig): number {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped <= 0) return 0;
  if (clamped >= 1) return 1;

  switch (config.preset) {
    case 'ease-in-out': {
      // Smooth quintic/sine hybrid ease-in-out
      return clamped < 0.5
        ? 4 * clamped * clamped * clamped
        : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
    }
    case 'ease-out': {
      // Exponential ease-out for crisp studio snap
      return 1 - Math.pow(2, -9 * clamped);
    }
    case 'cubic-bezier': {
      const [x1, y1, x2, y2] = config.bezier;
      return solveCubicBezier(clamped, x1, y1, x2, y2);
    }
    case 'spring':
    default: {
      // Map normalized [0, 1] over a standard 0.78s spring window
      const val = evaluateDampedSpring(
        clamped * 0.78,
        config.springDamping,
        config.springStiffness
      );
      return clamped > 0.96 ? val + (1 - val) * ((clamped - 0.96) / 0.04) : val;
    }
  }
}

/**
 * Unified element entrance evaluator used by all Remotion scenes.
 * `delayFrames` and `baseDurationFrames` are expressed on a 30fps reference timeline and
 * scaled to `fps` in seconds so playback velocity stays identical at 30fps and 60fps.
 * Supports positive or negative `delayFrames` (e.g., negative delay gives immediate partial entrance at frame 0).
 */
export function computeElementEntrance(
  frame: number,
  fps: number,
  config: AnimationEasingConfig,
  delayFrames: number = 0,
  baseDurationFrames: number = 22
): number {
  const safeFps = Math.max(1, fps);
  const elapsedSec = frame / safeFps - delayFrames / 30;
  if (elapsedSec <= 0) return 0;

  const tempo = clampTempoScale(config.tempoScale);

  if (config.preset === 'spring') {
    const tSec = elapsedSec / tempo;
    return evaluateDampedSpring(tSec, config.springDamping, config.springStiffness);
  }

  const durationSec = Math.max(4 / 30, (baseDurationFrames / 30) * tempo);
  return evaluateEasing(elapsedSec / durationSec, config);
}

/**
 * Samples points along [0, 1] for rendering the live SVG easing preview in StageView.
 */
export function sampleEasingCurvePoints(
  config: AnimationEasingConfig,
  steps: number = 32
): Array<{ t: number; y: number }> {
  const pts: Array<{ t: number; y: number }> = [];
  const count = Math.max(4, steps);
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    pts.push({ t, y: evaluateEasing(t, config) });
  }
  return pts;
}

export function formatEasingSummary(config: AnimationEasingConfig): string {
  switch (config.preset) {
    case 'spring':
      return `Spring · d${config.springDamping} · k${config.springStiffness} · ${config.tempoScale.toFixed(1)}x`;
    case 'cubic-bezier': {
      const [x1, y1, x2, y2] = config.bezier;
      return `cubic-bezier(${x1.toFixed(2)}, ${y1.toFixed(2)}, ${x2.toFixed(2)}, ${y2.toFixed(2)})`;
    }
    case 'ease-in-out':
      return `Ease In-Out · ${config.tempoScale.toFixed(1)}x`;
    case 'ease-out':
      return `Expo Ease-Out · ${config.tempoScale.toFixed(1)}x`;
  }
}
