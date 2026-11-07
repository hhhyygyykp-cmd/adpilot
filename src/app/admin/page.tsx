"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { useSession } from "@/components/providers";
import { api } from "@/lib/api-client";

type Overview = {
  counts: { customers: number; businesses: number; campaigns: number; jobs: number };
  allowList: string[];
  invites: Array<{ id: string; email: string; usedAt: string | null; expiresAt: string }>;
};

export default function AdminPage() {
  const { t } = useSession();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");

  useEffect(() => {
    api<Overview>("/api/admin/overview")
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : t("common.error")),
      );
  }, [t]);

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    const result = await api<{ invite: { url: string } }>("/api/admin/invites", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    setInviteUrl(result.invite.url);
    setEmail("");
  }

  return (
    <Shell admin>
      <h1 className="serif text-4xl">{t("admin.title")}</h1>
      {error ? <p className="mt-6 text-[var(--danger)]">{error}</p> : null}
      {data ? (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Stat label={t("admin.customerCount")} value={data.counts.customers} />
            <Stat label={t("admin.businessCount")} value={data.counts.businesses} />
            <Stat label={t("admin.campaignCount")} value={data.counts.campaigns} />
          </div>
          <section className="panel mt-8 rounded-3xl p-6">
            <h2 className="text-xs uppercase tracking-[0.18em] text-[var(--gold)]">{t("admin.allowList")}</h2>
            {data.allowList.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">{t("admin.allowListEmpty")}</p>
            ) : (
              <ul className="mt-3 space-y-1 text-sm">
                {data.allowList.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
          <form onSubmit={invite} className="panel mt-6 rounded-3xl p-6">
            <h2 className="text-xs uppercase tracking-[0.18em] text-[var(--gold)]">{t("admin.invites")}</h2>
            <label className="mt-4 block text-sm">
              {t("admin.inviteEmail")}
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3"
              />
            </label>
            <button type="submit" className="mt-4 rounded-full bg-[var(--gold)] px-5 py-2 text-sm text-[var(--ink)]">
              {t("admin.inviteSend")}
            </button>
            {inviteUrl ? (
              <p className="mt-4 break-all text-sm text-[var(--ok)]">
                {t("admin.inviteCreated")} {inviteUrl}
              </p>
            ) : null}
          </form>
        </>
      ) : null}
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel rounded-3xl p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <p className="serif mt-2 text-4xl">{value}</p>
    </div>
  );
}
