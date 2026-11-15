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

export function CustomerInstagramPanel({ businessId }: { businessId: string }) {
  const { t } = useSession();
  const params = useSearchParams();
  const [instagram, setInstagram] = useState<InstagramPublic | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const data = await api<{ instagram: InstagramPublic }>(
      `/api/businesses/${businessId}/instagram`,
    );
    setInstagram(data.instagram);
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
      const data = await api<{ instagram: InstagramPublic }>(
        `/api/businesses/${businessId}/instagram`,
        { method: "POST", body: JSON.stringify({ action, ...extra }) },
      );
      setInstagram(data.instagram);
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
          onClick={() => run("disconnect")}
          className="rounded-full border border-[var(--line)] px-5 py-2 text-sm"
        >
          {t("business.instagram.disconnect")}
        </button>
      </div>
    </section>
  );
}
