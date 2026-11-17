export type AspectRatio = '16:9' | '9:16' | '1:1';

export type LegacySceneKind =
  | 'hook'
  | 'trap'
  | 'api-core'
  | 'mcp-roles'
  | 'mcp-bridge'
  | 'mcp-primitives'
  | 'mcp-transports'
  | 'pipeline'
  | 'security-gate'
  | 'matrix'
  | 'verdict';

export type UniversalArchetype =
  | 'hero-hook'
  | 'split-compare'
  | 'architecture-flow'
  | 'code-walkthrough'
  | 'terminal-demo'
  | 'pipeline-steps'
  | 'metric-chart'
  | 'matrix-grid'
  | 'chapter-title'
  | 'bullet-spotlight'
  | 'quote-verdict';

export type SceneKind = LegacySceneKind | UniversalArchetype | 'custom-tsx';

export type AccentTone = 'coral' | 'mint' | 'hybrid';

export type MaleVoiceId = 'Andrew' | 'Brian' | 'Christopher' | 'Guy';

export type AmbientBgPreset =
  | 'none'
  | 'fiber-streams'
  | 'neural-mesh'
  | 'circuit-pulses'
  | 'volumetric-wave'
  | 'code-depth'
  | 'custom-video';

export interface AmbientBackgroundConfig {
  preset: AmbientBgPreset;
  /** Overlay opacity between 0.05 and 0.65 */
  opacity: number;
  customVideoUrl?: string;
  customVideoName?: string;
}

export interface VisualNodeItem {
  id: string;
  label: string;
  sublabel?: string;
  badge?: string;
  tone?: 'coral' | 'mint' | 'neutral';
}

export interface VisualMetricItem {
  label: string;
  value: string;
  numericValue?: number;
  unit?: string;
  delta?: string;
  tone?: 'coral' | 'mint' | 'neutral';
}

export interface VisualTerminalLine {
  text: string;
  kind?: 'cmd' | 'output' | 'success' | 'warn';
}

export interface VisualComparisonColumn {
  title: string;
  badge?: string;
  tone?: 'coral' | 'mint';
  items: string[];
}

export interface SceneVisualPayload {
  /** Top status kicker / eyebrow above headline */
  kicker?: string;
  /** Nodes for architecture-flow or pipeline-steps */
  nodes?: VisualNodeItem[];
  /** Optional connection labels between sequential nodes */
  connectorLabels?: string[];
  /** Left & right comparison columns for split-compare */
  columns?: VisualComparisonColumn[];
  /** Code language & filename for code-walkthrough */
  codeFilename?: string;
  codeLanguage?: string;
  highlightLines?: number[];
  /** Terminal lines for terminal-demo */
  terminalTitle?: string;
  terminalLines?: VisualTerminalLine[];
  /** Metrics/bars for metric-chart */
  metrics?: VisualMetricItem[];
  /** Key takeaway banner at bottom of scene */
  callout?: string;
}

export interface VideoScene {
  id: string;
  index: number;
  kind: SceneKind;
  chapterTitle: string;
  headline: string;
  accentWord?: string;
  subheadline: string;
  narration: string;
  durationSec: number;
  accent: AccentTone;
  leftBadge: string;
  rightBadge: string;
  codeSnippet?: string;
  bulletPoints?: string[];
  visualPayload?: SceneVisualPayload;
  /** Registered custom Remotion component key when kind === 'custom-tsx' */
  customSceneName?: string;
  /** Arbitrary JSON props forwarded to custom Remotion TSX scene */
  customProps?: Record<string, unknown>;
  ambientBg?: AmbientBackgroundConfig;
  /** URL (/audio/...) or Base64 data URL (audio/wav) */
  audioDataUrl?: string;
  /** Actual measured WAV audio duration in seconds */
  audioDurationSec?: number;
  /** Provider label that generated this clip */
  audioProvider?: string;
}

export type BackgroundTransitionMode = 'none' | 'crossfade' | 'motion-blur';

export interface BackgroundTransitionConfig {
  mode: BackgroundTransitionMode;
  durationSec: number;
  blurPx: number;
}

export type SceneTransitionMode =
  | 'none'
  | 'fade-blur'
  | 'slide-left'
  | 'zoom-push'
  | 'wipe-reveal';

export interface SceneTransitionConfig {
  mode: SceneTransitionMode;
  durationSec: number;
}

export type AnimationEasingPreset =
  | 'spring'
  | 'cubic-bezier'
  | 'ease-in-out'
  | 'ease-out';

export interface AnimationEasingConfig {
  preset: AnimationEasingPreset;
  bezier: [number, number, number, number];
  springDamping: number;
  springStiffness: number;
  tempoScale: number;
}

export interface VideoProject {
  id: string;
  title: string;
  subtitle: string;
  aspectRatio?: AspectRatio;
  fps: 30 | 60;
  width: number;
  height: number;
  voiceId: MaleVoiceId;
  voiceStyle: string;
  /** Speech rate percentage adjustment (-20 to +20, default 0) */
  voiceSpeedPct?: number;
  showCaptions: boolean;
  sfxEnabled: boolean;
  bgTransition?: BackgroundTransitionConfig;
  sceneTransition?: SceneTransitionConfig;
  animationEasing?: AnimationEasingConfig;
  scenes: VideoScene[];
  updatedAt?: string;
}

export interface SceneWindow {
  scene: VideoScene;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  startSec: number;
  endSec: number;
}

export interface CaptionCue {
  text: string;
  startFrame: number;
  endFrame: number;
}
