import express from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  PROJECT_TEMPLATES,
  createBlankProject,
  createProjectFromTemplate,
} from './src/video/projectTemplates';
import { clampVoiceSpeedPct } from './src/video/speechPacing';
import type { AspectRatio, MaleVoiceId, VideoProject } from './src/video/types';
import { mountMcpBridge } from './server/mcpBridge';
import { RenderManager } from './server/renderManager';
import {
  checkFfmpegAvailability,
  getGenAIClient,
  synthesizeStudioVoice,
} from './server/voiceEngine';
import { sanitizePathId, WorkspaceStore } from './server/workspaceStore';
import { createProjectZipBuffer } from './server/zipArchive';

export function isValidMediaContainer(buf: Buffer, ext: '.mp4' | '.webm'): boolean {
  if (!Buffer.isBuffer(buf) || buf.length < 16) return false;
  if (ext === '.webm') {
    // EBML header magic bytes: 0x1A 0x45 0xDF 0xA3
    return buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
  }
  // ISO BMFF / MP4: 'ftyp' box typically at bytes 4..8
  return buf.subarray(4, 8).toString('ascii') === 'ftyp';
}

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  const store = new WorkspaceStore(__dirname);
  const audioDir = path.resolve(__dirname, 'public/audio');
  const rendersDir = path.resolve(__dirname, 'public/renders');
  const backgroundsDir = path.resolve(__dirname, 'public/backgrounds');
  fs.mkdirSync(audioDir, { recursive: true });
  fs.mkdirSync(rendersDir, { recursive: true });
  fs.mkdirSync(backgroundsDir, { recursive: true });
  const noStoreStaticOptions = {
    setHeaders: (res: express.Response) => {
      res.setHeader('Cache-Control', 'no-store');
    },
  };
  app.use('/audio', express.static(audioDir, noStoreStaticOptions));
  app.use('/renders', express.static(rendersDir, noStoreStaticOptions));
  app.use('/backgrounds', express.static(backgroundsDir, noStoreStaticOptions));

  const renderManager = new RenderManager(__dirname, rendersDir, store);

  // Mount MCP server (/mcp) for OpenCode & external CLI agents
  mountMcpBridge(app, store, renderManager);

  // SSE Live-Sync Stream for browser IDE
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write(
      `data: ${JSON.stringify({ type: 'connected', activeProjectId: store.getActiveProjectId() })}\n\n`
    );
    store.addSseClient(res);
    const keepAlive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(keepAlive);
      }
    }, 25000);
    req.on('close', () => clearInterval(keepAlive));
  });

  app.get('/api/health', async (_req, res) => {
    const ffmpegAvailable = await checkFfmpegAvailability();
    res.json({
      ok: true,
      ffmpegAvailable,
      edgeTtsReady: true,
      geminiConfigured: Boolean(getGenAIClient()),
      activeProjectId: store.getActiveProjectId(),
    });
  });

  app.get('/api/external-events', (_req, res) => {
    res.json({ events: store.getExternalEvents() });
  });

  app.get('/api/templates', (_req, res) => {
    res.json({ templates: PROJECT_TEMPLATES });
  });

  // Persistent local video background uploads (served statically for Player & Remotion MP4 export)
  app.get('/api/backgrounds', (_req, res) => {
    try {
      const files = fs
        .readdirSync(backgroundsDir)
        .filter((f) => f.endsWith('.mp4') || f.endsWith('.webm'))
        .map((fileName) => {
          const stat = fs.statSync(path.join(backgroundsDir, fileName));
          return {
            fileName,
            url: `/backgrounds/${fileName}`,
            sizeBytes: stat.size,
            updatedAt: stat.mtime.toISOString(),
          };
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return res.json({ backgrounds: files });
    } catch {
      return res.json({ backgrounds: [] });
    }
  });

  app.delete('/api/backgrounds/:fileName', (req, res) => {
    const safeName = path.basename(String(req.params.fileName || ''));
    if (!/^[a-zA-Z0-9_-]+\.(mp4|webm)$/.test(safeName)) {
      return res.status(400).json({ error: 'Invalid background file name.' });
    }
    const targetPath = path.join(backgroundsDir, safeName);
    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'Background video not found.' });
    }
    fs.unlinkSync(targetPath);
    return res.json({ ok: true, deleted: safeName });
  });

  app.post(
    '/api/backgrounds',
    express.raw({ type: ['video/mp4', 'video/webm', 'application/octet-stream'], limit: '80mb' }),
    (req, res) => {
      const buf = req.body as Buffer;
      if (!Buffer.isBuffer(buf) || buf.length < 128) {
        return res.status(400).json({ error: 'Valid MP4 or WebM binary payload is required.' });
      }
      const rawHeader = String(req.headers['x-file-name'] || 'background.mp4');
      let rawName = rawHeader;
      try {
        rawName = decodeURIComponent(rawHeader);
      } catch {
        // Keep raw header when not percent-encoded
      }
      const cleanClientName = path.basename(rawName);
      const ext: '.mp4' | '.webm' =
        path.extname(cleanClientName).toLowerCase() === '.webm' ? '.webm' : '.mp4';
      if (!isValidMediaContainer(buf, ext)) {
        return res.status(400).json({
          error: `File header is not a valid ${ext === '.webm' ? 'WebM' : 'MP4'} video container.`,
        });
      }
      const base =
        sanitizePathId(path.basename(cleanClientName, path.extname(cleanClientName))).slice(0, 40) ||
        'bg';
      const safeFilename = `${base}-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}${ext}`;
      const targetPath = path.join(backgroundsDir, safeFilename);
      fs.writeFileSync(targetPath, buf);
      return res.status(201).json({
        url: `/backgrounds/${safeFilename}`,
        fileName: safeFilename,
        name: cleanClientName,
      });
    }
  );

  // Workspace Project CRUD
  app.get('/api/projects', (_req, res) => {
    const activeProject = store.getProject();
    res.json({
      activeProjectId: store.getActiveProjectId(),
      activeProject,
      projects: store.listProjects(),
    });
  });

  app.post('/api/projects', (req, res) => {
    const { title, aspectRatio } = req.body as {
      title?: string;
      aspectRatio?: AspectRatio;
    };
    const created = createBlankProject(
      title?.trim() || 'Untitled Studio Video',
      aspectRatio || '16:9'
    );
    const saved = store.saveProject(created, 'ui', { activate: true });
    res.status(201).json({ project: saved, projects: store.listProjects() });
  });

  app.post('/api/projects/from-template', (req, res) => {
    const { templateId, title, aspectRatio } = req.body as {
      templateId?: string;
      title?: string;
      aspectRatio?: AspectRatio;
    };
    const created = createProjectFromTemplate(
      templateId || 'feature-launch',
      title,
      aspectRatio
    );
    const saved = store.saveProject(created, 'ui', { activate: true });
    res.status(201).json({ project: saved, projects: store.listProjects() });
  });

  app.get('/api/projects/:id', (req, res) => {
    const project = store.getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    res.json({ project });
  });

  app.post('/api/projects/:id/activate', (req, res) => {
    const project = store.setActiveProjectId(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    res.json({ project, activeProjectId: project.id });
  });

  app.put('/api/projects/:id', (req, res) => {
    const body = req.body as VideoProject;
    if (!body || !Array.isArray(body.scenes)) {
      return res.status(400).json({ error: 'Valid project payload with scenes[] is required.' });
    }
    const source = req.headers['x-agent-source'] === 'external' ? 'mcp' : 'ui';
    const saved = store.saveProject({ ...body, id: req.params.id }, source);
    if (source === 'mcp') {
      store.recordExternalActivity(
        String(req.headers['user-agent'] || 'REST Client').slice(0, 40),
        'PUT /api/projects/:id',
        saved.id,
        `Updated project "${saved.title}" (${saved.scenes.length} scenes)`
      );
    }
    res.json({ project: saved });
  });

  app.delete('/api/projects/:id', (req, res) => {
    const deleted = store.deleteProject(req.params.id);
    if (!deleted) {
      return res.status(400).json({ error: 'Cannot delete the only project or project not found.' });
    }
    res.json({
      ok: true,
      activeProjectId: store.getActiveProjectId(),
      activeProject: store.getProject(),
      projects: store.listProjects(),
    });
  });

  // Studio Voiceover Synthesis (Local Edge Neural primary + optional Gemini backup)
  app.post('/api/tts', async (req, res) => {
    try {
      const {
        text,
        voiceName = 'Andrew',
        speedPct = 0,
        style,
        projectId,
        sceneId,
      } = req.body as {
        text?: string;
        voiceName?: MaleVoiceId | string;
        speedPct?: number;
        style?: string;
        projectId?: string;
        sceneId?: string;
      };

      if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Narration text is required.' });
      }

      const safeSpeed = clampVoiceSpeedPct(speedPct);
      const result = await synthesizeStudioVoice({
        text,
        voiceId: voiceName,
        speedPct: safeSpeed,
        style,
      });

      let audioDataUrl: string;
      if (projectId && sceneId) {
        audioDataUrl = store.saveSceneAudioWav(
          projectId,
          sceneId,
          `${result.voiceName}|${safeSpeed}|${text.trim()}`,
          result.wavBytes
        );
      } else {
        audioDataUrl = `data:audio/wav;base64,${Buffer.from(result.wavBytes).toString('base64')}`;
      }

      return res.json({
        audioDataUrl,
        durationSec: result.durationSec,
        voiceName: result.voiceName,
        model: result.providerUsed,
      });
    } catch (error) {
      const raw = error instanceof Error ? error.message : 'Speech synthesis failed.';
      const status = raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED') ? 429 : 500;
      return res.status(status).json({ error: raw.slice(0, 320) });
    }
  });

  // Unified Remotion 60fps MP4 Render Pipeline
  app.get('/api/render-status', (req, res) => {
    const pid = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    return res.json(renderManager.getStatus(pid));
  });

  app.post('/api/render-mp4', (req, res) => {
    const bodyProject = (req.body as { project?: VideoProject } | undefined)?.project;
    const targetProject =
      bodyProject && Array.isArray(bodyProject.scenes)
        ? store.saveProject(bodyProject, 'system', { activate: false })
        : store.getProject()!;

    const result = renderManager.startRender(targetProject);
    if (!result.started && result.error) {
      return res
        .status(result.alreadyRunning ? 409 : 400)
        .json({ ...result.status, error: result.error });
    }
    return res.status(202).json({
      started: result.started,
      alreadyRunning: result.alreadyRunning,
      ...result.status,
    });
  });

  app.get('/api/download-project', (_req, res) => {
    try {
      const zipBuffer = createProjectZipBuffer(__dirname);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="cloudmotion-studio-opencode.zip"'
      );
      res.setHeader('Content-Length', String(zipBuffer.length));
      return res.send(zipBuffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Project archive failed.';
      return res.status(500).json({ error: msg });
    }
  });

  app.use('/api', (_req, res) => {
    return res.status(404).json({ error: 'API route not found.' });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CloudMotion Studio IDE server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
