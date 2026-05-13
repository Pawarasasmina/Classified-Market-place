"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/marketplace";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/categories", label: "Categories" },
  { href: "/search", label: "Search" },
  { href: "/sell", label: "Create Listing" },
  { href: "/my-listings", label: "Dashboard" },
  { href: "/messages", label: "Chat" },
  { href: "/profile", label: "Profile" },
  { href: "/admin", label: "Admin" },
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
    <div className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/" className="text-lg font-bold text-[var(--foreground)]">
            Classified Marketplace
          </Link>
          <nav className="flex flex-wrap gap-2 text-sm">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 font-medium ${
                  isActive(pathname, link.href)
                    ? "nav-link-active"
                    : "nav-link hover:border-[var(--brand)] hover:text-[var(--brand-strong)]"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="text-sm">
            {user ? (
              <span className="font-semibold text-[var(--foreground)]">{user.displayName}</span>
            ) : (
              <div className="flex gap-2">
                <Link href="/login" className="action-secondary px-3 py-2 font-semibold">
                  Login
                </Link>
                <Link href="/register" className="action-primary px-3 py-2 font-semibold">
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
