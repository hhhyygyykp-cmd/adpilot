import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { newId } from "./crypto";
import { sql } from "./db";

const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export function extensionFor(mime: string): string | null {
  return ALLOWED.get(mime) ?? null;
}

export async function saveUpload(input: {
  customerId: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<{ storageKey: string; mimeType: string }> {
  const ext = extensionFor(input.mimeType);
  if (!ext) throw new Error("unsupported_type");
  if (input.buffer.byteLength > MAX_UPLOAD_BYTES) throw new Error("too_large");
  return writeBytes(input.customerId, input.buffer, ext, input.mimeType);
}

export async function saveGenerated(input: {
  customerId: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<{ storageKey: string; mimeType: string }> {
  const ext =
    extensionFor(input.mimeType) ??
    (input.mimeType === "video/mp4" ? "mp4" : null) ??
    (input.mimeType === "video/webm" ? "webm" : null);
  if (!ext) throw new Error("unsupported_type");
  if (input.buffer.byteLength > 80 * 1024 * 1024) throw new Error("too_large");
  return writeBytes(input.customerId, input.buffer, ext, input.mimeType);
}

function diskRoot(): string {
  return path.join(process.cwd(), "data", "uploads");
}

function asBuffer(value: unknown): Buffer | null {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value, "base64");
  return null;
}

async function writeBytes(
  customerId: string,
  buffer: Buffer,
  ext: string,
  mimeType: string,
): Promise<{ storageKey: string; mimeType: string }> {
  const key = `${customerId}/${newId()}.${ext}`;
  await sql(
    `insert into media_objects (storage_key, mime_type, byte_size, bytes)
     values ($1, $2, $3, $4)`,
    [key, mimeType, buffer.byteLength, buffer],
  );
  try {
    const full = path.join(diskRoot(), key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, buffer);
  } catch {
    // Hosted runtimes may not allow a local uploads directory. Postgres is enough.
  }
  return { storageKey: key, mimeType };
}

export async function readUpload(storageKey: string): Promise<Buffer> {
  if (
    storageKey.includes("..") ||
    storageKey.startsWith("/") ||
    storageKey.includes("\\")
  ) {
    throw new Error("invalid_key");
  }
  const rows = await sql<{ bytes: unknown }>(
    `select bytes from media_objects where storage_key = $1 limit 1`,
    [storageKey],
  );
  const fromDb = asBuffer(rows[0]?.bytes);
  if (fromDb) return fromDb;
  const full = path.join(diskRoot(), storageKey);
  const root = diskRoot() + path.sep;
  if (!full.startsWith(root)) throw new Error("invalid_key");
  return readFile(full);
}

export function sniffImageMime(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (buffer.length >= 6 && buffer.toString("ascii", 0, 6) === "GIF87a") return "image/gif";
  if (buffer.length >= 6 && buffer.toString("ascii", 0, 6) === "GIF89a") return "image/gif";
  return null;
}
