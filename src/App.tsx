import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { TopBar, type SaveSyncState, type StudioTab } from './components/TopBar';
import {
  StageView,
  type PreviewSeekRequest,
  type ProjectListItem,
} from './components/StageView';
import { createBlankProject } from './video/projectTemplates';
import { resolveAspectRatio } from './video/aspectRatios';
import { clampVoiceSpeedPct, normalizeLocalVoiceId } from './video/speechPacing';
import { clearSceneAudio, computeVoiceFittedDurationSec } from './video/timeline';
import type {
  AnimationEasingConfig,
  AspectRatio,
  MaleVoiceId,
  SceneTransitionConfig,
  VideoProject,
  VideoScene,
} from './video/types';
import {
  buildMasterNarrationWav,
  exportProjectToStudioMp4,
  type ExportProgress,
} from './utils/videoExporter';

const ScriptStudioView = lazy(() =>
  import('./components/ScriptStudioView').then((m) => ({ default: m.ScriptStudioView }))
);
const TemplatesView = lazy(() =>
  import('./components/TemplatesView').then((m) => ({ default: m.TemplatesView }))
);
const McpBridgeView = lazy(() =>
  import('./components/McpBridgeView').then((m) => ({ default: m.McpBridgeView }))
);

const INITIAL_BLANK_PROJECT = createBlankProject(
  'Untitled Studio Video',
  '16:9',
  'studio-blank'
);

function normalizeClientProject(raw: VideoProject): VideoProject {
  const dims = resolveAspectRatio(raw.aspectRatio, raw.width, raw.height);
  return {
    ...raw,
    fps: 60,
    aspectRatio: dims.aspectRatio,
    width: dims.width,
    height: dims.height,
    voiceId: normalizeLocalVoiceId(raw.voiceId),
    voiceSpeedPct: clampVoiceSpeedPct(raw.voiceSpeedPct),
  };
}

function triggerUrlDownload(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  triggerUrlDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [project, setProject] = useState<VideoProject>(INITIAL_BLANK_PROJECT);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [projectsList, setProjectsList] = useState<ProjectListItem[]>([
    {
      id: INITIAL_BLANK_PROJECT.id,
      title: INITIAL_BLANK_PROJECT.title,
      aspectRatio: '16:9',
      sceneCount: INITIAL_BLANK_PROJECT.scenes.length,
      updatedAt: new Date().toISOString(),
    },
  ]);
  const [externalEvents, setExternalEvents] = useState<
    Array<{
      id: string;
      timestamp: string;
      client: string;
      tool: string;
      projectId: string;
      summary: string;
    }>
  >([]);

  const [activeTab, setActiveTab] = useState<StudioTab>('stage');
  const [sseConnected, setSseConnected] = useState(false);
  const [previewSeekRequest, setPreviewSeekRequest] =
    useState<PreviewSeekRequest | null>(null);
  const [healthStatus, setHealthStatus] = useState<{
    ffmpegAvailable: boolean | null;
    edgeTtsReady: boolean;
    geminiConfigured: boolean;
  }>({
    ffmpegAvailable: null,
    edgeTtsReady: true,
    geminiConfigured: false,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [synthesizingSceneId, setSynthesizingSceneId] = useState<string | null>(null);
  const [isSynthesizingAll, setIsSynthesizingAll] = useState(false);
  const [synthesisProgress, setSynthesisProgress] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [renderedVideo, setRenderedVideo] = useState<{
    exists: boolean;
    url: string;
    sizeBytes: number;
    width: number;
    height: number;
    fps: number;
  } | null>(null);

  const [saveState, setSaveState] = useState<SaveSyncState>('saved');

  const synthesisRunIdRef = useRef(0);
  const projectRef = useRef(project);
  projectRef.current = project;
  const saveTimerRef = useRef<number | null>(null);
  const saveSeqRef = useRef(0);

  const refreshProjectsList = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.projects)) {
        setProjectsList(data.projects);
      }
      if (data.activeProject) {
        setProject(normalizeClientProject(data.activeProject));
        setSaveState('saved');
      }
    } catch {
      // Ignore transient network errors
    } finally {
      setHasHydrated(true);
    }
  }, []);

  const persistProjectDebounced = useCallback((nextProject: VideoProject) => {
    const seq = ++saveSeqRef.current;
    setSaveState('saving');
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void fetch(`/api/projects/${encodeURIComponent(nextProject.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextProject),
      })
        .then((res) => {
          if (seq === saveSeqRef.current) {
            setSaveState(res.ok ? 'saved' : 'error');
          }
        })
        .catch(() => {
          if (seq === saveSeqRef.current) {
            setSaveState('error');
          }
        });
    }, 350);
  }, []);

  const updateProjectAndSave = useCallback(
    (updater: (prev: VideoProject) => VideoProject) => {
      setProject((prev) => {
        const next = updater(prev);
        persistProjectDebounced(next);
        return next;
      });
    },
    [persistProjectDebounced]
  );

  useEffect(() => {
    void refreshProjectsList();

    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => {
        setHealthStatus({
          ffmpegAvailable:
            typeof data?.ffmpegAvailable === 'boolean' ? data.ffmpegAvailable : null,
          edgeTtsReady: typeof data?.edgeTtsReady === 'boolean' ? data.edgeTtsReady : true,
          geminiConfigured: Boolean(data?.geminiConfigured),
        });
      })
      .catch(() => {});

    fetch('/api/external-events')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.events)) {
          setExternalEvents(data.events);
        }
      })
      .catch(() => {});

    const es = new EventSource('/api/events');
    es.onopen = () => setSseConnected(true);
    es.onerror = () => setSseConnected(false);
    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (payload.type === 'connected') {
          setSseConnected(true);
        } else if (payload.type === 'active_project_changed' && payload.project) {
          if (payload.source !== 'ui') {
            if (saveTimerRef.current) {
              window.clearTimeout(saveTimerRef.current);
              saveTimerRef.current = null;
            }
            saveSeqRef.current += 1;
            setProject(normalizeClientProject(payload.project));
            setSaveState('saved');
            setHasHydrated(true);
          }
          void fetch('/api/projects')
            .then((r) => r.json())
            .then((d) => {
              if (Array.isArray(d?.projects)) setProjectsList(d.projects);
            })
            .catch(() => {});
        } else if (payload.type === 'project_updated' && payload.project) {
          if (payload.source !== 'ui' && payload.projectId === projectRef.current.id) {
            if (saveTimerRef.current) {
              window.clearTimeout(saveTimerRef.current);
              saveTimerRef.current = null;
            }
            saveSeqRef.current += 1;
            setProject(normalizeClientProject(payload.project));
            setSaveState('saved');
            setHasHydrated(true);
          }
          void fetch('/api/projects')
            .then((r) => r.json())
            .then((d) => {
              if (Array.isArray(d?.projects)) setProjectsList(d.projects);
            })
            .catch(() => {});
        } else if (payload.type === 'external_agent_event' && payload.event) {
          setExternalEvents((prev) => [payload.event, ...prev].slice(0, 30));
        } else if (
          payload.type === 'preview_seek' &&
          (!payload.projectId || payload.projectId === projectRef.current.id)
        ) {
          setPreviewSeekRequest({
            nonce: Date.now(),
            sceneNumber: payload.sceneNumber,
            sceneId: payload.sceneId,
            play: Boolean(payload.play),
          });
        } else if (payload.type === 'render_progress' && payload.status) {
          const st = payload.status;
          if (st.projectId && st.projectId !== projectRef.current.id) {
            return;
          }
          if (st.rendering) {
            setIsExporting(true);
            setExportProgress({
              progress: Math.max(0.02, Math.min(1, st.progress || 0.05)),
              label: st.label || 'Rendering Remotion MP4...',
            });
          } else {
            setIsExporting(false);
            if (st.exists && st.sizeBytes > 10000) {
              setRenderedVideo({
                exists: true,
                url: st.url,
                sizeBytes: st.sizeBytes,
                width: st.width || 1920,
                height: st.height || 1080,
                fps: st.fps || 60,
              });
            }
            if (st.error) {
              setErrorMsg(st.error);
              setExportProgress(null);
            } else if (st.progress >= 1) {
              setExportProgress({ progress: 1, label: st.label || 'MP4 ready!' });
              setTimeout(() => setExportProgress(null), 1800);
            }
          }
        }
      } catch {
        // Ignore malformed SSE event
      }
    };

    return () => {
      es.close();
    };
  }, [refreshProjectsList]);

  useEffect(() => {
    fetch(`/api/render-status?projectId=${encodeURIComponent(project.id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.exists === 'boolean') {
          setRenderedVideo(data);
          setIsExporting(Boolean(data.rendering));
          if (data.rendering) {
            setExportProgress({
              progress: Math.max(0.02, Math.min(1, data.progress || 0.05)),
              label: data.label || 'Rendering Remotion MP4...',
            });
          } else {
            setExportProgress(null);
          }
        }
      })
      .catch(() => {});
  }, [project.id]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const flushPendingSave = useCallback(async () => {
    if (!saveTimerRef.current) return;
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    const seq = ++saveSeqRef.current;
    const latest = projectRef.current;
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(latest.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(latest),
      });
      if (seq === saveSeqRef.current) {
        setSaveState(res.ok ? 'saved' : 'error');
      }
    } catch {
      if (seq === saveSeqRef.current) {
        setSaveState('error');
      }
    }
  }, []);

  const handleSelectProject = async (projectId: string) => {
    setErrorMsg(null);
    await flushPendingSave();
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/activate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.project) {
        throw new Error(data?.error || 'Failed to switch project.');
      }
      setProject(normalizeClientProject(data.project));
      setSaveState('saved');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to switch project.');
    }
  };

  const handleCreateNewProject = async () => {
    setErrorMsg(null);
    await flushPendingSave();
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Video Project ${projectsList.length + 1}`,
          aspectRatio: project.aspectRatio || '16:9',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.project) {
        throw new Error(data?.error || 'Failed to create project.');
      }
      setProject(normalizeClientProject(data.project));
      if (Array.isArray(data.projects)) setProjectsList(data.projects);
      setSaveState('saved');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create project.');
    }
  };

  const handleUseTemplate = async (templateId: string) => {
    setErrorMsg(null);
    await flushPendingSave();
    try {
      const res = await fetch('/api/projects/from-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });
      const data = await res.json();
      if (!res.ok || !data.project) {
        throw new Error(data?.error || 'Failed to instantiate template.');
      }
      setProject(normalizeClientProject(data.project));
      if (Array.isArray(data.projects)) setProjectsList(data.projects);
      setSaveState('saved');
      setActiveTab('stage');
      window.scrollTo({ top: 0 });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to instantiate template.');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    setErrorMsg(null);
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    saveSeqRef.current += 1;
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to delete project.');
      }
      if (data.activeProject) setProject(normalizeClientProject(data.activeProject));
      if (Array.isArray(data.projects)) setProjectsList(data.projects);
      setSaveState('saved');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete project.');
    }
  };

  const handleChangeAspectRatio = (ratio: AspectRatio) => {
    const dims = resolveAspectRatio(ratio);
    updateProjectAndSave((prev) => ({
      ...prev,
      aspectRatio: dims.aspectRatio,
      width: dims.width,
      height: dims.height,
    }));
  };

  const requestSceneTts = async (
    projectId: string,
    scene: VideoScene,
    voiceId: MaleVoiceId,
    voiceStyle: string,
    voiceSpeedPct?: number
  ): Promise<{ audioDataUrl: string; durationSec: number; model: string }> => {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        sceneId: scene.id,
        text: scene.narration,
        voiceName: normalizeLocalVoiceId(voiceId),
        style: voiceStyle,
        speedPct: clampVoiceSpeedPct(voiceSpeedPct),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Failed to synthesize voiceover.');
    }
    return {
      audioDataUrl: data.audioDataUrl,
      durationSec: data.durationSec,
      model: data.model || voiceId,
    };
  };

  const synthesizeVoices = useCallback(
    async (onlyMissing: boolean) => {
      const runId = ++synthesisRunIdRef.current;
      setErrorMsg(null);
      setIsSynthesizingAll(true);
      try {
        const snapshot = projectRef.current;
        const targets = snapshot.scenes.filter((s) => !onlyMissing || !s.audioDataUrl);
        for (let i = 0; i < targets.length; i++) {
          if (synthesisRunIdRef.current !== runId) break;
          const sc = targets[i];
          setSynthesisProgress(`Voice ${sc.index}/${snapshot.scenes.length}...`);
          const latest = projectRef.current;
          const result = await requestSceneTts(
            latest.id,
            sc,
            latest.voiceId,
            latest.voiceStyle,
            latest.voiceSpeedPct
          );
          if (synthesisRunIdRef.current !== runId) break;
          updateProjectAndSave((prev) => ({
            ...prev,
            scenes: prev.scenes.map((existing) =>
              existing.id === sc.id && existing.narration.trim() === sc.narration.trim()
                ? {
                    ...existing,
                    audioDataUrl: result.audioDataUrl,
                    audioDurationSec: result.durationSec,
                    audioProvider: result.model,
                    durationSec: computeVoiceFittedDurationSec(result.durationSec),
                  }
                : existing
            ),
          }));
        }
      } catch (err) {
        if (synthesisRunIdRef.current === runId) {
          setErrorMsg(err instanceof Error ? err.message : 'Batch voiceover failed.');
        }
      } finally {
        if (synthesisRunIdRef.current === runId) {
          setIsSynthesizingAll(false);
          setSynthesisProgress(null);
        }
      }
    },
    [updateProjectAndSave]
  );

  const handleUpdateScene = (sceneId: string, patch: Partial<VideoScene>) => {
    updateProjectAndSave((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) => {
        if (s.id !== sceneId) return s;
        const narrationChanged =
          patch.narration !== undefined &&
          patch.narration.trim() !== s.narration.trim();
        const merged: VideoScene = { ...s, ...patch };
        return narrationChanged && patch.audioDataUrl === undefined
          ? clearSceneAudio(merged)
          : merged;
      }),
    }));
  };

  const handleAddBlankScene = () => {
    updateProjectAndSave((prev) => {
      const nextIndex = prev.scenes.length + 1;
      const newScene: VideoScene = {
        id: `scene-${Date.now().toString(36)}-${nextIndex}`,
        index: nextIndex,
        kind: 'bullet-spotlight',
        chapterTitle: `${String(nextIndex).padStart(2, '0')}. New Scene`,
        headline: 'KEY ARCHITECTURAL POINT',
        accentWord: 'ARCHITECTURAL',
        subheadline: 'Edit headline, archetype, or narration in the inspector or OpenCode',
        narration:
          'In this next section, let us break down how this component integrates cleanly into your production architecture.',
        durationSec: 10,
        accent: 'hybrid',
        leftBadge: 'STEP',
        rightBadge: 'RESULT',
        bulletPoints: [
          'First clear takeaway for the viewer',
          'Second concrete detail or metric',
        ],
        ambientBg: { preset: 'fiber-streams', opacity: 0.22 },
      };
      return {
        ...prev,
        scenes: [...prev.scenes, newScene],
      };
    });
  };

  const handleDeleteScene = (sceneId: string) => {
    updateProjectAndSave((prev) => ({
      ...prev,
      scenes: prev.scenes
        .filter((s) => s.id !== sceneId)
        .map((s, idx) => ({ ...s, index: idx + 1 })),
    }));
  };

  const handleUpdateVoice = (voiceId: MaleVoiceId, voiceSpeedPct?: number) => {
    updateProjectAndSave((prev) => {
      const nextVoiceId = normalizeLocalVoiceId(voiceId);
      const nextSpeedPct = clampVoiceSpeedPct(voiceSpeedPct ?? prev.voiceSpeedPct);
      const voiceChanged =
        nextVoiceId !== normalizeLocalVoiceId(prev.voiceId) ||
        nextSpeedPct !== clampVoiceSpeedPct(prev.voiceSpeedPct);
      return {
        ...prev,
        voiceId: nextVoiceId,
        voiceSpeedPct: nextSpeedPct,
        scenes: voiceChanged ? prev.scenes.map(clearSceneAudio) : prev.scenes,
      };
    });
  };

  const handleSynthesizeSceneVoice = async (sceneId: string) => {
    const snapshot = projectRef.current;
    const target = snapshot.scenes.find((s) => s.id === sceneId);
    if (!target) return;
    setErrorMsg(null);
    setSynthesizingSceneId(sceneId);
    try {
      const result = await requestSceneTts(
        snapshot.id,
        target,
        snapshot.voiceId,
        snapshot.voiceStyle,
        snapshot.voiceSpeedPct
      );
      updateProjectAndSave((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s) =>
          s.id === sceneId && s.narration.trim() === target.narration.trim()
            ? {
                ...s,
                audioDataUrl: result.audioDataUrl,
                audioDurationSec: result.durationSec,
                audioProvider: result.model,
                durationSec: computeVoiceFittedDurationSec(result.durationSec),
              }
            : s
        ),
      }));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Voiceover synthesis failed.');
    } finally {
      setSynthesizingSceneId(null);
    }
  };

  const handleSynthesizeAllVoices = async () => {
    const hasMissing = project.scenes.some((s) => !s.audioDataUrl);
    await synthesizeVoices(hasMissing);
  };

  const handleDownloadMasterAudio = async () => {
    try {
      const wavBlob = await buildMasterNarrationWav(project);
      if (!wavBlob) {
        setErrorMsg('Synthesize at least one scene voiceover before downloading WAV.');
        return;
      }
      triggerDownload(wavBlob, `${project.id}-voiceover.wav`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to package master WAV audio.'
      );
    }
  };

  const handleExportVideo = async () => {
    if (isExporting) return;
    setErrorMsg(null);
    setIsExporting(true);
    setExportProgress({ progress: 0, label: 'Starting unified Remotion 60fps export...' });
    try {
      await flushPendingSave();
      const latest = projectRef.current;
      const result = await exportProjectToStudioMp4(latest, setExportProgress);
      if (result.format === 'mp4') {
        setRenderedVideo({
          exists: true,
          url: result.url,
          sizeBytes: result.sizeBytes,
          width: result.width,
          height: result.height,
          fps: result.fps,
        });
        triggerUrlDownload(result.url, `${latest.id}-60fps.mp4`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Video export failed.');
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportProgress(null), 1500);
    }
  };

  const handleDownloadSavedMp4 = () => {
    if (!renderedVideo?.exists) return;
    triggerUrlDownload(renderedVideo.url, `${project.id}-60fps.mp4`);
  };

  const handleDownloadProjectZip = () => {
    triggerUrlDownload('/api/download-project', 'cloudmotion-studio-opencode.zip');
  };

  return (
    <div className="min-h-screen bg-[#07090D] text-[#F4F6FA]">
      <TopBar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0 });
        }}
        onExportVideo={handleExportVideo}
        isExporting={isExporting}
        canExport={project.scenes.length > 0}
        saveState={saveState}
      />

      {exportProgress && (
        <div className="mx-auto mt-3 max-w-[1440px] px-4 sm:px-6">
          <div className="rounded-xl border border-[#1AE5A0]/30 bg-[#0B1211] px-4 py-3">
            <div className="flex items-center justify-between text-xs font-medium text-[#1AE5A0]">
              <span>Rendering Unified Remotion MP4 + {project.voiceId} Voiceover</span>
              <span className="font-mono tabular-nums">{exportProgress.label}</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                style={{ width: `${Math.round(exportProgress.progress * 100)}%` }}
                className="h-full bg-gradient-to-r from-[#FF542E] to-[#1AE5A0]"
              />
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="mx-auto mt-3 max-w-[1440px] px-4 sm:px-6">
          <div className="flex items-start justify-between gap-4 overflow-hidden rounded-xl border border-[#FF542E]/40 bg-[#180E10] px-4 py-3 text-xs text-[#FCA5A5]">
            <span className="min-w-0 flex-1 break-words leading-relaxed">{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="shrink-0 font-semibold text-white hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {activeTab === 'stage' && (
        <StageView
          project={project}
          projectsList={projectsList}
          isHydrating={!hasHydrated}
          previewSeekRequest={previewSeekRequest}
          onOpenOpenCodeSetup={() => setActiveTab('bridge')}
          onOpenTemplates={() => setActiveTab('templates')}
          onSelectProject={handleSelectProject}
          onCreateNewProject={handleCreateNewProject}
          onDeleteProject={handleDeleteProject}
          onChangeAspectRatio={handleChangeAspectRatio}
          onUpdateScene={handleUpdateScene}
          onAddBlankScene={handleAddBlankScene}
          onDeleteScene={handleDeleteScene}
          onSynthesizeSceneVoice={handleSynthesizeSceneVoice}
          synthesizingSceneId={synthesizingSceneId}
          onToggleCaptions={() =>
            updateProjectAndSave((p) => ({ ...p, showCaptions: !p.showCaptions }))
          }
          onToggleSfx={() =>
            updateProjectAndSave((p) => ({ ...p, sfxEnabled: !p.sfxEnabled }))
          }
          onUpdateSceneAmbientBg={(sceneId, preset) =>
            updateProjectAndSave((prev) => ({
              ...prev,
              scenes: prev.scenes.map((s) =>
                s.id === sceneId
                  ? {
                      ...s,
                      ambientBg: {
                        ...(s.ambientBg || { preset: 'fiber-streams', opacity: 0.34 }),
                        preset,
                      },
                    }
                  : s
              ),
            }))
          }
          onUpdateBgTransition={(bgTransition) =>
            updateProjectAndSave((prev) => ({ ...prev, bgTransition }))
          }
          onUpdateSceneTransition={(sceneTransition: SceneTransitionConfig) =>
            updateProjectAndSave((prev) => ({ ...prev, sceneTransition }))
          }
          onUpdateAnimationEasing={(animationEasing: AnimationEasingConfig) =>
            updateProjectAndSave((prev) => ({ ...prev, animationEasing }))
          }
          onSynthesizeAllVoices={handleSynthesizeAllVoices}
          onDownloadMasterAudio={handleDownloadMasterAudio}
          renderedVideo={renderedVideo}
          onDownloadSavedMp4={handleDownloadSavedMp4}
          isSynthesizingAll={isSynthesizingAll}
          synthesisProgress={synthesisProgress}
          onJumpToScript={() => setActiveTab('script')}
        />
      )}

      <Suspense
        fallback={
          <div className="mx-auto max-w-[1260px] px-4 py-10 text-xs text-[#94A3B8]">
            Loading studio workspace...
          </div>
        }
      >
        {activeTab === 'script' && (
          <ScriptStudioView
            project={project}
            onUpdateScene={handleUpdateScene}
            onApplyAmbientBgToAll={(config) =>
              updateProjectAndSave((prev) => ({
                ...prev,
                scenes: prev.scenes.map((s) => ({ ...s, ambientBg: { ...config } })),
              }))
            }
            onUpdateVoice={handleUpdateVoice}
            onSynthesizeSceneVoice={handleSynthesizeSceneVoice}
            onSynthesizeAllVoices={handleSynthesizeAllVoices}
            synthesizingSceneId={synthesizingSceneId}
            isSynthesizingAll={isSynthesizingAll}
            onReturnToStage={() => setActiveTab('stage')}
          />
        )}

        {activeTab === 'templates' && (
          <TemplatesView onUseTemplate={handleUseTemplate} />
        )}

        {activeTab === 'bridge' && (
          <McpBridgeView
            project={project}
            externalEvents={externalEvents}
            sseConnected={sseConnected}
            healthStatus={healthStatus}
            onDownloadProjectZip={handleDownloadProjectZip}
          />
        )}
      </Suspense>
    </div>
  );
}
