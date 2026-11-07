"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { useSession } from "@/components/providers";
import { api } from "@/lib/api-client";

type Row = {
  id: string;
  name: string;
  nameAr: string;
  summary: string;
  whenToUse: string;
  whenNotToUse: string;
};

export default function AdminKnowledgePage() {
  const { t } = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ frameworks: Row[] }>("/api/admin/knowledge")
      .then((data) => setRows(data.frameworks))
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <Shell admin>
      <h1 className="serif text-4xl">{t("admin.knowledge")}</h1>
      <p className="mt-3 max-w-2xl text-sm text-[var(--muted)]">
        Frameworks are scored from the brief. AIDA is not the default.
      </p>
      {error ? <p className="mt-4 text-[var(--danger)]">{error}</p> : null}
      <ul className="mt-8 grid gap-3">
        {rows.map((row) => (
          <li key={row.id} className="panel rounded-2xl p-5">
            <p className="font-medium">
              {row.name} <span className="text-[var(--muted)]">· {row.nameAr}</span>
            </p>
            <p className="mt-2 text-sm">{row.summary}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Use: {row.whenToUse}</p>
            <p className="text-sm text-[var(--muted)]">Avoid: {row.whenNotToUse}</p>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
