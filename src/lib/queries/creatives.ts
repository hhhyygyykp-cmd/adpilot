import "server-only";

import { newId } from "../crypto";
import { parseJson, sql } from "../db";
import { falGenerateStill, falGenerateVideo } from "../media/fal";
import { localPreviewStill } from "../media/local-still";
import { buildImagePrompt, buildVideoPrompt } from "../media/prompt";
import type { GeneratedMedia } from "../media/provider";
import {
  PAID_IMAGE_LIMIT,
  PAID_VIDEO_LIMIT,
  campaignWantsVideo,
  falKeyConfigured,
  formatUsd,
} from "../media/quote";
import { saveGenerated } from "../storage";
import type { Business, Campaign, CampaignCreative, GenerationStatus } from "../types";

type Row = {
  id: string;
  campaign_id: string;
  kind: "image" | "video";
  provider: string;
  prompt: string;
  mime_type: string;
  byte_size: number;
  original_name: string;
  note: string;
  created_at: string;
};

function mapCreative(row: Row): CampaignCreative {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    kind: row.kind,
    provider: row.provider,
    prompt: row.prompt,
    mimeType: row.mime_type,
    byteSize: Number(row.byte_size),
    originalName: row.original_name,
    note: row.note,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function listCreatives(customerId: string, campaignId: string): Promise<CampaignCreative[]> {
  const rows = await sql<Row>(
    `select id, campaign_id, kind, provider, prompt, mime_type, byte_size, original_name, note, created_at
     from campaign_creatives
     where customer_id = $1 and campaign_id = $2
     order by created_at desc`,
    [customerId, campaignId],
  );
  return rows.map(mapCreative);
}

export async function getOwnedCreative(customerId: string, id: string, isAdmin = false) {
  const rows = await sql<Row & { storage_key: string; customer_id: string }>(
    isAdmin
      ? `select * from campaign_creatives where id = $1 limit 1`
      : `select * from campaign_creatives where id = $1 and customer_id = $2 limit 1`,
    isAdmin ? [id] : [id, customerId],
  );
  return rows[0] ?? null;
}

async function storeCreative(input: {
  campaign: Campaign;
  media: GeneratedMedia;
  prompt: string;
  note: string;
  filename: string;
}): Promise<void> {
  const stored = await saveGenerated({
    customerId: input.campaign.customerId,
    buffer: input.media.buffer,
    mimeType: input.media.mimeType,
  });
  await sql(
    `insert into campaign_creatives (
       id, customer_id, campaign_id, kind, provider, prompt, mime_type, byte_size, storage_key, original_name, note
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      newId(),
      input.campaign.customerId,
      input.campaign.id,
      input.media.kind,
      input.media.provider,
      input.prompt,
      stored.mimeType,
      input.media.buffer.byteLength,
      stored.storageKey,
      input.filename,
      input.note,
    ],
  );
}

async function finish(campaign: Campaign, status: GenerationStatus, note: string) {
  await sql(
    `update campaigns set generation_status = $3, generation_note = $4, updated_at = now()
     where id = $1 and customer_id = $2`,
    [campaign.id, campaign.customerId, status, note],
  );
}

export async function generateCampaignMedia(input: {
  campaign: Campaign;
  business: Business;
  authorizePaid: boolean;
  wantVideo: boolean;
}): Promise<{ status: GenerationStatus; note: string }> {
  const campaign = input.campaign;
  const prompt = buildImagePrompt(campaign, input.business);
  const videoPrompt = buildVideoPrompt(campaign, input.business);
  const wantsVideo = input.wantVideo || campaignWantsVideo(campaign);
  const keyReady = falKeyConfigured();

  await sql(
    `update campaigns set generation_status = 'generating', generation_note = '', updated_at = now()
     where id = $1 and customer_id = $2`,
    [campaign.id, campaign.customerId],
  );

  try {
    if (input.authorizePaid) {
      return await generatePaid({ campaign, prompt, videoPrompt, wantsVideo, keyReady });
    }
    if (keyReady) {
      const note =
        "fal.ai is configured. Review the estimate and authorize the spend before a paid still or video is generated. No paid call was made.";
      await finish(campaign, "not_started", note);
      return { status: "not_started", note };
    }
    const image: GeneratedMedia = {
      buffer: localPreviewStill(),
      mimeType: "image/png",
      provider: "local",
      kind: "image",
    };
    await storeCreative({
      campaign,
      media: image,
      prompt,
      filename: `${campaign.productName || "ad"}.png`,
      note: "Local preview still. The brief stayed on AdPilot and was not sent to an outside image service.",
    });
    const note = wantsVideo
      ? "Local preview still stored. Paid video waits for FAL_KEY and your authorization. Nothing was labeled as video."
      : "Local preview still stored. The brief was not sent to an outside image service. Paid fal stills run only after you authorize.";
    await finish(campaign, "ready", note);
    return { status: "ready", note };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed";
    const existing = await listCreatives(campaign.customerId, campaign.id);
    if (existing.some((item) => item.kind === "image")) {
      const note = `A later generate call failed (${message}). The previously stored real image is still on file.`;
      await finish(campaign, "ready", note);
      return { status: "ready", note };
    }
    await finish(campaign, "failed", message);
    return { status: "failed", note: message };
  }
}

async function claimPaidSlot(
  campaign: Campaign,
  kind: "image" | "video",
  limit: number,
): Promise<boolean> {
  const column = kind === "image" ? "paid_image_count" : "paid_video_count";
  const rows = await sql<{ id: string }>(
    `update campaigns
     set ${column} = ${column} + 1, updated_at = now()
     where id = $1 and customer_id = $2 and ${column} < $3
     returning id`,
    [campaign.id, campaign.customerId, limit],
  );
  return rows.length > 0;
}

async function releasePaidSlot(campaign: Campaign, kind: "image" | "video") {
  const column = kind === "image" ? "paid_image_count" : "paid_video_count";
  await sql(
    `update campaigns
     set ${column} = greatest(${column} - 1, 0), updated_at = now()
     where id = $1 and customer_id = $2`,
    [campaign.id, campaign.customerId],
  );
}

async function generatePaid(input: {
  campaign: Campaign;
  prompt: string;
  videoPrompt: string;
  wantsVideo: boolean;
  keyReady: boolean;
}): Promise<{ status: GenerationStatus; note: string }> {
  const { campaign, prompt, videoPrompt, wantsVideo, keyReady } = input;
  const quote = campaign.mediaQuote;
  if (!keyReady) {
    const note = `Waiting for FAL_KEY. Estimated ${formatUsd(quote.totalUsd)} (FLUX.1 schnell ${formatUsd(quote.still.usd)}${quote.video ? `, Kling ${formatUsd(quote.video.usd)}` : ""}). No paid still or video was generated.`;
    await finish(campaign, "not_started", note);
    return { status: "not_started", note };
  }

  const notes: string[] = [];
  const claimedImage = await claimPaidSlot(campaign, "image", PAID_IMAGE_LIMIT);

  if (claimedImage) {
    try {
      const still = await falGenerateStill(prompt, campaign.customerId);
      await storeCreative({
        campaign,
        media: still,
        prompt,
        filename: `${campaign.productName || "ad"}.jpg`,
        note: `Paid FLUX.1 schnell on fal (${formatUsd(quote.still.usd)}). Authorized by the customer.`,
      });
      notes.push(`Paid still: FLUX.1 schnell on fal (${formatUsd(quote.still.usd)}).`);
    } catch (error) {
      await releasePaidSlot(campaign, "image");
      throw error;
    }
  } else if (!wantsVideo) {
    const note = `Paid still limit reached (${PAID_IMAGE_LIMIT} per campaign). No extra fal image was requested.`;
    await finish(campaign, "failed", note);
    return { status: "failed", note };
  }

  if (!wantsVideo) {
    const note = notes.join(" ");
    await finish(campaign, "ready", note);
    return { status: "ready", note };
  }
  const claimedVideo = await claimPaidSlot(campaign, "video", PAID_VIDEO_LIMIT);
  if (!claimedVideo) {
    const note = `${notes.join(" ")} Paid video limit reached (${PAID_VIDEO_LIMIT} per campaign). No Kling call was made.`;
    await finish(campaign, "ready", note);
    return { status: "ready", note };
  }

  let video: GeneratedMedia;
  try {
    video = await falGenerateVideo(videoPrompt, campaign.customerId);
  } catch (error) {
    await releasePaidSlot(campaign, "video");
    throw error;
  }
  if (!("kind" in video) || video.kind !== "video" || video.mimeType !== "video/mp4") {
    await releasePaidSlot(campaign, "video");
    const note = `${notes.join(" ")} fal did not return moving mp4, so nothing was stored as video.`;
    await finish(campaign, "ready", note);
    return { status: "ready", note };
  }
  await storeCreative({
    campaign,
    media: video,
    prompt: videoPrompt,
    filename: `${campaign.productName || "ad"}.mp4`,
    note: `Paid Kling 2.5 Turbo Pro text-to-video on fal, 5s 16:9 (${quote.video ? formatUsd(quote.video.usd) : ""}). Authorized by the customer.`,
  });
  notes.push(`Paid video: Kling 2.5 Turbo Pro on fal (${quote.video ? formatUsd(quote.video.usd) : ""}).`);
  const note = notes.join(" ");
  await finish(campaign, "ready", note);
  return { status: "ready", note };
}

export { parseJson };
