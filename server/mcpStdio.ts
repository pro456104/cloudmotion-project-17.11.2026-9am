import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { handleMcpRpcRequest, type McpRpcRequestBody } from './mcpBridge';
import { RenderManager } from './renderManager';
import { WorkspaceStore } from './workspaceStore';

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const liveServerUrl = `http://127.0.0.1:${process.env.PORT || 3000}/mcp`;

let fallbackStore: WorkspaceStore | null = null;
let fallbackRenderManager: RenderManager | null = null;

function getFallbackDeps() {
  if (!fallbackStore) {
    fallbackStore = new WorkspaceStore(rootDir);
  }
  if (!fallbackRenderManager) {
    fallbackRenderManager = new RenderManager(
      rootDir,
      path.join(rootDir, 'public', 'renders'),
      fallbackStore
    );
  }
  return { store: fallbackStore, renderManager: fallbackRenderManager };
}

async function processLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return;

  let rpcBody: McpRpcRequestBody;
  try {
    rpcBody = JSON.parse(trimmed) as McpRpcRequestBody;
  } catch {
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      })}\n`
    );
    return;
  }

  // Prefer live Express server so SSE updates reach the browser immediately
  try {
    const res = await fetch(liveServerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'OpenCode-Local-Stdio',
      },
      body: JSON.stringify(rpcBody),
    });
    if (res.status === 204) return;
    if (res.ok) {
      const json = await res.json();
      process.stdout.write(`${JSON.stringify(json)}\n`);
      return;
    }
  } catch {
    // Dev server offline -> fallback seamlessly to local WorkspaceStore
  }

  const { store, renderManager } = getFallbackDeps();
  const localOut = await handleMcpRpcRequest(
    rpcBody,
    'OpenCode-Stdio-Offline',
    store,
    renderManager
  );
  if (localOut.status !== 204 && localOut.payload !== null) {
    process.stdout.write(`${JSON.stringify(localOut.payload)}\n`);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

let lineQueue: Promise<void> = Promise.resolve();

rl.on('line', (line) => {
  lineQueue = lineQueue
    .then(() => processLine(line))
    .catch((err) => {
      const msg = err instanceof Error ? err.message : 'Internal stdio bridge error';
      process.stdout.write(
        `${JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32000, message: msg },
        })}\n`
      );
    });
});
