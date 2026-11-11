"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { useSession } from "@/components/providers";
import { api } from "@/lib/api-client";
import { publicationLabelKey } from "@/components/publication-panel";
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
          {campaigns.map((campaign) => {
            const published = campaign.publications.find((item) => item.status === "published");
            const latest = campaign.publications[0];
            const href = published ? `/ads/${campaign.id}` : `/create?id=${campaign.id}`;
            return (
            <li key={campaign.id}>
              <Link href={href} className="panel block rounded-2xl p-5">
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
                    {latest ? (
                      <p className="mt-2 text-xs text-[var(--gold)]">{t(publicationLabelKey(latest.status))}</p>
                    ) : null}
                  </div>
                  <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs uppercase tracking-[0.14em] text-[var(--gold)]">
                    {published ? t("ads.published") : statusLabel[campaign.status] ?? campaign.status}
                  </span>
                </div>
              </Link>
            </li>
            );
          })}
        </ul>
      )}
    </Shell>
  );
}
