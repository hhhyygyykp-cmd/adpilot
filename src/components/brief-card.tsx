"use client";

import type { Campaign, ConceptLane, InterpretedBrief } from "@/lib/types";
import { ConceptPicker } from "./concept-picker";
import { MediaCard } from "./media-card";
import { StrategyCard } from "./strategy-card";
import { useSession } from "./providers";

export function BriefCard({
  campaign,
  onConfirm,
  onChooseConcept,
  onGenerate,
  generating,
}: {
  campaign: Campaign;
  onConfirm?: () => Promise<void>;
  onChooseConcept?: (body: {
    conceptId?: ConceptLane;
    useRecommended?: boolean;
  }) => Promise<void>;
  onGenerate?: (body: { authorizePaid?: boolean; video?: boolean }) => Promise<void>;
  generating?: boolean;
}) {
  const { t } = useSession();
  const brief = campaign.interpretedBrief as Partial<InterpretedBrief>;
  const businessName = campaign.businessName || brief.businessName || "";
  const format = campaign.formatPreference
    ? t(`brief.${campaign.formatPreference}`)
    : t("brief.none");
  const rows = [
    [t("brief.business"), businessName || t("brief.none")],
    [t("brief.product"), campaign.productName || t("brief.none")],
    [t("brief.offer"), campaign.offer || t("brief.none")],
    [t("brief.objective"), campaign.objective || t("brief.none")],
    [t("brief.format"), format],
    campaign.audienceNote ? [t("brief.audience"), campaign.audienceNote] : null,
  ].filter(Boolean) as string[][];
  const canConfirm = campaign.status === "brief_ready" && Boolean(onConfirm) && Boolean(campaign.conceptSet?.selectedId);
  return (
    <div className="space-y-4">
      <section className="panel rounded-3xl p-5">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--gold)]">{t("create.summaryTitle")}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">{label}</dt>
              <dd className="mt-0.5 text-sm">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-[var(--gold-deep)]">
          {campaign.generationStatus === "ready" ? t("media.freeNote") : t("create.generationOff")}
        </p>
        {campaign.status === "brief_ready" && onConfirm && !campaign.conceptSet?.selectedId ? (
          <p className="mt-3 text-sm text-[var(--muted)]">{t("concepts.needPick")}</p>
        ) : null}
        {canConfirm ? (
          <button
            type="button"
            onClick={() => onConfirm?.()}
            className="mt-4 rounded-full bg-[var(--gold)] px-5 py-2.5 text-sm font-medium text-[var(--ink)]"
          >
            {t("create.confirm")}
          </button>
        ) : null}
        {campaign.status === "confirmed" ? (
          <p className="mt-4 text-sm text-[var(--ok)]">{t("create.confirmed")}</p>
        ) : null}
      </section>
      {campaign.marketingPlan?.framework ? <StrategyCard plan={campaign.marketingPlan} /> : null}
      <ConceptPicker
        campaign={campaign}
        onChoose={campaign.status === "brief_ready" ? onChooseConcept : undefined}
        onConfirm={canConfirm ? onConfirm : undefined}
      />
      <MediaCard campaign={campaign} onGenerate={onGenerate} busy={generating} />
    </div>
  );
}
