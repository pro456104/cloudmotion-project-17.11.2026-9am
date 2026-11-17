import fs from 'node:fs';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';

const EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.playwright-cli',
  'workspace',
]);

const EXCLUDED_REL_PREFIXES = [
  'public/renders',
  'public/audio',
  'public/backgrounds',
];

const UNCOMPRESSED_EXTENSIONS = new Set(['.mp4', '.wav', '.webm', '.png']);

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosTimeDate(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  const dosTime = ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | (seconds & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f);
  return { dosTime, dosDate };
}

function collectFiles(
  rootDir: string,
  currentDir: string,
  outFiles: Array<{ fullPath: string; arcName: string; mtime: Date }>
): void {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relPosix = path.relative(rootDir, fullPath).split(path.sep).join('/');

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      if (
        EXCLUDED_REL_PREFIXES.some(
          (prefix) => relPosix === prefix || relPosix.startsWith(`${prefix}/`)
        )
      ) {
        continue;
      }
      collectFiles(rootDir, fullPath, outFiles);
    } else if (entry.isFile()) {
      if (entry.name.startsWith('.env') && entry.name !== '.env.example') {
        continue;
      }
      const stat = fs.statSync(fullPath);
      outFiles.push({
        fullPath,
        arcName: `cloudmotion-studio/${relPosix}`,
        mtime: stat.mtime,
      });
    }
  }
}

export function createProjectZipBuffer(rootDir: string): Buffer {
  const files: Array<{ fullPath: string; arcName: string; mtime: Date }> = [];
  collectFiles(rootDir, rootDir, files);

  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const raw = fs.readFileSync(file.fullPath);
    const nameBuf = Buffer.from(file.arcName, 'utf8');
    const crc = crc32(raw);
    const { dosTime, dosDate } = toDosTimeDate(file.mtime);
    const ext = path.extname(file.fullPath).toLowerCase();

    let method = 0; // STORE
    let payload: Buffer = raw;

    if (!UNCOMPRESSED_EXTENSIONS.has(ext) && raw.length > 0) {
      const deflated = deflateRawSync(raw);
      if (deflated.length < raw.length) {
        method = 8; // DEFLATE
        payload = deflated;
      }
    }

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(payload.length, 18);
    localHeader.writeUInt32LE(raw.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra len

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0x0800, 8); // UTF-8 filename flag
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(payload.length, 20);
    centralHeader.writeUInt32LE(raw.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra len
    centralHeader.writeUInt16LE(0, 32); // comment len
    centralHeader.writeUInt16LE(0, 34); // disk start
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(offset, 42);

    localChunks.push(localHeader, nameBuf, payload);
    centralChunks.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + payload.length;
  }

  const centralDirBuffer = Buffer.concat(centralChunks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDirBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localChunks, centralDirBuffer, eocd]);
}
