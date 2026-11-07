"use client";

import { useState } from "react";
import type { MarketingPlan } from "@/lib/types";
import { useSession } from "./providers";

export function StrategyCard({ plan }: { plan: MarketingPlan }) {
  const { t } = useSession();
  const [open, setOpen] = useState(false);
  return (
    <section className="panel rounded-3xl p-5">
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--gold)]">{t("strategy.title")}</p>
      {plan.framework ? (
        <p className="mt-3 serif text-xl leading-7">
          {plan.framework.name}
          <span className="ms-2 font-sans text-sm text-[var(--muted)]">{plan.framework.reason}</span>
        </p>
      ) : null}
      {plan.historyNote ? (
        <p className="mt-2 text-xs text-[var(--gold)]">{plan.historyNote}</p>
      ) : plan.reusedFromHistory?.length ? (
        <p className="mt-2 text-xs text-[var(--gold)]">
          {t("strategy.reused")} {plan.reusedFromHistory.join(" · ")}
        </p>
      ) : null}
      <p className="mt-3 text-sm text-[var(--gold-deep)]">{t("strategy.noMetrics")}</p>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--muted)]"
      >
        {open ? t("strategy.hideDetails") : t("strategy.showDetails")}
      </button>
      {open ? (
        <div className="mt-4 space-y-3 border-t border-[var(--line)] pt-4 text-sm">
          {plan.audience ? <p>{t("strategy.audience")}: {plan.audience}</p> : null}
          {plan.angle ? <p>{t("strategy.angle")}: {plan.angle}</p> : null}
          {plan.history[0] ? (
            <p>
              {t("strategy.history")}:{" "}
              {[plan.history[0].productName, plan.history[0].offer, plan.history[0].objective]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : (
            <p className="text-[var(--muted)]">{t("strategy.noHistory")}</p>
          )}
          {plan.hypotheses[0] ? (
            <p className="text-[var(--muted)]">
              {t("strategy.hypotheses")}: {plan.hypotheses[0].claim}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
