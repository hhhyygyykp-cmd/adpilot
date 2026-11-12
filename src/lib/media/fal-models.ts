export type FalKind = "image" | "logo" | "video";

export const FAL_IMAGE_MODEL = process.env.FAL_IMAGE_MODEL?.trim() || "fal-ai/flux/schnell";
export const FAL_LOGO_MODEL = process.env.FAL_LOGO_MODEL?.trim() || "recraft/v4.1/flash/text-to-image";
export const FAL_VIDEO_MODEL =
  process.env.FAL_VIDEO_MODEL?.trim() || "fal-ai/kling-video/v2.5-turbo/pro/text-to-video";

export const IMAGE_SIZES = [
  "square_hd",
  "square",
  "portrait_4_3",
  "portrait_16_9",
  "landscape_4_3",
  "landscape_16_9",
] as const;

export type ImageSizeName = (typeof IMAGE_SIZES)[number];

const MEGAPIXELS: Record<ImageSizeName, number> = {
  square_hd: (1024 * 1024) / 1_000_000,
  square: (512 * 512) / 1_000_000,
  portrait_4_3: (768 * 1024) / 1_000_000,
  portrait_16_9: (576 * 1024) / 1_000_000,
  landscape_4_3: (1024 * 768) / 1_000_000,
  landscape_16_9: (1024 * 576) / 1_000_000,
};

export const FLUX_USD_PER_MEGAPIXEL = 0.003;
export const RECRAFT_FLASH_USD = 0.007;
export const KLING_USD_PER_SECOND = 0.07;

export const VIDEO_DURATIONS = ["5", "10"] as const;
export const VIDEO_ASPECTS = ["16:9", "9:16", "1:1"] as const;

export const FAL_RATE_LIMITS: Record<FalKind, { limit: number; windowMs: number }> = {
  image: { limit: 12, windowMs: 60 * 60 * 1000 },
  logo: { limit: 8, windowMs: 60 * 60 * 1000 },
  video: { limit: 2, windowMs: 60 * 60 * 1000 },
};

export function modelFor(kind: FalKind): string {
  if (kind === "logo") return FAL_LOGO_MODEL;
  if (kind === "video") return FAL_VIDEO_MODEL;
  return FAL_IMAGE_MODEL;
}

export function testingBudgetUsd(): number {
  const raw = process.env.FAL_TEST_BUDGET_USD?.trim();
  if (!raw) return 1;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return 1;
  return Math.min(value, 100);
}

export function globalTestingBudgetUsd(): number {
  const raw = process.env.FAL_GLOBAL_BUDGET_USD?.trim();
  if (!raw) return testingBudgetUsd();
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return testingBudgetUsd();
  return Math.min(value, 500);
}

export function imageCost(size: ImageSizeName | { width: number; height: number }, count: number): number {
  const megapixels =
    typeof size === "string" ? MEGAPIXELS[size] : (size.width * size.height) / 1_000_000;
  return roundMoney(megapixels * FLUX_USD_PER_MEGAPIXEL * count);
}

export function logoCost(): number {
  return RECRAFT_FLASH_USD;
}

export function videoCost(seconds: number): number {
  return roundMoney(KLING_USD_PER_SECOND * seconds);
}

export function roundMoney(value: number): number {
  return Number(value.toFixed(6));
}
