import type { Campaign, MediaQuote } from "../types";
import {
  FAL_IMAGE_MODEL,
  FAL_VIDEO_MODEL,
  FLUX_USD_PER_MEGAPIXEL,
  KLING_USD_PER_SECOND,
} from "./fal-models";

export const FAL_STILL_MODEL = FAL_IMAGE_MODEL;
export const FAL_VIDEO_MODEL_ID = FAL_VIDEO_MODEL;
export const FAL_STILL_USD = Number((FLUX_USD_PER_MEGAPIXEL * 0.262144).toFixed(6));
export const FAL_VIDEO_USD_PER_SEC = KLING_USD_PER_SECOND;
export const FAL_VIDEO_SECONDS = 5;
export const PAID_IMAGE_LIMIT = 3;
export const PAID_VIDEO_LIMIT = 2;

export function falKeyConfigured(): boolean {
  return Boolean(process.env.FAL_KEY?.trim());
}

export function campaignWantsVideo(campaign: Pick<Campaign, "formatPreference" | "conceptSet">): boolean {
  if (campaign.formatPreference === "video" || campaign.formatPreference === "both") return true;
  const selected = campaign.conceptSet?.concepts.find((item) => item.id === campaign.conceptSet?.selectedId);
  return selected?.recommendedFormat === "video";
}

export function buildMediaQuote(input: {
  campaign: Pick<Campaign, "formatPreference" | "conceptSet" | "paidImageCount" | "paidVideoCount">;
  keyConfigured: boolean;
}): MediaQuote {
  const wantsVideo = campaignWantsVideo(input.campaign);
  const paidImageCount = input.campaign.paidImageCount ?? 0;
  const paidVideoCount = input.campaign.paidVideoCount ?? 0;
  const stillRemaining = Math.max(0, PAID_IMAGE_LIMIT - paidImageCount);
  const videoRemaining = Math.max(0, PAID_VIDEO_LIMIT - paidVideoCount);
  const stillUsd = FAL_STILL_USD;
  const videoUsd = wantsVideo ? FAL_VIDEO_USD_PER_SEC * FAL_VIDEO_SECONDS : 0;
  return {
    keyConfigured: input.keyConfigured,
    waitingForKey: !input.keyConfigured,
    wantsVideo,
    still: {
      provider: "fal",
      model: FAL_STILL_MODEL,
      label: "FLUX.1 schnell",
      usd: stillUsd,
      remaining: stillRemaining,
      limit: PAID_IMAGE_LIMIT,
    },
    video: wantsVideo
      ? {
          provider: "fal",
          model: FAL_VIDEO_MODEL_ID,
          label: "Kling 2.5 Turbo Pro",
          usd: videoUsd,
          seconds: FAL_VIDEO_SECONDS,
          remaining: videoRemaining,
          limit: PAID_VIDEO_LIMIT,
        }
      : null,
    totalUsd: Number((stillUsd + videoUsd).toFixed(4)),
  };
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(3)}`;
}
