"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { adminLogoutAction } from "@/app/(main)/actions";

const adminNav = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/listings", label: "Listings", icon: "listings" },
  { href: "/admin/moderation", label: "Moderation Queue", icon: "shield" },
  { href: "/admin/reports", label: "Reports & Complaints", icon: "flag" },
  { href: "/admin/categories", label: "Categories", icon: "layers" },
  { href: "/admin/verification", label: "Verification / KYC", icon: "badge" },
  { href: "/admin/boosts", label: "Boosts & Promotions", icon: "rocket" },
  { href: "/admin/payments", label: "Payments & Revenue", icon: "wallet" },
  { href: "/admin/chat-monitoring", label: "Chat Monitoring", icon: "chat" },
  { href: "/admin/notifications", label: "Notifications", icon: "bell" },
  { href: "/admin/analytics", label: "Analytics", icon: "chart" },
  { href: "/admin/platform-settings", label: "Platform Settings", icon: "gear" },
];

function NavIcon({ icon }: { icon: (typeof adminNav)[number]["icon"] }) {
  const sharedProps = {
    className: "h-4 w-4",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (icon) {
    case "grid":
      return (
        <svg {...sharedProps}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "users":
      return (
        <svg {...sharedProps}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
          <circle cx="9.5" cy="7" r="3.5" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "listings":
      return (
        <svg {...sharedProps}>
          <path d="M8 6h13" />
          <path d="M8 12h13" />
          <path d="M8 18h13" />
          <path d="M3 6h.01" />
          <path d="M3 12h.01" />
          <path d="M3 18h.01" />
        </svg>
      );
    case "shield":
      return (
        <svg {...sharedProps}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "flag":
      return (
        <svg {...sharedProps}>
          <path d="M4 22V4" />
          <path d="m4 4 6-2 4 2 6-2v12l-6 2-4-2-6 2" />
        </svg>
      );
    case "layers":
      return (
        <svg {...sharedProps}>
          <path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z" />
          <path d="m3 12 9 4.5 9-4.5" />
          <path d="m3 16.5 9 4.5 9-4.5" />
        </svg>
      );
    case "badge":
      return (
        <svg {...sharedProps}>
          <path d="M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
          <path d="m8.5 13.5-1 7 4.5-2.5 4.5 2.5-1-7" />
        </svg>
      );
    case "rocket":
      return (
        <svg {...sharedProps}>
          <path d="M5 15c-1.5 0-2.5 1-3 3 2 0 3-1 3-3Z" />
          <path d="M9 15 4 20" />
          <path d="M15 9 20 4" />
          <path d="M14 10 7 17" />
          <path d="M12 3c5 0 9 4 9 9-3 2-6 2-9 0-2-3-2-6 0-9Z" />
        </svg>
      );
    case "wallet":
      return (
        <svg {...sharedProps}>
          <path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
          <path d="M16 12h4" />
          <path d="M3 9h17" />
        </svg>
      );
    case "chat":
      return (
        <svg {...sharedProps}>
          <path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.5-4A8 8 0 1 1 21 12Z" />
          <path d="M8 11h8" />
          <path d="M8 15h5" />
        </svg>
      );
    case "bell":
      return (
        <svg {...sharedProps}>
          <path d="M15 17H5l1.4-1.4A2 2 0 0 0 7 14.2V11a5 5 0 1 1 10 0v3.2a2 2 0 0 0 .6 1.4L19 17h-4" />
          <path d="M10 21a2 2 0 0 0 4 0" />
        </svg>
      );
    case "chart":
      return (
        <svg {...sharedProps}>
          <path d="M4 20V10" />
          <path d="M10 20V4" />
          <path d="M16 20v-7" />
          <path d="M22 20v-11" />
        </svg>
      );
    case "gear":
      return (
        <svg {...sharedProps}>
          <path d="M12 8.8A3.2 3.2 0 1 0 12 15.2 3.2 3.2 0 0 0 12 8.8Z" />
          <path d="m19.4 15 .2 2.1-1.8 1-1.6-1a7.7 7.7 0 0 1-1.8.8l-.5 1.8h-2l-.5-1.8a7.7 7.7 0 0 1-1.8-.8l-1.6 1-1.8-1 .2-2.1a7.5 7.5 0 0 1-1.1-1.6L2.3 12l1.5-1.4a7.5 7.5 0 0 1 1.1-1.6l-.2-2.1 1.8-1 1.6 1a7.7 7.7 0 0 1 1.8-.8l.5-1.8h2l.5 1.8a7.7 7.7 0 0 1 1.8.8l1.6-1 1.8 1-.2 2.1a7.5 7.5 0 0 1 1.1 1.6l1.5 1.4-1.5 1.4a7.5 7.5 0 0 1-1.1 1.6Z" />
        </svg>
      );
    default:
      return null;
  }
}

function isActive(pathname: string, href: string) {
  if (href === "/admin/dashboard") {
    return pathname === href;
  }

  return pathname.startsWith(href);
}

export function AdminDashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const storedTheme =
      typeof window !== "undefined"
        ? window.localStorage.getItem("marketplace-theme")
        : null;
    const nextTheme =
      storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark";

    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  }, []);

  useEffect(() => {
    for (const item of adminNav) {
      router.prefetch(item.href);
    }
  }, [router]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    window.localStorage.setItem("marketplace-theme", nextTheme);
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[24rem] bg-[radial-gradient(circle_at_top_left,rgba(102,104,232,0.22),transparent_42%),radial-gradient(circle_at_top_right,rgba(163,110,29,0.16),transparent_28%)]" />
      <div className="mx-auto max-w-[96rem] px-5 py-8 sm:px-8 lg:px-10">
        <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="rounded-[2rem] border border-[var(--line)] bg-[linear-gradient(180deg,var(--surface-strong),color-mix(in_srgb,var(--surface-strong)_88%,var(--background)))] p-5 text-[var(--foreground)] shadow-[0_24px_70px_rgba(4,7,20,0.18)] xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-[1.6rem] border border-[var(--line)] bg-[color-mix(in_srgb,var(--surface)_28%,transparent)] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#6668E8,#A36E1D)] text-sm font-bold text-white">
                  CM
                </div>
                <div>
                  <p className="display-font text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                    Admin Console
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">Classified Ops</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-[1.25rem] border border-[var(--line)] bg-[color-mix(in_srgb,var(--surface)_36%,transparent)] p-3">
                  <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--muted)]">
                    Mode
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">Secure admin</p>
                </div>
                <div className="rounded-[1.25rem] border border-[var(--line)] bg-[color-mix(in_srgb,var(--surface)_36%,transparent)] p-3">
                  <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--muted)]">
                    Status
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--brand-deep)]">Live controls</p>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <p className="display-font text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                Control Center
              </p>
              <div className="mt-3 grid gap-2">
                {adminNav.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group flex items-center gap-3 rounded-[1.2rem] px-4 py-3 text-sm font-semibold ${
                        active
                          ? "bg-[linear-gradient(135deg,#6668E8,#4F57D8)] text-white shadow-[0_14px_36px_rgba(102,104,232,0.24)]"
                          : "border border-[var(--line)] bg-[color-mix(in_srgb,var(--surface)_36%,transparent)] text-[var(--foreground)] hover:border-[rgba(102,104,232,0.34)] hover:bg-[var(--accent-soft)]"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                          active
                            ? "bg-[rgba(255,255,255,0.16)] text-white"
                            : "bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] text-[var(--brand-deep)]"
                        }`}
                      >
                        <NavIcon icon={item.icon} />
                      </span>
                      <span className="leading-5">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-[var(--line)] bg-[linear-gradient(180deg,var(--surface),color-mix(in_srgb,var(--surface)_82%,var(--background)))] p-4">
              <p className="display-font text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                Operations Pulse
              </p>
              <div className="mt-4 space-y-3 text-sm text-[var(--foreground)]">
                <div className="flex items-center justify-between rounded-[1rem] bg-[color-mix(in_srgb,var(--surface-strong)_56%,var(--surface))] px-3 py-2">
                  <span>Moderation flow</span>
                  <span className="rounded-full bg-[rgba(163,110,29,0.22)] px-2 py-1 text-xs font-semibold text-[#F0C983]">
                    Watch
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-[1rem] bg-[color-mix(in_srgb,var(--surface-strong)_56%,var(--surface))] px-3 py-2">
                  <span>Revenue sync</span>
                  <span className="rounded-full bg-[rgba(33,161,121,0.18)] px-2 py-1 text-xs font-semibold text-[#9AE2C8]">
                    Stable
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-[1rem] bg-[color-mix(in_srgb,var(--surface-strong)_56%,var(--surface))] px-3 py-2">
                  <span>Fraud alerts</span>
                  <span className="rounded-full bg-[rgba(185,56,32,0.18)] px-2 py-1 text-xs font-semibold text-[#FFB4A8]">
                    Review
                  </span>
                </div>
              </div>
            </div>
          </aside>

          <section className="space-y-6">
            <header className="rounded-[2rem] border border-[var(--line)] bg-[linear-gradient(180deg,var(--surface),color-mix(in_srgb,var(--surface)_78%,var(--background)))] p-6 text-[var(--foreground)] shadow-[0_22px_60px_rgba(17,24,45,0.14)]">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="max-w-3xl">
                  <p className="display-font text-xs font-semibold uppercase tracking-[0.26em] text-[var(--brand-deep)]">
                    Marketplace Operations
                  </p>
                  <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-[var(--foreground)] sm:text-4xl">
                    Dedicated control room for platform health, trust, and growth.
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                    Monitor listings, revenue, moderation, user quality, and risk signals from one admin-only workspace.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <div className="rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
                      Protected routes
                    </div>
                    <div className="rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[var(--accent)]">
                      Role-aware sessions
                    </div>
                    <div className="rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[var(--brand-deep)]">
                      Audit-focused tooling
                    </div>
                  </div>
                </div>

                <div className="grid min-w-[18rem] gap-3">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]"
                  >
                    {theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                  </button>
                  <div className="rounded-[1.4rem] border border-[var(--line)] bg-[var(--surface-strong)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                          Search
                        </p>
                        <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">Global admin search</p>
                      </div>
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--brand-deep)]">
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <circle cx="11" cy="11" r="7" />
                          <path d="m20 20-3.5-3.5" />
                        </svg>
                      </span>
                    </div>
                    <div className="mt-3 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--muted)]">
                      Search users, listings, reports, categories...
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]"
                    >
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#A36E1D] opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#A36E1D]" />
                      </span>
                      Notifications
                    </button>
                    <button
                      type="button"
                      className="inline-flex flex-1 items-center justify-center rounded-full bg-[linear-gradient(135deg,#6668E8,#4F57D8)] px-4 py-3 text-sm font-semibold text-white"
                    >
                      Admin profile
                    </button>
                    <form action={adminLogoutAction} className="flex-1">
                      <button
                        type="submit"
                        className="w-full rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]"
                      >
                        Log out
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </header>

            <div>{children}</div>
          </section>
        </div>
      </div>
    </div>
  );
}
