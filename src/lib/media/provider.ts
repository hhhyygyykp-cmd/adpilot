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

export class FalProvider implements MediaProvider {
  readonly id = "fal";

  async generateImage(prompt: string): Promise<GeneratedMedia> {
    return falGenerateStill(prompt);
  }

  async generateVideo(
    prompt: string,
    image?: { buffer: Buffer; mimeType: string },
  ): Promise<GeneratedMedia | { unavailable: string }> {
    void image;
    return falGenerateVideo(prompt);
  }
}

export function getMediaProvider(): MediaProvider | null {
  return falKeyConfigured() ? new FalProvider() : null;
}

export { sniff };
