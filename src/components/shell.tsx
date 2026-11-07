"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/lib/api-client";
import { LanguageToggle } from "./language-toggle";
import { useSession } from "./providers";

const customerLinks = [
  { href: "/", key: "nav.home" },
  { href: "/create", key: "nav.create" },
  { href: "/ads", key: "nav.ads" },
  { href: "/business", key: "nav.business" },
  { href: "/account", key: "nav.account" },
];

export function Mark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-3 ${className}`}>
      <span className="grid h-9 w-9 place-items-center rounded-full border border-[var(--gold)] text-[var(--gold)] serif text-lg">
        A
      </span>
      <span className="serif text-xl tracking-wide">AdPilot</span>
    </Link>
  );
}

export function Shell({
  children,
  requireAuth = true,
  admin = false,
}: {
  children: React.ReactNode;
  requireAuth?: boolean;
  admin?: boolean;
}) {
  const { customer, loading, t, refresh } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (requireAuth && !customer) router.replace("/login");
  }, [customer, loading, requireAuth, router]);

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" });
    await refresh();
    router.replace("/");
  }

  if (loading || (requireAuth && !customer)) {
    return (
      <div className="grid min-h-screen place-items-center text-[var(--muted)]">{t("common.loading")}</div>
    );
  }

  if (admin && customer && !customer.isAdmin) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4">
        <p className="serif text-3xl">{t("admin.title")}</p>
        <p className="mt-4 text-[var(--danger)]">{t("admin.denied")}</p>
        <Link href="/" className="mt-6 text-[var(--gold)]">
          {t("admin.back")}
        </Link>
      </div>
    );
  }

  const links = admin
    ? [
        { href: "/admin", key: "admin.overview" },
        { href: "/admin/customers", key: "admin.customers" },
        { href: "/admin/businesses", key: "admin.businesses" },
        { href: "/admin/campaigns", key: "admin.campaigns" },
        { href: "/admin/knowledge", key: "admin.knowledge" },
        { href: "/admin/jobs", key: "admin.jobs" },
      ]
    : customerLinks;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[rgba(12,11,9,0.86)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Mark />
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-3 py-2 text-sm transition ${
                    active
                      ? "bg-[var(--gold)] text-[var(--ink)]"
                      : "text-[var(--muted)] hover:text-[var(--cream)]"
                  }`}
                >
                  {t(link.key)}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <LanguageToggle compact />
            {customer?.isAdmin && !admin ? (
              <Link href="/admin" className="hidden text-xs uppercase tracking-[0.16em] text-[var(--gold)] sm:inline">
                {t("nav.admin")}
              </Link>
            ) : null}
            {admin ? (
              <Link href="/" className="text-xs uppercase tracking-[0.16em] text-[var(--gold)]">
                {t("admin.back")}
              </Link>
            ) : null}
            {customer ? (
              <button
                type="button"
                onClick={signOut}
                className="hidden text-xs uppercase tracking-[0.16em] text-[var(--muted)] sm:inline"
              >
                {t("nav.signOut")}
              </button>
            ) : null}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:hidden">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
                  active ? "bg-[var(--gold)] text-[var(--ink)]" : "text-[var(--muted)]"
                }`}
              >
                {t(link.key)}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:py-12">{children}</main>
    </div>
  );
}
