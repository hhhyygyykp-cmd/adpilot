"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChatThread } from "@/components/chat-thread";
import { FalStudio } from "@/components/fal-studio";
import { Shell } from "@/components/shell";
import { useSession } from "@/components/providers";
import { api } from "@/lib/api-client";
import type { Business, BusinessAsset } from "@/lib/types";

export default function BusinessDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useSession();
  const [business, setBusiness] = useState<Business | null>(null);
  const [assets, setAssets] = useState<BusinessAsset[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const data = await api<{ business: Business; assets: BusinessAsset[] }>(
      `/api/businesses/${id}`,
    );
    setBusiness(data.business);
    setAssets(data.assets);
  }, [id]);

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [load]);

  async function upload(kind: "logo" | "product_photo", file: File) {
    const form = new FormData();
    form.set("kind", kind);
    form.set("file", file);
    await api(`/api/businesses/${id}/assets`, { method: "POST", body: form });
    await load();
  }

  if (!business) {
    return (
      <Shell>
        <p>{error || t("common.loading")}</p>
      </Shell>
    );
  }

  const logos = assets.filter((item) => item.kind === "logo");
  const photos = assets.filter((item) => item.kind === "product_photo");
  const chatting = Boolean(business.onboardingState.awaiting);

  return (
    <Shell>
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--gold)]">{t("business.onboarding")}</p>
      <h1 className="serif mt-2 text-4xl">{business.name || t("business.add")}</h1>
      {error ? <p className="mt-4 text-sm text-[var(--danger)]">{error}</p> : null}
      {chatting ? (
        <div className="mt-8">
          <ChatThread
            messages={business.onboardingState.messages}
            showSkip
            showSkipRemaining={business.onboardingState.awaiting !== "name"}
            onSend={async (text) => {
              const data = await api<{ business: Business }>(
                `/api/businesses/${id}/conversation`,
                { method: "POST", body: JSON.stringify({ text }) },
              );
              setBusiness(data.business);
            }}
            onSkip={async () => {
              const data = await api<{ business: Business }>(
                `/api/businesses/${id}/conversation`,
                { method: "POST", body: JSON.stringify({ skip: true }) },
              );
              setBusiness(data.business);
            }}
            onSkipRemaining={async () => {
              const data = await api<{ business: Business }>(
                `/api/businesses/${id}/conversation`,
                { method: "POST", body: JSON.stringify({ skipRemaining: true }) },
              );
              setBusiness(data.business);
            }}
          />
        </div>
      ) : (
        <form
          className="panel mt-8 grid gap-4 rounded-3xl p-6 md:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const data = await api<{ business: Business }>(`/api/businesses/${id}`, {
              method: "PATCH",
              body: JSON.stringify({
                name: form.get("name"),
                category: form.get("category"),
                description: form.get("description"),
                productsServices: form.get("productsServices"),
                targetCustomers: form.get("targetCustomers"),
                location: form.get("location"),
                website: form.get("website"),
                publicContact: form.get("publicContact"),
                brandPersonality: form.get("brandPersonality"),
                marketingGoals: form.get("marketingGoals"),
              }),
            });
            setBusiness(data.business);
          }}
        >
          {(
            [
              "name",
              "category",
              "productsServices",
              "description",
              "targetCustomers",
              "location",
              "website",
              "publicContact",
              "brandPersonality",
              "marketingGoals",
            ] as const
          ).map((field) => (
            <label key={field} className="flex flex-col gap-2 text-sm">
              {t(`business.fields.${field}`)}
              {field === "description" ||
              field === "productsServices" ||
              field === "brandPersonality" ||
              field === "marketingGoals" ? (
                <textarea
                  name={field}
                  defaultValue={business[field]}
                  rows={3}
                  className="w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3"
                />
              ) : (
                <input
                  name={field}
                  defaultValue={business[field]}
                  className="w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3"
                />
              )}
            </label>
          ))}
          <div className="md:col-span-2">
            <button type="submit" className="rounded-full bg-[var(--gold)] px-6 py-3 text-sm text-[var(--ink)]">
              {t("business.finish")}
            </button>
          </div>
        </form>
      )}

      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="panel rounded-3xl p-6">
          <h2 className="text-xs uppercase tracking-[0.18em] text-[var(--gold)]">{t("business.logo")}</h2>
          <FalStudio kinds={["logo"]} initialPrompt={business.name ? `Logo for ${business.name}` : ""} />
          {logos.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">{t("business.noLogo")}</p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-3">
              {logos.map((asset) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={asset.id}
                  src={`/api/assets/${asset.id}`}
                  alt={asset.originalName}
                  className="h-20 w-20 rounded-2xl object-cover"
                />
              ))}
            </div>
          )}
          <label className="mt-4 inline-block cursor-pointer text-sm text-[var(--gold)]">
            {t("business.uploadLogo")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload("logo", file).catch((err: Error) => setError(err.message));
              }}
            />
          </label>
        </div>
        <div className="panel rounded-3xl p-6">
          <h2 className="text-xs uppercase tracking-[0.18em] text-[var(--gold)]">{t("business.photos")}</h2>
          {photos.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">{t("business.noPhotos")}</p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-3">
              {photos.map((asset) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={asset.id}
                  src={`/api/assets/${asset.id}`}
                  alt={asset.originalName}
                  className="h-20 w-20 rounded-2xl object-cover"
                />
              ))}
            </div>
          )}
          <label className="mt-4 inline-block cursor-pointer text-sm text-[var(--gold)]">
            {t("business.uploadPhoto")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload("product_photo", file).catch((err: Error) => setError(err.message));
              }}
            />
          </label>
        </div>
      </section>
    </Shell>
  );
}
