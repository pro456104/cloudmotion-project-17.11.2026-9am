# CloudMotion Studio

A local, programmatic **Remotion** video creation IDE with live browser preview, local zero-key American English neural voiceovers, an OpenCode MCP bridge, and unified **60fps MP4** export.

## Key Capabilities

- **Programmatic 60fps Remotion Stage** — Preview compositions live in `@remotion/player` across `16:9` (`1920x1080`), `9:16` (`1080x1920`), and `1:1` (`1080x1080`) formats with time-normalized animations, shot transitions, ambient vector/video layers, and captions.
- **11 Universal Archetypes + Custom TSX** — Mix `hero-hook`, `chapter-title`, `split-compare`, `architecture-flow`, `pipeline-steps`, `code-walkthrough`, `terminal-demo`, `metric-chart`, `matrix-grid`, `bullet-spotlight`, and `quote-verdict` (complete with `callout` banners and `connectorLabels`), or register custom scenes under `src/video/customScenes/`.
- **Zero-Key Local Neural Voiceover** — Synthesizes 24kHz WAV tracks locally via `edge-tts-universal` (`Andrew`, `Brian`, `Christopher`, `Guy`, with `-20%` to `+20%` pace control) with silence-tightening and timeline alignment; optional `GEMINI_API_KEY` acts solely as a backup TTS provider.
- **OpenCode MCP Bridge (`/mcp` & stdio)** — Exposes 19 MCP tools over HTTP JSON-RPC/SSE and stdio (`server/mcpStdio.ts`) with live SSE synchronization (`active_project_changed`, `project_updated`, `preview_seek`, `render_progress`).
- **Unified 60fps MP4 Export** — Headless Remotion rendering (`@remotion/bundler` + `@remotion/renderer`) muxed via `ffmpeg` into 192kbps AAC H.264 MP4s under `public/renders/`, plus zero-dependency ZIP workspace download (`/api/download-project`).

## Tech Stack

React 19, TypeScript, Vite, Tailwind CSS 4, Remotion 4 (`@remotion/player`, `@remotion/bundler`, `@remotion/renderer`), Express, `edge-tts-universal`, and `ffmpeg`.

## Getting Started

1. Install **FFmpeg** on your system `PATH` (required for WAV conversion and MP4 muxing):
   - macOS: `brew install ffmpeg`
   - Ubuntu / Debian: `sudo apt install ffmpeg`
   - Windows: `winget install Gyan.FFmpeg`
2. Install Node dependencies and start the IDE server:

```bash
npm install
npm run dev
```

Open `http://localhost:3000` (or launch `opencode` in the same directory to control the stage through `opencode.json` and `AGENTS.md`).

### Optional Environment Variables

Copy `.env.example` to `.env` only if you want to customize runtime options:

| Variable         | Purpose                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| `PORT`           | HTTP server port (defaults to `3000`).                                  |
| `GEMINI_API_KEY` | Optional backup TTS key when Edge TTS is offline/unavailable.           |
| `APP_URL`        | Optional public URL when hosted behind a proxy.                         |

### Scripts

| Command         | Description                                              |
| --------------- | -------------------------------------------------------- |
| `npm run dev`   | Start Express API + MCP bridge + Vite middleware on 3000 |
| `npm run build` | Build production client assets into `dist/`              |
| `npm start`     | Run the Express production server via `tsx server.ts`    |
| `npm run lint`  | Type-check client and server code (`tsc --noEmit`)       |
| `npm test`      | Run unit tests for timeline math, easing, store & ZIP    |

## Generated Runtime Assets

Runtime files in `workspace/`, `public/audio/`, `public/renders/`, and `public/backgrounds/` are created dynamically and excluded from workspace ZIP exports.
