import "server-only";

import { selectedCopy } from "../agent/strategies";
import { audit } from "../audit";
import { newId } from "../crypto";
import { parseJson, sql } from "../db";
import type {
  Business,
  Campaign,
  CampaignCreative,
  CampaignPublication,
  InstagramInsights,
  InstagramPublishStatus,
} from "../types";
import { fetchMediaInsights, fetchPublishedMedia, publicInstagramError } from "./meta";
import { readLiveConnection } from "./connection";

type PublicationRow = {
  id: string;
  customer_id: string;
  business_id: string;
  campaign_id: string;
  creative_id: string;
  kind: "image" | "video";
  caption: string;
  requested_at: string | null;
  customer_approved_at: string | null;
  admin_authorized_at: string | null;
  admin_authorized_by: string | null;
  publish_status: InstagramPublishStatus;
  ig_media_id: string | null;
  permalink: string | null;
  published_at: string | null;
  last_error: string;
  insights: unknown;
  insights_fetched_at: string | null;
  insights_unavailable: string | null;
  created_at: string;
  updated_at: string;
};

export type QueueItem = CampaignPublication & {
  customerId: string;
  customerEmail: string;
  customerName: string;
  businessId: string;
  businessName: string;
  productName: string | null;
  offer: string | null;
  creativeKind: "image" | "video";
  creativeMimeType: string;
};

const INSIGHT_KEYS = ["views", "impressions", "reach", "likes", "comments", "shares", "saved", "saves"] as const;

function pickInsights(raw: Record<string, number>, extras?: { likes?: number; comments?: number }): InstagramInsights | null {
  const out: InstagramInsights = {};
  if (typeof raw.views === "number") out.views = raw.views;
  if (typeof raw.impressions === "number") out.impressions = raw.impressions;
  if (typeof raw.reach === "number") out.reach = raw.reach;
  if (typeof raw.likes === "number") out.likes = raw.likes;
  else if (typeof extras?.likes === "number") out.likes = extras.likes;
  if (typeof raw.comments === "number") out.comments = raw.comments;
  else if (typeof extras?.comments === "number") out.comments = extras.comments;
  if (typeof raw.shares === "number") out.shares = raw.shares;
  if (typeof raw.saves === "number") out.saves = raw.saves;
  else if (typeof raw.saved === "number") out.saves = raw.saved;
  return Object.keys(out).length ? out : null;
}

export function mapPublication(row: PublicationRow): CampaignPublication {
  const stored = parseJson<InstagramInsights | null>(row.insights, null);
  return {
    id: row.id,
    campaignId: row.campaign_id,
    creativeId: row.creative_id,
    kind: row.kind,
    caption: row.caption,
    requestedAt: row.requested_at ? new Date(row.requested_at).toISOString() : null,
    customerApprovedAt: row.customer_approved_at
      ? new Date(row.customer_approved_at).toISOString()
      : null,
    adminAuthorized: Boolean(row.admin_authorized_at),
    status: row.publish_status,
    igMediaId: row.ig_media_id,
    permalink: row.permalink,
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    lastError: row.last_error || "",
    insights: stored && Object.keys(stored).length ? stored : null,
    insightsUnavailable: row.insights_unavailable,
    insightsFetchedAt: row.insights_fetched_at
      ? new Date(row.insights_fetched_at).toISOString()
      : null,
  };
}

export function defaultCaption(campaign: Campaign, business: Business): string {
  const copy = selectedCopy(campaign, business);
  return [copy.headline, copy.supportingCopy, copy.offer, copy.cta]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 2200);
}

function parseRequestedAt(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function listPublicationsForCustomer(
  customerId: string,
  campaignIds: string[],
): Promise<Map<string, CampaignPublication[]>> {
  const map = new Map<string, CampaignPublication[]>();
  if (campaignIds.length === 0) return map;
  const rows = await sql<PublicationRow>(
    `select * from instagram_publications
     where customer_id = $1
     order by created_at desc`,
    [customerId],
  );
  const wanted = new Set(campaignIds);
  for (const row of rows) {
    if (!wanted.has(row.campaign_id)) continue;
    const list = map.get(row.campaign_id) ?? [];
    list.push(mapPublication(row));
    map.set(row.campaign_id, list);
  }
  return map;
}

export async function getPublicationForCustomer(customerId: string, id: string) {
  const rows = await sql<PublicationRow>(
    `select * from instagram_publications where id = $1 and customer_id = $2 limit 1`,
    [id, customerId],
  );
  return rows[0] ? mapPublication(rows[0]) : null;
}

export async function approveCreative(input: {
  customerId: string;
  campaign: Campaign;
  business: Business;
  creative: CampaignCreative;
  caption?: string;
  requestedAt?: unknown;
}): Promise<CampaignPublication | { error: string; status: number }> {
  const caption = (input.caption?.trim() || defaultCaption(input.campaign, input.business)).slice(0, 2200);
  const requestedAt = parseRequestedAt(input.requestedAt);
  const existing = await sql<PublicationRow>(
    `select * from instagram_publications where creative_id = $1 limit 1`,
    [input.creative.id],
  );
  const current = existing[0];
  if (current?.ig_media_id || current?.publish_status === "published") {
    return { error: "This creative is already published to Instagram. A second post of the same file is not allowed.", status: 409 };
  }
  if (current && (current.publish_status === "authorized" || current.publish_status === "publishing")) {
    return { error: "This creative is already in the agency publishing queue.", status: 409 };
  }
  const id = current?.id ?? newId();
  if (current) {
    await sql(
      `update instagram_publications set
         caption = $2,
         requested_at = $3,
         customer_approved_at = now(),
         admin_authorized_at = null,
         admin_authorized_by = null,
         publish_status = 'pending_admin',
         last_error = '',
         updated_at = now()
       where id = $1 and customer_id = $4 and ig_media_id is null`,
      [id, caption, requestedAt, input.customerId],
    );
  } else {
    await sql(
      `insert into instagram_publications (
         id, customer_id, business_id, campaign_id, creative_id, kind, caption, requested_at,
         customer_approved_at, publish_status
       ) values ($1,$2,$3,$4,$5,$6,$7,$8, now(), 'pending_admin')`,
      [
        id,
        input.customerId,
        input.campaign.businessId,
        input.campaign.id,
        input.creative.id,
        input.creative.kind,
        caption,
        requestedAt,
      ],
    );
  }
  await audit({
    actorCustomerId: input.customerId,
    action: "instagram.customer_approve",
    entityType: "instagram_publication",
    entityId: id,
    metadata: { campaignId: input.campaign.id, creativeId: input.creative.id, kind: input.creative.kind },
  });
  const saved = await getPublicationForCustomer(input.customerId, id);
  if (!saved) return { error: "Approval did not save.", status: 500 };
  return saved;
}

export async function withdrawApproval(input: {
  customerId: string;
  publicationId: string;
}): Promise<CampaignPublication | { error: string; status: number }> {
  const rows = await sql<PublicationRow>(
    `update instagram_publications set
       publish_status = 'withdrawn',
       admin_authorized_at = null,
       admin_authorized_by = null,
       updated_at = now()
     where id = $1 and customer_id = $2
       and ig_media_id is null
       and publish_status in ('pending_admin', 'authorized', 'failed', 'declined')
     returning *`,
    [input.publicationId, input.customerId],
  );
  if (!rows[0]) {
    return { error: "This approval can no longer be withdrawn.", status: 409 };
  }
  await audit({
    actorCustomerId: input.customerId,
    action: "instagram.customer_withdraw",
    entityType: "instagram_publication",
    entityId: input.publicationId,
  });
  return mapPublication(rows[0]);
}

export async function listPublishingQueue(): Promise<QueueItem[]> {
  const rows = await sql<
    PublicationRow & {
      customer_email: string;
      customer_name: string;
      business_name: string;
      product_name: string | null;
      offer: string | null;
      mime_type: string;
    }
  >(
    `select p.*,
            cu.email as customer_email,
            cu.name as customer_name,
            b.name as business_name,
            c.product_name,
            c.offer,
            cr.mime_type
     from instagram_publications p
     join customers cu on cu.id = p.customer_id
     join businesses b on b.id = p.business_id
     join campaigns c on c.id = p.campaign_id
     join campaign_creatives cr on cr.id = p.creative_id
     order by
       case p.publish_status
         when 'pending_admin' then 0
         when 'authorized' then 1
         when 'failed' then 2
         when 'publishing' then 3
         else 4
       end,
       p.updated_at desc
     limit 200`,
  );
  return rows.map((row) => ({
    ...mapPublication(row),
    customerId: row.customer_id,
    customerEmail: row.customer_email,
    customerName: row.customer_name,
    businessId: row.business_id,
    businessName: row.business_name,
    productName: row.product_name,
    offer: row.offer,
    creativeKind: row.kind,
    creativeMimeType: row.mime_type,
  }));
}

export async function getPublicationRow(id: string): Promise<PublicationRow | null> {
  const rows = await sql<PublicationRow>(
    `select * from instagram_publications where id = $1 limit 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function authorizePublication(input: {
  adminCustomerId: string;
  publicationId: string;
  caption?: string;
}): Promise<CampaignPublication | { error: string; status: number }> {
  const caption = input.caption?.trim();
  const rows = await sql<PublicationRow>(
    `update instagram_publications set
       publish_status = 'authorized',
       admin_authorized_at = now(),
       admin_authorized_by = $2,
       caption = coalesce($3, caption),
       last_error = '',
       updated_at = now()
     where id = $1
       and customer_approved_at is not null
       and ig_media_id is null
       and publish_status in ('pending_admin', 'authorized', 'failed', 'declined')
     returning *`,
    [input.publicationId, input.adminCustomerId, caption || null],
  );
  if (!rows[0]) {
    return { error: "This advertisement is not waiting for agency authorization.", status: 409 };
  }
  await audit({
    actorCustomerId: input.adminCustomerId,
    action: "instagram.admin_authorize",
    entityType: "instagram_publication",
    entityId: input.publicationId,
  });
  return mapPublication(rows[0]);
}

export async function revokeAuthorization(input: {
  adminCustomerId: string;
  publicationId: string;
}): Promise<CampaignPublication | { error: string; status: number }> {
  const rows = await sql<PublicationRow>(
    `update instagram_publications set
       publish_status = 'pending_admin',
       admin_authorized_at = null,
       admin_authorized_by = null,
       updated_at = now()
     where id = $1 and ig_media_id is null and publish_status in ('authorized', 'failed')
     returning *`,
    [input.publicationId],
  );
  if (!rows[0]) return { error: "Authorization cannot be revoked after a live post exists.", status: 409 };
  await audit({
    actorCustomerId: input.adminCustomerId,
    action: "instagram.admin_revoke",
    entityType: "instagram_publication",
    entityId: input.publicationId,
  });
  return mapPublication(rows[0]);
}

export async function declinePublication(input: {
  adminCustomerId: string;
  publicationId: string;
}): Promise<CampaignPublication | { error: string; status: number }> {
  const rows = await sql<PublicationRow>(
    `update instagram_publications set
       publish_status = 'declined',
       admin_authorized_at = null,
       admin_authorized_by = null,
       updated_at = now()
     where id = $1 and ig_media_id is null and publish_status in ('pending_admin', 'authorized', 'failed')
     returning *`,
    [input.publicationId],
  );
  if (!rows[0]) return { error: "This queue item cannot be declined.", status: 409 };
  await audit({
    actorCustomerId: input.adminCustomerId,
    action: "instagram.admin_decline",
    entityType: "instagram_publication",
    entityId: input.publicationId,
  });
  return mapPublication(rows[0]);
}

export async function markPublishing(id: string): Promise<PublicationRow | null> {
  const rows = await sql<PublicationRow>(
    `update instagram_publications set publish_status = 'publishing', last_error = '', updated_at = now()
     where id = $1
       and publish_status in ('authorized', 'failed')
       and admin_authorized_at is not null
       and customer_approved_at is not null
       and ig_media_id is null
     returning *`,
    [id],
  );
  return rows[0] ?? null;
}

export async function markPublished(input: {
  id: string;
  igMediaId: string;
  permalink: string | null;
  publishedAt: string;
}): Promise<void> {
  await sql(
    `update instagram_publications set
       publish_status = 'published',
       ig_media_id = $2,
       permalink = $3,
       published_at = $4,
       last_error = '',
       updated_at = now()
     where id = $1 and ig_media_id is null`,
    [input.id, input.igMediaId, input.permalink, input.publishedAt],
  );
}

export async function markPublishFailed(id: string, message: string): Promise<void> {
  await sql(
    `update instagram_publications set
       publish_status = 'failed',
       last_error = $2,
       updated_at = now()
     where id = $1 and ig_media_id is null`,
    [id, message.slice(0, 2000)],
  );
}

export async function refreshPublicationInsights(
  publication: Pick<CampaignPublication, "id" | "igMediaId" | "status">,
): Promise<CampaignPublication | null> {
  if (publication.status !== "published" || !publication.igMediaId) {
    const row = await getPublicationRow(publication.id);
    return row ? mapPublication(row) : null;
  }
  const live = await readLiveConnection();
  if ("error" in live) {
    await sql(
      `update instagram_publications
       set insights_unavailable = $2, updated_at = now()
       where id = $1`,
      [publication.id, live.error],
    );
    const row = await getPublicationRow(publication.id);
    return row ? mapPublication(row) : null;
  }
  try {
    const media = await fetchPublishedMedia({ mediaId: publication.igMediaId, token: live.token });
    let raw: Record<string, number> = {};
    let unavailable: string | null = null;
    const collected: Record<string, number> = {};
    const failed: string[] = [];
    for (const metric of INSIGHT_KEYS) {
      try {
        const one = await fetchMediaInsights({
          mediaId: publication.igMediaId,
          token: live.token,
          metrics: [metric],
        });
        Object.assign(collected, one);
      } catch (error) {
        failed.push(
          `${metric}: ${publicInstagramError(error, "unavailable")}`,
        );
      }
    }
    raw = collected;
    if (!Object.keys(collected).length && failed.length) {
      unavailable = "Instagram did not return insights for this post.";
    } else if (failed.length) {
      unavailable = `Some Instagram insight metrics are unavailable.`;
    }
    const insights = pickInsights(raw, { likes: media.likeCount, comments: media.commentsCount });
    if (!insights && !unavailable) {
      unavailable = "Instagram did not return any of the requested insight metrics.";
    }
    await sql(
      `update instagram_publications set
         permalink = coalesce($2, permalink),
         insights = $3::jsonb,
         insights_fetched_at = now(),
         insights_unavailable = $4,
         updated_at = now()
       where id = $1`,
      [
        publication.id,
        media.permalink ?? null,
        insights ? JSON.stringify(insights) : null,
        unavailable,
      ],
    );
  } catch (error) {
    await sql(
      `update instagram_publications
       set insights_unavailable = $2, updated_at = now()
       where id = $1`,
      [publication.id, publicInstagramError(error, "Instagram insights could not be loaded.")],
    );
  }
  const row = await getPublicationRow(publication.id);
  return row ? mapPublication(row) : null;
}

export async function maybeRefreshInsights(publications: CampaignPublication[]): Promise<CampaignPublication[]> {
  const next: CampaignPublication[] = [];
  for (const item of publications) {
    if (item.status !== "published" || !item.igMediaId) {
      next.push(item);
      continue;
    }
    const stale =
      !item.insightsFetchedAt ||
      Date.now() - new Date(item.insightsFetchedAt).getTime() > 15 * 60 * 1000;
    if (!stale) {
      next.push(item);
      continue;
    }
    next.push((await refreshPublicationInsights(item)) ?? item);
  }
  return next;
}
