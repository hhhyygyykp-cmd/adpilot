"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { useSession } from "@/components/providers";
import { api } from "@/lib/api-client";
import type { Campaign } from "@/lib/types";

export default function AdsPage() {
  const { t } = useSession();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ campaigns: Campaign[] }>("/api/campaigns")
      .then((data) => setCampaigns(data.campaigns))
      .catch((err: Error) => setError(err.message));
  }, []);

  const statusLabel: Record<string, string> = {
    drafting: t("ads.statusDrafting"),
    brief_ready: t("ads.statusBrief"),
    confirmed: t("ads.statusConfirmed"),
  };

  return (
    <Shell>
      <h1 className="serif text-4xl">{t("ads.title")}</h1>
      {error ? <p className="mt-4 text-sm text-[var(--danger)]">{error}</p> : null}
      {campaigns.length === 0 ? (
        <p className="mt-8 text-[var(--muted)]">{t("ads.empty")}</p>
      ) : (
        <ul className="mt-8 grid gap-3">
          {campaigns.map((campaign) => (
            <li key={campaign.id}>
              <Link href={`/create?id=${campaign.id}`} className="panel block rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {campaign.productName || campaign.originalPrompt}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {t("ads.forBusiness")} {campaign.businessName}
                      {campaign.offer ? ` · ${campaign.offer}` : ""}
                      {campaign.objective ? ` · ${campaign.objective}` : ""}
                      {campaign.conceptSet?.selectedId
                        ? ` · ${campaign.conceptSet.concepts.find((item) => item.id === campaign.conceptSet?.selectedId)?.title || t(`concepts.${campaign.conceptSet.selectedId}`)}`
                        : ""}
                    </p>
                  </div>
                  <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs uppercase tracking-[0.14em] text-[var(--gold)]">
                    {statusLabel[campaign.status] ?? campaign.status}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
