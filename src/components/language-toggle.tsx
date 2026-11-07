"use client";

import { useSession } from "./providers";

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useSession();
  return (
    <div className="inline-flex rounded-full border border-[var(--line)] bg-black/20 p-0.5 text-xs tracking-[0.14em] uppercase">
      <button
        type="button"
        className={`rounded-full px-3 py-1.5 transition ${
          language === "en" ? "bg-[var(--gold)] text-[var(--ink)]" : "text-[var(--muted)]"
        }`}
        onClick={() => setLanguage("en")}
      >
        {compact ? "EN" : "EN"}
      </button>
      <button
        type="button"
        className={`rounded-full px-3 py-1.5 transition ${
          language === "ar" ? "bg-[var(--gold)] text-[var(--ink)]" : "text-[var(--muted)]"
        }`}
        onClick={() => setLanguage("ar")}
      >
        عربي
      </button>
    </div>
  );
}
