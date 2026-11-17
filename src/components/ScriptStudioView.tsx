import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Play, Square, Volume2 } from 'lucide-react';
import { resolveSceneAmbientBg } from '../video/ambientPresets';
import {
  LOCAL_NEURAL_VOICES,
  clampVoiceSpeedPct,
  normalizeLocalVoiceId,
} from '../video/speechPacing';
import {
  MIN_SCENE_DURATION_SEC,
  MAX_SCENE_DURATION_SEC,
  clampSceneDurationSec,
} from '../video/timeline';
import type {
  AmbientBackgroundConfig,
  MaleVoiceId,
  VideoProject,
  VideoScene,
} from '../video/types';
import { AmbientBgPicker } from './AmbientBgPicker';
import {
  startNaturalPhraseSpeech,
  type LiveSpeechController,
} from '../utils/liveSpeechPlayer';

interface ScriptStudioViewProps {
  project: VideoProject;
  onUpdateScene: (sceneId: string, patch: Partial<VideoScene>) => void;
  onApplyAmbientBgToAll: (config: AmbientBackgroundConfig) => void;
  onUpdateVoice: (voiceId: MaleVoiceId, voiceSpeedPct?: number) => void;
  onSynthesizeSceneVoice: (sceneId: string) => Promise<void>;
  onSynthesizeAllVoices: () => Promise<void>;
  synthesizingSceneId: string | null;
  isSynthesizingAll: boolean;
  onReturnToStage: () => void;
}

const PACE_OPTIONS: Array<{ pct: number; label: string; tag: string }> = [
  { pct: -5, label: 'Measured', tag: '-5%' },
  { pct: 0, label: 'Natural', tag: '0%' },
  { pct: 6, label: 'Crisp', tag: '+6%' },
];

export const ScriptStudioView: React.FC<ScriptStudioViewProps> = ({
  project,
  onUpdateScene,
  onApplyAmbientBgToAll,
  onUpdateVoice,
  onSynthesizeSceneVoice,
  onSynthesizeAllVoices,
  synthesizingSceneId,
  isSynthesizingAll,
  onReturnToStage,
}) => {
  const [selectedId, setSelectedId] = useState(project.scenes[0]?.id || '');
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [isSpeakingLive, setIsSpeakingLive] = useState(false);
  const liveSpeechRef = useRef<LiveSpeechController | null>(null);

  useEffect(() => {
    if (project.scenes.length === 0) {
      setSelectedId('');
      return;
    }
    if (!project.scenes.some((s) => s.id === selectedId)) {
      setSelectedId(project.scenes[0].id);
    }
  }, [project.id, project.scenes, selectedId]);

  useEffect(() => {
    return () => {
      previewAudio?.pause();
    };
  }, [previewAudio]);

  useEffect(() => {
    return () => {
      liveSpeechRef.current?.stop();
    };
  }, [selectedId]);

  const selectedScene =
    project.scenes.find((s) => s.id === selectedId) || project.scenes[0];

  const handlePlayClip = (dataUrl?: string) => {
    if (!dataUrl) return;
    liveSpeechRef.current?.stop();
    setIsSpeakingLive(false);
    if (previewAudio) {
      previewAudio.pause();
    }
    const audio = new Audio(dataUrl);
    setPreviewAudio(audio);
    void audio.play().catch(() => {
      // Ignore autoplay rejection cleanly
    });
  };

  const handleToggleLiveSpeech = (narration: string) => {
    if (isSpeakingLive) {
      liveSpeechRef.current?.stop();
      setIsSpeakingLive(false);
      return;
    }
    if (previewAudio) {
      previewAudio.pause();
    }
    liveSpeechRef.current = startNaturalPhraseSpeech({
      narration,
      voiceId: normalizeLocalVoiceId(project.voiceId),
      voiceSpeedPct: clampVoiceSpeedPct(project.voiceSpeedPct),
      rate: 0.96,
      pitch: 1.0,
      onStart: () => setIsSpeakingLive(true),
      onEnd: () => setIsSpeakingLive(false),
    });
  };

  const activeVoiceId = normalizeLocalVoiceId(project.voiceId);
  const activeSpeedPct = clampVoiceSpeedPct(project.voiceSpeedPct);

  return (
    <main className="mx-auto max-w-[1260px] px-4 py-6 sm:px-6 sm:py-8">
      {/* American English Male Voiceover Settings */}
      <section className="mb-8 rounded-2xl border border-white/[0.08] bg-[#0B0E14] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[#F8FAFC]">
              Local American English Neural Voices
            </h2>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Zero-key neural narration (<code className="text-[#E2E8F0]">edge-tts-universal</code>)
              renders directly to 24kHz WAV without external API keys.
            </p>
          </div>
          <button
            type="button"
            onClick={onSynthesizeAllVoices}
            disabled={isSynthesizingAll || project.scenes.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1AE5A0] px-3.5 py-2 text-xs font-bold text-[#07090D] transition-colors hover:bg-[#14C98C] disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {isSynthesizingAll ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Synthesizing...</span>
              </>
            ) : (
              <>
                <Mic className="h-3.5 w-3.5" />
                <span>Generate All {project.scenes.length} Scenes</span>
              </>
            )}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {LOCAL_NEURAL_VOICES.map((v) => {
            const active = activeVoiceId === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onUpdateVoice(v.id, activeSpeedPct)}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  active
                    ? 'border-[#1AE5A0]/60 bg-[#1AE5A0]/10'
                    : 'border-white/[0.07] bg-[#11151E] hover:border-white/20'
                }`}
              >
                <div className="text-xs font-bold text-[#F8FAFC]">{v.name}</div>
                <div className="mt-1 font-mono text-[10px] text-[#64748B]">
                  {v.edgeVoiceName}
                </div>
                <div className="mt-1 text-[11px] leading-snug text-[#94A3B8]">
                  {v.profile}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
          <div>
            <div className="text-xs font-medium text-[#E2E8F0]">Delivery Pace</div>
            <div className="text-[11px] text-[#94A3B8]">
              Controls Edge TTS speech rate cleanly across all scenes
            </div>
          </div>
          <div
            role="group"
            aria-label="Voice delivery pace"
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#07090D] p-1"
          >
            {PACE_OPTIONS.map((opt) => {
              const selected = activeSpeedPct === opt.pct;
              return (
                <button
                  key={opt.pct}
                  type="button"
                  onClick={() => onUpdateVoice(activeVoiceId, opt.pct)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors whitespace-nowrap shrink-0 ${
                    selected
                      ? 'bg-[#FF542E] text-white'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  {opt.label} ({opt.tag})
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2-Column Scene Editor */}
      {project.scenes.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#0B0E14] p-8 text-center">
          <h3 className="font-display text-lg font-bold text-[#F8FAFC]">
            No Scenes Yet
          </h3>
          <p className="mt-2 text-xs text-[#94A3B8]">
            Generate scenes via OpenCode MCP or add a scene from Studio Stage to edit narration
            and synthesize {activeVoiceId} neural voiceovers.
          </p>
          <button
            type="button"
            onClick={onReturnToStage}
            className="mt-4 inline-flex items-center rounded-lg bg-[#FF542E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#EA4722]"
          >
            Go to Studio Stage
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Scene Selector */}
          <aside className="lg:col-span-4">
            <div className="space-y-2.5">
              {project.scenes.map((scene) => {
                const active = scene.id === selectedScene?.id;
                return (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => setSelectedId(scene.id)}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      active
                        ? 'border-[#FF542E]/60 bg-[#131722]'
                        : 'border-white/[0.07] bg-[#0B0E14] hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#F8FAFC]">
                        {scene.chapterTitle}
                      </span>
                      <span className="font-mono text-[#94A3B8] tabular-nums">
                        {scene.durationSec}s · {scene.audioDataUrl ? 'Audio Ready' : 'No WAV'}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#94A3B8]">
                      {scene.narration}
                    </p>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right Scene Details Editor */}
          {selectedScene && (
            <section className="rounded-2xl border border-white/[0.08] bg-[#0B0E14] p-6 lg:col-span-8">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
                <div>
                  <div className="font-mono text-xs text-[#FF542E]">
                    {selectedScene.chapterTitle}
                  </div>
                  <h3 className="mt-1 font-display text-xl font-bold text-[#F8FAFC]">
                    {selectedScene.headline}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleToggleLiveSpeech(selectedScene.narration)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      isSpeakingLive
                        ? 'border-[#FF542E]/60 bg-[#FF542E]/15 text-[#FF542E]'
                        : 'border-white/15 bg-[#11151E] text-[#E2E8F0] hover:border-white/30'
                    }`}
                  >
                    {isSpeakingLive ? (
                      <>
                        <Square className="h-3.5 w-3.5 fill-current" />
                        <span>Stop Preview</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3.5 w-3.5 text-[#1AE5A0]" />
                        <span>Preview Live Voice</span>
                      </>
                    )}
                  </button>
                  {selectedScene.audioDataUrl && (
                    <button
                      type="button"
                      onClick={() => handlePlayClip(selectedScene.audioDataUrl)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#11151E] px-3 py-2 text-xs font-medium text-[#E2E8F0] hover:border-white/30"
                    >
                      <Play className="h-3.5 w-3.5 text-[#1AE5A0]" />
                      <span>
                        Play WAV ({selectedScene.audioDurationSec || selectedScene.durationSec}s)
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onSynthesizeSceneVoice(selectedScene.id)}
                    disabled={synthesizingSceneId === selectedScene.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1AE5A0] px-3.5 py-2 text-xs font-bold text-[#07090D] hover:bg-[#14C98C] disabled:opacity-60"
                  >
                    {synthesizingSceneId === selectedScene.id ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="h-3.5 w-3.5" />
                        <span>Synthesize Scene Audio</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8]">
                    On-Screen Kinetic Headline
                  </label>
                  <input
                    type="text"
                    value={selectedScene.headline}
                    onChange={(e) =>
                      onUpdateScene(selectedScene.id, { headline: e.target.value })
                    }
                    className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#11151E] px-3 py-2 text-sm font-semibold text-[#F8FAFC] focus:border-[#FF542E] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#94A3B8]">
                    Scene Duration (seconds)
                  </label>
                  <input
                    type="number"
                    min={MIN_SCENE_DURATION_SEC}
                    max={MAX_SCENE_DURATION_SEC}
                    step={0.5}
                    value={selectedScene.durationSec}
                    onChange={(e) =>
                      onUpdateScene(selectedScene.id, {
                        durationSec: clampSceneDurationSec(Number(e.target.value) || 8, 8),
                      })
                    }
                    className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#11151E] px-3 py-2 font-mono text-sm text-[#F8FAFC] tabular-nums focus:border-[#FF542E] focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-xs font-medium text-[#94A3B8]">
                  Subheadline
                </label>
                <input
                  type="text"
                  value={selectedScene.subheadline}
                  onChange={(e) =>
                    onUpdateScene(selectedScene.id, { subheadline: e.target.value })
                  }
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#11151E] px-3 py-2 text-sm text-[#F8FAFC] focus:border-[#FF542E] focus:outline-none"
                />
              </div>

              <div className="mt-4">
                <label className="block text-xs font-medium text-[#94A3B8]">
                  Spoken English Narration (Voiceover Script)
                </label>
                <textarea
                  rows={4}
                  value={selectedScene.narration}
                  onChange={(e) =>
                    onUpdateScene(selectedScene.id, { narration: e.target.value })
                  }
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#11151E] p-3 text-sm leading-relaxed text-[#F8FAFC] focus:border-[#FF542E] focus:outline-none"
                />
              </div>

              {selectedScene.codeSnippet !== undefined && (
                <div className="mt-4">
                  <label className="block text-xs font-medium text-[#94A3B8]">
                    Code / Protocol Visual Block
                  </label>
                  <textarea
                    rows={5}
                    value={selectedScene.codeSnippet}
                    onChange={(e) =>
                      onUpdateScene(selectedScene.id, { codeSnippet: e.target.value })
                    }
                    className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#07090D] p-3 font-mono text-xs leading-relaxed text-[#1AE5A0] focus:border-[#1AE5A0] focus:outline-none"
                  />
                </div>
              )}

              <AmbientBgPicker
                value={resolveSceneAmbientBg(selectedScene)}
                onChange={(nextBg) =>
                  onUpdateScene(selectedScene.id, { ambientBg: nextBg })
                }
                onApplyToAll={(cfg) => onApplyAmbientBgToAll(cfg)}
              />

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={onReturnToStage}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#11151E] px-4 py-2 text-xs font-semibold text-[#F8FAFC] hover:border-white/30"
                >
                  <Play className="h-3.5 w-3.5 text-[#FF542E]" />
                  <span>Preview on Studio Stage</span>
                </button>
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
};
