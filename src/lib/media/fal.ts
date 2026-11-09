import "server-only";

import { fal } from "@fal-ai/client";
import {
  FAL_IMAGE_MODEL,
  FAL_VIDEO_MODEL,
  imageCost,
  videoCost,
} from "./fal-models";
import { falKeyProblem, publicFalError, readFalKey } from "./fal-key";
import { isPublicMediaUrl, mediaUrls } from "./fal-service";
import {
  attachFalRequest,
  finishFalJob,
  reserveFalJob,
} from "./fal-jobs";
import { sniff } from "./sniff";
import type { GeneratedMedia } from "./provider";

function configureFal() {
  const key = readFalKey();
  const problem = falKeyProblem(key);
  if (problem) throw new Error(problem);
  fal.config({ credentials: key });
  return key;
}

export async function falGenerateStill(prompt: string, customerId?: string): Promise<GeneratedMedia> {
  configureFal();
  const text = prompt.slice(0, 1200);
  const input = {
    prompt: text,
    image_size: "square_hd" as const,
    num_images: 1,
    num_inference_steps: 4,
    output_format: "jpeg" as const,
    enable_safety_checker: true,
  };
  const jobId = customerId
    ? (await reserveFalJob({
        customerId,
        kind: "image",
        modelId: FAL_IMAGE_MODEL,
        prompt: text,
        settings: input,
        costUsd: imageCost("square_hd", 1),
      }))?.id
    : undefined;
  if (customerId && !jobId) throw new Error("Testing budget reached");
  try {
    const result = await fal.subscribe(FAL_IMAGE_MODEL, { input, logs: false });
    const urls = mediaUrls(result.data);
    if (jobId) await attachFalRequest(jobId, result.requestId);
    if (!urls[0]) throw new Error("fal still did not return an image");
    const buffer = await download(urls[0]);
    const mime = sniff(buffer) ?? "image/jpeg";
    if (!mime.startsWith("image/")) throw new Error("fal still was not an image");
    if (jobId) await finishFalJob(jobId, "completed", urls, null);
    return { buffer, mimeType: mime.split(";")[0], provider: "fal", kind: "image" };
  } catch (error) {
    const message = publicFalError(error);
    if (jobId) await finishFalJob(jobId, "failed", [], message);
    throw new Error(message);
  }
}

export async function falGenerateVideo(prompt: string, customerId?: string): Promise<GeneratedMedia> {
  configureFal();
  const text = prompt.slice(0, 1200);
  const input = {
    prompt: text,
    duration: "5" as const,
    aspect_ratio: "16:9" as const,
    enable_safety_checker: true,
  };
  const jobId = customerId
    ? (await reserveFalJob({
        customerId,
        kind: "video",
        modelId: FAL_VIDEO_MODEL,
        prompt: text,
        settings: input,
        costUsd: videoCost(5),
      }))?.id
    : undefined;
  if (customerId && !jobId) throw new Error("Testing budget reached");
  try {
    const result = await fal.subscribe(FAL_VIDEO_MODEL, { input, logs: false });
    const urls = mediaUrls(result.data);
    if (jobId) await attachFalRequest(jobId, result.requestId);
    if (!urls[0]) throw new Error("fal video did not return a file");
    const buffer = await download(urls[0]);
    if (sniff(buffer) !== "video/mp4") throw new Error("fal did not return an mp4");
    if (jobId) await finishFalJob(jobId, "completed", urls, null);
    return { buffer, mimeType: "video/mp4", provider: "fal", kind: "video" };
  } catch (error) {
    const message = publicFalError(error);
    if (jobId) await finishFalJob(jobId, "failed", [], message);
    throw new Error(message);
  }
}

async function download(url: string): Promise<Buffer> {
  if (!isPublicMediaUrl(url)) throw new Error("fal media download failed");
  const response = await fetch(url, { signal: AbortSignal.timeout(90_000) });
  if (!response.ok) throw new Error("fal media download failed");
  return Buffer.from(await response.arrayBuffer());
}
