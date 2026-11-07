"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { BriefCard } from "@/components/brief-card";
import { ChatThread } from "@/components/chat-thread";
import { Shell } from "@/components/shell";
import { useSession } from "@/components/providers";
import { api } from "@/lib/api-client";
import type { Business, Campaign } from "@/lib/types";

function CreateAd() {
  const { t } = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(id));
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async (campaignId: string) => {
    const data = await api<{ campaign: Campaign }>(`/api/campaigns/${campaignId}`);
    setCampaign(data.campaign);
  }, []);

  useEffect(() => {
    api<{ businesses: Business[] }>("/api/businesses")
      .then((data) => setBusinesses(data.businesses))
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    load(id)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, load]);

  const active = businesses.find((item) => item.isActive) ?? businesses[0];

  async function start(event: React.FormEvent) {
    event.preventDefault();
    if (!active) return;
    setError("");
    try {
      const data = await api<{ campaign: Campaign }>("/api/campaigns", {
        method: "POST",
        body: JSON.stringify({ prompt, businessId: active.id }),
      });
      router.replace(`/create?id=${data.campaign.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  return (
    <Shell>
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--gold)]">{t("create.title")}</p>
      <p className="mt-2 text-sm text-[var(--muted)]">{t("create.refreshSafe")}</p>
      {error ? <p className="mt-4 text-sm text-[var(--danger)]">{error}</p> : null}
      {loading ? <p className="mt-8 text-[var(--muted)]">{t("common.loading")}</p> : null}
      {!loading && !campaign ? (
        active ? (
          <form onSubmit={start} className="panel mt-8 rounded-3xl p-6">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={t("home.placeholder")}
              rows={5}
              className="w-full resize-none bg-transparent text-lg outline-none"
            />
            <button
              type="submit"
              className="mt-4 rounded-full bg-[var(--gold)] px-6 py-3 text-sm text-[var(--ink)]"
            >
              {t("home.create")}
            </button>
          </form>
        ) : (
          <div className="mt-8">
            <p>{t("create.needBusiness")}</p>
            <Link href="/business" className="mt-4 inline-block text-[var(--gold)]">
              {t("home.addBusiness")}
            </Link>
          </div>
        )
      ) : null}
      {campaign ? (
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
          <div className="lg:sticky lg:top-24">
          <ChatThread
            messages={campaign.conversation}
            disabled={campaign.status !== "drafting"}
            showSkip={campaign.status === "drafting"}
            showSkipRemaining={
              campaign.status === "drafting" &&
              Boolean(campaign.productName && campaign.objective)
            }
            onSend={async (text) => {
              const data = await api<{ campaign: Campaign }>(
                `/api/campaigns/${campaign.id}/message`,
                { method: "POST", body: JSON.stringify({ text }) },
              );
              setCampaign(data.campaign);
            }}
            onSkip={async () => {
              const data = await api<{ campaign: Campaign }>(
                `/api/campaigns/${campaign.id}/message`,
                { method: "POST", body: JSON.stringify({ skip: true }) },
              );
              setCampaign(data.campaign);
            }}
            onSkipRemaining={async () => {
              const data = await api<{ campaign: Campaign }>(
                `/api/campaigns/${campaign.id}/message`,
                { method: "POST", body: JSON.stringify({ skipRemaining: true }) },
              );
              setCampaign(data.campaign);
            }}
          />
          </div>
          {campaign.status !== "drafting" ? (
            <div className="max-h-none space-y-4 overflow-y-auto lg:max-h-[calc(100vh-7rem)] lg:pr-1">
            <BriefCard
              campaign={campaign}
              generating={generating}
              onGenerate={
                campaign.status === "confirmed"
                  ? async (body) => {
                      setGenerating(true);
                      try {
                        const data = await api<{ campaign: Campaign }>(
                          `/api/campaigns/${campaign.id}/generate`,
                          { method: "POST", body: JSON.stringify(body ?? {}) },
                        );
                        setCampaign(data.campaign);
                      } finally {
                        setGenerating(false);
                      }
                    }
                  : undefined
              }
              onChooseConcept={async (body) => {
                const data = await api<{ campaign: Campaign }>(
                  `/api/campaigns/${campaign.id}/concept`,
                  { method: "POST", body: JSON.stringify(body) },
                );
                setCampaign(data.campaign);
              }}
              onConfirm={
                campaign.status === "brief_ready"
                  ? async () => {
                      const data = await api<{ campaign: Campaign }>(
                        `/api/campaigns/${campaign.id}/confirm`,
                        { method: "POST" },
                      );
                      setCampaign(data.campaign);
                    }
                  : undefined
              }
            />
            </div>
          ) : (
            <aside className="panel rounded-3xl p-5 text-sm text-[var(--muted)]">
              <p>
                {t("home.active")} {campaign.businessName || active?.name}
              </p>
              {campaign.marketingPlan?.history?.[0] ? (
                <p className="mt-3">
                  {t("strategy.history")}:{" "}
                  {[
                    campaign.marketingPlan.history[0].productName,
                    campaign.marketingPlan.history[0].offer,
                    campaign.marketingPlan.history[0].objective,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
              {campaign.marketingPlan?.reusedFromHistory?.length ? (
                <p className="mt-3 text-[var(--gold)]">
                  {t("strategy.reused")} {campaign.marketingPlan.reusedFromHistory.join(" · ")}
                </p>
              ) : null}
              <p className="mt-3">{t("create.generationOff")}</p>
            </aside>
          )}
        </div>
      ) : null}
    </Shell>
  );
}

export default function CreatePage() {
  return (
    <Suspense>
      <CreateAd />
    </Suspense>
  );
}
