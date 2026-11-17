import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import {
  Blend,
  Captions,
  ChevronDown,
  ChevronUp,
  Download,
  Film,
  FolderPlus,
  Loader2,
  Mic,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { RemotionComposition } from '../video/RemotionComposition';
import { resolveAspectRatio } from '../video/aspectRatios';
import {
  MIN_SCENE_DURATION_SEC,
  MAX_SCENE_DURATION_SEC,
  clampSceneDurationSec,
  computeSceneWindows,
  formatTimecode,
  getSceneAtFrame,
  getTotalFrames,
} from '../video/timeline';
import {
  AMBIENT_BG_PRESETS,
  clampTransitionBlur,
  clampTransitionDuration,
  resolveProjectBgTransition,
  resolveSceneAmbientBg,
} from '../video/ambientPresets';
import {
  ANIMATION_EASING_PRESETS,
  formatEasingSummary,
  resolveProjectAnimationEasing,
  sampleEasingCurvePoints,
} from '../video/easingPresets';
import {
  SCENE_TRANSITION_PRESETS,
  clampSceneTransitionDuration,
  resolveProjectSceneTransition,
} from '../video/sceneTransitions';
import type {
  AmbientBgPreset,
  AnimationEasingConfig,
  AspectRatio,
  BackgroundTransitionConfig,
  BackgroundTransitionMode,
  SceneKind,
  SceneTransitionConfig,
  UniversalArchetype,
  VideoProject,
  VideoScene,
} from '../video/types';
import { sfxEngine } from '../utils/sfxEngine';
import { startNaturalPhraseSpeech } from '../utils/liveSpeechPlayer';
import { listCustomScenes } from '../video/customScenes/registry';
import { clampVoiceSpeedPct, normalizeLocalVoiceId } from '../video/speechPacing';

export interface ProjectListItem {
  id: string;
  title: string;
  aspectRatio: AspectRatio;
  sceneCount: number;
  updatedAt: string;
}

export interface PreviewSeekRequest {
  nonce: number;
  sceneNumber?: number;
  sceneId?: string;
  play?: boolean;
}

interface StageViewProps {
  project: VideoProject;
  projectsList: ProjectListItem[];
  isHydrating: boolean;
  previewSeekRequest: PreviewSeekRequest | null;
  onOpenOpenCodeSetup: () => void;
  onOpenTemplates: () => void;
  onSelectProject: (projectId: string) => void;
  onCreateNewProject: () => void;
  onDeleteProject: (projectId: string) => void;
  onChangeAspectRatio: (ratio: AspectRatio) => void;
  onUpdateScene: (sceneId: string, patch: Partial<VideoScene>) => void;
  onAddBlankScene: () => void;
  onDeleteScene: (sceneId: string) => void;
  onSynthesizeSceneVoice: (sceneId: string) => Promise<void>;
  synthesizingSceneId: string | null;
  onToggleCaptions: () => void;
  onToggleSfx: () => void;
  onUpdateSceneAmbientBg: (sceneId: string, preset: AmbientBgPreset) => void;
  onUpdateBgTransition: (config: BackgroundTransitionConfig) => void;
  onUpdateSceneTransition: (config: SceneTransitionConfig) => void;
  onUpdateAnimationEasing: (config: AnimationEasingConfig) => void;
  onSynthesizeAllVoices: () => void;
  onDownloadMasterAudio: () => void;
  renderedVideo: {
    exists: boolean;
    url: string;
    sizeBytes: number;
    width: number;
    height: number;
    fps: number;
  } | null;
  onDownloadSavedMp4: () => void;
  isSynthesizingAll: boolean;
  synthesisProgress: string | null;
  onJumpToScript: () => void;
}

const ARCHETYPE_OPTIONS: Array<{ id: UniversalArchetype; label: string }> = [
  { id: 'hero-hook', label: 'Hero Hook' },
  { id: 'chapter-title', label: 'Chapter Divider' },
  { id: 'split-compare', label: 'Split Comparison' },
  { id: 'architecture-flow', label: 'Architecture Flow' },
  { id: 'code-walkthrough', label: 'Code Walkthrough' },
  { id: 'terminal-demo', label: 'Terminal Demo' },
  { id: 'pipeline-steps', label: 'Pipeline Steps' },
  { id: 'metric-chart', label: 'Metric Chart' },
  { id: 'matrix-grid', label: 'Decision Matrix' },
  { id: 'bullet-spotlight', label: 'Bullet Spotlight' },
  { id: 'quote-verdict', label: 'Final Verdict' },
];

export const StageView: React.FC<StageViewProps> = ({
  project,
  projectsList,
  isHydrating,
  previewSeekRequest,
  onOpenOpenCodeSetup,
  onOpenTemplates,
  onSelectProject,
  onCreateNewProject,
  onDeleteProject,
  onChangeAspectRatio,
  onUpdateScene,
  onAddBlankScene,
  onDeleteScene,
  onSynthesizeSceneVoice,
  synthesizingSceneId,
  onToggleCaptions,
  onToggleSfx,
  onUpdateSceneAmbientBg,
  onUpdateBgTransition,
  onUpdateSceneTransition,
  onUpdateAnimationEasing,
  onSynthesizeAllVoices,
  onDownloadMasterAudio,
  renderedVideo,
  onDownloadSavedMp4,
  isSynthesizingAll,
  synthesisProgress,
  onJumpToScript,
}) => {
  const customScenes = useMemo(() => listCustomScenes(), []);
  const playerRef = useRef<PlayerRef>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isTransitionPanelOpen, setIsTransitionPanelOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [seekTick, setSeekTick] = useState(0);
  const lastSceneIdRef = useRef<string | null>(null);
  const isPlayingRef = useRef(false);

  const dims = useMemo(
    () => resolveAspectRatio(project.aspectRatio, project.width, project.height),
    [project.aspectRatio, project.width, project.height]
  );

  const bgTransition = useMemo(() => resolveProjectBgTransition(project), [project]);
  const sceneTransition = useMemo(() => resolveProjectSceneTransition(project), [project]);
  const animationEasing = useMemo(() => resolveProjectAnimationEasing(project), [project]);
  const easingCurvePath = useMemo(() => {
    const pts = sampleEasingCurvePoints(animationEasing, 24);
    return pts
      .map((pt, idx) => {
        const x = (pt.t * 100).toFixed(1);
        const y = Math.max(2, Math.min(34, 30 - pt.y * 24)).toFixed(1);
        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }, [animationEasing]);

  const windows = useMemo(
    () => computeSceneWindows(project.scenes, project.fps),
    [project.scenes, project.fps]
  );
  const totalFrames = useMemo(
    () => getTotalFrames(project.scenes, project.fps),
    [project.scenes, project.fps]
  );

  const activeWindow = useMemo(
    () => getSceneAtFrame(windows, currentFrame) || windows[0],
    [windows, currentFrame]
  );

  const voiceReadyCount = project.scenes.filter((s) => Boolean(s.audioDataUrl)).length;
  const allVoicesReady =
    project.scenes.length > 0 && voiceReadyCount === project.scenes.length;

  const prevProjectIdRef = useRef(project.id);
  const remountInitialFrame =
    prevProjectIdRef.current === project.id
      ? Math.max(0, Math.min(currentFrame, Math.max(0, totalFrames - 1)))
      : 0;

  useEffect(() => {
    prevProjectIdRef.current = project.id;
    setCurrentFrame(0);
    setIsPlaying(false);
    isPlayingRef.current = false;
    lastSceneIdRef.current = null;
  }, [project.id]);

  useEffect(() => {
    setIsPlaying(false);
    isPlayingRef.current = false;
  }, [dims.width, dims.height]);

  useEffect(() => {
    if (!previewSeekRequest) return;
    const targetWin =
      typeof previewSeekRequest.sceneNumber === 'number'
        ? windows.find((w) => w.scene.index === previewSeekRequest.sceneNumber)
        : previewSeekRequest.sceneId
          ? windows.find((w) => w.scene.id === previewSeekRequest.sceneId)
          : windows[0];
    if (targetWin && playerRef.current) {
      playerRef.current.seekTo(targetWin.startFrame);
      setCurrentFrame(targetWin.startFrame);
      setSeekTick((t) => t + 1);
      if (previewSeekRequest.play) {
        playerRef.current.play();
      }
    }
  }, [previewSeekRequest, windows]);

  useEffect(() => {
    const shouldSpeak =
      isPlaying && !isMuted && Boolean(activeWindow) && !activeWindow?.scene.audioDataUrl;

    if (!shouldSpeak || !activeWindow) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return;
    }

    const localProgress = Math.max(
      0,
      Math.min(
        0.92,
        (currentFrame - activeWindow.startFrame) / Math.max(1, activeWindow.durationFrames)
      )
    );

    const controller = startNaturalPhraseSpeech({
      narration: activeWindow.scene.narration,
      voiceId: normalizeLocalVoiceId(project.voiceId),
      voiceSpeedPct: clampVoiceSpeedPct(project.voiceSpeedPct),
      startFraction: localProgress,
      rate: 0.96,
      pitch: 1.0,
    });

    return () => {
      controller.stop();
    };
  }, [
    isPlaying,
    isMuted,
    activeWindow?.scene.id,
    activeWindow?.scene.audioDataUrl,
    project.voiceId,
    project.voiceSpeedPct,
    seekTick,
  ]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const onFrameUpdate = (e: { detail: { frame: number } }) => {
      const f = e.detail.frame;
      setCurrentFrame(f);
      const win = getSceneAtFrame(windows, f);
      if (win && win.scene.id !== lastSceneIdRef.current) {
        if (
          lastSceneIdRef.current !== null &&
          isPlayingRef.current &&
          project.sfxEnabled &&
          !isMuted
        ) {
          sfxEngine.playTransitionWhoosh(0.06);
        }
        lastSceneIdRef.current = win.scene.id;
      }
    };

    const onPlay = () => {
      isPlayingRef.current = true;
      setIsPlaying(true);
    };
    const onPause = () => {
      isPlayingRef.current = false;
      setIsPlaying(false);
    };
    const onEnded = () => {
      isPlayingRef.current = false;
      setIsPlaying(false);
    };

    player.addEventListener('frameupdate', onFrameUpdate);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    player.addEventListener('ended', onEnded);

    return () => {
      player.removeEventListener('frameupdate', onFrameUpdate);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
      player.removeEventListener('ended', onEnded);
    };
  }, [windows, project.sfxEnabled, isMuted]);

  const togglePlay = () => {
    const player = playerRef.current;
    if (!player) return;
    if (isPlaying) {
      player.pause();
    } else {
      if (project.sfxEnabled && !isMuted) {
        sfxEngine.playKineticTick(0.04);
      }
      player.play();
    }
  };

  const seekToFrame = (frame: number) => {
    const player = playerRef.current;
    if (!player) return;
    const clamped = Math.max(0, Math.min(totalFrames - 1, frame));
    player.seekTo(clamped);
    setCurrentFrame(clamped);
    setSeekTick((t) => t + 1);
  };

  const handleRestart = () => {
    seekToFrame(0);
    playerRef.current?.play();
  };

  const handlePreviewTransition = () => {
    if (windows.length < 2) return;
    const activeIdx = Math.max(
      0,
      windows.findIndex((w) => w.scene.id === activeWindow?.scene.id)
    );
    const targetIdx = activeIdx < windows.length - 1 ? activeIdx + 1 : 1;
    const boundaryFrame = windows[targetIdx].startFrame;
    seekToFrame(Math.max(0, boundaryFrame - 12));
    playerRef.current?.play();
  };

  const progressPct = totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 0;

  const playerFrameBoxClass =
    dims.aspectRatio === '9:16'
      ? 'mx-auto h-[480px] aspect-[9/16]'
      : dims.aspectRatio === '1:1'
        ? 'mx-auto h-[460px] aspect-square'
        : 'w-full aspect-video max-h-[62vh]';

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-3.5 sm:px-6 sm:py-4">
      {/* Compact Half-Screen-Optimized Workspace Toolbar */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5 border-b border-white/[0.06] pb-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <select
            aria-label="Active video project"
            value={project.id}
            onChange={(e) => onSelectProject(e.target.value)}
            className="max-w-[200px] sm:max-w-[230px] truncate rounded-lg border border-white/10 bg-[#0B0E14] px-2.5 py-1.5 text-xs font-semibold text-[#F8FAFC] focus:border-[#FF542E] focus:outline-none"
          >
            {projectsList.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} ({item.aspectRatio})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onCreateNewProject}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#11151E] px-2.5 py-1.5 text-xs font-medium text-[#E2E8F0] transition-colors hover:border-white/25 hover:text-white whitespace-nowrap shrink-0"
          >
            <FolderPlus className="h-3.5 w-3.5 text-[#1AE5A0]" />
            <span>New Video</span>
          </button>

          {projectsList.length > 1 && (
            <button
              type="button"
              onClick={() => onDeleteProject(project.id)}
              aria-label="Delete active project"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-[#11151E] text-[#94A3B8] hover:border-[#FF542E]/50 hover:text-[#FF542E]"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Multi-Format Segmented Control */}
          <div
            role="group"
            aria-label="Canvas aspect ratio"
            className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-[#0B0E14] p-0.5"
          >
            {(['16:9', '9:16', '1:1'] as AspectRatio[]).map((ratio) => {
              const active = dims.aspectRatio === ratio;
              return (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => onChangeAspectRatio(ratio)}
                  className={`rounded-md px-2 py-1 font-mono text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#FF542E] text-white'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  {ratio}
                </button>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center gap-2 pl-1 text-xs text-[#94A3B8]">
            <span>{project.scenes.length} Scenes</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {project.scenes.length === 0 ? '00:00' : formatTimecode(totalFrames, project.fps)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {dims.width}×{dims.height}
            </span>
          </div>
        </div>

        {/* Audio & Render Downloads */}
        <div className="flex flex-wrap items-center gap-2">
          {renderedVideo?.exists && (
            <button
              type="button"
              onClick={onDownloadSavedMp4}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#FF542E]/45 bg-[#FF542E]/12 px-2.5 py-1.5 text-xs font-semibold text-[#F8FAFC] transition-colors hover:bg-[#FF542E]/22 whitespace-nowrap shrink-0"
            >
              <Film className="h-3.5 w-3.5 text-[#FF542E]" />
              <span>
                MP4 ({(renderedVideo.sizeBytes / (1024 * 1024)).toFixed(1)} MB)
              </span>
            </button>
          )}
          {voiceReadyCount > 0 && (
            <button
              type="button"
              onClick={onDownloadMasterAudio}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#11151E] px-2.5 py-1.5 text-xs font-medium text-[#E2E8F0] transition-colors hover:border-white/20 hover:text-white whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5 text-[#1AE5A0]" />
              <span>WAV</span>
            </button>
          )}
          <button
            type="button"
            onClick={onSynthesizeAllVoices}
            disabled={isSynthesizingAll || project.scenes.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#1AE5A0]/40 bg-[#1AE5A0]/10 px-3 py-1.5 text-xs font-semibold text-[#1AE5A0] transition-colors hover:bg-[#1AE5A0]/20 disabled:opacity-45 whitespace-nowrap shrink-0"
          >
            {isSynthesizingAll ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{synthesisProgress || 'Synthesizing...'}</span>
              </>
            ) : (
              <>
                <Mic className="h-3.5 w-3.5" />
                <span>
                  {allVoicesReady
                    ? `Regenerate ${project.voiceId}`
                    : voiceReadyCount > 0
                      ? `Voice Missing (${project.scenes.length - voiceReadyCount})`
                      : `Synthesize ${project.voiceId} Voice`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Focused Stage + Timeline Column */}
      <div className="space-y-3.5">
        {/* Remotion Stage Container */}
        <div
          data-testid="remotion-stage"
          className="overflow-hidden rounded-2xl border border-white/10 bg-[#07090D] shadow-[0_24px_70px_rgba(0,0,0,0.65)]"
        >
          <div className="flex w-full items-center justify-center bg-[#05070B] p-2 sm:p-2.5">
            <div className={`relative overflow-hidden rounded-lg bg-[#07090D] ${playerFrameBoxClass}`}>
              {project.scenes.length === 0 ? (
                isHydrating ? (
                  <div className="flex h-full w-full items-center justify-center border border-dashed border-white/10 bg-[#090C12]">
                    <Loader2 className="h-5 w-5 animate-spin text-[#64748B]" />
                  </div>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center border border-dashed border-white/15 bg-[#090C12] p-6 text-center sm:p-10">
                    <div className="font-mono text-xs text-[#1AE5A0] tabular-nums">
                      {dims.aspectRatio} · {dims.width}×{dims.height} · US {normalizeLocalVoiceId(project.voiceId)} Voice
                    </div>
                    <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-[#F8FAFC] sm:text-3xl">
                      Empty Remotion Canvas
                    </h1>
                    <p className="mt-2 max-w-lg text-xs leading-relaxed text-[#94A3B8] sm:text-sm">
                      No scenes in this workspace yet. Direct OpenCode in your terminal beside this
                      window, or start manually below.
                    </p>

                    <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
                      <button
                        type="button"
                        onClick={onAddBlankScene}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#11151E] px-3.5 py-2 text-xs font-medium text-[#E2E8F0] hover:border-white/30 whitespace-nowrap shrink-0"
                      >
                        <Plus className="h-3.5 w-3.5 text-[#1AE5A0]" />
                        <span>Add First Scene</span>
                      </button>
                      <button
                        type="button"
                        onClick={onOpenTemplates}
                        className="rounded-lg border border-white/15 bg-[#11151E] px-3.5 py-2 text-xs font-medium text-[#E2E8F0] hover:border-white/30 whitespace-nowrap shrink-0"
                      >
                        Browse Templates
                      </button>
                      <button
                        type="button"
                        onClick={onOpenOpenCodeSetup}
                        className="rounded-lg border border-[#1AE5A0]/35 bg-[#1AE5A0]/10 px-3.5 py-2 text-xs font-semibold text-[#1AE5A0] hover:bg-[#1AE5A0]/20 whitespace-nowrap shrink-0"
                      >
                        OpenCode Setup
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <Player
                  key={`${project.id}-${dims.width}x${dims.height}`}
                  ref={playerRef}
                  component={RemotionComposition}
                  inputProps={{ project, muted: isMuted }}
                  durationInFrames={totalFrames}
                  compositionWidth={dims.width}
                  compositionHeight={dims.height}
                  fps={project.fps}
                  initialFrame={remountInitialFrame}
                  style={{ width: '100%', height: '100%' }}
                  controls={false}
                  clickToPlay={true}
                  acknowledgeRemotionLicense={true}
                />
              )}
            </div>
          </div>

          {/* Transport & Scrubber Bar */}
          {project.scenes.length > 0 && (
            <div className="border-t border-white/[0.08] bg-[#0B0E14] px-3 py-2.5 sm:px-4">
              <div
                role="slider"
                aria-label="Video timeline scrubber"
                aria-valuemin={0}
                aria-valuemax={totalFrames - 1}
                aria-valuenow={currentFrame}
                tabIndex={0}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  seekToFrame(Math.round(ratio * (totalFrames - 1)));
                }}
                onKeyDown={(e) => {
                  const step = Math.max(1, project.fps);
                  if (e.key === 'ArrowRight') seekToFrame(currentFrame + step);
                  if (e.key === 'ArrowLeft') seekToFrame(currentFrame - step);
                }}
                className="group relative mb-2.5 h-2 w-full cursor-pointer overflow-hidden rounded-full bg-white/[0.07]"
              >
                {windows.slice(1).map((w) => (
                  <span
                    key={w.scene.id}
                    aria-hidden="true"
                    style={{ left: `${(w.startFrame / totalFrames) * 100}%` }}
                    className="absolute top-0 bottom-0 z-10 w-[2px] bg-[#07090D]"
                  />
                ))}
                <div
                  style={{ width: `${progressPct}%` }}
                  className="h-full bg-gradient-to-r from-[#FF542E] to-[#1AE5A0] transition-[width] duration-75"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={isPlaying ? 'Pause video' : 'Play video'}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#F8FAFC] text-[#07090D] transition-transform hover:scale-[1.03] active:scale-[0.98]"
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4 fill-current" />
                    ) : (
                      <Play className="h-4 w-4 translate-x-[1px] fill-current" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleRestart}
                    aria-label="Restart video"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#11151E] text-[#CBD5E1] hover:border-white/20 hover:text-white"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMuted((m) => !m)}
                    aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#11151E] text-[#CBD5E1] hover:border-white/20 hover:text-white"
                  >
                    {isMuted ? (
                      <VolumeX className="h-3.5 w-3.5 text-[#FF542E]" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5 text-[#1AE5A0]" />
                    )}
                  </button>

                  <div className="ml-1 font-mono text-xs text-[#E2E8F0] tabular-nums">
                    {formatTimecode(currentFrame, project.fps)}{' '}
                    <span className="text-[#64748B]">
                      / {formatTimecode(totalFrames, project.fps)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <select
                    aria-label="Scene ambient background"
                    value={
                      activeWindow
                        ? resolveSceneAmbientBg(activeWindow.scene).preset
                        : 'fiber-streams'
                    }
                    onChange={(e) => {
                      if (!activeWindow) return;
                      onUpdateSceneAmbientBg(
                        activeWindow.scene.id,
                        e.target.value as AmbientBgPreset
                      );
                    }}
                    className="max-w-[140px] rounded-lg border border-white/10 bg-[#11151E] px-2 py-1.5 text-xs font-medium text-[#E2E8F0] focus:border-[#1AE5A0] focus:outline-none"
                  >
                    {AMBIENT_BG_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        BG: {p.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setIsTransitionPanelOpen((open) => !open)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${
                      isTransitionPanelOpen
                        ? 'border-[#1AE5A0]/50 bg-[#1AE5A0]/10 text-[#1AE5A0]'
                        : 'border-white/10 bg-[#11151E] text-[#CBD5E1]'
                    }`}
                  >
                    <Blend className="h-3.5 w-3.5" />
                    <span>Transitions</span>
                    {isTransitionPanelOpen ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={onToggleCaptions}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${
                      project.showCaptions
                        ? 'border-[#1AE5A0]/40 bg-[#1AE5A0]/10 text-[#1AE5A0]'
                        : 'border-white/10 bg-[#11151E] text-[#94A3B8]'
                    }`}
                  >
                    <Captions className="h-3.5 w-3.5" />
                    <span>Captions</span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleSfx}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${
                      project.sfxEnabled
                        ? 'border-[#FF542E]/40 bg-[#FF542E]/10 text-[#FF542E]'
                        : 'border-white/10 bg-[#11151E] text-[#94A3B8]'
                    }`}
                  >
                    <span>SFX</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsInspectorOpen((v) => !v)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${
                      isInspectorOpen
                        ? 'border-[#FF542E]/40 bg-[#FF542E]/10 text-[#F8FAFC]'
                        : 'border-white/10 bg-[#11151E] text-[#CBD5E1]'
                    }`}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Inspector</span>
                  </button>
                </div>
              </div>

              {/* Collapsible Transitions Panel */}
              {isTransitionPanelOpen && (
                <div className="mt-3 space-y-2.5 border-t border-white/[0.06] pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-[#F8FAFC]">Shot Cut</span>
                      <span className="font-mono text-[#94A3B8]">
                        {sceneTransition.mode} · {sceneTransition.durationSec.toFixed(1)}s
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handlePreviewTransition}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#1AE5A0]/40 bg-[#1AE5A0]/10 px-2.5 py-1 text-[11px] font-semibold text-[#1AE5A0]"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      <span>Preview Cut</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                    {SCENE_TRANSITION_PRESETS.map((option) => {
                      const selected = sceneTransition.mode === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() =>
                            onUpdateSceneTransition({ ...sceneTransition, mode: option.id })
                          }
                          className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] ${
                            selected
                              ? 'border-[#FF542E]/70 bg-[#FF542E]/10 text-[#F8FAFC]'
                              : 'border-white/[0.08] bg-[#07090D] text-[#94A3B8]'
                          }`}
                        >
                          <div className="font-semibold">{option.label}</div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {(['none', 'crossfade', 'motion-blur'] as BackgroundTransitionMode[]).map(
                      (mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => onUpdateBgTransition({ ...bgTransition, mode })}
                          className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] ${
                            bgTransition.mode === mode
                              ? 'border-[#1AE5A0]/65 bg-[#1AE5A0]/10 text-[#F8FAFC]'
                              : 'border-white/[0.08] bg-[#07090D] text-[#94A3B8]'
                          }`}
                        >
                          BG: {mode}
                        </button>
                      )
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-[#07090D] px-3 py-1.5 text-[11px] text-[#94A3B8]">
                      <span>Shot Duration ({sceneTransition.durationSec.toFixed(1)}s)</span>
                      <input
                        type="range"
                        min={0.2}
                        max={1.5}
                        step={0.1}
                        disabled={sceneTransition.mode === 'none'}
                        value={sceneTransition.durationSec}
                        onChange={(e) =>
                          onUpdateSceneTransition({
                            ...sceneTransition,
                            durationSec: clampSceneTransitionDuration(Number(e.target.value)),
                          })
                        }
                        className="w-28 accent-[#FF542E]"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-[#07090D] px-3 py-1.5 text-[11px] text-[#94A3B8]">
                      <span>BG Blur ({bgTransition.blurPx}px)</span>
                      <input
                        type="range"
                        min={4}
                        max={28}
                        step={2}
                        disabled={bgTransition.mode !== 'motion-blur'}
                        value={bgTransition.blurPx}
                        onChange={(e) =>
                          onUpdateBgTransition({
                            ...bgTransition,
                            blurPx: clampTransitionBlur(Number(e.target.value)),
                            durationSec: clampTransitionDuration(bgTransition.durationSec),
                          })
                        }
                        className="w-28 accent-[#1AE5A0]"
                      />
                    </label>
                  </div>

                  {/* Motion Easing Presets + Live Curve */}
                  <div className="border-t border-white/[0.06] pt-2.5">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#F8FAFC]">Motion Easing</span>
                      <span className="font-mono text-[11px] text-[#94A3B8]">
                        {formatEasingSummary(animationEasing)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                      <div className="flex items-center justify-center rounded-lg border border-white/[0.08] bg-[#07090D] p-1.5">
                        <svg viewBox="0 0 100 36" className="h-7 w-full">
                          <path
                            d={easingCurvePath}
                            fill="none"
                            stroke="#1AE5A0"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                      {ANIMATION_EASING_PRESETS.map((preset) => {
                        const selected = animationEasing.preset === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() =>
                              onUpdateAnimationEasing({
                                ...animationEasing,
                                preset: preset.id,
                              })
                            }
                            className={`rounded-lg border px-2.5 py-1.5 text-left text-[11px] ${
                              selected
                                ? 'border-[#1AE5A0]/65 bg-[#1AE5A0]/10 text-[#F8FAFC]'
                                : 'border-white/[0.08] bg-[#07090D] text-[#94A3B8]'
                            }`}
                          >
                            <div className="font-semibold">{preset.label}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scene Timeline Strip */}
        {project.scenes.length > 0 && (
          <section aria-label="Video scenes">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold text-[#94A3B8]">
                Timeline Scenes ({windows.length})
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onAddBlankScene}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#11151E] px-2.5 py-1 text-xs font-medium text-[#E2E8F0] hover:border-white/25 whitespace-nowrap shrink-0"
                >
                  <Plus className="h-3.5 w-3.5 text-[#1AE5A0]" />
                  <span>Add Scene</span>
                </button>
                <button
                  type="button"
                  onClick={onJumpToScript}
                  className="rounded-lg border border-white/10 bg-[#11151E] px-2.5 py-1 text-xs font-medium text-[#CBD5E1] hover:border-white/25 whitespace-nowrap shrink-0"
                >
                  Full Script Editor
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {windows.map((win) => {
                const isCurrent = activeWindow?.scene.id === win.scene.id;
                const hasAudio = Boolean(win.scene.audioDataUrl);
                return (
                  <button
                    key={win.scene.id}
                    type="button"
                    onClick={() => seekToFrame(win.startFrame)}
                    className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition-colors ${
                      isCurrent
                        ? 'border-[#FF542E]/70 bg-[#131722]'
                        : 'border-white/[0.07] bg-[#0B0E14] hover:border-white/15'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-2 font-mono text-[11px] text-[#64748B] tabular-nums">
                      <span>{formatTimecode(win.startFrame, project.fps)}</span>
                      <span className={hasAudio ? 'text-[#1AE5A0]' : 'text-[#64748B]'}>
                        {hasAudio ? 'WAV' : 'Text'}
                      </span>
                    </div>
                    <div className="mt-1 line-clamp-1 text-xs font-semibold text-[#F8FAFC]">
                      {win.scene.chapterTitle}
                    </div>
                    <div className="mt-0.5 line-clamp-1 font-mono text-[10px] text-[#94A3B8]">
                      {win.scene.kind === 'custom-tsx'
                        ? `custom:${win.scene.customSceneName || 'tsx'}`
                        : win.scene.kind}{' '}
                      · {win.scene.durationSec}s
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Inline Active Scene Inspector (Collapsed by default for clean half-screen workflow) */}
        {isInspectorOpen && activeWindow && (
          <section
            aria-label="Active scene inspector"
            className="rounded-2xl border border-white/[0.08] bg-[#0B0E14] p-4"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] pb-3">
              <div>
                <div className="font-mono text-[11px] text-[#FF542E]">
                  Scene #{activeWindow.scene.index} Inspector
                </div>
                <div className="font-display text-sm font-bold text-[#F8FAFC]">
                  {activeWindow.scene.chapterTitle}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void onSynthesizeSceneVoice(activeWindow.scene.id)}
                  disabled={synthesizingSceneId === activeWindow.scene.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1AE5A0] px-3 py-1.5 text-xs font-bold text-[#07090D] hover:bg-[#14C98C] disabled:opacity-60"
                >
                  {synthesizingSceneId === activeWindow.scene.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Mic className="h-3.5 w-3.5" />
                  )}
                  <span>Synthesize {project.voiceId}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteScene(activeWindow.scene.id)}
                  aria-label="Delete selected scene"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#11151E] text-[#94A3B8] hover:border-[#FF542E]/50 hover:text-[#FF542E]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-[11px] font-medium text-[#94A3B8]">
                  Visual Archetype
                </label>
                <select
                  aria-label="Visual Archetype"
                  value={activeWindow.scene.kind}
                  onChange={(e) => {
                    const nextKind = e.target.value as SceneKind;
                    onUpdateScene(activeWindow.scene.id, {
                      kind: nextKind,
                      ...(nextKind === 'custom-tsx'
                        ? {
                            customSceneName:
                              activeWindow.scene.customSceneName || customScenes[0]?.name,
                          }
                        : {}),
                    });
                  }}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#11151E] px-2.5 py-2 text-xs text-[#F8FAFC] focus:border-[#FF542E] focus:outline-none"
                >
                  {!ARCHETYPE_OPTIONS.some((a) => a.id === activeWindow.scene.kind) &&
                    activeWindow.scene.kind !== 'custom-tsx' && (
                      <option value={activeWindow.scene.kind}>
                        Preset: {activeWindow.scene.kind}
                      </option>
                    )}
                  {ARCHETYPE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                  <option value="custom-tsx">Custom TSX Scene</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#94A3B8]">
                  Headline
                </label>
                <input
                  type="text"
                  aria-label="Scene headline"
                  value={activeWindow.scene.headline}
                  onChange={(e) =>
                    onUpdateScene(activeWindow.scene.id, { headline: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#11151E] px-2.5 py-2 text-xs font-semibold text-[#F8FAFC] focus:border-[#FF542E] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#94A3B8]">
                  Duration (sec)
                </label>
                <input
                  type="number"
                  aria-label="Scene duration in seconds"
                  min={MIN_SCENE_DURATION_SEC}
                  max={MAX_SCENE_DURATION_SEC}
                  step={0.5}
                  value={activeWindow.scene.durationSec}
                  onChange={(e) =>
                    onUpdateScene(activeWindow.scene.id, {
                      durationSec: clampSceneDurationSec(Number(e.target.value) || 8, 8),
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#11151E] px-2.5 py-2 font-mono text-xs text-[#F8FAFC] tabular-nums focus:border-[#FF542E] focus:outline-none"
                />
              </div>
            </div>

            {activeWindow.scene.kind === 'custom-tsx' && (
              <div className="mt-3">
                <label className="block text-[11px] font-medium text-[#1AE5A0]">
                  Custom Remotion Component (src/video/customScenes/registry.tsx)
                </label>
                <select
                  aria-label="Custom Remotion Component"
                  value={activeWindow.scene.customSceneName || ''}
                  onChange={(e) =>
                    onUpdateScene(activeWindow.scene.id, {
                      customSceneName: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-[#1AE5A0]/35 bg-[#0D1614] px-2.5 py-2 text-xs font-medium text-[#F8FAFC] focus:border-[#1AE5A0] focus:outline-none"
                >
                  {customScenes.map((cs) => (
                    <option key={cs.name} value={cs.name}>
                      {cs.name} — {cs.description}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mt-3">
              <label className="block text-[11px] font-medium text-[#94A3B8]">
                Subheadline
              </label>
              <input
                type="text"
                aria-label="Scene subheadline"
                value={activeWindow.scene.subheadline}
                onChange={(e) =>
                  onUpdateScene(activeWindow.scene.id, { subheadline: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#11151E] px-3 py-2 text-xs text-[#F8FAFC] focus:border-[#FF542E] focus:outline-none"
              />
            </div>

            <div className="mt-3">
              <label className="block text-[11px] font-medium text-[#94A3B8]">
                English Narration (US {normalizeLocalVoiceId(project.voiceId)} Voiceover)
              </label>
              <textarea
                rows={2}
                aria-label="Scene English narration"
                value={activeWindow.scene.narration}
                onChange={(e) =>
                  onUpdateScene(activeWindow.scene.id, { narration: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#11151E] px-3 py-2 text-xs leading-relaxed text-[#F8FAFC] focus:border-[#FF542E] focus:outline-none"
              />
            </div>
          </section>
        )}
      </div>
    </main>
  );
};
