"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { LanguageToggle } from "@/components/language-toggle";
import { Mark } from "@/components/shell";
import { useSession } from "@/components/providers";
import { api } from "@/lib/api-client";

function LoginForm() {
  const { t, refresh } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await refresh();
      router.replace(params.get("next") || "/");
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
      <h1 className="serif text-4xl">{t("auth.signInTitle")}</h1>
      <form onSubmit={onSubmit} className="panel mt-8 space-y-4 rounded-3xl p-6">
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
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-black/20 px-4 py-3 outline-none"
          />
        </label>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-[var(--gold)] py-3 text-sm font-medium text-[var(--ink)]"
        >
          {t("auth.submitSignIn")}
        </button>
      </form>
      <p className="mt-6 text-sm text-[var(--muted)]">
        {t("auth.needAccount")}{" "}
        <Link href="/register" className="text-[var(--gold)]">
          {t("nav.register")}
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
