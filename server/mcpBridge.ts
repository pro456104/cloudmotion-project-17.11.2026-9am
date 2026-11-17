import crypto from 'node:crypto';
import type { Express, Request, Response } from 'express';
import { clampAmbientOpacity } from '../src/video/ambientPresets';
import { resolveAspectRatio } from '../src/video/aspectRatios';
import { listCustomScenes } from '../src/video/customScenes/registry';
import { resolveProjectAnimationEasing } from '../src/video/easingPresets';
import {
  PROJECT_TEMPLATES,
  createBlankProject,
  createProjectFromTemplate,
} from '../src/video/projectTemplates';
import { clampSceneTransitionDuration } from '../src/video/sceneTransitions';
import {
  LOCAL_NEURAL_VOICES,
  clampVoiceSpeedPct,
  normalizeLocalVoiceId,
} from '../src/video/speechPacing';
import {
  clampSceneDurationSec,
  clearSceneAudio,
  computeVoiceFittedDurationSec,
} from '../src/video/timeline';
import type {
  AmbientBackgroundConfig,
  AnimationEasingConfig,
  AspectRatio,
  BackgroundTransitionConfig,
  SceneTransitionConfig,
  VideoProject,
  VideoScene,
} from '../src/video/types';
import type { RenderManager } from './renderManager';
import { synthesizeStudioVoice } from './voiceEngine';
import type { WorkspaceStore } from './workspaceStore';

const ARCHETYPE_SCHEMAS = {
  archetypes: {
    'hero-hook': {
      purpose: 'High-impact opening title hook with accent keyword and takeaways.',
      fields: 'headline, accentWord, subheadline, leftBadge, rightBadge, bulletPoints[], visualPayload.kicker, visualPayload.callout',
    },
    'chapter-title': {
      purpose: 'Cinematic chapter divider marking transitions in long-form videos.',
      fields: 'chapterTitle, headline, accentWord, subheadline, visualPayload.kicker',
    },
    'split-compare': {
      purpose: 'Side-by-side comparison (e.g., Before vs After, Tool A vs Tool B).',
      fields: 'headline, visualPayload.columns[{ title, badge, tone: "coral"|"mint", items[] }], visualPayload.callout',
    },
    'architecture-flow': {
      purpose: 'Animated multi-node system diagram with directional packets.',
      fields: 'headline, visualPayload.nodes[{ id, label, sublabel, badge, tone: "coral"|"mint"|"neutral" }], visualPayload.connectorLabels[], visualPayload.callout',
    },
    'pipeline-steps': {
      purpose: 'Numbered horizontal or vertical sequential workflow stages.',
      fields: 'headline, visualPayload.nodes[{ id, label, sublabel, badge, tone }], visualPayload.callout',
    },
    'code-walkthrough': {
      purpose: 'Syntax-highlighted monospace code editor card with line callouts.',
      fields: 'headline, codeSnippet, visualPayload.codeFilename, visualPayload.codeLanguage, visualPayload.highlightLines[]',
    },
    'terminal-demo': {
      purpose: 'Animated CLI terminal playback showing commands and stdout/success.',
      fields: 'headline, visualPayload.terminalTitle, visualPayload.terminalLines[{ text, kind: "cmd"|"output"|"success"|"warn" }]',
    },
    'metric-chart': {
      purpose: 'Animated horizontal benchmark bars with values and deltas.',
      fields: 'headline, visualPayload.metrics[{ label, value, numericValue (0-100), delta, tone: "coral"|"mint"|"neutral" }]',
    },
    'matrix-grid': {
      purpose: '2-column decision rule matrix separated by "|".',
      fields: 'headline, leftBadge, rightBadge, bulletPoints["Left rule|Right rule"]',
    },
    'bullet-spotlight': {
      purpose: 'Structured numbered takeaway cards synced to narration.',
      fields: 'headline, subheadline, bulletPoints[], visualPayload.callout',
    },
    'quote-verdict': {
      purpose: 'Closing architectural takeaway or memorable summary statement.',
      fields: 'headline, subheadline, codeSnippet, visualPayload.callout',
    },
    'custom-tsx': {
      purpose: 'Render a bespoke React Remotion TSX component from src/video/customScenes/registry.tsx.',
      fields: 'customSceneName, customProps, headline, subheadline, narration, durationSec',
    },
  },
  aspectRatios: ['16:9 (1920x1080)', '9:16 (1080x1920)', '1:1 (1080x1080)'],
  localNeuralVoices: LOCAL_NEURAL_VOICES,
};

export const MCP_TOOLS = [
  {
    name: 'list_projects',
    description: 'List all video projects in CloudMotion Studio and return the active project ID.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_project',
    description: 'Fetch full JSON state and scenes of a project (defaults to active project).',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
      },
    },
  },
  {
    name: 'create_project',
    description: 'Create a new clean Remotion video project and set it active in the browser.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        aspectRatio: { type: 'string', enum: ['16:9', '9:16', '1:1'] },
      },
      required: ['title'],
    },
  },
  {
    name: 'create_from_template',
    description:
      'Create a project from a starter template (feature-launch, vertical-short, cli-walkthrough, mcp-vs-api-sample).',
    inputSchema: {
      type: 'object',
      properties: {
        templateId: { type: 'string' },
        title: { type: 'string' },
        aspectRatio: { type: 'string', enum: ['16:9', '9:16', '1:1'] },
      },
      required: ['templateId'],
    },
  },
  {
    name: 'switch_project',
    description: 'Activate an existing project ID so it opens live in the browser Remotion Stage.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'delete_project',
    description:
      'Delete an existing project and clean up its cached audio and rendered MP4 assets (requires at least one remaining project).',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'set_aspect_ratio',
    description: 'Switch a project canvas between 16:9, 9:16, or 1:1.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        aspectRatio: { type: 'string', enum: ['16:9', '9:16', '1:1'] },
      },
      required: ['aspectRatio'],
    },
  },
  {
    name: 'update_project_settings',
    description:
      'Update global project settings: title, subtitle, showCaptions, sfxEnabled, voiceId (Andrew|Brian|Christopher|Guy), voiceSpeedPct (-20..20), sceneTransition, bgTransition, or bulk applyAmbientBgToAll.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        title: { type: 'string' },
        subtitle: { type: 'string' },
        showCaptions: { type: 'boolean' },
        sfxEnabled: { type: 'boolean' },
        voiceId: { type: 'string', enum: ['Andrew', 'Brian', 'Christopher', 'Guy'] },
        voiceSpeedPct: { type: 'number' },
        sceneTransition: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['none', 'fade-blur', 'slide-left', 'zoom-push', 'wipe-reveal'],
            },
            durationSec: { type: 'number' },
          },
        },
        bgTransition: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['none', 'crossfade', 'motion-blur'] },
            durationSec: { type: 'number' },
            blurPx: { type: 'number' },
          },
        },
        animationEasing: {
          type: 'object',
          properties: {
            preset: {
              type: 'string',
              enum: ['spring', 'cubic-bezier', 'ease-in-out', 'ease-out'],
            },
            bezier: { type: 'array', items: { type: 'number' } },
            springDamping: { type: 'number' },
            springStiffness: { type: 'number' },
            tempoScale: { type: 'number' },
          },
        },
        applyAmbientBgToAll: {
          type: 'object',
          properties: {
            preset: { type: 'string' },
            opacity: { type: 'number' },
          },
        },
      },
    },
  },
  {
    name: 'get_archetype_schemas',
    description:
      'Return exact visualPayload field schemas for all 11 built-in Remotion archetypes, custom-tsx usage, and local neural voices.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_custom_scenes',
    description:
      'List all custom Remotion TSX scenes currently registered in src/video/customScenes/registry.tsx.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'replace_all_scenes',
    description:
      'Replace all scenes of a project. Ideal for OpenCode generating a complete multi-scene long-form English explainer video.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        title: { type: 'string' },
        subtitle: { type: 'string' },
        scenes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              kind: { type: 'string' },
              chapterTitle: { type: 'string' },
              headline: { type: 'string' },
              accentWord: { type: 'string' },
              subheadline: { type: 'string' },
              narration: { type: 'string' },
              durationSec: { type: 'number' },
              accent: { type: 'string' },
              leftBadge: { type: 'string' },
              rightBadge: { type: 'string' },
              codeSnippet: { type: 'string' },
              bulletPoints: { type: 'array', items: { type: 'string' } },
              visualPayload: { type: 'object' },
              customSceneName: { type: 'string' },
              customProps: { type: 'object' },
            },
            required: ['kind', 'chapterTitle', 'headline', 'subheadline', 'narration'],
          },
        },
      },
      required: ['scenes'],
    },
  },
  {
    name: 'add_scene',
    description: 'Add a scene to the active or specified project and live-reload the browser player.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        insertAtIndex: { type: 'number' },
        scene: { type: 'object' },
      },
      required: ['scene'],
    },
  },
  {
    name: 'update_scene',
    description: 'Patch an existing scene by sceneNumber (1-based) or sceneId.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        sceneNumber: { type: 'number' },
        sceneId: { type: 'string' },
        patch: { type: 'object' },
      },
      required: ['patch'],
    },
  },
  {
    name: 'delete_scene',
    description: 'Remove a scene by sceneNumber (1-based) or sceneId.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        sceneNumber: { type: 'number' },
        sceneId: { type: 'string' },
      },
    },
  },
  {
    name: 'seek_preview',
    description:
      'Jump the live browser Remotion Player directly to a specific scene number or sceneId and optionally start playback.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        sceneNumber: { type: 'number' },
        sceneId: { type: 'string' },
        play: { type: 'boolean' },
      },
    },
  },
  {
    name: 'synthesize_scene_voice',
    description: 'Generate local neural voiceover WAV for a specific scene and auto-fit its duration.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        sceneNumber: { type: 'number' },
        sceneId: { type: 'string' },
      },
    },
  },
  {
    name: 'synthesize_all_voices',
    description:
      'Synthesize local neural voiceover WAV tracks across all scenes (or only missing ones) and fit scene durations automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        onlyMissing: { type: 'boolean' },
      },
    },
  },
  {
    name: 'export_mp4',
    description:
      'Start unified Remotion 60fps MP4 rendering with AAC voiceover audio for the active or specified project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
      },
    },
  },
  {
    name: 'get_render_status',
    description:
      'Check current MP4 export progress, output file path, size, and readiness for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
      },
    },
  },
];

export interface McpRpcRequestBody {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

export async function handleMcpRpcRequest(
  body: McpRpcRequestBody,
  clientTag: string,
  store: WorkspaceStore,
  renderManager: RenderManager
): Promise<{ status: number; payload: Record<string, unknown> | null }> {
  const id = body?.id ?? null;
  const method = body?.method || '';
  const params = body?.params || {};

  const ok = (result: unknown) => ({
    status: 200,
    payload: { jsonrpc: '2.0', id, result },
  });
  const err = (code: number, message: string) => ({
    status: 200,
    payload: { jsonrpc: '2.0', id, error: { code, message } },
  });

  try {
    if (method === 'initialize') {
      return ok({
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'cloudmotion-studio-mcp',
          version: '2.2.0',
        },
      });
    }

    if (method === 'notifications/initialized') {
      return { status: 204, payload: null };
    }

    if (method === 'tools/list') {
      return ok({ tools: MCP_TOOLS });
    }

    if (method === 'tools/call') {
      const name = String(params.name || '');
      const args = (params.arguments || {}) as Record<string, unknown>;
      const targetId = args.projectId ? String(args.projectId) : store.getActiveProjectId();

      let textOutput = '';

      if (name === 'list_projects') {
        textOutput = JSON.stringify({
          activeProjectId: store.getActiveProjectId(),
          projects: store.listProjects(),
        });
      } else if (name === 'get_project') {
        const p = store.getProject(targetId);
        if (!p) return err(-32602, 'Project not found');
        textOutput = JSON.stringify(p);
      } else if (name === 'create_project') {
        const created = createBlankProject(
          String(args.title || 'Untitled Studio Video'),
          (args.aspectRatio as AspectRatio) || '16:9'
        );
        const saved = store.saveProject(created, 'mcp', { activate: true });
        store.recordExternalActivity(
          clientTag,
          name,
          saved.id,
          `Created project "${saved.title}" (${saved.aspectRatio})`
        );
        textOutput = JSON.stringify(saved);
      } else if (name === 'create_from_template') {
        const templateId = String(args.templateId || 'feature-launch');
        const created = createProjectFromTemplate(
          templateId,
          args.title ? String(args.title) : undefined,
          args.aspectRatio as AspectRatio | undefined
        );
        const saved = store.saveProject(created, 'mcp', { activate: true });
        store.recordExternalActivity(
          clientTag,
          name,
          saved.id,
          `Created "${saved.title}" from template "${templateId}"`
        );
        textOutput = JSON.stringify({
          ok: true,
          project: saved,
          availableTemplates: PROJECT_TEMPLATES.map((t) => t.id),
        });
      } else if (name === 'switch_project') {
        const pid = String(args.projectId || '');
        const activated = store.setActiveProjectId(pid);
        if (!activated) return err(-32602, `Project "${pid}" not found`);
        store.recordExternalActivity(
          clientTag,
          name,
          activated.id,
          `Switched active stage to "${activated.title}"`
        );
        textOutput = JSON.stringify({ ok: true, activeProjectId: activated.id, project: activated });
      } else if (name === 'delete_project') {
        const pid = String(args.projectId || '');
        if (!pid) return err(-32602, 'projectId is required');
        const deleted = store.deleteProject(pid);
        if (!deleted) {
          return err(
            -32602,
            'Cannot delete project (either not found or it is the last project in workspace).'
          );
        }
        const activeId = store.getActiveProjectId();
        store.recordExternalActivity(
          clientTag,
          name,
          activeId,
          `Deleted project "${pid}"`
        );
        textOutput = JSON.stringify({
          ok: true,
          deletedProjectId: pid,
          activeProjectId: activeId,
          projects: store.listProjects(),
        });
      } else if (name === 'set_aspect_ratio') {
        const p = store.getProject(targetId);
        if (!p) return err(-32602, 'Project not found');
        const dims = resolveAspectRatio(args.aspectRatio as AspectRatio);
        const saved = store.saveProject(
          {
            ...p,
            aspectRatio: dims.aspectRatio,
            width: dims.width,
            height: dims.height,
          },
          'mcp'
        );
        store.recordExternalActivity(
          clientTag,
          name,
          saved.id,
          `Switched canvas to ${dims.aspectRatio}`
        );
        textOutput = JSON.stringify({ ok: true, aspectRatio: dims.aspectRatio });
      } else if (name === 'update_project_settings') {
        const p = store.getProject(targetId);
        if (!p) return err(-32602, 'Project not found');

        const nextVoiceId = args.voiceId
          ? normalizeLocalVoiceId(String(args.voiceId))
          : p.voiceId;
        const nextSpeedPct =
          typeof args.voiceSpeedPct === 'number'
            ? clampVoiceSpeedPct(args.voiceSpeedPct)
            : clampVoiceSpeedPct(p.voiceSpeedPct);

        const voiceChanged =
          nextVoiceId !== p.voiceId || nextSpeedPct !== clampVoiceSpeedPct(p.voiceSpeedPct);

        let nextScenes = p.scenes;
        if (voiceChanged) {
          nextScenes = nextScenes.map(clearSceneAudio);
        }

        if (args.applyAmbientBgToAll && typeof args.applyAmbientBgToAll === 'object') {
          const bgPatch = args.applyAmbientBgToAll as Partial<AmbientBackgroundConfig>;
          nextScenes = nextScenes.map((s) => ({
            ...s,
            ambientBg: {
              preset: (bgPatch.preset || s.ambientBg?.preset || 'fiber-streams') as AmbientBackgroundConfig['preset'],
              opacity: clampAmbientOpacity(bgPatch.opacity ?? s.ambientBg?.opacity ?? 0.24),
              customVideoUrl: s.ambientBg?.customVideoUrl,
              customVideoName: s.ambientBg?.customVideoName,
            },
          }));
        }

        const nextSceneTransition: SceneTransitionConfig | undefined =
          args.sceneTransition && typeof args.sceneTransition === 'object'
            ? {
                mode:
                  ((args.sceneTransition as Partial<SceneTransitionConfig>).mode ||
                    p.sceneTransition?.mode ||
                    'fade-blur') as SceneTransitionConfig['mode'],
                durationSec: clampSceneTransitionDuration(
                  (args.sceneTransition as Partial<SceneTransitionConfig>).durationSec ??
                    p.sceneTransition?.durationSec ??
                    0.5
                ),
              }
            : p.sceneTransition;

        const nextBgTransition: BackgroundTransitionConfig | undefined =
          args.bgTransition && typeof args.bgTransition === 'object'
            ? {
                mode:
                  ((args.bgTransition as Partial<BackgroundTransitionConfig>).mode ||
                    p.bgTransition?.mode ||
                    'crossfade') as BackgroundTransitionConfig['mode'],
                durationSec: Number(
                  (args.bgTransition as Partial<BackgroundTransitionConfig>).durationSec ??
                    p.bgTransition?.durationSec ??
                    0.7
                ),
                blurPx: Number(
                  (args.bgTransition as Partial<BackgroundTransitionConfig>).blurPx ??
                    p.bgTransition?.blurPx ??
                    14
                ),
              }
            : p.bgTransition;

        const baseEasing = resolveProjectAnimationEasing(p);
        const nextAnimationEasing: AnimationEasingConfig =
          args.animationEasing && typeof args.animationEasing === 'object'
            ? resolveProjectAnimationEasing({
                animationEasing: {
                  ...baseEasing,
                  ...(args.animationEasing as Partial<AnimationEasingConfig>),
                },
              })
            : baseEasing;

        const updated: VideoProject = {
          ...p,
          title: typeof args.title === 'string' && args.title.trim() ? args.title.trim() : p.title,
          subtitle: typeof args.subtitle === 'string' ? args.subtitle : p.subtitle,
          showCaptions:
            typeof args.showCaptions === 'boolean' ? args.showCaptions : p.showCaptions,
          sfxEnabled:
            typeof args.sfxEnabled === 'boolean' ? args.sfxEnabled : p.sfxEnabled,
          voiceId: nextVoiceId,
          voiceSpeedPct: nextSpeedPct,
          sceneTransition: nextSceneTransition,
          bgTransition: nextBgTransition,
          animationEasing: nextAnimationEasing,
          scenes: nextScenes,
        };

        const saved = store.saveProject(updated, 'mcp');
        store.recordExternalActivity(
          clientTag,
          name,
          saved.id,
          `Updated settings (${saved.voiceId} ${saved.voiceSpeedPct ?? 0}%, captions=${saved.showCaptions})`
        );
        textOutput = JSON.stringify({
          ok: true,
          projectId: saved.id,
          title: saved.title,
          voiceId: saved.voiceId,
          voiceSpeedPct: saved.voiceSpeedPct,
          showCaptions: saved.showCaptions,
          sfxEnabled: saved.sfxEnabled,
          sceneTransition: saved.sceneTransition,
          bgTransition: saved.bgTransition,
          animationEasing: saved.animationEasing,
        });
      } else if (name === 'get_archetype_schemas') {
        textOutput = JSON.stringify({
          ...ARCHETYPE_SCHEMAS,
          customScenes: listCustomScenes(),
        });
      } else if (name === 'list_custom_scenes') {
        textOutput = JSON.stringify({
          customScenes: listCustomScenes(),
          usageHint:
            'Add a new React component in src/video/customScenes/, register it in src/video/customScenes/registry.tsx, then reference kind: "custom-tsx" and customSceneName.',
        });
      } else if (name === 'replace_all_scenes') {
        const p = store.getProject(targetId);
        if (!p) return err(-32602, 'Project not found');
        store.clearProjectAudio(p.id);
        const rawScenes = Array.isArray(args.scenes)
          ? (args.scenes as Array<Partial<VideoScene>>)
          : [];
        const scenes: VideoScene[] = rawScenes.map((s, i) => ({
          id:
            s.id ||
            `scene-${Date.now().toString(36)}-${i + 1}-${crypto.randomBytes(2).toString('hex')}`,
          index: i + 1,
          kind: (s.kind as VideoScene['kind']) || 'bullet-spotlight',
          chapterTitle: s.chapterTitle || `${String(i + 1).padStart(2, '0')}. Chapter`,
          headline: s.headline || 'SECTION',
          accentWord: s.accentWord,
          subheadline: s.subheadline || '',
          narration: s.narration || '',
          durationSec: clampSceneDurationSec(Number(s.durationSec) || 12, 12),
          accent: s.accent || 'hybrid',
          leftBadge: s.leftBadge || 'BEFORE',
          rightBadge: s.rightBadge || 'AFTER',
          codeSnippet: s.codeSnippet,
          bulletPoints: s.bulletPoints,
          visualPayload: s.visualPayload,
          customSceneName: s.customSceneName,
          customProps: s.customProps,
          ambientBg: s.ambientBg || { preset: 'fiber-streams', opacity: 0.22 },
        }));
        const saved = store.saveProject(
          {
            ...p,
            title: args.title ? String(args.title) : p.title,
            subtitle: args.subtitle ? String(args.subtitle) : p.subtitle,
            scenes,
          },
          'mcp'
        );
        store.recordExternalActivity(
          clientTag,
          name,
          saved.id,
          `Built storyboard with ${saved.scenes.length} scenes`
        );
        textOutput = JSON.stringify({
          ok: true,
          projectId: saved.id,
          sceneCount: saved.scenes.length,
        });
      } else if (name === 'add_scene') {
        const p = store.getProject(targetId);
        if (!p) return err(-32602, 'Project not found');
        const raw = (args.scene || {}) as Partial<VideoScene>;
        const scene: VideoScene = {
          id:
            raw.id ||
            `scene-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
          index: p.scenes.length + 1,
          kind: (raw.kind as VideoScene['kind']) || 'bullet-spotlight',
          chapterTitle:
            raw.chapterTitle || `${String(p.scenes.length + 1).padStart(2, '0')}. New Scene`,
          headline: raw.headline || 'NEW SCENE',
          accentWord: raw.accentWord,
          subheadline: raw.subheadline || '',
          narration: raw.narration || '',
          durationSec: clampSceneDurationSec(Number(raw.durationSec) || 10, 10),
          accent: raw.accent || 'hybrid',
          leftBadge: raw.leftBadge || 'A',
          rightBadge: raw.rightBadge || 'B',
          codeSnippet: raw.codeSnippet,
          bulletPoints: raw.bulletPoints,
          visualPayload: raw.visualPayload,
          customSceneName: raw.customSceneName,
          customProps: raw.customProps,
          ambientBg: raw.ambientBg || { preset: 'fiber-streams', opacity: 0.22 },
        };
        const scenes = [...p.scenes];
        const insertIdx =
          typeof args.insertAtIndex === 'number'
            ? Math.max(0, Math.min(scenes.length, Math.round(args.insertAtIndex) - 1))
            : scenes.length;
        scenes.splice(insertIdx, 0, scene);
        const saved = store.saveProject({ ...p, scenes }, 'mcp');
        store.recordExternalActivity(
          clientTag,
          name,
          saved.id,
          `Added scene "${scene.chapterTitle}"`
        );
        textOutput = JSON.stringify({ ok: true, sceneId: scene.id });
      } else if (name === 'update_scene') {
        const p = store.getProject(targetId);
        if (!p) return err(-32602, 'Project not found');
        const sceneNum =
          typeof args.sceneNumber === 'number' ? Math.round(args.sceneNumber) : null;
        const idx =
          sceneNum !== null
            ? p.scenes.findIndex((s) => s.index === sceneNum)
            : p.scenes.findIndex((s) => s.id === String(args.sceneId || ''));
        if (idx < 0) return err(-32602, 'Scene not found');
        const patch = (args.patch || {}) as Partial<VideoScene>;
        const scenes = [...p.scenes];
        const prevScene = scenes[idx];
        const narrationChanged =
          typeof patch.narration === 'string' &&
          patch.narration.trim() !== prevScene.narration.trim();
        const merged: VideoScene = {
          ...prevScene,
          ...patch,
        };
        scenes[idx] =
          narrationChanged && patch.audioDataUrl === undefined
            ? clearSceneAudio(merged)
            : merged;
        const saved = store.saveProject({ ...p, scenes }, 'mcp');
        store.recordExternalActivity(
          clientTag,
          name,
          saved.id,
          `Updated scene #${idx + 1}: ${scenes[idx].chapterTitle}`
        );
        textOutput = JSON.stringify({ ok: true, scene: saved.scenes[idx] });
      } else if (name === 'delete_scene') {
        const p = store.getProject(targetId);
        if (!p) return err(-32602, 'Project not found');
        const sceneNum =
          typeof args.sceneNumber === 'number' ? Math.round(args.sceneNumber) : null;
        const idx =
          sceneNum !== null
            ? p.scenes.findIndex((s) => s.index === sceneNum)
            : p.scenes.findIndex((s) => s.id === String(args.sceneId || ''));
        if (idx < 0) {
          return err(-32602, 'Scene not found');
        }
        const removed = p.scenes[idx];
        const scenes = p.scenes.filter((_, i) => i !== idx);
        const saved = store.saveProject({ ...p, scenes }, 'mcp');
        store.recordExternalActivity(
          clientTag,
          name,
          saved.id,
          `Deleted scene "${removed.chapterTitle}"`
        );
        textOutput = JSON.stringify({ ok: true });
      } else if (name === 'seek_preview') {
        const p = store.getProject(targetId);
        if (!p) return err(-32602, 'Project not found');
        const sceneNum =
          typeof args.sceneNumber === 'number' ? Math.round(args.sceneNumber) : undefined;
        const sceneId = args.sceneId ? String(args.sceneId) : undefined;
        store.broadcastPreviewSeek(p.id, sceneNum, sceneId, Boolean(args.play));
        store.recordExternalActivity(
          clientTag,
          name,
          p.id,
          `Focused player on ${sceneNum ? `scene #${sceneNum}` : sceneId || 'start'}`
        );
        textOutput = JSON.stringify({ ok: true, projectId: p.id, sceneNumber: sceneNum });
      } else if (name === 'synthesize_scene_voice') {
        const p = store.getProject(targetId);
        if (!p) return err(-32602, 'Project not found');
        const sceneNum =
          typeof args.sceneNumber === 'number' ? Math.round(args.sceneNumber) : null;
        const idx =
          sceneNum !== null
            ? p.scenes.findIndex((s) => s.index === sceneNum)
            : p.scenes.findIndex((s) => s.id === String(args.sceneId || ''));
        if (idx < 0) return err(-32602, 'Scene not found');
        const target = p.scenes[idx];
        const speedPct = clampVoiceSpeedPct(p.voiceSpeedPct);
        const voiceOut = await synthesizeStudioVoice({
          text: target.narration,
          voiceId: p.voiceId,
          speedPct,
          style: p.voiceStyle,
        });
        const audioUrl = store.saveSceneAudioWav(
          p.id,
          target.id,
          `${voiceOut.voiceName}|${speedPct}|${target.narration}`,
          voiceOut.wavBytes
        );
        const scenes = [...p.scenes];
        scenes[idx] = {
          ...target,
          audioDataUrl: audioUrl,
          audioDurationSec: voiceOut.durationSec,
          audioProvider: voiceOut.providerUsed,
          durationSec: computeVoiceFittedDurationSec(voiceOut.durationSec),
        };
        const saved = store.saveProject({ ...p, scenes }, 'mcp');
        store.recordExternalActivity(
          clientTag,
          name,
          saved.id,
          `Synthesized ${voiceOut.providerUsed} for scene #${idx + 1}`
        );
        textOutput = JSON.stringify({
          ok: true,
          audioUrl,
          durationSec: voiceOut.durationSec,
          provider: voiceOut.providerUsed,
        });
      } else if (name === 'synthesize_all_voices') {
        let p = store.getProject(targetId);
        if (!p) return err(-32602, 'Project not found');
        const onlyMissing = Boolean(args.onlyMissing);
        const speedPct = clampVoiceSpeedPct(p.voiceSpeedPct);
        const results: Array<{ index: number; durationSec: number; provider: string }> = [];
        for (let i = 0; i < p.scenes.length; i++) {
          const target = p.scenes[i];
          if (onlyMissing && target.audioDataUrl) continue;
          const voiceOut = await synthesizeStudioVoice({
            text: target.narration,
            voiceId: p.voiceId,
            speedPct,
            style: p.voiceStyle,
          });
          const audioUrl = store.saveSceneAudioWav(
            p.id,
            target.id,
            `${voiceOut.voiceName}|${speedPct}|${target.narration}`,
            voiceOut.wavBytes
          );
          const nextScenes = [...p.scenes];
          nextScenes[i] = {
            ...target,
            audioDataUrl: audioUrl,
            audioDurationSec: voiceOut.durationSec,
            audioProvider: voiceOut.providerUsed,
            durationSec: computeVoiceFittedDurationSec(voiceOut.durationSec),
          };
          p = store.saveProject({ ...p, scenes: nextScenes }, 'mcp');
          results.push({
            index: i + 1,
            durationSec: voiceOut.durationSec,
            provider: voiceOut.providerUsed,
          });
        }
        store.recordExternalActivity(
          clientTag,
          name,
          p.id,
          `Synthesized US ${p.voiceId} voiceover for ${results.length} scene(s)`
        );
        textOutput = JSON.stringify({
          ok: true,
          synthesizedCount: results.length,
          scenes: results,
        });
      } else if (name === 'export_mp4') {
        const p = store.getProject(targetId);
        if (!p) return err(-32602, 'Project not found');
        if (!p.scenes || p.scenes.length === 0) {
          return err(-32602, 'Cannot export MP4: project has 0 scenes.');
        }
        const started = renderManager.startRender(p);
        if (!started.started && started.error) {
          return err(-32602, started.error);
        }
        store.recordExternalActivity(
          clientTag,
          name,
          p.id,
          started.started
            ? `Started unified Remotion 60fps MP4 render (${p.aspectRatio})`
            : `Render already running (${Math.round(started.status.progress * 100)}%)`
        );
        textOutput = JSON.stringify(started);
      } else if (name === 'get_render_status') {
        textOutput = JSON.stringify(renderManager.getStatus(targetId));
      } else {
        return err(-32601, `Unknown tool: ${name}`);
      }

      return ok({
        content: [{ type: 'text', text: textOutput }],
      });
    }

    return err(-32601, `Method not found: ${method}`);
  } catch (e) {
    return err(-32000, e instanceof Error ? e.message : 'MCP execution error');
  }
}

export function mountMcpBridge(
  app: Express,
  store: WorkspaceStore,
  renderManager: RenderManager
) {
  app.get('/mcp', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write(`event: endpoint\ndata: /mcp\n\n`);
    const timer = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(timer);
      }
    }, 20000);
    req.on('close', () => clearInterval(timer));
  });

  app.post('/mcp', async (req: Request, res: Response) => {
    const body = req.body as McpRpcRequestBody;
    const clientTag = String(req.headers['user-agent'] || 'External CLI').slice(0, 40);
    const out = await handleMcpRpcRequest(body, clientTag, store, renderManager);
    if (out.status === 204 || out.payload === null) {
      return res.status(204).end();
    }
    return res.status(out.status).json(out.payload);
  });
}
