"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "@/components/providers";
import { api } from "@/lib/api-client";

type InstagramPublic = {
  status: string;
  username: string | null;
  name: string | null;
  biography: string | null;
  lastError: string;
  accessNote: string;
  appReviewNote: string;
  canPublish: boolean;
};

type Inferred = {
  overview: string;
  productsServices: string;
  brandPersonality: string;
  visualIdentity: string;
  contentThemes: string;
  audience: string;
  opportunities: string;
  recommendedApproaches: string;
  confidence: string;
  preliminary: boolean;
  visionUsed: boolean;
};

type AnalysisPublic = {
  id: string | null;
  status: string;
  inferred: Inferred | null;
  retrieved: {
    profile?: { username?: string; biography?: string; followersCount?: number | null };
    posting?: { count?: number; frequency?: string };
    insights?: { available?: boolean; note?: string };
  } | null;
  visionUsed: boolean;
  mediaCount: number;
  lastError: string;
};

export function CustomerInstagramPanel({ businessId }: { businessId: string }) {
  const { t } = useSession();
  const params = useSearchParams();
  const [instagram, setInstagram] = useState<InstagramPublic | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisPublic | null>(null);
  const [inferred, setInferred] = useState<Inferred | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const data = await api<{ instagram: InstagramPublic; analysis: AnalysisPublic }>(
      `/api/businesses/${businessId}/instagram`,
    );
    setInstagram(data.instagram);
    setAnalysis(data.analysis);
    setInferred(data.analysis.inferred);
  }, [businessId]);

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [load]);

  useEffect(() => {
    const state = params.get("state");
    if (params.get("instagram") !== "pending" || !state) return;
    setBusy("complete");
    api(`/api/businesses/${businessId}/instagram/complete`, {
      method: "POST",
      body: JSON.stringify({ state }),
    })
      .then(() => load())
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(""));
  }, [params, businessId, load]);

  async function run(action: string, extra: Record<string, unknown> = {}) {
    setError("");
    setBusy(action);
    try {
      if (action === "connect") {
        const data = await api<{ url: string }>(`/api/businesses/${businessId}/instagram/connect`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        window.location.href = data.url;
        return;
      }
      const data = await api<{ instagram: InstagramPublic; analysis: AnalysisPublic }>(
        `/api/businesses/${businessId}/instagram`,
        { method: "POST", body: JSON.stringify({ action, ...extra }) },
      );
      setInstagram(data.instagram);
      setAnalysis(data.analysis);
      setInferred(data.analysis.inferred);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy("");
    }
  }

  const connected = instagram?.status === "connected";

  return (
    <section className="panel mt-10 rounded-3xl p-6">
      <h2 className="text-xs uppercase tracking-[0.18em] text-[var(--gold)]">{t("business.instagram.title")}</h2>
      <p className="mt-3 text-sm text-[var(--muted)]">{t("business.instagram.description")}</p>
      <p className="mt-2 text-xs text-[var(--muted)]">{instagram?.accessNote || t("business.instagram.neverPublish")}</p>
      {instagram?.appReviewNote ? (
        <p className="mt-2 text-xs text-[var(--muted)]">{instagram.appReviewNote}</p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
      {instagram?.lastError ? <p className="mt-3 text-sm text-[var(--danger)]">{instagram.lastError}</p> : null}
      <p className="mt-4 text-sm">
        {connected
          ? `${t("business.instagram.connectedAs")} @${instagram?.username || ""}`
          : t("business.instagram.notConnected")}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => run("connect")}
          className="rounded-full bg-[var(--gold)] px-5 py-2 text-sm text-[var(--ink)]"
        >
          {t("business.instagram.connect")}
        </button>
        <button
          type="button"
          disabled={!connected || Boolean(busy)}
          onClick={() => run("analyze")}
          className="rounded-full border border-[var(--line)] px-5 py-2 text-sm"
        >
          {t("business.instagram.analyze")}
        </button>
        <button
          type="button"
          disabled={!connected || Boolean(busy)}
          onClick={() => run("disconnect")}
          className="rounded-full border border-[var(--line)] px-5 py-2 text-sm"
        >
          {t("business.instagram.disconnect")}
        </button>
      </div>
      {analysis?.inferred && inferred ? (
        <div className="mt-8 space-y-4">
          <h3 className="serif text-2xl">{t("business.instagram.learned")}</h3>
          <p className="text-xs text-[var(--gold)]">{t("business.instagram.inferred")}</p>
          {inferred.preliminary ? (
            <p className="text-sm text-[var(--muted)]">{t("business.instagram.preliminary")}</p>
          ) : null}
          <p className="text-sm text-[var(--muted)]">
            {inferred.visionUsed ? t("business.instagram.visionUsed") : t("business.instagram.captionsOnly")}
          </p>
          {analysis.retrieved?.insights?.note ? (
            <p className="text-sm text-[var(--muted)]">{analysis.retrieved.insights.note}</p>
          ) : null}
          {(
            [
              ["overview", "overview"],
              ["products", "productsServices"],
              ["personality", "brandPersonality"],
              ["visual", "visualIdentity"],
              ["themes", "contentThemes"],
              ["audience", "audience"],
              ["opportunities", "opportunities"],
              ["approaches", "recommendedApproaches"],
            ] as const
          ).map(([label, key]) => (
            <label key={key} className="block text-sm">
              {t(`business.instagram.${label}`)}
              <textarea
                value={inferred[key]}
                onChange={(event) => setInferred({ ...inferred, [key]: event.target.value })}
                rows={3}
                className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3"
              />
            </label>
          ))}
          <button
            type="button"
            disabled={!analysis.id || Boolean(busy)}
            onClick={() => run("confirm", { analysisId: analysis.id, inferred })}
            className="rounded-full bg-[var(--gold)] px-5 py-2 text-sm text-[var(--ink)]"
          >
            {t("business.instagram.confirm")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
