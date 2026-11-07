"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { getDict, interpolate } from "@/lib/i18n";
import type { Dict } from "@/lib/i18n";
import type { Customer, Language } from "@/lib/types";

type SessionValue = {
  customer: Customer | null;
  language: Language;
  dict: Dict;
  loading: boolean;
  refresh: () => Promise<void>;
  setLanguage: (language: Language) => Promise<void>;
  t: (path: string, vars?: Record<string, string>) => string;
};

const SessionContext = createContext<SessionValue | null>(null);

function lookup(dict: Dict, path: string): string {
  const parts = path.split(".");
  let current: unknown = dict;
  for (const part of parts) {
    if (!current || typeof current !== "object") return path;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : path;
}

export function Providers({
  children,
  initialLanguage,
}: {
  children: React.ReactNode;
  initialLanguage: Language;
}) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [language, setLang] = useState<Language>(initialLanguage);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await api<{ customer: Customer | null }>("/api/auth/me");
    setCustomer(data.customer);
    if (data.customer?.preferredLanguage) setLang(data.customer.preferredLanguage);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  const setLanguage = useCallback(async (next: Language) => {
    setLang(next);
    await api("/api/account/language", {
      method: "POST",
      body: JSON.stringify({ language: next }),
    });
    await refresh();
  }, [refresh]);

  const dict = getDict(language);
  const t = useCallback(
    (path: string, vars?: Record<string, string>) => interpolate(lookup(dict, path), vars),
    [dict],
  );

  const value = useMemo(
    () => ({ customer, language, dict, loading, refresh, setLanguage, t }),
    [customer, language, dict, loading, refresh, setLanguage, t],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used within Providers");
  return value;
}
