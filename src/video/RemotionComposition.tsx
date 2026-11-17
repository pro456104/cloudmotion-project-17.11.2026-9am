import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { AnimationEasingProvider } from './AnimationEasingContext';
import { DEFAULT_AMBIENT_BG, resolveProjectBgTransition } from './ambientPresets';
import { resolveProjectAnimationEasing } from './easingPresets';
import {
  computeSceneTransitionFrames,
  computeSceneTransitionStyles,
  resolveProjectSceneTransition,
  type SceneLayerTransformState,
} from './sceneTransitions';
import { SCENE_AUDIO_LEAD_IN_SEC, computeSceneWindows } from './timeline';
import type {
  SceneTransitionMode,
  UniversalArchetype,
  VideoProject,
  VideoScene,
} from './types';
import { BackdropGrid } from './scenes/BackdropGrid';
import { SceneApiCore } from './scenes/SceneApiCore';
import { SceneErrorBoundary } from './scenes/SceneErrorBoundary';
import { SceneHook } from './scenes/SceneHook';
import { SceneMatrix } from './scenes/SceneMatrix';
import { SceneMcpBridge } from './scenes/SceneMcpBridge';
import { SceneMcpRoles } from './scenes/SceneMcpRoles';
import { ScenePipeline } from './scenes/ScenePipeline';
import { ScenePrimitives } from './scenes/ScenePrimitives';
import { SceneSecurity } from './scenes/SceneSecurity';
import { SceneTransports } from './scenes/SceneTransports';
import { SceneTrap } from './scenes/SceneTrap';
import { SceneVerdict } from './scenes/SceneVerdict';
import { UniversalSceneRenderer } from './scenes/UniversalSceneRenderer';
import { renderCustomSceneComponent } from './customScenes/registry';

const UNIVERSAL_ARCHETYPES = new Set<string>([
  'hero-hook',
  'split-compare',
  'architecture-flow',
  'code-walkthrough',
  'terminal-demo',
  'pipeline-steps',
  'metric-chart',
  'matrix-grid',
  'chapter-title',
  'bullet-spotlight',
  'quote-verdict',
]);

function resolveFontUrl(filename: string): string {
  try {
    return staticFile(`fonts/${filename}`);
  } catch {
    return `/fonts/${filename}`;
  }
}

const STUDIO_FONT_CSS = `
@font-face { font-family: "Outfit"; font-weight: 700; font-style: normal; src: url("${resolveFontUrl('Outfit-700.ttf')}") format("truetype"); }
@font-face { font-family: "Outfit"; font-weight: 800; font-style: normal; src: url("${resolveFontUrl('Outfit-800.ttf')}") format("truetype"); }
@font-face { font-family: "Outfit"; font-weight: 900; font-style: normal; src: url("${resolveFontUrl('Outfit-900.ttf')}") format("truetype"); }
@font-face { font-family: "Plus Jakarta Sans"; font-weight: 500; font-style: normal; src: url("${resolveFontUrl('PlusJakartaSans-500.ttf')}") format("truetype"); }
@font-face { font-family: "Plus Jakarta Sans"; font-weight: 600; font-style: normal; src: url("${resolveFontUrl('PlusJakartaSans-600.ttf')}") format("truetype"); }
@font-face { font-family: "Plus Jakarta Sans"; font-weight: 700; font-style: normal; src: url("${resolveFontUrl('PlusJakartaSans-700.ttf')}") format("truetype"); }
@font-face { font-family: "JetBrains Mono"; font-weight: 400; font-style: normal; src: url("${resolveFontUrl('JetBrainsMono-Regular.ttf')}") format("truetype"); }
@font-face { font-family: "JetBrains Mono"; font-weight: 500; font-style: normal; src: url("${resolveFontUrl('JetBrainsMono-Medium.ttf')}") format("truetype"); }
@font-face { font-family: "JetBrains Mono"; font-weight: 600; font-style: normal; src: url("${resolveFontUrl('JetBrainsMono-SemiBold.ttf')}") format("truetype"); }
@font-face { font-family: "JetBrains Mono"; font-weight: 700; font-style: normal; src: url("${resolveFontUrl('JetBrainsMono-Bold.ttf')}") format("truetype"); }
`;

const LegacyAspectAdapter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { width, height } = useVideoConfig();
  if (width === 1920 && height === 1080) {
    return <>{children}</>;
  }
  const scale = Math.min(width / 1920, height / 1080);
  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 1920,
          height: 1080,
          position: 'relative',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

const SceneRenderer: React.FC<{ scene: VideoScene }> = ({ scene }) => {
  if (scene.kind === 'custom-tsx') {
    const customNode = renderCustomSceneComponent(scene);
    if (customNode) return <>{customNode}</>;
  }

  if (UNIVERSAL_ARCHETYPES.has(scene.kind)) {
    return (
      <UniversalSceneRenderer
        scene={scene}
        archetype={scene.kind as UniversalArchetype}
      />
    );
  }

  let legacyNode: React.ReactNode;
  switch (scene.kind) {
    case 'hook':
      legacyNode = <SceneHook scene={scene} />;
      break;
    case 'trap':
      legacyNode = <SceneTrap scene={scene} />;
      break;
    case 'api-core':
      legacyNode = <SceneApiCore scene={scene} />;
      break;
    case 'mcp-roles':
      legacyNode = <SceneMcpRoles scene={scene} />;
      break;
    case 'mcp-bridge':
      legacyNode = <SceneMcpBridge scene={scene} />;
      break;
    case 'mcp-primitives':
      legacyNode = <ScenePrimitives scene={scene} />;
      break;
    case 'mcp-transports':
      legacyNode = <SceneTransports scene={scene} />;
      break;
    case 'pipeline':
      legacyNode = <ScenePipeline scene={scene} />;
      break;
    case 'security-gate':
      legacyNode = <SceneSecurity scene={scene} />;
      break;
    case 'matrix':
      legacyNode = <SceneMatrix scene={scene} />;
      break;
    case 'verdict':
      legacyNode = <SceneVerdict scene={scene} />;
      break;
    default:
      return <UniversalSceneRenderer scene={scene} archetype="bullet-spotlight" />;
  }

  return <LegacyAspectAdapter>{legacyNode}</LegacyAspectAdapter>;
};

interface SceneTransitionShellProps {
  mode: SceneTransitionMode;
  sceneDurationFrames: number;
  inTransitionFrames: number;
  outTransitionFrames: number;
  hasPreviousScene: boolean;
  hasNextScene: boolean;
  children: React.ReactNode;
}

const SceneTransitionShell: React.FC<SceneTransitionShellProps> = ({
  mode,
  sceneDurationFrames,
  inTransitionFrames,
  outTransitionFrames,
  hasPreviousScene,
  hasNextScene,
  children,
}) => {
  const frame = useCurrentFrame();

  let layer: SceneLayerTransformState = {
    opacity: 1,
    translateXFraction: 0,
    scale: 1,
    blurPx: 0,
    wipeRevealFraction: 1,
  };
  let seamOpacity = 0;
  let seamXFraction = 0;

  if (hasPreviousScene && inTransitionFrames > 0 && frame < inTransitionFrames) {
    const state = computeSceneTransitionStyles(frame, inTransitionFrames, mode, true);
    layer = state.incoming;
    seamOpacity = state.seam.opacity;
    seamXFraction = state.seam.xFraction;
  } else if (hasNextScene && outTransitionFrames > 0 && frame >= sceneDurationFrames) {
    const outFrame = frame - sceneDurationFrames;
    const state = computeSceneTransitionStyles(outFrame, outTransitionFrames, mode, true);
    layer = state.outgoing;
  }

  const transforms: string[] = [];
  if (Math.abs(layer.translateXFraction) > 0.0005) {
    transforms.push(`translate3d(${(layer.translateXFraction * 100).toFixed(3)}%, 0, 0)`);
  }
  if (Math.abs(layer.scale - 1) > 0.0005) {
    transforms.push(`scale(${layer.scale.toFixed(4)})`);
  }

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          opacity: layer.opacity,
          transform: transforms.length > 0 ? transforms.join(' ') : undefined,
          filter: layer.blurPx > 0.08 ? `blur(${layer.blurPx.toFixed(2)}px)` : undefined,
          clipPath:
            layer.wipeRevealFraction < 0.999
              ? `inset(0 ${((1 - layer.wipeRevealFraction) * 100).toFixed(2)}% 0 0)`
              : undefined,
          willChange:
            transforms.length > 0 || layer.blurPx > 0 ? 'transform, opacity, filter' : undefined,
        }}
      >
        {children}
      </AbsoluteFill>

      {seamOpacity > 0.01 && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${(seamXFraction * 100).toFixed(3)}%`,
            width: 4,
            transform: 'translateX(-50%)',
            background:
              'linear-gradient(180deg, rgba(255,84,46,0) 0%, #FF542E 28%, #1AE5A0 72%, rgba(26,229,160,0) 100%)',
            boxShadow:
              '0 0 28px rgba(255,84,46,0.65), 0 0 42px rgba(26,229,160,0.45)',
            opacity: seamOpacity,
            pointerEvents: 'none',
          }}
        />
      )}
    </AbsoluteFill>
  );
};

export interface RemotionCompositionProps {
  project: VideoProject;
  muted?: boolean;
}

export const RemotionComposition: React.FC<RemotionCompositionProps> = ({
  project,
  muted = false,
}) => {
  const { fps } = useVideoConfig();

  const windows = React.useMemo(
    () => computeSceneWindows(project.scenes, fps),
    [project.scenes, fps]
  );
  const bgTransition = React.useMemo(() => resolveProjectBgTransition(project), [project]);
  const sceneTransition = React.useMemo(
    () => resolveProjectSceneTransition(project),
    [project]
  );
  const animationEasing = React.useMemo(
    () => resolveProjectAnimationEasing(project),
    [project]
  );

  return (
    <AnimationEasingProvider value={animationEasing}>
      <AbsoluteFill style={{ backgroundColor: '#07090D' }}>
        <style>{STUDIO_FONT_CSS}</style>

        {/* Layer 0: Obsidian Grid & Smooth Ambient Background Transitions */}
        <AbsoluteFill style={{ zIndex: 0 }}>
          {windows.map((win, idx) => {
            const prevWin = idx > 0 ? windows[idx - 1] : undefined;
            return (
              <Sequence
                key={`${win.scene.id}-bg`}
                from={win.startFrame}
                durationInFrames={win.durationFrames}
                name={`${win.scene.chapterTitle} Backdrop`}
              >
                <BackdropGrid
                  layerMode="backdrop"
                  chapterTitle={win.scene.chapterTitle}
                  sceneIndex={win.scene.index}
                  totalScenes={windows.length}
                  accent={win.scene.accent}
                  narration={win.scene.narration}
                  audioDurationSec={win.scene.audioDurationSec}
                  showCaptions={project.showCaptions}
                  ambientBg={win.scene.ambientBg}
                  prevAmbientBg={
                    prevWin ? prevWin.scene.ambientBg || DEFAULT_AMBIENT_BG : undefined
                  }
                  prevAccent={prevWin?.scene.accent}
                  prevDurationFrames={prevWin?.durationFrames}
                  bgTransition={bgTransition}
                />
              </Sequence>
            );
          })}
        </AbsoluteFill>

        {/* Layer 1: Foreground Shot-to-Shot Overlapped Scene Transitions */}
        <AbsoluteFill style={{ zIndex: 1 }}>
          {windows.map((win, idx) => {
            const hasPreviousScene = idx > 0;
            const nextWin = idx < windows.length - 1 ? windows[idx + 1] : undefined;
            const hasNextScene = Boolean(nextWin);
            const inTransitionFrames = hasPreviousScene
              ? computeSceneTransitionFrames(sceneTransition, fps, win.durationFrames)
              : 0;
            const outTransitionFrames = nextWin
              ? computeSceneTransitionFrames(sceneTransition, fps, nextWin.durationFrames)
              : 0;

            return (
              <Sequence
                key={`${win.scene.id}-fg`}
                from={win.startFrame}
                durationInFrames={win.durationFrames + outTransitionFrames}
                name={win.scene.chapterTitle}
              >
                <SceneTransitionShell
                  mode={sceneTransition.mode}
                  sceneDurationFrames={win.durationFrames}
                  inTransitionFrames={inTransitionFrames}
                  outTransitionFrames={outTransitionFrames}
                  hasPreviousScene={hasPreviousScene}
                  hasNextScene={hasNextScene}
                >
                  <SceneErrorBoundary sceneTitle={win.scene.chapterTitle}>
                    <SceneRenderer scene={win.scene} />
                  </SceneErrorBoundary>
                </SceneTransitionShell>
              </Sequence>
            );
          })}
        </AbsoluteFill>

        {/* Layer 2: Crisp Chapter Marker & Synchronized Captions Above Shot Cuts */}
        <AbsoluteFill style={{ zIndex: 2, pointerEvents: 'none' }}>
          {windows.map((win) => (
            <Sequence
              key={`${win.scene.id}-hud`}
              from={win.startFrame}
              durationInFrames={win.durationFrames}
              name={`${win.scene.chapterTitle} HUD`}
            >
              <BackdropGrid
                layerMode="hud"
                chapterTitle={win.scene.chapterTitle}
                sceneIndex={win.scene.index}
                totalScenes={windows.length}
                accent={win.scene.accent}
                narration={win.scene.narration}
                audioDurationSec={win.scene.audioDurationSec}
                showCaptions={project.showCaptions}
              />
            </Sequence>
          ))}
        </AbsoluteFill>

        {/* Layer 3: Scene Voiceover Audio Tracks */}
        {!muted &&
          windows.map((win) => {
            if (!win.scene.audioDataUrl) return null;
            const leadInFrames = Math.max(1, Math.round(SCENE_AUDIO_LEAD_IN_SEC * fps));
            return (
              <Sequence
                key={`${win.scene.id}-audio`}
                from={win.startFrame + leadInFrames}
                durationInFrames={Math.max(1, win.durationFrames - leadInFrames)}
              >
                <Audio src={win.scene.audioDataUrl} volume={1} />
              </Sequence>
            );
          })}
      </AbsoluteFill>
    </AnimationEasingProvider>
  );
};
