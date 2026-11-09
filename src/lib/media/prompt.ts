import { photographBrief } from "../agent/strategies";
import type { Business, Campaign } from "../types";

export function buildImagePrompt(campaign: Campaign, business: Business): string {
  return photographBrief(campaign, business);
}

export function buildVideoPrompt(campaign: Campaign, business: Business): string {
  return `${buildImagePrompt(campaign, business)} Slow push-in, the subject stays in frame, real motion, no text and no logos.`;
}
