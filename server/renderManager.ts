import fs from 'node:fs';
import path from 'node:path';
import type { VideoProject } from '../src/video/types';
import { renderUnifiedRemotionMp4 } from './remotionExporter';
import { sanitizePathId, type WorkspaceStore } from './workspaceStore';

export interface RenderStatusSnapshot {
  exists: boolean;
  url: string;
  filePath: string;
  sizeBytes: number;
  updatedAt?: string;
  rendering: boolean;
  progress: number;
  label: string;
  error: string | null;
  projectId: string;
  fileName: string;
  width: number;
  height: number;
  fps: number;
}

interface ProjectRenderState {
  rendering: boolean;
  progress: number;
  label: string;
  error: string | null;
  width: number;
  height: number;
  fps: number;
}

export class RenderManager {
  private readonly rootDir: string;
  private readonly rendersDir: string;
  private readonly store: WorkspaceStore;

  private activeRenderProjectId: string | null = null;
  private readonly projectStates = new Map<string, ProjectRenderState>();

  constructor(rootDir: string, rendersDir: string, store: WorkspaceStore) {
    this.rootDir = rootDir;
    this.rendersDir = rendersDir;
    this.store = store;
    fs.mkdirSync(this.rendersDir, { recursive: true });
  }

  private getOrDefaultProjectState(projectId: string): ProjectRenderState {
    const existing = this.projectStates.get(projectId);
    if (existing) return existing;
    const proj = this.store.getProject(projectId);
    return {
      rendering: false,
      progress: 0,
      label: '',
      error: null,
      width: proj?.width || 1920,
      height: proj?.height || 1080,
      fps: 60,
    };
  }

  private getRenderFileMeta(projectId: string) {
    const pid = sanitizePathId(projectId);
    const fileName = `${pid}-60fps.mp4`;
    const filePath = path.join(this.rendersDir, fileName);
    try {
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        if (stat.size > 10000) {
          return {
            exists: true,
            url: `/renders/${fileName}?t=${Math.floor(stat.mtimeMs)}`,
            filePath,
            sizeBytes: stat.size,
            updatedAt: stat.mtime.toISOString(),
          };
        }
      }
    } catch {
      // Ignore stat errors
    }
    return {
      exists: false,
      url: `/renders/${fileName}`,
      filePath,
      sizeBytes: 0,
      updatedAt: undefined,
    };
  }

  getStatus(projectId?: string): RenderStatusSnapshot {
    const targetPid =
      projectId || this.activeRenderProjectId || this.store.getActiveProjectId();
    const fileMeta = this.getRenderFileMeta(targetPid);
    const st = this.getOrDefaultProjectState(targetPid);

    return {
      ...fileMeta,
      rendering: st.rendering,
      progress: st.progress,
      label: st.label,
      error: st.error,
      projectId: targetPid,
      fileName: path.basename(fileMeta.filePath),
      width: st.width,
      height: st.height,
      fps: st.fps,
    };
  }

  startRender(project: VideoProject): {
    started: boolean;
    alreadyRunning?: boolean;
    busyWithProjectId?: string;
    error?: string;
    status: RenderStatusSnapshot;
  } {
    if (!project.scenes || project.scenes.length === 0) {
      const msg = 'Cannot export MP4: project has 0 scenes. Add scenes before rendering.';
      return {
        started: false,
        error: msg,
        status: {
          ...this.getStatus(project.id),
          error: msg,
        },
      };
    }

    if (this.activeRenderProjectId) {
      if (this.activeRenderProjectId !== project.id) {
        return {
          started: false,
          alreadyRunning: true,
          busyWithProjectId: this.activeRenderProjectId,
          error: `Another export ("${this.activeRenderProjectId}") is currently rendering. Please wait until it finishes before exporting "${project.id}".`,
          status: this.getStatus(project.id),
        };
      }
      return {
        started: false,
        alreadyRunning: true,
        status: this.getStatus(project.id),
      };
    }

    const safePid = sanitizePathId(project.id);
    const outFile = `${safePid}-60fps.mp4`;
    const outPath = path.join(this.rendersDir, outFile);

    this.activeRenderProjectId = project.id;
    const state: ProjectRenderState = {
      rendering: true,
      progress: 0.01,
      label: 'Starting unified Remotion 60fps export...',
      error: null,
      width: project.width,
      height: project.height,
      fps: 60,
    };
    this.projectStates.set(project.id, state);

    this.store.broadcast({
      type: 'render_progress',
      status: this.getStatus(project.id),
    });

    let lastBroadcastPct = -1;

    void renderUnifiedRemotionMp4(this.rootDir, project, outPath, (progress, label) => {
      state.progress = progress;
      state.label = label;
      const pct = Math.round(progress * 100);
      if (pct !== lastBroadcastPct && (pct % 4 === 0 || pct >= 94)) {
        lastBroadcastPct = pct;
        this.store.broadcast({
          type: 'render_progress',
          status: this.getStatus(project.id),
        });
      }
    })
      .then((meta) => {
        state.rendering = false;
        state.progress = 1;
        state.width = meta.width;
        state.height = meta.height;
        state.label = `${meta.width}×${meta.height} 60fps MP4 ready!`;
        this.activeRenderProjectId = null;
        this.store.broadcast({
          type: 'render_progress',
          status: this.getStatus(project.id),
        });
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Remotion MP4 render failed.';
        console.error('Unified Remotion render error:', msg);
        state.rendering = false;
        state.error = msg;
        state.label = 'Render failed';
        this.activeRenderProjectId = null;
        this.store.broadcast({
          type: 'render_progress',
          status: this.getStatus(project.id),
        });
      });

    return {
      started: true,
      status: this.getStatus(project.id),
    };
  }
}
