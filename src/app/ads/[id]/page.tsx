"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Shell } from "@/components/shell";
import { PublicationPanel } from "@/components/publication-panel";
import { useSession } from "@/components/providers";
import { api } from "@/lib/api-client";
import type { Campaign } from "@/lib/types";

export default function PublishedAdPage() {
  const { t } = useSession();
  const params = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params.id) return;
    api<{ campaign: Campaign }>(`/api/campaigns/${params.id}`)
      .then((data) => setCampaign(data.campaign))
      .catch((err: Error) => setError(err.message));
  }, [params.id]);

  useEffect(() => {
    if (!campaign?.publications.some((item) => item.permalink)) return;
    const existing = document.querySelector("script[data-adpilot-instagram-embed]");
    if (existing) {
      const instagram = window as unknown as { instgrm?: { Embeds?: { process: () => void } } };
      instagram.instgrm?.Embeds?.process();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://www.instagram.com/embed.js";
    script.async = true;
    script.dataset.adpilotInstagramEmbed = "true";
    document.body.appendChild(script);
  }, [campaign]);

  const publications = campaign?.publications ?? [];

  return (
    <Shell>
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--gold)]">{t("ads.publishedTitle")}</p>
      {error ? <p className="mt-4 text-sm text-[var(--danger)]">{error}</p> : null}
      {!campaign && !error ? <p className="mt-8 text-[var(--muted)]">{t("common.loading")}</p> : null}
      {campaign ? (
        <>
          <h1 className="serif mt-3 text-4xl">{campaign.productName || campaign.originalPrompt}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {t("ads.forBusiness")} {campaign.businessName}
          </p>
          <Link href={`/create?id=${campaign.id}`} className="mt-4 inline-block text-sm text-[var(--gold)]">
            {t("ads.open")}
          </Link>
          {publications.length === 0 ? (
            <p className="panel mt-8 rounded-3xl p-6 text-[var(--muted)]">{t("ads.noPost")}</p>
          ) : (
            publications.map((publication) => {
              const creative = campaign.creatives.find((item) => item.id === publication.creativeId);
              return (
                <article key={publication.id} className="panel mt-6 rounded-3xl p-5">
                  {creative?.kind === "video" ? (
                    <video src={`/api/creatives/${creative.id}`} controls playsInline className="w-full rounded-2xl" />
                  ) : creative ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/creatives/${creative.id}`}
                      alt={campaign.productName || "Advertisement"}
                      className="w-full rounded-2xl"
                    />
                  ) : null}
                  <PublicationPanel publication={publication} />
                </article>
              );
            })
          )}
        </>
      ) : null}
    </Shell>
  );
}
