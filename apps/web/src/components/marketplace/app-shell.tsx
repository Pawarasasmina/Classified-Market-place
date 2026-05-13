"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/marketplace";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/categories", label: "Categories" },
  { href: "/search", label: "Search" },
  { href: "/sell", label: "Sell" },
  { href: "/messages", label: "Messages" },
  { href: "/saved", label: "Saved" },
  { href: "/my-listings", label: "My Listings" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function MarketplaceShell({
  children,
  user,
}: {
  children: ReactNode;
  user: SessionUser | null;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-transparent text-[var(--foreground)]">
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgba(17,24,45,0.88)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[92rem] items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#6668E8,#A36E1D)] text-sm font-bold text-white">
              CM
            </div>
            <div>
              <p className="display-font text-sm font-bold uppercase tracking-[0.24em] text-[var(--brand-deep)]">
                Classified Marketplace
              </p>
              <p className="text-xs text-[var(--muted)]">
                Buy, sell, and chat locally
              </p>
            </div>
          </Link>

          <nav className="hidden flex-wrap items-center gap-2 lg:flex">
            {navLinks.map((link) => {
              const active = isActive(pathname, link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-[var(--brand)] text-[var(--foreground)]"
                      : "text-[var(--muted)] hover:bg-[rgba(102,104,232,0.16)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                aria-label="Open profile"
                className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${
                  isActive(pathname, "/profile")
                    ? "border-transparent bg-[var(--brand)] text-[var(--foreground)]"
                    : "border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[rgba(102,104,232,0.16)]"
                }`}
                title="Profile"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="M18 20a6 6 0 0 0-12 0" />
                  <circle cx="12" cy="8" r="4" />
                </svg>
              </Link>
              <Link
                href="/profile"
                className="hidden rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[rgba(102,104,232,0.16)] sm:inline-flex"
              >
                {user.displayName}
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface)]"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-[linear-gradient(135deg,#6668E8,#4F57D8)] px-4 py-2 text-sm font-semibold text-white"
              >
                Create account
              </Link>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--line)] lg:hidden">
          <div className="mx-auto flex max-w-[92rem] gap-2 overflow-x-auto px-5 py-3 text-xs sm:px-8">
            {navLinks.map((link) => {
              const active = isActive(pathname, link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`whitespace-nowrap rounded-full px-3 py-2 font-medium ${
                    active
                      ? "bg-[var(--brand)] text-[var(--foreground)]"
                      : "bg-[var(--surface)] text-[var(--muted)]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-[var(--line)] bg-[rgba(17,24,45,0.9)]">
        <div className="mx-auto flex max-w-[92rem] flex-col gap-4 px-5 py-8 text-sm text-[var(--muted)] sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <p>
            Find trusted listings, message sellers fast, and post your own in minutes.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/sell" className="hover:text-[var(--foreground)]">
              Post listing
            </Link>
            <Link href="/messages" className="hover:text-[var(--foreground)]">
              Inbox
            </Link>
            <Link href="/saved" className="hover:text-[var(--foreground)]">
              Saved items
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
