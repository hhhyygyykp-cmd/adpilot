"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { useSession } from "@/components/providers";
import { api } from "@/lib/api-client";

type Row = {
  id: string;
  status: string;
  productName: string | null;
  offer: string | null;
  objective: string | null;
  customerEmail: string;
  businessName: string;
};

export default function AdminCampaignsPage() {
  const { t } = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ campaigns: Row[] }>("/api/admin/campaigns")
      .then((data) => setRows(data.campaigns))
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <Shell admin>
      <h1 className="serif text-4xl">{t("admin.campaigns")}</h1>
      {error ? <p className="mt-4 text-[var(--danger)]">{error}</p> : null}
      <ul className="mt-8 grid gap-3">
        {rows.map((row) => (
          <li key={row.id} className="panel rounded-2xl p-5">
            <p className="font-medium">{row.productName || row.businessName}</p>
            <p className="text-sm text-[var(--muted)]">
              {row.customerEmail} · {row.status}
              {row.offer ? ` · ${row.offer}` : ""}
              {row.objective ? ` · ${row.objective}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
