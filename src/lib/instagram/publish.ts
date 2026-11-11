import "server-only";

import { audit } from "../audit";
import { originIsPublicHttps, publicOriginFromRequest } from "./config";
import { readLiveConnection } from "./connection";
import {
  createImageContainer,
  createReelContainer,
  fetchPublishedMedia,
  publicInstagramError,
  publishContainer,
  waitForContainer,
} from "./meta";
import { createMediaGrant } from "./media-grant";
import {
  getPublicationRow,
  markPublishFailed,
  markPublished,
    markPublishing,
    mapPublication,
} from "./publications";
import type { CampaignPublication } from "../types";

export async function publishAuthorizedAd(input: {
  request: Request;
  adminCustomerId: string;
  publicationId: string;
}): Promise<CampaignPublication | { error: string; status: number }> {
  const live = await readLiveConnection();
  if ("error" in live) return live;

  const claimed = await markPublishing(input.publicationId);
  if (!claimed) {
    return {
      error:
        "This advertisement is not authorized to publish, is already live, or is still missing customer approval.",
      status: 409,
    };
  }

  const origin = publicOriginFromRequest(input.request);
  if (!originIsPublicHttps(origin)) {
    const message = `Instagram can only fetch the creative from a public HTTPS URL. This server origin is ${origin}. Set META_PUBLIC_ORIGIN to a reachable https origin, or connect from a hosted URL. Nothing was posted.`;
    await markPublishFailed(claimed.id, message);
    return { error: message, status: 409 };
  }

  try {
    const grant = await createMediaGrant({
      request: input.request,
      creativeId: claimed.creative_id,
      publicationId: claimed.id,
    });
    const containerId =
      claimed.kind === "video"
        ? await createReelContainer({
            igUserId: live.igUserId,
            token: live.token,
            videoUrl: grant.url,
            caption: claimed.caption,
          })
        : await createImageContainer({
            igUserId: live.igUserId,
            token: live.token,
            imageUrl: grant.url,
            caption: claimed.caption,
          });
    await waitForContainer({ containerId, token: live.token });
    const mediaId = await publishContainer({
      igUserId: live.igUserId,
      token: live.token,
      creationId: containerId,
    });
    const media = await fetchPublishedMedia({ mediaId, token: live.token }).catch(() => ({
      id: mediaId,
      permalink: undefined,
      timestamp: undefined,
    }));
    const publishedAt = media.timestamp
      ? new Date(media.timestamp).toISOString()
      : new Date().toISOString();
    await markPublished({
      id: claimed.id,
      igMediaId: media.id || mediaId,
      permalink: media.permalink ?? null,
      publishedAt,
    });
    await audit({
      actorCustomerId: input.adminCustomerId,
      action: "instagram.publish",
      entityType: "instagram_publication",
      entityId: claimed.id,
      metadata: {
        igMediaId: media.id || mediaId,
        permalink: media.permalink ?? null,
        kind: claimed.kind,
      },
    });
    const row = await getPublicationRow(claimed.id);
    if (!row?.ig_media_id) {
      return { error: "Instagram returned a media id but it was not stored.", status: 500 };
    }
    return mapPublication(row);
  } catch (error) {
    const message = publicInstagramError(error, "Instagram publishing failed. Nothing was stored as posted.");
    await markPublishFailed(claimed.id, message);
    await audit({
      actorCustomerId: input.adminCustomerId,
      action: "instagram.publish_failed",
      entityType: "instagram_publication",
      entityId: claimed.id,
      metadata: { error: message },
    });
    return { error: message, status: 502 };
  }
}
