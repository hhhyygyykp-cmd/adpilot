"use client";

import { Shell } from "@/components/shell";
import { useSession } from "@/components/providers";

export default function AdminJobsPage() {
  const { t } = useSession();
  return (
    <Shell admin>
      <h1 className="serif text-4xl">{t("admin.jobs")}</h1>
      <p className="panel mt-8 rounded-3xl p-6 text-[var(--muted)]">{t("admin.jobsStub")}</p>
    </Shell>
  );
}
