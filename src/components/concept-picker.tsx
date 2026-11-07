"use client";

import type { Campaign, ConceptLane, MarketingConcept } from "@/lib/types";
import { useSession } from "./providers";

export function ConceptPicker({
  campaign,
  onChoose,
  onConfirm,
}: {
  campaign: Campaign;
  onChoose?: (body: { conceptId?: ConceptLane; useRecommended?: boolean }) => Promise<void>;
  onConfirm?: () => Promise<void>;
}) {
  const { t } = useSession();
  const set = campaign.conceptSet;
  if (!set || set.concepts.length < 3) return null;
  const locked = campaign.status === "confirmed" || !onChoose;
  const selected = set.selectedId;

  return (
    <section className="panel rounded-3xl p-5">
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--gold)]">{t("concepts.title")}</p>
      <p className="mt-3 text-sm leading-6">{set.recommendationReason}</p>
      <p className="mt-2 text-xs text-[var(--muted)]">{t("concepts.noMedia")}</p>
      <div className="mt-4 grid gap-3">
        {set.concepts.map((concept) => (
          <ConceptCard
            key={concept.id}
            concept={concept}
            recommended={concept.id === set.recommendedId}
            selected={concept.id === selected}
            locked={locked}
            onPick={onChoose ? () => onChoose({ conceptId: concept.id }) : undefined}
          />
        ))}
      </div>
      {!locked && !selected ? (
        <button
          type="button"
          onClick={() => onChoose?.({ useRecommended: true })}
          className="mt-4 w-full rounded-full bg-[var(--gold)] px-5 py-3 text-sm font-medium text-[var(--ink)]"
        >
          {t("concepts.letAi")}
        </button>
      ) : null}
      {selected ? (
        <p className="mt-4 text-sm text-[var(--ok)]">
          {set.chosenBy === "ai" ? t("concepts.chosenAi") : t("concepts.chosenYou")}
        </p>
      ) : null}
      {selected && onConfirm && campaign.status === "brief_ready" ? (
        <button
          type="button"
          onClick={() => onConfirm()}
          className="mt-4 w-full rounded-full bg-[var(--gold)] px-5 py-3 text-sm font-medium text-[var(--ink)]"
        >
          {t("create.confirm")}
        </button>
      ) : null}
    </section>
  );
}

function ConceptCard({
  concept,
  recommended,
  selected,
  locked,
  onPick,
}: {
  concept: MarketingConcept;
  recommended: boolean;
  selected: boolean;
  locked: boolean;
  onPick?: () => void;
}) {
  const { t } = useSession();
  return (
    <article
      className={`rounded-2xl border p-4 ${
        selected ? "border-[var(--gold)] bg-black/20" : "border-[var(--line)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="serif text-xl">{concept.title}</p>
          {recommended ? (
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--gold)]">
              {t("concepts.recommend")}
            </p>
          ) : null}
        </div>
        {!locked && onPick ? (
          <button
            type="button"
            onClick={onPick}
            className={`rounded-full px-3 py-1.5 text-xs ${
              selected
                ? "bg-[var(--gold)] text-[var(--ink)]"
                : "border border-[var(--line)] text-[var(--cream)]"
            }`}
          >
            {selected ? t("concepts.selected") : t("concepts.pick")}
          </button>
        ) : null}
      </div>
      <p className="mt-3 text-sm font-medium leading-6">{concept.hook}</p>
      <dl className="mt-3 grid gap-2 text-sm">
        <Row label={t("concepts.core")} value={concept.coreMessage} />
        <Row label={t("concepts.benefit")} value={concept.audienceBenefit} />
        <Row label={t("concepts.direction")} value={concept.creativeDirection} />
        <Row label={t("concepts.format")} value={t(`brief.${concept.recommendedFormat}`)} />
        <Row label={t("concepts.cta")} value={concept.cta} />
      </dl>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">{label}</dt>
      <dd className="mt-0.5 leading-5 text-[var(--cream)]">{value}</dd>
    </div>
  );
}
