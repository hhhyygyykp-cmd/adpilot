import "server-only";

import { fal } from "@fal-ai/client";
import { falKeyProblem, publicFalError, readFalKey } from "./fal-key";
import { prepareFalInput } from "./fal-input";
import type { FalKind } from "./fal-models";
import {
  attachFalRequest,
  falBudget,
  findFalJob,
  finishFalJob,
  listFalJobs,
  readFalJob,
  reserveFalJob,
  type FalJob,
} from "./fal-jobs";

export class FalRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function falAccount(customerId: string, kind: FalKind) {
  return { jobs: await listFalJobs(customerId, kind), budget: await falBudget(customerId) };
}

export async function startFalGeneration(customerId: string, kind: FalKind, body: unknown): Promise<FalJob> {
  let prepared;
  try {
    prepared = prepareFalInput(kind, body);
  } catch (error) {
    throw new FalRequestError(error instanceof Error ? error.message : "Invalid request", 400);
  }
  ensureKey();
  const reserved = await reserveFalJob({
    customerId,
    kind,
    modelId: prepared.modelId,
    prompt: prepared.prompt,
    settings: prepared.input,
    costUsd: prepared.costUsd,
  });
  if (!reserved) throw new FalRequestError("Testing budget reached", 402);
  try {
    const submitted = await withRetry(() =>
      fal.queue.submit(prepared.modelId, { input: prepared.input }),
    );
    const requestId = submitted.request_id;
    if (!requestId) throw new Error("fal did not return a request id");
    await attachFalRequest(reserved.id, requestId);
    if (kind === "video") {
      const job = await readFalJob(reserved.id);
      if (!job) throw new Error("Generation record disappeared");
      return job;
    }
    return await waitForJob(customerId, kind, requestId, 45_000);
  } catch (error) {
    if (error instanceof FalRequestError) throw error;
    await finishFalJob(reserved.id, "failed", [], safeFalMessage(error));
    throw new FalRequestError(safeFalMessage(error), 502);
  }
}

export async function syncFalGeneration(customerId: string, kind: FalKind, requestId: string): Promise<FalJob> {
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(requestId)) {
    throw new FalRequestError("Generation not found", 404);
  }
  const existing = await findFalJob(customerId, kind, requestId);
  if (!existing) throw new FalRequestError("Generation not found", 404);
  if (existing.status === "completed" || existing.status === "failed") return existing;
  ensureKey();
  return pullRemote(existing);
}

async function waitForJob(customerId: string, kind: FalKind, requestId: string, timeoutMs: number): Promise<FalJob> {
  const started = Date.now();
  let latest = await findFalJob(customerId, kind, requestId);
  while (latest && Date.now() - started < timeoutMs) {
    latest = await pullRemote(latest);
    if (latest.status === "completed" || latest.status === "failed") return latest;
    await delay(2_000);
  }
  if (!latest) throw new FalRequestError("Generation not found", 404);
  return latest;
}

async function pullRemote(job: FalJob): Promise<FalJob> {
  if (!job.requestId) return job;
  try {
    const status = await withRetry(() =>
      fal.queue.status(job.modelId, { requestId: job.requestId!, logs: false }),
    );
    const name = String((status as { status?: string }).status ?? "");
    if (name === "COMPLETED") {
      const result = await withRetry(() =>
        fal.queue.result(job.modelId, { requestId: job.requestId! }),
      );
      const urls = mediaUrls(result.data);
      if (!urls.length) {
        await finishFalJob(job.id, "failed", [], "fal did not return media");
      } else {
        await finishFalJob(job.id, "completed", urls, null);
      }
    } else if (name === "FAILED" || name === "CANCELLED") {
      await finishFalJob(job.id, "failed", [], `fal ${name.toLowerCase()}`);
    } else {
      await finishFalJob(job.id, name === "IN_PROGRESS" ? "in_progress" : "queued", [], null);
    }
  } catch {
    return job;
  }
  return (await readFalJob(job.id)) ?? job;
}

export function mediaUrls(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  const found: string[] = [];
  if (Array.isArray(record.images)) {
    for (const image of record.images) {
      if (image && typeof image === "object" && "url" in image && typeof image.url === "string") {
        found.push(image.url);
      }
    }
  }
  if (record.video && typeof record.video === "object" && "url" in record.video) {
    const url = (record.video as { url?: unknown }).url;
    if (typeof url === "string") found.push(url);
  }
  return found.filter(isPublicMediaUrl);
}

export function isPublicMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host === "fal.media" || host.endsWith(".fal.media") || host === "storage.googleapis.com";
  } catch {
    return false;
  }
}

function ensureKey() {
  const key = readFalKey();
  const problem = falKeyProblem(key);
  if (problem) throw new FalRequestError(problem, 503);
  fal.config({ credentials: key });
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (!retryable(error) || attempt === 2) break;
      await delay(400 * (attempt + 1));
    }
  }
  throw last;
}

function retryable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 0;
  return status === 429 || status >= 500 || /timeout|ECONN|fetch failed|network/i.test(message);
}

function safeFalMessage(error: unknown): string {
  return publicFalError(error);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
