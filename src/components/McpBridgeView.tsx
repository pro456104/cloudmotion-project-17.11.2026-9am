import React, { useEffect, useState } from 'react';
import { Check, CheckCircle2, Copy, FolderArchive, Loader2, Terminal } from 'lucide-react';
import type { VideoProject } from '../video/types';

interface ExternalAgentEvent {
  id: string;
  timestamp: string;
  client: string;
  tool: string;
  projectId: string;
  summary: string;
}

interface McpBridgeViewProps {
  project: VideoProject;
  externalEvents: ExternalAgentEvent[];
  sseConnected: boolean;
  healthStatus: {
    ffmpegAvailable: boolean | null;
    edgeTtsReady: boolean;
    geminiConfigured: boolean;
  };
  onDownloadProjectZip: () => void;
}

export const McpBridgeView: React.FC<McpBridgeViewProps> = ({
  project,
  externalEvents,
  sseConnected,
  healthStatus,
  onDownloadProjectZip,
}) => {
  const [origin, setOrigin] = useState('http://localhost:3000');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testingMcp, setTestingMcp] = useState(false);
  const [mcpTestResult, setMcpTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const mcpUrl = `${origin}/mcp`;

  const opencodeLocalConfig = `{
  "$schema": "https://opencode.ai/config.json",
  "instructions": ["AGENTS.md"],
  "mcp": {
    "cloudmotion-studio": {
      "type": "local",
      "command": ["npx", "tsx", "server/mcpStdio.ts"],
      "enabled": true
    }
  }
}`;

  const opencodeRemoteConfig = `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "cloudmotion-studio": {
      "type": "remote",
      "url": "${mcpUrl}",
      "enabled": true
    }
  }
}`;

  const copySnippet = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleTestMcp = async () => {
    setTestingMcp(true);
    setMcpTestResult(null);
    try {
      const res = await fetch('/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      });
      const json = await res.json();
      const count = Array.isArray(json?.result?.tools) ? json.result.tools.length : 0;
      if (count > 0) {
        setMcpTestResult({
          ok: true,
          message: `MCP bridge active: ${count} video creation tools verified on /mcp`,
        });
      } else {
        setMcpTestResult({ ok: false, message: 'Unexpected MCP response.' });
      }
    } catch (err) {
      setMcpTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Failed to reach /mcp',
      });
    } finally {
      setTestingMcp(false);
    }
  };

  return (
    <main className="mx-auto max-w-[1220px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#F8FAFC] sm:text-3xl">
            Local PC &amp; OpenCode Setup
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">
            Run this workspace locally on your machine side-by-side with OpenCode. The root
            repository includes <code className="text-[#F8FAFC]">opencode.json</code>,{' '}
            <code className="text-[#F8FAFC]">AGENTS.md</code>, and a live stdio/HTTP MCP bridge so
            OpenCode directs videos directly into your browser stage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void handleTestMcp()}
            disabled={testingMcp}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#11151E] px-4 py-2 text-xs font-semibold text-[#F8FAFC] hover:border-[#1AE5A0]/60 whitespace-nowrap shrink-0"
          >
            {testingMcp ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1AE5A0]" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-[#1AE5A0]" />
            )}
            <span>Test MCP Server</span>
          </button>

          <button
            type="button"
            onClick={onDownloadProjectZip}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1AE5A0] px-4 py-2 text-xs font-bold text-[#07090D] hover:bg-[#14C98C] whitespace-nowrap shrink-0"
          >
            <FolderArchive className="h-3.5 w-3.5" />
            <span>Download Local PC ZIP</span>
          </button>
        </div>
      </div>

      {/* Local Readiness Strip (unboxed, clean typography) */}
      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-white/[0.07] py-3 font-mono text-xs text-[#94A3B8]">
        <div>
          SSE Live-Sync:{' '}
          <span className={sseConnected ? 'text-[#1AE5A0]' : 'text-[#94A3B8]'}>
            {sseConnected ? 'Connected' : 'Connecting'}
          </span>
        </div>
        <div>
          Local Neural TTS ({project.voiceId}):{' '}
          <span className={healthStatus.edgeTtsReady ? 'text-[#1AE5A0]' : 'text-[#FF542E]'}>
            {healthStatus.edgeTtsReady ? 'Ready (Zero-Key Local)' : 'Unavailable'}
          </span>
        </div>
        <div>
          FFmpeg:{' '}
          <span
            className={
              healthStatus.ffmpegAvailable === true
                ? 'text-[#1AE5A0]'
                : healthStatus.ffmpegAvailable === false
                  ? 'text-[#FF542E]'
                  : 'text-[#94A3B8]'
            }
          >
            {healthStatus.ffmpegAvailable === true
              ? 'Installed on PATH'
              : healthStatus.ffmpegAvailable === false
                ? 'Missing on PATH'
                : 'Checking...'}
          </span>
        </div>
      </div>

      {healthStatus.ffmpegAvailable === false && (
        <div className="mb-6 rounded-xl border border-[#FF542E]/40 bg-[#180E10] px-4 py-3 text-xs leading-relaxed text-[#FCA5A5]">
          <span className="font-semibold text-white">FFmpeg not detected on PATH:</span> Neural
          WAV conversion and unified Remotion MP4 rendering require <code className="text-white">ffmpeg</code>.
          Install it locally before synthesizing audio or rendering MP4:{' '}
          <code className="text-white">brew install ffmpeg</code> (macOS),{' '}
          <code className="text-white">winget install Gyan.FFmpeg</code> (Windows), or{' '}
          <code className="text-white">sudo apt install ffmpeg</code> (Ubuntu/Debian).
        </div>
      )}

      {mcpTestResult && (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-xs font-medium ${
            mcpTestResult.ok
              ? 'border-[#1AE5A0]/40 bg-[#0B1211] text-[#1AE5A0]'
              : 'border-[#FF542E]/40 bg-[#180E10] text-[#FCA5A5]'
          }`}
        >
          {mcpTestResult.message}
        </div>
      )}

      {/* 3-Step Local Workflow */}
      <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.08] bg-[#0B0E14] p-5">
          <div className="font-mono text-xs text-[#FF542E]">01. Extract &amp; Run Server</div>
          <h2 className="mt-1.5 font-display text-base font-bold text-[#F8FAFC]">
            Start localhost:3000
          </h2>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-white/[0.06] bg-[#07090D] p-3 font-mono text-[11px] leading-relaxed text-[#CBD5E1]">
{`npm install
npm run dev`}
          </pre>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#0B0E14] p-5">
          <div className="font-mono text-xs text-[#1AE5A0]">02. Launch OpenCode</div>
          <h2 className="mt-1.5 font-display text-base font-bold text-[#F8FAFC]">
            Open Same Folder
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-[#94A3B8]">
            Run <code className="text-[#F8FAFC]">opencode</code> inside the extracted folder beside
            this half-screen browser window. It auto-loads{' '}
            <code className="text-[#F8FAFC]">opencode.json</code> and{' '}
            <code className="text-[#F8FAFC]">AGENTS.md</code>.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#0B0E14] p-5">
          <div className="font-mono text-xs text-[#94A3B8]">03. Direct &amp; Watch Live</div>
          <h2 className="mt-1.5 font-display text-base font-bold text-[#F8FAFC]">
            {project.voiceId} Voice + Remotion MP4
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-[#94A3B8]">
            Ask OpenCode to create scenes, synthesize {project.voiceId} neural narration locally, seek
            preview, or export a 60fps MP4. Updates appear instantaneously on the stage.
          </p>
        </div>
      </section>

      {/* OpenCode Config Reference */}
      <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-[#0B0E14] p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-[#F8FAFC]">
                Pre-Bundled opencode.json (Stdio + Auto Browser Sync)
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Proxies to localhost:3000/mcp when server runs, or edits workspace directly
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copySnippet('opencode-local', opencodeLocalConfig)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#11151E] px-3 py-1.5 text-xs font-medium text-[#E2E8F0] hover:border-white/20 whitespace-nowrap shrink-0"
            >
              {copiedId === 'opencode-local' ? (
                <Check className="h-3.5 w-3.5 text-[#1AE5A0]" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copiedId === 'opencode-local' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="overflow-x-auto rounded-xl border border-white/[0.07] bg-[#07090D] p-4 font-mono text-xs leading-relaxed text-[#CBD5E1]">
            {opencodeLocalConfig}
          </pre>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#0B0E14] p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-[#F8FAFC]">
                Direct HTTP MCP Option ({mcpUrl})
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Alternative HTTP/SSE endpoint when connecting remote or external clients
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copySnippet('opencode-remote', opencodeRemoteConfig)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#11151E] px-3 py-1.5 text-xs font-medium text-[#E2E8F0] hover:border-white/20 whitespace-nowrap shrink-0"
            >
              {copiedId === 'opencode-remote' ? (
                <Check className="h-3.5 w-3.5 text-[#1AE5A0]" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copiedId === 'opencode-remote' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="overflow-x-auto rounded-xl border border-white/[0.07] bg-[#07090D] p-4 font-mono text-xs leading-relaxed text-[#CBD5E1]">
            {opencodeRemoteConfig}
          </pre>
        </div>
      </section>

      {/* Tool Inventory & Activity Log */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-[#0B0E14] p-5">
          <h2 className="font-display text-base font-bold text-[#F8FAFC]">
            Exposed OpenCode MCP Capabilities (19 Tools)
          </h2>
          <p className="mt-1 text-xs text-[#94A3B8]">
            Active project: <span className="font-mono text-[#E2E8F0]">{project.id}</span>
          </p>
          <div className="mt-4 space-y-2 text-xs text-[#CBD5E1]">
            <div>
              <span className="font-mono text-[#1AE5A0]">Projects &amp; Settings:</span>{' '}
              list_projects, get_project, create_project, create_from_template, switch_project,
              delete_project, set_aspect_ratio, update_project_settings
            </div>
            <div>
              <span className="font-mono text-[#FF542E]">Storyboard &amp; Discovery:</span>{' '}
              get_archetype_schemas, list_custom_scenes, replace_all_scenes, add_scene,
              update_scene, delete_scene, seek_preview
            </div>
            <div>
              <span className="font-mono text-[#1AE5A0]">Voice &amp; Render:</span>{' '}
              synthesize_scene_voice, synthesize_all_voices, export_mp4, get_render_status
            </div>
            <div className="pt-2 text-[#94A3B8]">
              Supports local neural voices (<code className="text-[#E2E8F0]">Andrew</code>,{' '}
              <code className="text-[#E2E8F0]">Brian</code>,{' '}
              <code className="text-[#E2E8F0]">Christopher</code>,{' '}
              <code className="text-[#E2E8F0]">Guy</code>), custom TSX scenes in{' '}
              <code className="text-[#E2E8F0]">src/video/customScenes/</code>, and disk-backed{' '}
              <code className="text-[#E2E8F0]">/backgrounds/</code> video loops.
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#0B0E14] p-5">
          <h2 className="mb-3 font-display text-base font-bold text-[#F8FAFC]">
            Live OpenCode / External Agent Activity
          </h2>
          {externalEvents.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-[#07090D] p-5 text-xs leading-relaxed text-[#94A3B8]">
              No external MCP edits recorded in this session yet. Once you run OpenCode locally
              or click Test MCP Server, incoming commands appear here and refresh the Remotion
              Stage automatically.
            </div>
          ) : (
            <div className="space-y-2.5">
              {externalEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.07] bg-[#11151E] px-3.5 py-2.5 text-xs"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1AE5A0]" />
                    <div className="min-w-0">
                      <div className="font-semibold text-[#F8FAFC]">{ev.summary}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-[#94A3B8]">
                        {ev.tool} · {ev.client}
                      </div>
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-[#64748B] tabular-nums shrink-0">
                    {new Date(ev.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
};
