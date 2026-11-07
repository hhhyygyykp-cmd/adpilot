"use client";

import { useState } from "react";
import type { Campaign } from "@/lib/types";
import { useSession } from "./providers";

export function MediaCard({
  campaign,
  onGenerate,
  busy,
}: {
  campaign: Campaign;
  onGenerate?: (body: { authorizePaid?: boolean; video?: boolean }) => Promise<void>;
  busy?: boolean;
}) {
  const { t } = useSession();
  const [authorized, setAuthorized] = useState(false);
  const images = campaign.creatives.filter((item) => item.kind === "image");
  const videos = campaign.creatives.filter((item) => item.kind === "video");
  const quote = campaign.mediaQuote;
  if (campaign.status !== "confirmed") return null;
  const total = `$${quote.totalUsd.toFixed(3)}`;
  const stillLeft = quote.still.remaining > 0;
  const videoLeft = !quote.video || quote.video.remaining > 0;
  const canPay = authorized && (stillLeft || (quote.wantsVideo && videoLeft && images.length > 0));

  return (
    <section className="panel rounded-3xl p-5">
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--gold)]">{t("media.title")}</p>
      <div className="mt-3 rounded-2xl border border-[var(--line)] p-4 text-sm leading-6">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--gold)]">{t("media.estimate")}</p>
        <p className="mt-2">
          {t("media.stillLine")} {quote.still.label} · {quote.still.model} · ${quote.still.usd.toFixed(3)} ·{" "}
          {quote.still.remaining}/{quote.still.limit} {t("media.left")}
        </p>
        {quote.video ? (
          <p className="mt-1">
            {t("media.videoLine")} {quote.video.label} · {quote.video.model} · {quote.video.seconds}s · $
            {quote.video.usd.toFixed(3)} · {quote.video.remaining}/{quote.video.limit} {t("media.left")}
          </p>
        ) : (
          <p className="mt-1 text-[var(--muted)]">{t("media.noVideo")}</p>
        )}
        <p className="mt-2 font-medium">
          {t("media.total")} {total}
        </p>
        {quote.waitingForKey ? <p className="mt-2 text-[var(--gold-deep)]">{t("media.waitingKey")}</p> : null}
      </div>
      {campaign.generationNote ? (
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{campaign.generationNote}</p>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted)]">{t("media.freeNote")}</p>
      )}
      {images.map((item) => (
        <figure key={item.id} className="mt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/creatives/${item.id}`}
            alt={campaign.productName || "Generated advertisement"}
            className="w-full rounded-2xl"
          />
          <figcaption className="mt-2 flex items-center justify-between text-xs text-[var(--muted)]">
            <span>{item.provider} · {item.kind}</span>
            <a href={`/api/creatives/${item.id}?download=1`} className="text-[var(--gold)]">
              {t("media.download")}
            </a>
          </figcaption>
        </figure>
      ))}
      {videos.map((item) => (
        <div key={item.id} className="mt-4">
          <video
            src={`/api/creatives/${item.id}`}
            controls
            playsInline
            className="w-full rounded-2xl"
          />
          <a href={`/api/creatives/${item.id}?download=1`} className="mt-2 inline-block text-xs text-[var(--gold)]">
            {t("media.downloadVideo")}
          </a>
        </div>
      ))}
      {onGenerate ? (
        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
              checked={authorized}
              onChange={(event) => setAuthorized(event.target.checked)}
              className="mt-1"
            />
            <span>
              {t("media.authorize")} {total}
            </span>
          </label>
          <button
            type="button"
            disabled={busy || !canPay}
            onClick={() => onGenerate({ authorizePaid: true, video: quote.wantsVideo })}
            className="rounded-full bg-[var(--gold)] px-5 py-2.5 text-sm font-medium text-[var(--ink)] disabled:opacity-40"
          >
            {busy ? t("media.workingPaid") : t("media.generatePaid")}
          </button>
          {quote.waitingForKey ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onGenerate({ authorizePaid: false, video: false })}
              className="ml-3 rounded-full border border-[var(--line)] px-5 py-2.5 text-sm disabled:opacity-40"
            >
              {busy ? t("media.working") : images.length ? t("media.againFree") : t("media.generateFree")}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
