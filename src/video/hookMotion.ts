import {
  DEFAULT_ANIMATION_EASING,
  computeElementEntrance,
  evaluateEasing,
} from './easingPresets';
import type { AnimationEasingConfig } from './types';

export interface HookMotionState {
  /** Normalized progress through the scene [0..1] */
  progress: number;
  /** Initial kinetic lock-in [0..1+] across first ~24 frames, starting visible (>= 0.7) at frame 0 */
  introEase: number;
  /** Expanding shockwave ring radius factor [0..1] behind VS */
  shockwave: number;
  /** Continuous orbital rotation angle in degrees */
  orbitDeg: number;
  /** Smooth vertical floating offset in px */
  floatY: number;
  /** Continuous SVG stroke reveal [0..1] for the MCP infinity mark */
  mcpStrokeDraw: number;
  /** Beat 1 myth strikethrough progress [0..1] */
  mythStrike: number;
  /** Beat 2 (bridge comparison) visibility weight [0..1] */
  beat2Weight: number;
  /** Beat 3 (2-layer stack synthesis) visibility weight [0..1] */
  beat3Weight: number;
  /** Packet cycle [0..1) for request/response motion */
  packetCycle: number;
  /** Active highlighted micro-step index (0, 1, or 2) inside MCP & API cards */
  activeStepIndex: number;
  /** Coral-to-Mint underline rule progress [0..1] */
  ruleProgress: number;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function easeInOutSine(t: number): number {
  const c = clamp01(t);
  return 0.5 - 0.5 * Math.cos(Math.PI * c);
}

/**
 * Deterministic multi-beat animation state for Scene 1 (Hook),
 * shared by `SceneHook.tsx` and timeline/unit verification,
 * driven by the user's selected AnimationEasingConfig.
 */
export function computeHookMotionState(
  frame: number,
  durationInFrames: number,
  fps: number = 60,
  easing: AnimationEasingConfig = DEFAULT_ANIMATION_EASING
): HookMotionState {
  const safeDuration = Math.max(1, durationInFrames);
  const safeFps = Math.max(1, fps);
  const f = Math.max(0, frame);
  const progress = clamp01(f / safeDuration);

  // Crisp kinetic lock-in driven by selected easing while remaining legible at frame 0
  const introEase = computeElementEntrance(
    f,
    safeFps,
    easing,
    -6,
    Math.max(18, safeFps * 0.8)
  );

  // Shockwave pulse behind VS over first 1.2s, repeating subtly every 4s
  const shockCycle = (f % Math.round(safeFps * 4)) / (safeFps * 1.35);
  const shockwave = clamp01(shockCycle);

  // Continuous rotation & subtle floating breath
  const orbitDeg = (f * (360 / (safeFps * 9))) % 360;
  const floatY = Math.sin((f / safeFps) * Math.PI * 0.9) * 5;

  // MCP path gently draws itself in during the opening second and stays alive
  const strokeEase = clamp01(
    computeElementEntrance(f, safeFps, easing, 0, safeFps * 1.0)
  );
  const mcpStrokeDraw = 0.55 + 0.45 * strokeEase;

  // Beat boundaries aligned word-for-word to Scene 1 opening narration (22s, 20.96s spoken):
  // 0.00-0.40: "In this video, I'm going to explain why MCP does not replace traditional APIs." -> Myth + Strike
  // 0.40-0.62: "Every week, that misconception breaks real production architectures." -> Beat 2 Bridge
  // 0.62-1.00: "Instead of replacing REST, GraphQL, or gRPC, MCP solves a different layer." -> Beat 3 Stack
  const mythStrike = clamp01(evaluateEasing((progress - 0.25) / 0.09, easing));

  const beat2Enter = clamp01(evaluateEasing((progress - 0.38) / 0.07, easing));
  const beat2Exit = 1 - clamp01(evaluateEasing((progress - 0.60) / 0.06, easing));
  const beat2Weight = clamp01(beat2Enter * beat2Exit);

  const beat3Weight = clamp01(evaluateEasing((progress - 0.62) / 0.08, easing));

  const packetPeriod = Math.max(24, Math.round(safeFps * 1.8));
  const packetCycle = (f % packetPeriod) / packetPeriod;
  const activeStepIndex = Math.floor((f / Math.max(12, safeFps * 0.85)) % 3);

  // Gradient bar smoothly expands across the whole 14s intro as a visual timeline cue
  const ruleProgress = 0.22 + 0.78 * easeInOutSine(progress / 0.92);

  return {
    progress,
    introEase,
    shockwave,
    orbitDeg,
    floatY,
    mcpStrokeDraw,
    mythStrike,
    beat2Weight,
    beat3Weight,
    packetCycle,
    activeStepIndex,
    ruleProgress,
  };
}
