import "server-only";

import { falGenerateStill, falGenerateVideo } from "./fal";
import { falKeyConfigured } from "./quote";
import { sniff } from "./sniff";

export type GeneratedMedia = {
  buffer: Buffer;
  mimeType: string;
  provider: string;
  kind: "image" | "video";
};

export type MediaProvider = {
  id: string;
  generateImage(prompt: string): Promise<GeneratedMedia>;
  generateVideo(
    prompt: string,
    image?: { buffer: Buffer; mimeType: string },
  ): Promise<GeneratedMedia | { unavailable: string }>;
};

export class PollinationsProvider implements MediaProvider {
  readonly id = "pollinations";

  async generateImage(prompt: string): Promise<GeneratedMedia> {
    const encoded = encodeURIComponent(prompt.slice(0, 1200));
    const urls = [
      `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&model=flux&referrer=adpilot`,
      `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&referrer=adpilot`,
    ];
    let lastError = "Pollinations image failed";
    for (const url of urls) {
      const response = await fetch(url, {
        headers: { "user-agent": "AdPilot/1.0 (free media)" },
        signal: AbortSignal.timeout(90_000),
      });
      if (!response.ok) {
        lastError = `Pollinations image failed (${response.status})`;
        continue;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const mime = sniff(buffer) ?? response.headers.get("content-type") ?? "";
      if (!mime.startsWith("image/")) {
        lastError = "Pollinations did not return an image";
        continue;
      }
      return { buffer, mimeType: mime.split(";")[0], provider: this.id, kind: "image" };
    }
    throw new Error(lastError);
  }

  async generateVideo(_prompt: string): Promise<GeneratedMedia | { unavailable: string }> {
    return {
      unavailable:
        "No free moving video. Paid MiniMax Hailuo on fal needs FAL_KEY and your authorization. Nothing was labeled as video.",
    };
  }
}

export class FalProvider implements MediaProvider {
  readonly id = "fal";

  async generateImage(prompt: string): Promise<GeneratedMedia> {
    return falGenerateStill(prompt);
  }

  async generateVideo(
    prompt: string,
    image?: { buffer: Buffer; mimeType: string },
  ): Promise<GeneratedMedia | { unavailable: string }> {
    if (!image) {
      return { unavailable: "Hailuo image-to-video needs a still first. No slideshow was stored as video." };
    }
    return falGenerateVideo(prompt, image.buffer, image.mimeType);
  }
}

export function getMediaProvider(): MediaProvider {
  return falKeyConfigured() ? new FalProvider() : new PollinationsProvider();
}

export { sniff };
