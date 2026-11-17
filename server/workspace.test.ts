import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { createBlankProject } from '../src/video/projectTemplates';
import { sanitizePathId, WorkspaceStore } from './workspaceStore';
import { createProjectZipBuffer } from './zipArchive';

function parseZipEntries(zip: Buffer): Array<{
  name: string;
  method: number;
  data: Buffer;
}> {
  const entries: Array<{ name: string; method: number; data: Buffer }> = [];
  let offset = 0;
  while (offset + 30 <= zip.length) {
    const sig = zip.readUInt32LE(offset);
    if (sig !== 0x04034b50) break;
    const method = zip.readUInt16LE(offset + 8);
    const compSize = zip.readUInt32LE(offset + 18);
    const nameLen = zip.readUInt16LE(offset + 26);
    const extraLen = zip.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = zip.toString('utf8', nameStart, nameStart + nameLen);
    const dataStart = nameStart + nameLen + extraLen;
    const compSlice = zip.subarray(dataStart, dataStart + compSize);
    const data = method === 8 ? inflateRawSync(compSlice) : Buffer.from(compSlice);
    entries.push({ name, method, data });
    offset = dataStart + compSize;
  }
  return entries;
}

test('createProjectZipBuffer packages workspace cleanly and excludes runtime artifacts', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-zip-test-'));
  try {
    fs.writeFileSync(path.join(tmpRoot, 'package.json'), '{"name":"demo"}\n');
    fs.writeFileSync(path.join(tmpRoot, '.env.example'), 'PORT=3000\n');
    fs.writeFileSync(path.join(tmpRoot, '.env'), 'SECRET=should_not_ship\n');
    fs.mkdirSync(path.join(tmpRoot, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'src', 'index.ts'), 'export const ok = true;\n');
    fs.mkdirSync(path.join(tmpRoot, 'node_modules', 'pkg'), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'node_modules', 'pkg', 'index.js'), 'ignored');
    fs.mkdirSync(path.join(tmpRoot, 'workspace', 'projects'), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'workspace', 'projects', 'p.json'), '{}');
    fs.mkdirSync(path.join(tmpRoot, 'public', 'renders'), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'public', 'renders', 'out.mp4'), 'binary');

    const zip = createProjectZipBuffer(tmpRoot);
    assert.equal(zip.readUInt32LE(0), 0x04034b50);
    // EOCD signature near end
    assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);

    const entries = parseZipEntries(zip);
    const names = entries.map((e) => e.name);
    assert.ok(names.includes('cloudmotion-studio/package.json'));
    assert.ok(names.includes('cloudmotion-studio/.env.example'));
    assert.ok(names.includes('cloudmotion-studio/src/index.ts'));
    assert.ok(!names.some((n) => n.endsWith('/.env')));
    assert.ok(!names.some((n) => n.includes('node_modules')));
    assert.ok(!names.some((n) => n.includes('workspace/')));
    assert.ok(!names.some((n) => n.includes('public/renders')));

    const pkgEntry = entries.find((e) => e.name === 'cloudmotion-studio/package.json');
    assert.equal(pkgEntry?.data.toString('utf8'), '{"name":"demo"}\n');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('WorkspaceStore normalizes fps=60, preserves active project on background saves, and prunes stale WAVs', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-store-test-'));
  try {
    const store = new WorkspaceStore(tmpRoot);
    const initialActiveId = store.getActiveProjectId();
    assert.equal(store.getProject()?.fps, 60);
    assert.equal(sanitizePathId('../../bad/name!@#'), '______bad_name___');

    // Save a secondary project WITHOUT activate: true -> activeProjectId must stay unchanged
    const secondary = createBlankProject('Secondary', '16:9', 'secondary-proj');
    secondary.fps = 30;
    const savedSecondary = store.saveProject(secondary, 'mcp');
    assert.equal(savedSecondary.fps, 60);
    assert.equal(store.getActiveProjectId(), initialActiveId);

    // Save with activate: true switches activeProjectId
    const tertiary = createBlankProject('Tertiary', '9:16', 'tertiary-proj');
    const savedTertiary = store.saveProject(tertiary, 'mcp', { activate: true });
    assert.equal(store.getActiveProjectId(), 'tertiary-proj');

    // Old scene WAVs are pruned when narration hash changes
    const firstUrl = store.saveSceneAudioWav('tertiary-proj', 'sc-keep', 'hash-a', new Uint8Array([1, 2, 3]));
    const secondUrl = store.saveSceneAudioWav('tertiary-proj', 'sc-keep', 'hash-b', new Uint8Array([4, 5, 6]));
    assert.notEqual(firstUrl, secondUrl);

    // Save an orphaned scene WAV, then save project containing only sc-keep -> orphan WAV must be pruned
    store.saveSceneAudioWav('tertiary-proj', 'removed-scene', 'hash-c', new Uint8Array([7, 8, 9]));
    const audioDir = path.join(tmpRoot, 'public', 'audio', 'tertiary-proj');
    assert.equal(fs.readdirSync(audioDir).length, 2);

    savedTertiary.scenes = [
      {
        id: 'sc-keep',
        index: 1,
        kind: 'hero-hook',
        chapterTitle: 'Keep',
        headline: 'Keep Scene',
        subheadline: 'Preserved scene',
        narration: 'Hello world',
        durationSec: 6,
        accent: 'mint',
        leftBadge: 'A',
        rightBadge: 'B',
        visualPayload: {},
      },
    ];
    store.saveProject(savedTertiary, 'ui');
    const wavFilesAfterSave = fs.readdirSync(audioDir);
    assert.equal(wavFilesAfterSave.length, 1);
    assert.equal(`/audio/tertiary-proj/${wavFilesAfterSave[0]}`, secondUrl);

    // clearProjectAudio wipes remaining audio directory
    store.clearProjectAudio('tertiary-proj');
    assert.equal(fs.existsSync(audioDir), false);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});
