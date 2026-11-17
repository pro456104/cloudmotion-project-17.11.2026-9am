import { resolveAspectRatio } from './aspectRatios';
import { DEFAULT_PROJECT } from './defaultProject';
import type { AspectRatio, VideoProject } from './types';

export interface ProjectTemplateMeta {
  id: string;
  title: string;
  description: string;
  aspectRatio: AspectRatio;
  estimatedDurationLabel: string;
  sceneCount: number;
  category: 'Starter' | 'Example' | 'Short-Form' | 'Technical';
}

export function createBlankProject(
  title: string = 'Untitled Studio Video',
  aspectRatio: AspectRatio = '16:9',
  fixedId?: string
): VideoProject {
  const dims = resolveAspectRatio(aspectRatio);
  const id = fixedId || `proj-${Date.now().toString(36)}`;
  return {
    id,
    title,
    subtitle: `${dims.label} · OpenCode Remotion Workspace & Local Neural Voice`,
    aspectRatio: dims.aspectRatio,
    fps: 60,
    width: dims.width,
    height: dims.height,
    voiceId: 'Andrew',
    voiceStyle: 'Local Edge Neural US English narration',
    voiceSpeedPct: 0,
    showCaptions: true,
    sfxEnabled: true,
    bgTransition: {
      mode: 'crossfade',
      durationSec: 0.7,
      blurPx: 14,
    },
    sceneTransition: {
      mode: 'fade-blur',
      durationSec: 0.5,
    },
    animationEasing: {
      preset: 'spring',
      bezier: [0.22, 1, 0.36, 1],
      springDamping: 14,
      springStiffness: 160,
      tempoScale: 1.0,
    },
    scenes: [],
    updatedAt: new Date().toISOString(),
  };
}

function createFeatureLaunchTemplate(title?: string): VideoProject {
  const id = `proj-${Date.now().toString(36)}`;
  return {
    ...createBlankProject(title || 'SaaS Feature Launch Explainer', '16:9', id),
    subtitle: '16:9 Widescreen · Hook, Pipeline Flow & Benchmark Proof',
    scenes: [
      {
        id: `${id}-scene-1`,
        index: 1,
        kind: 'hero-hook',
        chapterTitle: '01. Product Hook',
        headline: 'SHIP RELEASES IN SECONDS',
        accentWord: 'SECONDS',
        subheadline: 'Replace flaky deploy scripts with deterministic build pipelines',
        narration:
          'Waiting twenty minutes for CI builds kills engineering momentum. Here is how deterministic edge pipelines cut deploy times down to seconds.',
        durationSec: 10,
        accent: 'coral',
        leftBadge: 'PROBLEM',
        rightBadge: 'SOLUTION',
        bulletPoints: [
          'Zero cold-start container warmups',
          'Cryptographic build artifact caching',
        ],
        visualPayload: {
          kicker: 'FEATURE LAUNCH',
          callout: 'Customize headlines & narration via OpenCode MCP',
        },
        ambientBg: { preset: 'fiber-streams', opacity: 0.22 },
      },
      {
        id: `${id}-scene-2`,
        index: 2,
        kind: 'pipeline-steps',
        chapterTitle: '02. Workflow',
        headline: 'THREE-STEP ROLLOUT',
        accentWord: 'ROLLOUT',
        subheadline: 'Every commit verifies, bundles, and ships atomically',
        narration:
          'First, changes compile against shared type contracts. Second, incremental assets sync to edge storage. Third, traffic cuts over cleanly with zero downtime.',
        durationSec: 11,
        accent: 'hybrid',
        leftBadge: 'CI',
        rightBadge: 'EDGE',
        visualPayload: {
          kicker: 'PIPELINE',
          nodes: [
            { id: 'n1', label: 'Typecheck', sublabel: 'Schema validation', badge: '01', tone: 'coral' },
            { id: 'n2', label: 'Edge Bundle', sublabel: 'Content-addressed', badge: '02', tone: 'neutral' },
            { id: 'n3', label: 'Instant Cutover', sublabel: 'Zero downtime', badge: '03', tone: 'mint' },
          ],
          callout: 'All motion primitives render cleanly at 60fps',
        },
        ambientBg: { preset: 'neural-mesh', opacity: 0.2 },
      },
      {
        id: `${id}-scene-3`,
        index: 3,
        kind: 'metric-chart',
        chapterTitle: '03. Proven Impact',
        headline: '92% FASTER DEPLOYS',
        accentWord: '92%',
        subheadline: 'Production telemetry across 4,000+ monthly builds',
        narration:
          'Teams migrating to incremental edge workers drop deploy duration by ninety-two percent and eliminate flaky rollbacks.',
        durationSec: 9,
        accent: 'mint',
        leftBadge: 'LEGACY CI',
        rightBadge: 'EDGE PIPELINE',
        visualPayload: {
          kicker: 'BENCHMARK',
          metrics: [
            { label: 'Deploy Time Saved', value: '92%', numericValue: 92, tone: 'mint', delta: '-11m 40s' },
            { label: 'Rollback Rate', value: '0.4%', numericValue: 8, tone: 'mint', delta: '-88%' },
            { label: 'Cold Starts', value: '0ms', numericValue: 4, tone: 'coral', delta: 'Eliminated' },
          ],
          callout: 'Ready to voice with US Andrew & export 1080p MP4',
        },
        ambientBg: { preset: 'circuit-pulses', opacity: 0.22 },
      },
    ],
  };
}

function createVerticalShortTemplate(title?: string): VideoProject {
  const dims = resolveAspectRatio('9:16');
  const id = `proj-${Date.now().toString(36)}`;
  return {
    ...createBlankProject(title || '9:16 Developer Short Starter', '9:16', id),
    subtitle: `${dims.label} · High-Retention Vertical Motion Graphics`,
    scenes: [
      {
        id: `${id}-scene-1`,
        index: 1,
        kind: 'hero-hook',
        chapterTitle: '01. Hook',
        headline: 'STOP SHIPPING SLOW APIS',
        accentWord: 'SLOW',
        subheadline: 'Three caching patterns that cut p99 latency under 15ms',
        narration:
          'If your database melts every time traffic spikes, you do not need bigger hardware. You need three caching patterns that keep p99 latency under fifteen milliseconds.',
        durationSec: 10,
        accent: 'coral',
        leftBadge: 'VERTICAL 9:16',
        rightBadge: '1080×1920',
        bulletPoints: [
          'Edge stale-while-revalidate responses',
          'Singleflight stampede protection',
        ],
        visualPayload: {
          kicker: 'PERFORMANCE SHORT',
          callout: 'Swipe-stopping hook + crisp US Andrew narration',
        },
        ambientBg: { preset: 'neural-mesh', opacity: 0.22 },
      },
      {
        id: `${id}-scene-2`,
        index: 2,
        kind: 'metric-chart',
        chapterTitle: '02. Benchmark',
        headline: '94% CACHE HIT RATIO',
        accentWord: '94%',
        subheadline: 'Measured across 10,000 concurrent requests per second',
        narration:
          'Adding singleflight coalescing dropped origin database queries by ninety-four percent while keeping response latency flat.',
        durationSec: 9,
        accent: 'mint',
        leftBadge: 'BEFORE: 420MS',
        rightBadge: 'AFTER: 12MS',
        visualPayload: {
          kicker: 'PRODUCTION METRICS',
          metrics: [
            { label: 'Origin DB Load', value: '6%', numericValue: 6, tone: 'mint', delta: '-94%' },
            { label: 'Cache Hit Ratio', value: '94%', numericValue: 94, tone: 'mint', delta: '+62%' },
            { label: 'p99 Latency', value: '12ms', numericValue: 18, tone: 'coral', delta: '35x faster' },
          ],
          callout: 'Switch any scene into OpenCode to customize metrics live',
        },
        ambientBg: { preset: 'circuit-pulses', opacity: 0.22 },
      },
    ],
  };
}

function createCliWalkthroughTemplate(title?: string): VideoProject {
  const id = `proj-${Date.now().toString(36)}`;
  return {
    ...createBlankProject(title || 'CLI & Architecture Walkthrough', '16:9', id),
    scenes: [
      {
        id: `${id}-scene-1`,
        index: 1,
        kind: 'terminal-demo',
        chapterTitle: '01. Live CLI Demo',
        headline: 'ZERO-CONFIG PIPELINE',
        accentWord: 'ZERO-CONFIG',
        subheadline: 'Demonstrate terminal workflows and real build output cleanly',
        narration:
          'Instead of blurry screen recordings, render razor-sharp animated terminal sequences directly inside Remotion at crisp 1080p sixty frames per second.',
        durationSec: 11,
        accent: 'mint',
        leftBadge: 'TERMINAL',
        rightBadge: '60FPS VECTOR',
        visualPayload: {
          kicker: 'PROGRAMMATIC TERMINAL',
          terminalTitle: 'zsh — ~/workspace',
          terminalLines: [
            { text: '$ npx create-cloud-stack@latest edge-api', kind: 'cmd' },
            { text: 'Resolving templates & verifying TypeScript config...', kind: 'output' },
            { text: '✔ Provisioned edge worker + Redis cache layer (1.8s)', kind: 'success' },
            { text: '$ npm run deploy -- --prod', kind: 'cmd' },
            { text: '✔ Live across 34 regions · p99 11ms', kind: 'success' },
          ],
          callout: 'No screen-capture compression artifacts',
        },
        ambientBg: { preset: 'code-depth', opacity: 0.18 },
      },
      {
        id: `${id}-scene-2`,
        index: 2,
        kind: 'code-walkthrough',
        chapterTitle: '02. Code Breakdown',
        headline: 'TYPE-SAFE HANDLERS',
        accentWord: 'TYPE-SAFE',
        subheadline: 'Highlight critical lines in sync with US Andrew explanation',
        narration:
          'As Andrew walks through the implementation, each key line illuminates in crisp monospace typography so viewers can follow every detail effortlessly.',
        durationSec: 11,
        accent: 'hybrid',
        leftBadge: 'TYPESCRIPT',
        rightBadge: 'HIGHLIGHTED',
        codeSnippet: `export async function fetchWithCoalescing(key: string) {\n  const cached = await redis.get(key);\n  if (cached) return JSON.parse(cached);\n  return singleflight(key, () => db.queryKey(key));\n}`,
        visualPayload: {
          kicker: 'CODE WALKTHROUGH',
          codeFilename: 'src/cache/coalesce.ts',
          codeLanguage: 'typescript',
          highlightLines: [2, 4],
          callout: 'Supports any language snippet & line highlights',
        },
        ambientBg: { preset: 'fiber-streams', opacity: 0.2 },
      },
    ],
  };
}

export const PROJECT_TEMPLATES: ProjectTemplateMeta[] = [
  {
    id: 'feature-launch',
    title: 'SaaS Feature Launch Explainer',
    description:
      '3-scene widescreen starter pairing a hero hook, numbered pipeline steps, and animated benchmark metrics.',
    aspectRatio: '16:9',
    estimatedDurationLabel: '0:30',
    sceneCount: 3,
    category: 'Starter',
  },
  {
    id: 'vertical-short',
    title: '9:16 Vertical Performance Short',
    description:
      'Portrait 1080×1920 starter featuring a hook scene and animated metric chart bars.',
    aspectRatio: '9:16',
    estimatedDurationLabel: '0:19',
    sceneCount: 2,
    category: 'Short-Form',
  },
  {
    id: 'cli-walkthrough',
    title: 'CLI & Code Walkthrough',
    description:
      'Programmatic terminal demo + syntax-highlighted code walkthrough ready for technical videos.',
    aspectRatio: '16:9',
    estimatedDurationLabel: '0:22',
    sceneCount: 2,
    category: 'Technical',
  },
  {
    id: 'mcp-vs-api-sample',
    title: 'MCP vs. API Architectural Deep Dive (Sample)',
    description:
      'Complete 11-scene long-form reference project showcasing custom vector diagrams, charts, and transitions.',
    aspectRatio: '16:9',
    estimatedDurationLabel: '3:27',
    sceneCount: DEFAULT_PROJECT.scenes.length,
    category: 'Example',
  },
];

export function createProjectFromTemplate(
  templateId: string,
  customTitle?: string,
  overrideAspectRatio?: AspectRatio
): VideoProject {
  let proj: VideoProject;
  if (templateId === 'mcp-vs-api-sample') {
    const id = `proj-${Date.now().toString(36)}`;
    proj = {
      ...structuredClone(DEFAULT_PROJECT),
      id,
      title: customTitle?.trim() || 'MCP vs. API (Sample Copy)',
      voiceId: 'Andrew',
      voiceSpeedPct: 0,
      updatedAt: new Date().toISOString(),
    };
  } else if (templateId === 'feature-launch') {
    proj = createFeatureLaunchTemplate(customTitle);
  } else if (templateId === 'vertical-short') {
    proj = createVerticalShortTemplate(customTitle);
  } else if (templateId === 'cli-walkthrough') {
    proj = createCliWalkthroughTemplate(customTitle);
  } else {
    proj = createBlankProject(customTitle || 'Untitled Studio Video', overrideAspectRatio || '16:9');
  }

  if (overrideAspectRatio) {
    const dims = resolveAspectRatio(overrideAspectRatio);
    proj.aspectRatio = dims.aspectRatio;
    proj.width = dims.width;
    proj.height = dims.height;
  }
  return proj;
}
