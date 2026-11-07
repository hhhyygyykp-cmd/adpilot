"use client";

import { useEffect, useState } from "react";
import { LanguageToggle } from "@/components/language-toggle";
import { Shell } from "@/components/shell";
import { useSession } from "@/components/providers";
import { api } from "@/lib/api-client";

export default function AccountPage() {
  const { customer, t, refresh } = useSession();
  const [name, setName] = useState(customer?.name ?? "");

  useEffect(() => {
    if (customer?.name) setName(customer.name);
  }, [customer]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api("/api/account", { method: "PATCH", body: JSON.stringify({ name }) });
      await refresh();
      setMessage(t("account.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api("/api/account", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setMessage(t("account.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  return (
    <Shell>
      <h1 className="serif text-4xl">{t("account.title")}</h1>
      {message ? <p className="mt-4 text-sm text-[var(--ok)]">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-[var(--danger)]">{error}</p> : null}
      <form onSubmit={saveProfile} className="panel mt-8 max-w-lg space-y-4 rounded-3xl p-6">
        <h2 className="text-xs uppercase tracking-[0.18em] text-[var(--gold)]">{t("account.profile")}</h2>
        <label className="block text-sm">
          {t("auth.name")}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3"
          />
        </label>
        <p className="text-sm text-[var(--muted)]">{customer?.email}</p>
        <button type="submit" className="rounded-full bg-[var(--gold)] px-5 py-2 text-sm text-[var(--ink)]">
          {t("account.save")}
        </button>
      </form>
      <section className="panel mt-6 max-w-lg space-y-4 rounded-3xl p-6">
        <h2 className="text-xs uppercase tracking-[0.18em] text-[var(--gold)]">{t("account.language")}</h2>
        <LanguageToggle />
      </section>
      <form onSubmit={savePassword} className="panel mt-6 max-w-lg space-y-4 rounded-3xl p-6">
        <h2 className="text-xs uppercase tracking-[0.18em] text-[var(--gold)]">{t("account.security")}</h2>
        <label className="block text-sm">
          {t("account.currentPassword")}
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3"
          />
        </label>
        <label className="block text-sm">
          {t("account.newPassword")}
          <input
            type="password"
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3"
          />
        </label>
        <button type="submit" className="rounded-full border border-[var(--line)] px-5 py-2 text-sm">
          {t("account.changePassword")}
        </button>
      </form>
    </Shell>
  );
}
