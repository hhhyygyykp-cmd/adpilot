"use client";

import type { CampaignPublication, InstagramInsights } from "@/lib/types";
import { useSession } from "./providers";

const METRICS: Array<[keyof InstagramInsights, string]> = [
  ["views", "ads.metricViews"],
  ["impressions", "ads.metricImpressions"],
  ["reach", "ads.metricReach"],
  ["likes", "ads.metricLikes"],
  ["comments", "ads.metricComments"],
  ["shares", "ads.metricShares"],
  ["saves", "ads.metricSaves"],
];

export function publicationLabelKey(status: CampaignPublication["status"]): string {
  switch (status) {
    case "pending_admin":
      return "ads.pending";
    case "authorized":
      return "ads.authorized";
    case "publishing":
      return "ads.publishing";
    case "published":
      return "ads.published";
    case "failed":
      return "ads.failed";
    case "withdrawn":
      return "ads.withdrawn";
    case "declined":
      return "ads.declined";
    default:
      return "ads.noPost";
  }
}

export function PublicationPanel({
  publication,
  showWithdraw,
  onWithdraw,
}: {
  publication: CampaignPublication;
  showWithdraw?: boolean;
  onWithdraw?: () => Promise<void>;
}) {
  const { t } = useSession();
  const insights = publication.insights;
  const metricRows = insights
    ? METRICS.filter(([key]) => typeof insights[key] === "number")
    : [];

  return (
    <section className="mt-4 rounded-2xl border border-[var(--line)] p-4 text-sm">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--gold)]">
        {t(publicationLabelKey(publication.status))}
      </p>
      {publication.caption ? (
        <p className="mt-2 whitespace-pre-wrap text-[var(--muted)]">{publication.caption}</p>
      ) : null}
      {publication.requestedAt ? (
        <p className="mt-2 text-xs text-[var(--muted)]">
          {t("ads.requestedDate")}: {new Date(publication.requestedAt).toLocaleString()}
        </p>
      ) : null}
      {publication.status === "published" && publication.permalink ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--gold)]">{t("ads.instagramPost")}</p>
          {publication.publishedAt ? (
            <p>
              {t("ads.publishedAt")}: {new Date(publication.publishedAt).toLocaleString()}
            </p>
          ) : null}
          <a
            href={publication.permalink}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--gold)]"
          >
            {t("ads.postLink")}
          </a>
          <blockquote
            className="instagram-media"
            data-instgrm-permalink={publication.permalink}
            data-instgrm-version="14"
            style={{ maxWidth: "100%", width: "100%" }}
          >
            <a href={publication.permalink}>{publication.permalink}</a>
          </blockquote>
        </div>
      ) : publication.status === "published" ? (
        <p className="mt-3 text-[var(--muted)]">{t("admin.noLivePost")}</p>
      ) : null}
      {publication.status === "published" ? (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--gold)]">{t("ads.insightsTitle")}</p>
          {metricRows.length ? (
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {metricRows.map(([key, label]) => (
                <div key={key}>
                  <dt className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">{t(label)}</dt>
                  <dd className="serif text-2xl">{insights?.[key]}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-2 text-[var(--muted)]">{t("ads.noInsights")}</p>
          )}
          {publication.insightsUnavailable ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              {t("ads.insightsUnavailable")}: {publication.insightsUnavailable}
            </p>
          ) : null}
        </div>
      ) : null}
      {publication.lastError && publication.status === "failed" ? (
        <p className="mt-3 text-[var(--danger)]">{publication.lastError}</p>
      ) : null}
      {showWithdraw &&
      ["pending_admin", "authorized", "failed", "declined"].includes(publication.status) &&
      !publication.igMediaId ? (
        <button
          type="button"
          onClick={() => onWithdraw?.()}
          className="mt-4 text-xs uppercase tracking-[0.14em] text-[var(--muted)]"
        >
          {t("ads.withdraw")}
        </button>
      ) : null}
    </section>
  );
}
