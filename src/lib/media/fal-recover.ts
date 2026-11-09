import "server-only";

import { fal } from "@fal-ai/client";
import { FAL_VIDEO_MODEL } from "./fal-models";
import { falKeyProblem, readFalKey } from "./fal-key";
import { mediaUrls } from "./fal-service";
import { listFalJobs } from "./fal-jobs";

export type RecoveredVideo = {
  requestId: string;
  url: string;
};

export async function findCompletedFalVideos(customerId: string, promptHint: string): Promise<RecoveredVideo[]> {
  const key = readFalKey();
  if (falKeyProblem(key)) return [];
  fal.config({ credentials: key });
  const found = new Map<string, RecoveredVideo>();
  for (const video of await fromStoredJobs(customerId)) found.set(video.requestId, video);
  for (const video of await fromAccountHistory(key, promptHint)) {
    if (!found.has(video.requestId)) found.set(video.requestId, video);
  }
  return [...found.values()];
}

async function fromStoredJobs(customerId: string): Promise<RecoveredVideo[]> {
  const jobs = await listFalJobs(customerId, "video");
  const found: RecoveredVideo[] = [];
  for (const job of jobs) {
    if (!job.requestId) continue;
    const saved = job.mediaUrls.find((url) => url.startsWith("https://"));
    if (saved) {
      found.push({ requestId: job.requestId, url: saved });
      continue;
    }
    const fresh = await resultUrl(job.requestId);
    if (fresh) found.push({ requestId: job.requestId, url: fresh });
  }
  return found;
}

async function fromAccountHistory(key: string, promptHint: string): Promise<RecoveredVideo[]> {
  const endpoint = new URL("https://api.fal.ai/v1/models/requests/by-endpoint");
  endpoint.searchParams.set("endpoint_id", FAL_VIDEO_MODEL);
  endpoint.searchParams.set("status", "success");
  endpoint.searchParams.set("limit", "10");
  endpoint.searchParams.append("expand", "payloads");
  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { Authorization: `Key ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return [];
  }
  if (!response.ok) return [];
  const body = (await response.json()) as { items?: ListedRequest[] };
  const items = (body.items ?? [])
    .map((item) => ({
      requestId: item.request_id ?? "",
      url: mediaUrls(item.json_output)[0] ?? "",
      prompt: typeof item.json_input?.prompt === "string" ? item.json_input.prompt : "",
      ended: item.ended_at ?? "",
    }))
    .filter((item) => item.requestId)
    .sort((a, b) => (a.ended < b.ended ? 1 : -1));
  const hint = promptHint.slice(0, 80);
  const matched = items.filter((item) => item.prompt && hint && (item.prompt.includes(hint) || hint.includes(item.prompt.slice(0, 80))));
  const ordered = matched.length ? matched : items;
  const found: RecoveredVideo[] = [];
  for (const item of ordered) {
    const url = item.url || (await resultUrl(item.requestId));
    if (url) found.push({ requestId: item.requestId, url });
  }
  return found;
}

async function resultUrl(requestId: string): Promise<string> {
  try {
    const result = await fal.queue.result(FAL_VIDEO_MODEL, { requestId });
    return mediaUrls(result.data)[0] ?? "";
  } catch {
    return "";
  }
}

type ListedRequest = {
  request_id?: string;
  ended_at?: string | null;
  json_input?: { prompt?: string };
  json_output?: unknown;
};
