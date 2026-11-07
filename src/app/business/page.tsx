"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { useSession } from "@/components/providers";
import { api } from "@/lib/api-client";
import type { Business } from "@/lib/types";

export default function BusinessPage() {
  const { t } = useSession();
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await api<{ businesses: Business[] }>("/api/businesses");
    setBusinesses(data.businesses);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  async function add() {
    setBusy(true);
    try {
      const data = await api<{ business: Business }>("/api/businesses", { method: "POST" });
      router.push(`/business/${data.business.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function activate(id: string) {
    await api(`/api/businesses/${id}/activate`, { method: "POST" });
    await load();
  }

  return (
    <Shell>
      <div className="flex items-center justify-between gap-4">
        <h1 className="serif text-4xl">{t("business.title")}</h1>
        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="rounded-full bg-[var(--gold)] px-5 py-2 text-sm text-[var(--ink)]"
        >
          {t("business.add")}
        </button>
      </div>
      {error ? <p className="mt-4 text-sm text-[var(--danger)]">{error}</p> : null}
      {businesses.length === 0 ? (
        <p className="mt-8 text-[var(--muted)]">{t("business.empty")}</p>
      ) : (
        <ul className="mt-8 grid gap-4">
          {businesses.map((business) => (
            <li key={business.id} className="panel rounded-3xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="serif text-2xl">{business.name || t("business.onboarding")}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {business.category || business.productsServices || t("common.optional")}
                  </p>
                </div>
                {business.isActive ? (
                  <span className="rounded-full bg-[var(--gold)] px-3 py-1 text-xs uppercase tracking-[0.14em] text-[var(--ink)]">
                    {t("business.active")}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => activate(business.id)}
                    className="text-xs uppercase tracking-[0.14em] text-[var(--gold)]"
                  >
                    {t("business.makeActive")}
                  </button>
                )}
              </div>
              <Link href={`/business/${business.id}`} className="mt-4 inline-block text-sm text-[var(--gold)]">
                {t("business.edit")}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
