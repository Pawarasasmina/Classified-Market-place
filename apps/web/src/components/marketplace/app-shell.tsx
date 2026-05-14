"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { logoutAction } from "@/app/(main)/actions";
import { ColorProfileToggle } from "@/components/marketplace/color-profile-toggle";
import type { SessionUser } from "@/lib/marketplace";

const customerNavLinks = [
  { href: "/", label: "Home" },
  { href: "/categories", label: "Categories" },
  { href: "/search", label: "Search" },
  { href: "/sell", label: "Sell" },
  { href: "/saved", label: "Saved" },
  { href: "/messages", label: "Messages" },
  { href: "/my-listings", label: "My Listings" },
  { href: "/profile", label: "Profile" },
];

const adminNavLinks = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin#moderation", label: "Moderation" },
  { href: "/messages", label: "Support Inbox" },
  { href: "/profile", label: "Profile" },
];

function isActive(pathname: string, href: string) {
  const baseHref = href.split("#")[0]?.split("?")[0] ?? href;

  if (baseHref === "/") return pathname === "/";
  return pathname.startsWith(baseHref);
}

function isAdminUser(user: SessionUser | null) {
  return user?.role.toUpperCase() === "ADMIN";
}

function adminWorkspaceRoute(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/messages") ||
    pathname === "/profile"
  );
}

function withCustomerPreview(href: string, enabled: boolean) {
  if (!enabled) {
    return href;
  }

  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}view=customer`;
}

export function MarketplaceShell({
  children,
  user,
}: {
  children: ReactNode;
  user: SessionUser | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const admin = isAdminUser(user);
  const customerPreview = admin && searchParams.get("view") === "customer";
  const adminShell = admin && !customerPreview;
  const adminLogin =
    !user &&
    pathname === "/login" &&
    (searchParams.get("next") ?? "").startsWith("/admin");
  const adminExperience = adminShell || adminLogin;
  const shouldRedirectToAdmin =
    adminShell && !adminWorkspaceRoute(pathname);
  const navLinks = adminShell
    ? adminNavLinks
    : adminLogin
      ? []
      : customerNavLinks;

  useEffect(() => {
    if (shouldRedirectToAdmin) {
      router.replace("/admin");
    }
  }, [router, shouldRedirectToAdmin]);

  return (
    <div
      className={`min-h-screen text-[var(--foreground)] ${
        adminExperience ? "admin-shell" : ""
      }`}
    >
      <header className="marketplace-header sticky top-0 z-40">
        <div className="mx-auto flex max-w-[92rem] flex-col gap-4 px-4 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <Link
            href={
              adminExperience ? "/admin" : withCustomerPreview("/", customerPreview)
            }
            className="flex items-center gap-3"
          >
            <span className="marketplace-brand-mark flex h-11 w-11 items-center justify-center text-sm font-black text-white">
              CM
            </span>
            <span>
              <span className="block text-sm font-black uppercase tracking-[0.22em]">
                {adminExperience ? "Admin Console" : "Classified Marketplace"}
              </span>
              <span className="marketplace-header-muted block text-xs">
                {adminLogin
                  ? "Management sign in"
                  : adminShell
                    ? "Operations workspace"
                    : "Buy, sell, and chat locally"}
              </span>
            </span>
          </Link>

          {navLinks.length ? (
            <nav className="hidden flex-wrap gap-2 text-sm lg:flex">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={
                    adminShell ? link.href : withCustomerPreview(link.href, customerPreview)
                  }
                  className={`px-3 py-2 font-semibold ${
                    isActive(pathname, link.href)
                      ? "nav-link-active"
                      : "nav-link"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {!adminExperience ? <ColorProfileToggle /> : null}
            {user ? (
              <>
                <span className="marketplace-header-badge rounded-md px-3 py-2 font-semibold">
                  {user.displayName}
                </span>
                {adminShell ? (
                  <Link
                    href="/?view=customer"
                    target="_blank"
                    rel="noreferrer"
                    className="action-secondary px-3 py-2 font-semibold"
                  >
                    View customer view
                  </Link>
                ) : customerPreview ? (
                  <Link href="/admin" className="marketplace-header-button px-3 py-2 font-semibold">
                    Back to admin
                  </Link>
                ) : null}
                <form action={logoutAction}>
                  <button className="marketplace-header-button px-3 py-2 font-semibold">
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <div className={`flex gap-2 ${adminLogin ? "hidden" : ""}`}>
                <Link
                  href={withCustomerPreview("/login", customerPreview)}
                  className="marketplace-header-button px-3 py-2 font-semibold"
                >
                  Sign in
                </Link>
                <Link
                  href={withCustomerPreview("/register", customerPreview)}
                  className="action-primary px-3 py-2 font-semibold"
                >
                  Create account
                </Link>
              </div>
            )}
          </div>
        </div>
        {navLinks.length ? (
          <div className="border-t border-[var(--header-line)] lg:hidden">
            <nav className="mx-auto flex max-w-[92rem] gap-2 overflow-x-auto px-4 py-3 text-xs sm:px-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={
                    adminShell ? link.href : withCustomerPreview(link.href, customerPreview)
                  }
                  className={`whitespace-nowrap rounded-md px-3 py-2 font-semibold ${
                    isActive(pathname, link.href)
                      ? "marketplace-mobile-link-active"
                      : "marketplace-mobile-link"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        ) : null}
      </header>
      <main>
        {shouldRedirectToAdmin ? (
          <div className="page">
            <div className="panel">Opening admin dashboard...</div>
          </div>
        ) : (
          children
        )}
      </main>
      {!adminExperience ? (
        <footer className="marketplace-footer">
          <div className="mx-auto grid max-w-[92rem] gap-6 px-4 py-8 text-sm sm:px-8 lg:grid-cols-[1fr_auto] lg:items-center lg:px-10">
            <div>
              <p className="font-black uppercase tracking-[0.2em]">
                Classified Marketplace
              </p>
              <p className="marketplace-footer-muted mt-2 max-w-2xl">
                A modern local marketplace for trusted discovery, seller tools,
                and direct conversations.
              </p>
            </div>
            <div className="marketplace-footer-muted flex flex-wrap gap-3">
              <Link href={withCustomerPreview("/search", customerPreview)}>Browse</Link>
              <Link href={withCustomerPreview("/sell", customerPreview)}>Sell</Link>
              <Link href={withCustomerPreview("/messages", customerPreview)}>Messages</Link>
              <Link href={withCustomerPreview("/profile", customerPreview)}>Account</Link>
            </div>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
