# CloudMotion Studio — OpenCode Video Director Guide

You are controlling **CloudMotion Studio**, a local programmatic **Remotion** video creation IDE running at `http://localhost:3000`.
When the user runs `npm run dev` and opens the browser alongside OpenCode, every change you make through the `cloudmotion-studio` MCP tools live-syncs to the browser Remotion Player via Server-Sent Events (`/api/events`).

## Core Rules (Strictly Follow)
1. **Zero AI-Generated Raster Images or AI Video Clips**: Every scene is rendered 100% programmatically in React + Remotion (kinetic typography, node graphs, terminal demos, syntax-highlighted code, metric charts, matrices).
2. **Zero-Key Local English Neural Voices**: Narration runs locally via Edge Neural voices (`Andrew`, `Brian`, `Christopher`, `Guy`) with optional `voiceSpeedPct` (`-20` to `+20`) — default `Andrew` (`en-US-AndrewMultilingualNeural`, ~13–22s / 35–65 words per scene for long-form videos).
3. **Long-Form Structure**: For explainer videos (3–15+ minutes), mix pacing using `chapter-title`, `hero-hook`, `split-compare`, `architecture-flow`, `code-walkthrough`, `terminal-demo`, `pipeline-steps`, `metric-chart`, `matrix-grid`, `bullet-spotlight`, and `quote-verdict`.

## Standard Production Workflow (19 MCP Tools)
1. Call `get_archetype_schemas` first if you need exact `visualPayload` field structures or available custom TSX scenes (`list_custom_scenes`).
2. Call `create_project` (or `create_from_template` with `feature-launch`, `vertical-short`, `cli-walkthrough`, `mcp-vs-api-sample`, or `switch_project` / `get_project`) and `set_aspect_ratio` (`16:9`, `9:16`, or `1:1`).
3. Call `update_project_settings` anytime to configure `title`, `subtitle`, `showCaptions`, `sfxEnabled`, `voiceId` (`Andrew` | `Brian` | `Christopher` | `Guy`), `voiceSpeedPct`, `sceneTransition`, `bgTransition`, or bulk `applyAmbientBgToAll`.
4. Call `replace_all_scenes` (or `add_scene` / `update_scene` / `delete_scene`) to populate the storyboard.
5. Call `seek_preview` on any edited scene so the user immediately sees it inside the browser player.
6. When the user approves the script/visuals (or requests full audio/render), call `synthesize_all_voices` to generate 24kHz WAV tracks and auto-fit every scene's duration.
7. Call `export_mp4` and poll `get_render_status` to produce the unified Remotion 60fps MP4 in `public/renders/`. Use `delete_project` to remove unneeded workspaces along with their cached WAV/MP4 assets.

## Advanced Mode: Custom Remotion TSX Scenes
If a user asks for a bespoke animation or diagram not covered by the 11 built-in archetypes:
1. Create a new React Remotion component in `src/video/customScenes/<YourScene>.tsx` using `useCurrentFrame()`, `useVideoConfig()`, `spring()`, and `interpolate()`. Keep it responsive to `16:9` (`1920x1080`), `9:16` (`1080x1920`), and `1:1` (`1080x1080`).
2. Register it in `src/video/customScenes/registry.tsx` inside `CUSTOM_SCENE_REGISTRY`.
3. Reference it in a scene via MCP using `kind: "custom-tsx"` and `customSceneName: "<your-key>"`.
4. All scenes are wrapped in `SceneErrorBoundary` and automatically re-bundled before MP4 export when source files change.
