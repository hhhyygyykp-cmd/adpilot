import {
  IMAGE_SIZES,
  VIDEO_ASPECTS,
  VIDEO_DURATIONS,
  type FalKind,
  type ImageSizeName,
  imageCost,
  logoCost,
  modelFor,
  videoCost,
} from "./fal-models";

export type Rgb = { r: number; g: number; b: number };

export type PreparedFalInput = {
  kind: FalKind;
  modelId: string;
  prompt: string;
  input: Record<string, unknown>;
  costUsd: number;
};

const PROMPT_MAX = 2500;

export function prepareFalInput(kind: FalKind, body: unknown): PreparedFalInput {
  const record = asRecord(body);
  const prompt = requiredString(record.prompt, "prompt", PROMPT_MAX);
  if (kind === "video") return prepareVideo(prompt, record);
  if (kind === "logo") return prepareLogo(prompt, record);
  return prepareImage(prompt, record);
}

function prepareImage(prompt: string, record: Record<string, unknown>): PreparedFalInput {
  const imageSize = imageSizeOf(record.imageSize ?? record.image_size, "square");
  const numImages = integer(record.numImages ?? record.num_images, "numImages", 1, 4, 1);
  const steps = integer(
    record.numInferenceSteps ?? record.num_inference_steps,
    "numInferenceSteps",
    1,
    12,
    4,
  );
  const outputFormat = enumValue(
    record.outputFormat ?? record.output_format,
    "outputFormat",
    ["jpeg", "png"] as const,
    "jpeg",
  );
  rejectUnsafeChecker(record);
  const seed = optionalInteger(record.seed, "seed", 0, 2_147_483_647);
  const guidance = optionalNumber(record.guidanceScale ?? record.guidance_scale, "guidanceScale", 0, 20);
  const input: Record<string, unknown> = {
    prompt,
    image_size: imageSize,
    num_images: numImages,
    num_inference_steps: steps,
    output_format: outputFormat,
    enable_safety_checker: true,
  };
  if (seed !== undefined) input.seed = seed;
  if (guidance !== undefined) input.guidance_scale = guidance;
  return {
    kind: "image",
    modelId: modelFor("image"),
    prompt,
    input,
    costUsd: imageCost(imageSize, numImages),
  };
}

function prepareLogo(prompt: string, record: Record<string, unknown>): PreparedFalInput {
  const imageSize = imageSizeOf(record.imageSize ?? record.image_size, "square");
  rejectUnsafeChecker(record);
  const colors = optionalColors(record.colors);
  const background = optionalColor(record.backgroundColor ?? record.background_color, "backgroundColor");
  const input: Record<string, unknown> = {
    prompt,
    image_size: imageSize,
    enable_safety_checker: true,
  };
  if (colors) input.colors = colors;
  if (background) input.background_color = background;
  return {
    kind: "logo",
    modelId: modelFor("logo"),
    prompt,
    input,
    costUsd: logoCost(),
  };
}

function prepareVideo(prompt: string, record: Record<string, unknown>): PreparedFalInput {
  const duration = enumValue(record.duration, "duration", VIDEO_DURATIONS, "5");
  const aspect = enumValue(
    record.aspectRatio ?? record.aspect_ratio,
    "aspectRatio",
    VIDEO_ASPECTS,
    "16:9",
  );
  rejectUnsafeChecker(record);
  const negative = optionalString(record.negativePrompt ?? record.negative_prompt, "negativePrompt", 500);
  const cfg = optionalNumber(record.cfgScale ?? record.cfg_scale, "cfgScale", 0, 1);
  const input: Record<string, unknown> = {
    prompt,
    duration,
    aspect_ratio: aspect,
    enable_safety_checker: true,
  };
  if (negative) input.negative_prompt = negative;
  if (cfg !== undefined) input.cfg_scale = cfg;
  return {
    kind: "video",
    modelId: modelFor("video"),
    prompt,
    input,
    costUsd: videoCost(Number(duration)),
  };
}

function imageSizeOf(value: unknown, fallback: ImageSizeName): ImageSizeName | { width: number; height: number } {
  if (value === undefined) return fallback;
  if (typeof value === "string") {
    if (!(IMAGE_SIZES as readonly string[]).includes(value)) {
      throw new Error(`imageSize must be one of ${IMAGE_SIZES.join(", ")}`);
    }
    return value as ImageSizeName;
  }
  const record = asRecord(value);
  const width = integer(record.width, "imageSize.width", 256, 1024, 0);
  const height = integer(record.height, "imageSize.height", 256, 1024, 0);
  if (!width || !height) throw new Error("imageSize needs width and height");
  return { width, height };
}

function optionalColors(value: unknown): Rgb[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 5) throw new Error("colors must be a list of up to 5 RGB colors");
  return value.map((item, index) => optionalColor(item, `colors[${index}]`)!);
}

function optionalColor(value: unknown, name: string): Rgb | undefined {
  if (value === undefined) return undefined;
  const record = asRecord(value);
  return {
    r: integer(record.r, `${name}.r`, 0, 255, 0),
    g: integer(record.g, `${name}.g`, 0, 255, 0),
    b: integer(record.b, `${name}.b`, 0, 255, 0),
  };
}

function rejectUnsafeChecker(record: Record<string, unknown>) {
  const value = record.enableSafetyChecker ?? record.enable_safety_checker;
  if (value === false) throw new Error("The safety checker stays on");
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request");
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, name: string, max: number): string {
  if (typeof value !== "string") throw new Error(`${name} is required`);
  const text = value.trim();
  if (!text) throw new Error(`${name} is required`);
  if (text.length > max) throw new Error(`${name} is too long`);
  return text;
}

function optionalString(value: unknown, name: string, max: number): string | undefined {
  if (value === undefined || value === "") return undefined;
  return requiredString(value, name, max);
}

function integer(
  value: unknown,
  name: string,
  min: number,
  max: number,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return value;
}

function optionalInteger(value: unknown, name: string, min: number, max: number): number | undefined {
  if (value === undefined) return undefined;
  return integer(value, name, min, max, min);
}

function optionalNumber(value: unknown, name: string, min: number, max: number): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be a number from ${min} to ${max}`);
  }
  return value;
}

function enumValue<T extends string>(value: unknown, name: string, allowed: readonly T[], fallback: T): T {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new Error(`${name} must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}
