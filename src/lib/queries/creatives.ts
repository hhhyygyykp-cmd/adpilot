import "server-only";

import { newId } from "../crypto";
import { parseJson, sql } from "../db";
import { selectedCopy } from "../agent/strategies";
import { loadBrandMedia, realProductRequired, type BrandMedia } from "../media/brand-assets";
import { composeStillAd } from "../media/compose-still";
import { composeVideoAd } from "../media/compose-video";
import { downloadFalFile, falGenerateStill, falGenerateVideo } from "../media/fal";
import { findCompletedFalVideos } from "../media/fal-recover";
import { publicFalError } from "../media/fal-key";
import { sniff } from "../media/sniff";
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
import { getBusiness } from "./businesses";
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

export async function importMissingFalVideo(campaign: Campaign): Promise<boolean> {
  if (campaign.creatives.some((item) => item.kind === "video")) return false;
  if (!campaignWantsVideo(campaign)) return false;
  const business = await getBusiness(campaign.customerId, campaign.businessId);
  if (!business) return false;
  const candidates = await findCompletedFalVideos(campaign.customerId, buildVideoPrompt(campaign, business));
  for (const candidate of candidates) {
    const taken = await sql<{ id: string }>(
      `select id from campaign_creatives where customer_id = $1 and note like $2 limit 1`,
      [campaign.customerId, `%${candidate.requestId}%`],
    );
    if (taken.length) continue;
    try {
      const buffer = await downloadFalFile(candidate.url);
      if (sniff(buffer) !== "video/mp4") continue;
      await storeCreative({
        campaign,
        media: { buffer, mimeType: "video/mp4", provider: "fal", kind: "video" },
        prompt: buildVideoPrompt(campaign, business),
        filename: `${campaign.productName || "ad"}.mp4`,
        note: `Paid Kling 2.5 Turbo Pro video from fal, 5s. It had already finished and is now in AdPilot. ${candidate.requestId}`,
      });
      await sql(
        `update campaigns set paid_video_count = paid_video_count + 1, updated_at = now()
         where id = $1 and customer_id = $2`,
        [campaign.id, campaign.customerId],
      );
      await finish(
        campaign,
        "ready",
        "The video fal already generated is now in AdPilot. Open this screen to play it. No new video was charged.",
      );
      return true;
    } catch {
      continue;
    }
  }
  return false;
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
    const brand = await loadBrandMedia(campaign.customerId, campaign.businessId);
    if (realProductRequired(campaign.existingPhotosNote, campaign.mustAppear, Boolean(brand.product)) && !brand.product) {
      const note = "Upload the real product photo before a paid ad. AdPilot will not invent a different-looking product.";
      await finish(campaign, "failed", note);
      return { status: "failed", note };
    }
    if (brand.product) {
      return await generateReferenceAd({ campaign, business: input.business, wantsVideo, brand });
    }
    if (input.authorizePaid) {
      return await generatePaid({ campaign, business: input.business, prompt, videoPrompt, wantsVideo, keyReady, brand });
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
    const message = publicFalError(error, "Generation failed");
    const existing = await listCreatives(campaign.customerId, campaign.id);
    const images = existing.filter((item) => item.kind === "image");
    if (images.some((item) => item.provider === "fal")) {
      const note = `A later generate call failed (${message}). The paid image already saved is still on file.`;
      await finish(campaign, "ready", note);
      return { status: "ready", note };
    }
    if (images.length > 0) {
      const note = `${message} The picture on screen is still the local preview. No paid image was saved.`;
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

async function generateReferenceAd(input: {
  campaign: Campaign;
  business: Business;
  wantsVideo: boolean;
  brand: BrandMedia;
}): Promise<{ status: GenerationStatus; note: string }> {
  const copy = selectedCopy(input.campaign, input.business);
  const photo = input.brand.product;
  if (!photo) throw new Error("The product photograph disappeared.");
  const still = await composeStillAd({
    photo,
    logo: input.brand.logo,
    businessName: input.business.name,
    ...copy,
  });
  await storeCreative({
    campaign: input.campaign,
    media: { buffer: still, mimeType: "image/jpeg", provider: "customer-photo", kind: "image" },
    prompt: "Customer product photograph with the marketing layout.",
    filename: `${input.campaign.productName || "ad"}.jpg`,
    note: "Finished ad from your product photograph. No substitute product was generated.",
  });
  const notes = ["Finished ad from your product photograph. No substitute product was generated."];
  if (input.wantsVideo && !input.campaign.creatives.some((item) => item.kind === "video")) {
    const video = await composeVideoAd({
      footage: photo,
      logo: input.brand.logo,
      businessName: input.business.name,
      ...copy,
    });
    await storeCreative({
      campaign: input.campaign,
      media: { buffer: video, mimeType: "video/mp4", provider: "customer-photo", kind: "video" },
      prompt: "Edited advertisement from the customer photograph.",
      filename: `${input.campaign.productName || "ad"}.mp4`,
      note: "Edited advertisement from your photograph: title, offer, and call to action. No fal video charge.",
    });
    notes.push("Edited video from your photograph. No fal video charge.");
  }
  const note = notes.join(" ");
  await finish(input.campaign, "ready", note);
  return { status: "ready", note };
}

async function generatePaid(input: {
  campaign: Campaign;
  business: Business;
  prompt: string;
  videoPrompt: string;
  wantsVideo: boolean;
  keyReady: boolean;
  brand: BrandMedia;
}): Promise<{ status: GenerationStatus; note: string }> {
  const { campaign, prompt, videoPrompt, wantsVideo, keyReady } = input;
  const quote = campaign.mediaQuote;
  if (!keyReady) {
    const note = `Waiting for FAL_KEY. Estimated ${formatUsd(quote.totalUsd)} (FLUX.1 schnell ${formatUsd(quote.still.usd)}${quote.video ? `, Kling ${formatUsd(quote.video.usd)}` : ""}). No paid still or video was generated.`;
    await finish(campaign, "not_started", note);
    return { status: "not_started", note };
  }

  const notes: string[] = [];
  const alreadyHasStill = (campaign.paidImageCount ?? 0) > 0;

  if (!alreadyHasStill) {
    const claimedImage = await claimPaidSlot(campaign, "image", PAID_IMAGE_LIMIT);
    if (claimedImage) {
      try {
        const still = await falGenerateStill(prompt, campaign.customerId);
        const copy = selectedCopy(campaign, input.business);
        const finished = await composeStillAd({
          photo: still.buffer,
          logo: input.brand.logo,
          businessName: input.business.name,
          ...copy,
        });
        await storeCreative({
          campaign,
          media: { buffer: finished, mimeType: "image/jpeg", provider: "fal", kind: "image" },
          prompt,
          filename: `${campaign.productName || "ad"}.jpg`,
          note: `Finished ad. Photograph: FLUX.1 schnell (${formatUsd(quote.still.usd)}). Headline, offer, and call to action added in AdPilot.`,
        });
        notes.push(`Finished still: FLUX.1 schnell photograph plus the marketing layout (${formatUsd(quote.still.usd)}).`);
      } catch (error) {
        await releasePaidSlot(campaign, "image");
        throw error;
      }
    } else if (!wantsVideo) {
      const note = `Paid still limit reached (${PAID_IMAGE_LIMIT} per campaign). No extra fal image was requested.`;
      await finish(campaign, "failed", note);
      return { status: "failed", note };
    }
  }

  if (!wantsVideo || campaign.creatives.some((item) => item.kind === "video")) {
    const note = campaign.creatives.some((item) => item.kind === "video")
      ? `${notes.join(" ")} The video is already in AdPilot. No new fal video was requested.`.trim()
      : notes.join(" ");
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
    const reason = publicFalError(error, "The video service did not return a file.");
    const note = `${notes.join(" ")} The video was not created, so the video price was not charged. ${reason}`.trim();
    await finish(campaign, notes.length > 0 || alreadyHasStill ? "ready" : "failed", note);
    return { status: notes.length > 0 || alreadyHasStill ? "ready" : "failed", note };
  }
  if (!("kind" in video) || video.kind !== "video" || video.mimeType !== "video/mp4") {
    await releasePaidSlot(campaign, "video");
    const note = `${notes.join(" ")} The video file was not a moving mp4, so it was not saved and the video price was not charged.`.trim();
    await finish(campaign, "ready", note);
    return { status: "ready", note };
  }
  let edited: Buffer;
  try {
    const copy = selectedCopy(campaign, input.business);
    edited = await composeVideoAd({
      footage: video.buffer,
      logo: input.brand.logo,
      businessName: input.business.name,
      ...copy,
    });
  } catch (error) {
    await releasePaidSlot(campaign, "video");
    const reason = publicFalError(error, "The advertisement edit failed.");
    const note = `${notes.join(" ")} fal returned a clip, but the title and call-to-action edit failed, so the unfinished clip was not saved. ${reason}`.trim();
    await finish(campaign, "ready", note);
    return { status: "ready", note };
  }
  await storeCreative({
    campaign,
    media: { buffer: edited, mimeType: "video/mp4", provider: "fal", kind: "video" },
    prompt: videoPrompt,
    filename: `${campaign.productName || "ad"}.mp4`,
    note: `Finished video ad. Motion: Kling 2.5 Turbo Pro, 5s (${quote.video ? formatUsd(quote.video.usd) : ""}). Title card, lower third, and call to action edited in AdPilot.`,
  });
  notes.push(`Finished video: Kling motion plus title, offer, and call to action (${quote.video ? formatUsd(quote.video.usd) : ""}).`);
  const note = notes.join(" ");
  await finish(campaign, "ready", note);
  return { status: "ready", note };
}

export { parseJson };
