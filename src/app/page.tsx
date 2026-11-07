"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LanguageToggle } from "@/components/language-toggle";
import { Mark, Shell } from "@/components/shell";
import { useSession } from "@/components/providers";
import { api } from "@/lib/api-client";
import type { Business, Campaign } from "@/lib/types";

function Landing() {
  const { t } = useSession();
  return (
    <div className="relative min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
        <Mark />
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <Link href="/login" className="text-sm text-[var(--muted)]">
            {t("nav.signIn")}
          </Link>
        </div>
      </header>
      <section className="mx-auto flex max-w-4xl flex-col items-start px-4 pb-24 pt-10 md:pt-24">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--gold)]">{t("tagline")}</p>
        <h1 className="serif mt-6 max-w-3xl text-5xl leading-[1.1] md:text-7xl">{t("landing.headline")}</h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">{t("landing.body")}</p>
        <p className="mt-4 max-w-xl text-base text-[var(--cream)]/80">{t("promise")}</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/register"
            className="rounded-full bg-[var(--gold)] px-6 py-3 text-sm font-medium text-[var(--ink)]"
          >
            {t("landing.cta")}
          </Link>
          <Link href="/login" className="rounded-full border border-[var(--line)] px-6 py-3 text-sm">
            {t("landing.secondary")}
          </Link>
        </div>
      </section>
    </div>
  );
}

function StudioHome() {
  const { t } = useSession();
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const active = businesses.find((item) => item.isActive) ?? businesses[0];

  useEffect(() => {
    Promise.all([
      api<{ businesses: Business[] }>("/api/businesses"),
      api<{ campaigns: Campaign[] }>("/api/campaigns"),
    ])
      .then(([b, c]) => {
        setBusinesses(b.businesses);
        setCampaigns(c.campaigns);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  async function createAd(event: React.FormEvent) {
    event.preventDefault();
    if (!active) {
      router.push("/business");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await api<{ campaign: Campaign }>("/api/campaigns", {
        method: "POST",
        body: JSON.stringify({ prompt, businessId: active.id }),
      });
      router.push(`/create?id=${data.campaign.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <p className="text-xs uppercase tracking-[0.28em] text-[var(--gold)]">
        {active ? `${t("home.active")} ${active.name}` : t("home.noBusiness")}
      </p>
      <h1 className="serif mt-4 max-w-4xl text-4xl leading-tight md:text-6xl">{t("home.headline")}</h1>
      {!active ? (
        <Link
          href="/business"
          className="mt-8 inline-flex rounded-full bg-[var(--gold)] px-6 py-3 text-sm text-[var(--ink)]"
        >
          {t("home.addBusiness")}
        </Link>
      ) : (
        <form onSubmit={createAd} className="panel mt-10 rounded-3xl p-5 md:p-7">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={t("home.placeholder")}
            rows={5}
            className="w-full resize-none bg-transparent text-lg outline-none placeholder:text-[var(--muted)]"
          />
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={busy || prompt.trim().length < 3}
              className="rounded-full bg-[var(--gold)] px-6 py-3 text-sm font-medium text-[var(--ink)] disabled:opacity-40"
            >
              {t("home.create")}
            </button>
          </div>
        </form>
      )}
      {error ? <p className="mt-4 text-sm text-[var(--danger)]">{error}</p> : null}
      <section className="mt-14">
        <h2 className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{t("home.recent")}</h2>
        {campaigns.length === 0 ? (
          <p className="mt-4 text-[var(--muted)]">{t("home.emptyRecent")}</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {campaigns.slice(0, 5).map((campaign) => (
              <li key={campaign.id}>
                <Link
                  href={`/create?id=${campaign.id}`}
                  className="panel block rounded-2xl px-5 py-4 transition hover:border-[var(--gold)]"
                >
                  <p className="font-medium">{campaign.productName || campaign.originalPrompt}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {campaign.businessName}
                    {campaign.offer ? ` · ${campaign.offer}` : ""}
                    {campaign.objective ? ` · ${campaign.objective}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}

export default function HomePage() {
  const { customer, loading } = useSession();
  if (loading) return <div className="grid min-h-screen place-items-center text-[var(--muted)]">…</div>;
  return customer ? <StudioHome /> : <Landing />;
}
