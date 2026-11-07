"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { useSession } from "@/components/providers";
import { api } from "@/lib/api-client";

type Row = {
  id: string;
  email: string;
  name: string;
  preferredLanguage: string;
  createdAt: string;
  isAdmin: boolean;
};

export default function AdminCustomersPage() {
  const { t } = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ customers: Row[] }>("/api/admin/customers")
      .then((data) => setRows(data.customers))
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <Shell admin>
      <h1 className="serif text-4xl">{t("admin.customers")}</h1>
      {error ? <p className="mt-4 text-[var(--danger)]">{error}</p> : null}
      <ul className="mt-8 grid gap-3">
        {rows.map((row) => (
          <li key={row.id} className="panel rounded-2xl p-5">
            <p className="font-medium">{row.name}</p>
            <p className="text-sm text-[var(--muted)]">
              {row.email} · {row.preferredLanguage}
              {row.isAdmin ? " · admin" : ""}
            </p>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
