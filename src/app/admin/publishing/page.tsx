"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { useSession } from "@/components/providers";
import { api } from "@/lib/api-client";
import { publicationLabelKey } from "@/components/publication-panel";
import type { InstagramPublishStatus } from "@/lib/types";

type Row = {
  id: string;
  campaignId: string;
  creativeId: string;
  kind: "image" | "video";
  caption: string;
  requestedAt: string | null;
  customerApprovedAt: string | null;
  adminAuthorized: boolean;
  status: InstagramPublishStatus;
  igMediaId: string | null;
  permalink: string | null;
  publishedAt: string | null;
  lastError: string;
  customerEmail: string;
  customerName: string;
  businessName: string;
  productName: string | null;
  offer: string | null;
};

export default function AdminPublishingPage() {
  const { t } = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [destination, setDestination] = useState<{ username: string | null; igUserId: string | null }>({
    username: null,
    igUserId: null,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [captions, setCaptions] = useState<Record<string, string>>({});

  async function load() {
    const data = await api<{
      publications: Row[];
      destination?: { username: string | null; igUserId: string | null };
    }>("/api/admin/instagram/publications");
    setRows(data.publications);
    setDestination({
      username: data.destination?.username ?? null,
      igUserId: data.destination?.igUserId ?? null,
    });
    setCaptions(
      Object.fromEntries(data.publications.map((item) => [item.id, item.caption])),
    );
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  async function act(id: string, action: string) {
    setBusy(`${id}:${action}`);
    setError("");
    try {
      await api(`/api/admin/instagram/publications/${id}`, {
        method: "POST",
        body: JSON.stringify({ action, caption: captions[id] }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy("");
    }
  }

  return (
    <Shell admin>
      <h1 className="serif text-4xl">{t("admin.publishing")}</h1>
      <p className="mt-4 max-w-3xl text-sm text-[var(--muted)]">{t("admin.publishHint")}</p>
      {error ? <p className="mt-4 text-sm text-[var(--danger)]">{error}</p> : null}
      {rows.length === 0 ? (
        <p className="panel mt-8 rounded-3xl p-6 text-[var(--muted)]">{t("admin.queueEmpty")}</p>
      ) : (
        <ul className="mt-8 grid gap-4">
          {rows.map((row) => (
            <li key={row.id} className="panel rounded-3xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-medium">
                    {row.productName || row.businessName} · {row.kind}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {row.businessName} · {row.customerName} · {row.customerEmail}
                    {row.offer ? ` · ${row.offer}` : ""}
                  </p>
                </div>
                <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs uppercase tracking-[0.14em] text-[var(--gold)]">
                  {t(publicationLabelKey(row.status))}
                </span>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                    {t("admin.customerApproval")}
                  </dt>
                  <dd>{row.customerApprovedAt ? t("admin.yes") : t("admin.no")}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                    {t("admin.adminAuthorization")}
                  </dt>
                  <dd>{row.adminAuthorized ? t("admin.yes") : t("admin.no")}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                    {t("admin.requested")}
                  </dt>
                  <dd>{row.requestedAt ? new Date(row.requestedAt).toLocaleString() : "—"}</dd>
                </div>
              </dl>
              <p className="mt-4 text-sm">
                {t("admin.destination")}:{" "}
                <span className="font-medium">
                  {destination.username ? `@${destination.username.replace(/^@/, "")}` : "—"}
                </span>
                {destination.igUserId ? (
                  <span className="text-[var(--muted)]"> · {destination.igUserId}</span>
                ) : null}
              </p>
              <p className="mt-4 text-xs uppercase tracking-[0.14em] text-[var(--gold)]">{t("admin.preview")}</p>
              {row.kind === "video" ? (
                <video src={`/api/creatives/${row.creativeId}`} controls playsInline className="mt-2 max-h-80 w-full rounded-2xl" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/creatives/${row.creativeId}`}
                  alt={row.productName || "Advertisement"}
                  className="mt-2 max-h-80 w-full rounded-2xl object-contain"
                />
              )}
              <label className="mt-4 block text-sm">
                {t("ads.caption")}
                <textarea
                  value={captions[row.id] ?? row.caption}
                  onChange={(event) =>
                    setCaptions((current) => ({ ...current, [row.id]: event.target.value }))
                  }
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3"
                />
              </label>
              {row.permalink ? (
                <p className="mt-3 text-sm">
                  {t("admin.livePost")}:{" "}
                  <a href={row.permalink} className="text-[var(--gold)]" target="_blank" rel="noreferrer">
                    {row.permalink}
                  </a>
                  {row.igMediaId ? ` · ${row.igMediaId}` : ""}
                  {row.publishedAt ? ` · ${new Date(row.publishedAt).toLocaleString()}` : ""}
                </p>
              ) : (
                <p className="mt-3 text-sm text-[var(--muted)]">{t("admin.noLivePost")}</p>
              )}
              {row.lastError ? <p className="mt-2 text-sm text-[var(--danger)]">{row.lastError}</p> : null}
              <div className="mt-4 flex flex-wrap gap-3">
                {row.status !== "published" && row.customerApprovedAt ? (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => act(row.id, "authorize")}
                    className="rounded-full border border-[var(--line)] px-4 py-2 text-sm disabled:opacity-40"
                  >
                    {t("admin.authorize")}
                  </button>
                ) : null}
                {row.status === "authorized" ? (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => act(row.id, "revoke")}
                    className="rounded-full border border-[var(--line)] px-4 py-2 text-sm disabled:opacity-40"
                  >
                    {t("admin.revokeAuth")}
                  </button>
                ) : null}
                {row.status === "authorized" || row.status === "failed" ? (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => act(row.id, "publish")}
                    className="rounded-full bg-[var(--gold)] px-4 py-2 text-sm text-[var(--ink)] disabled:opacity-40"
                  >
                    {t("admin.publishNow")}
                  </button>
                ) : null}
                {row.status === "published" ? (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => act(row.id, "insights")}
                    className="rounded-full border border-[var(--line)] px-4 py-2 text-sm disabled:opacity-40"
                  >
                    {t("admin.insightsRefresh")}
                  </button>
                ) : null}
                {row.status !== "published" && row.status !== "withdrawn" ? (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => act(row.id, "decline")}
                    className="rounded-full px-4 py-2 text-sm text-[var(--danger)] disabled:opacity-40"
                  >
                    {t("admin.decline")}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
