import "server-only";

import { FAL_STILL_MODEL, FAL_VIDEO_MODEL, FAL_VIDEO_SECONDS, falKeyConfigured } from "./quote";
import { sniff } from "./sniff";
import type { GeneratedMedia } from "./provider";

const QUEUE = "https://queue.fal.run";

function falHeaders(): HeadersInit {
  const key = process.env.FAL_KEY?.trim();
  if (!key) throw new Error("FAL_KEY is not configured");
  return {
    authorization: `Key ${key}`,
    "content-type": "application/json",
    accept: "application/json",
  };
}

function publicFalError(model: string, status: number): Error {
  return new Error(`fal ${model} failed (${status})`);
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function subscribe(model: string, input: Record<string, unknown>, timeoutMs: number): Promise<Record<string, unknown>> {
  if (!falKeyConfigured()) throw new Error("FAL_KEY is not configured");
  const submit = await fetch(`${QUEUE}/${model}`, {
    method: "POST",
    headers: falHeaders(),
    body: JSON.stringify({ input }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!submit.ok) throw publicFalError(model, submit.status);
  const job = await readJson(submit);
  const requestId = typeof job.request_id === "string" ? job.request_id : "";
  if (!requestId) throw new Error(`fal ${model} did not return a request`);
  const statusUrl =
    (typeof job.status_url === "string" && job.status_url) || `${QUEUE}/${model}/requests/${requestId}/status`;
  const resultUrl =
    (typeof job.response_url === "string" && job.response_url) || `${QUEUE}/${model}/requests/${requestId}`;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const statusRes = await fetch(statusUrl, {
      headers: falHeaders(),
      signal: AbortSignal.timeout(20_000),
    });
    if (!statusRes.ok) throw publicFalError(model, statusRes.status);
    const statusBody = await readJson(statusRes);
    const status = String(statusBody.status ?? "");
    if (status === "COMPLETED") {
      const resultRes = await fetch(resultUrl, {
        headers: falHeaders(),
        signal: AbortSignal.timeout(90_000),
      });
      if (!resultRes.ok) throw publicFalError(model, resultRes.status);
      return readJson(resultRes);
    }
    if (status === "FAILED" || status === "CANCELLED") {
      throw new Error(`fal ${model} ${status.toLowerCase()}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`fal ${model} timed out`);
}

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(90_000) });
  if (!response.ok) throw new Error("fal media download failed");
  return Buffer.from(await response.arrayBuffer());
}

export async function falGenerateStill(prompt: string): Promise<GeneratedMedia> {
  const data = await subscribe(
    FAL_STILL_MODEL,
    {
      prompt: prompt.slice(0, 1200),
      image_size: "square_hd",
      num_images: 1,
      num_inference_steps: 4,
      output_format: "jpeg",
      enable_safety_checker: true,
    },
    60_000,
  );
  const images = Array.isArray(data.images) ? data.images : [];
  const first = images[0] as { url?: string; content_type?: string } | undefined;
  if (!first?.url) throw new Error("fal still did not return an image");
  const buffer = await download(first.url);
  const mime = sniff(buffer) ?? first.content_type ?? "image/jpeg";
  if (!mime.startsWith("image/")) throw new Error("fal still was not an image");
  return { buffer, mimeType: mime.split(";")[0], provider: "fal", kind: "image" };
}

export async function falGenerateVideo(prompt: string, image: Buffer, imageMime: string): Promise<GeneratedMedia> {
  const dataUri = `data:${imageMime};base64,${image.toString("base64")}`;
  const data = await subscribe(
    FAL_VIDEO_MODEL,
    {
      prompt: prompt.slice(0, 1200),
      image_url: dataUri,
      duration: FAL_VIDEO_SECONDS,
      resolution: "768P",
      prompt_expansion_mode: "disabled",
      enable_safety_checker: true,
    },
    240_000,
  );
  const video = data.video as { url?: string; content_type?: string } | undefined;
  if (!video?.url) throw new Error("fal video did not return a file");
  const buffer = await download(video.url);
  const sniffed = sniff(buffer);
  if (sniffed !== "video/mp4" && !(video.content_type ?? "").startsWith("video/")) {
    throw new Error("fal did not return moving video");
  }
  if (sniffed !== "video/mp4") throw new Error("fal did not return an mp4");
  return { buffer, mimeType: "video/mp4", provider: "fal", kind: "video" };
}
