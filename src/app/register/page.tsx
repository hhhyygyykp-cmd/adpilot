"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { LanguageToggle } from "@/components/language-toggle";
import { Mark } from "@/components/shell";
import { useSession } from "@/components/providers";
import { api } from "@/lib/api-client";
import type { Language } from "@/lib/types";

function RegisterForm() {
  const { t, refresh, language } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [preferred, setPreferred] = useState<Language>(language);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const invite = params.get("invite");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password,
          language: preferred,
          inviteToken: invite || undefined,
        }),
      });
      await refresh();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <Mark />
        <LanguageToggle compact />
      </div>
      <h1 className="serif text-4xl">{t("auth.registerTitle")}</h1>
      {invite ? <p className="mt-3 text-sm text-[var(--gold)]">{t("auth.inviteNote")}</p> : null}
      <form onSubmit={onSubmit} className="panel mt-8 space-y-4 rounded-3xl p-6">
        <label className="block text-sm">
          {t("auth.name")}
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3 outline-none"
          />
        </label>
        <label className="block text-sm">
          {t("auth.email")}
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3 outline-none"
          />
        </label>
        <label className="block text-sm">
          {t("auth.password")}
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3 outline-none"
          />
          <span className="mt-1 block text-xs text-[var(--muted)]">{t("auth.passwordHint")}</span>
        </label>
        <p className="text-xs text-[var(--muted)]">{t("auth.openaiNotice")}</p>
        <fieldset className="text-sm">
          <legend>{t("auth.language")}</legend>
          <div className="mt-2 flex gap-3">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="lang"
                checked={preferred === "en"}
                onChange={() => setPreferred("en")}
              />
              {t("auth.english")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="lang"
                checked={preferred === "ar"}
                onChange={() => setPreferred("ar")}
              />
              {t("auth.arabic")}
            </label>
          </div>
        </fieldset>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-[var(--gold)] py-3 text-sm font-medium text-[var(--ink)]"
        >
          {t("auth.submitRegister")}
        </button>
      </form>
      <p className="mt-6 text-sm text-[var(--muted)]">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="text-[var(--gold)]">
          {t("nav.signIn")}
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
