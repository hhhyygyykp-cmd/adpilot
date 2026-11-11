"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Shell } from "@/components/shell";
import { useSession } from "@/components/providers";
import { api } from "@/lib/api-client";
import { Suspense } from "react";

type Instagram = {
  configured: boolean;
  status: string;
  username: string | null;
  igUserId: string | null;
  accountType: string | null;
  name: string | null;
  permissions: string[];
  connectedAt: string | null;
  tokenExpiresAt: string | null;
  lastRefreshedAt: string | null;
  lastError: string;
  redirectUri: string;
  publicOrigin: string;
  scopes: string[];
};

function statusKey(status: string): string {
  if (status === "connected") return "admin.connected";
  if (status === "expired") return "admin.expired";
  if (status === "needs_reauth") return "admin.needsReauth";
  if (status === "not_configured") return "admin.notConfigured";
  return "admin.disconnected";
}

function AgencySettings() {
  const { t } = useSession();
  const params = useSearchParams();
  const [data, setData] = useState<Instagram | null>(null);
  const [error, setError] = useState(params.get("error") || "");
  const [busy, setBusy] = useState("");

  async function load() {
    const result = await api<{ instagram: Instagram }>("/api/admin/instagram");
    setData(result.instagram);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  async function connect() {
    setBusy("connect");
    setError("");
    try {
      const result = await api<{ url: string }>("/api/admin/instagram/connect", { method: "POST" });
      window.location.href = result.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
      setBusy("");
    }
  }

  async function act(action: "disconnect" | "refresh") {
    setBusy(action);
    setError("");
    try {
      const result = await api<{ instagram: Instagram }>("/api/admin/instagram", {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      setData(result.instagram);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy("");
    }
  }

  return (
    <Shell admin>
      <h1 className="serif text-4xl">{t("admin.settings")}</h1>
      <p className="mt-4 max-w-3xl text-[var(--muted)]">{t("admin.instagramIntro")}</p>
      {params.get("instagram") === "connected" ? (
        <p className="mt-4 text-sm text-[var(--ok)]">{t("admin.connected")}</p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-[var(--danger)]">{error}</p> : null}
      {data ? (
        <>
          <section className="panel mt-8 rounded-3xl p-6">
            <h2 className="text-xs uppercase tracking-[0.18em] text-[var(--gold)]">
              {t("admin.instagramTitle")}
            </h2>
            <p className="mt-3 text-sm">{t(statusKey(data.status))}</p>
            {data.lastError ? <p className="mt-2 text-sm text-[var(--danger)]">{data.lastError}</p> : null}
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label={t("admin.username")} value={data.username || "—"} />
              <Field label={t("admin.accountId")} value={data.igUserId || "—"} />
              <Field label={t("admin.accountType")} value={data.accountType || data.name || "—"} />
              <Field
                label={t("admin.permissions")}
                value={data.permissions.length ? data.permissions.join(", ") : "—"}
              />
              <Field
                label={t("admin.connectedAt")}
                value={data.connectedAt ? new Date(data.connectedAt).toLocaleString() : "—"}
              />
              <Field
                label={t("admin.expiresAt")}
                value={data.tokenExpiresAt ? new Date(data.tokenExpiresAt).toLocaleString() : "—"}
              />
            </dl>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={Boolean(busy) || !data.configured}
                onClick={connect}
                className="rounded-full bg-[var(--gold)] px-5 py-2 text-sm text-[var(--ink)] disabled:opacity-40"
              >
                {t("admin.connect")}
              </button>
              <button
                type="button"
                disabled={Boolean(busy) || data.status === "disconnected" || data.status === "not_configured"}
                onClick={() => act("refresh")}
                className="rounded-full border border-[var(--line)] px-5 py-2 text-sm disabled:opacity-40"
              >
                {t("admin.refresh")}
              </button>
              <button
                type="button"
                disabled={Boolean(busy) || data.status === "disconnected" || data.status === "not_configured"}
                onClick={() => act("disconnect")}
                className="rounded-full border border-[var(--line)] px-5 py-2 text-sm text-[var(--danger)] disabled:opacity-40"
              >
                {t("admin.disconnect")}
              </button>
            </div>
          </section>
          <section className="panel mt-6 rounded-3xl p-6">
            <h2 className="text-xs uppercase tracking-[0.18em] text-[var(--gold)]">{t("admin.setupTitle")}</h2>
            <ol className="mt-4 list-decimal space-y-3 ps-5 text-sm leading-6">
              <li>{t("admin.setup1")}</li>
              <li>{t("admin.setup2")}</li>
              <li>
                {t("admin.setup3")}
                <code className="mt-2 block break-all rounded-xl bg-black/30 px-3 py-2 text-xs">
                  {data.redirectUri}
                </code>
              </li>
              <li>{t("admin.setup4")}</li>
              <li>{t("admin.setup5")}</li>
              <li>{t("admin.setup6")}</li>
            </ol>
            <p className="mt-4 text-xs text-[var(--muted)]">
              {t("admin.redirectUri")}: {data.publicOrigin}
            </p>
          </section>
        </>
      ) : (
        <p className="mt-8 text-[var(--muted)]">{t("common.loading")}</p>
      )}
    </Shell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 break-all text-sm">{value}</dd>
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <Suspense>
      <AgencySettings />
    </Suspense>
  );
}
