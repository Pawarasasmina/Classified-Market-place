"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { logoutAction } from "@/app/(main)/actions";
import { CategoryIcon } from "@/components/marketplace/category-icon";
import { ColorProfileToggle } from "@/components/marketplace/color-profile-toggle";
import { GoogleOneTapPrompt } from "@/components/marketplace/google-auth-form";
import { NotificationBell } from "@/components/marketplace/notification-bell";
import { getAdminNavigationSections } from "@/lib/admin-navigation";
import { hasAnyAdminPermission } from "@/lib/admin-permissions";
import {
  buildMarketplaceCategoryTree,
  type MarketplaceCategoryNode,
} from "@/lib/category-tree";
import type { MarketplaceCategory, SessionUser } from "@/lib/marketplace";

const customerNavLinks = [
  { href: "/", label: "Home" },
  { href: "/categories", label: "Categories" },
  { href: "/search", label: "Search" },
  { href: "/sell", label: "Sell" },
  { href: "/saved", label: "Saved" },
  { href: "/messages", label: "Messages" },
  { href: "/notifications", label: "Notifications" },
  { href: "/transactions", label: "Purchases" },
  { href: "/wallet", label: "Wallet" },
  { href: "/reports", label: "Reports" },
  { href: "/my-listings", label: "My Listings" },
  { href: "/profile", label: "Profile" },
];

const customerColorProfileStorageKey = "smartmarket-color-profile";
const desktopPrimaryNavLinkHrefs = new Set([
  "/",
  "/categories",
  "/search",
  "/sell",
  "/saved",
  "/messages",
]);

function ChevronDownIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      className={className}
    >
      <path d="m5 7.5 5 5 5-5" />
    </svg>
  );
}

function HeaderMenu({
  label,
  active,
  align = "center",
  tone = "nav",
  children,
}: {
  label: ReactNode;
  active: boolean;
  align?: "center" | "right";
  tone?: "nav" | "utility";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="header-menu relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        onFocus={() => setOpen(true)}
        className={
          tone === "utility"
            ? "marketplace-header-button header-utility-button px-3 py-2 font-semibold"
            : `header-menu-trigger px-3 py-2 font-semibold ${
                active ? "nav-link-active" : "nav-link"
              }`
        }
        aria-expanded={open}
      >
        <span className="header-menu-trigger-label">{label}</span>
        <ChevronDownIcon className={`header-menu-chevron ${open ? "header-menu-chevron-open" : ""}`} />
      </button>
      {open ? (
        <div
          className={`header-menu-shell ${
            align === "right" ? "header-menu-panel-right" : ""
          }`}
        >
          <div className="header-menu-panel">
            {children}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CategoryChildLinks({
  nodes,
  customerPreview,
}: {
  nodes: MarketplaceCategoryNode[];
  customerPreview: boolean;
}) {
  return (
    <div className="category-menu-results">
      {nodes.map((node) => (
        <div key={node.slug} className="category-menu-group">
          <Link
            href={withCustomerPreview(
              `/search?category=${node.slug}`,
              customerPreview,
            )}
            className="category-menu-section-link"
          >
            {node.name}
          </Link>
          {node.nestedChildren.length ? (
            <div className="grid gap-1.5 pl-1">
              {node.nestedChildren.map((child) => (
                <Link
                  key={child.slug}
                  href={withCustomerPreview(
                    `/search?category=${child.slug}`,
                    customerPreview,
                  )}
                  className="category-menu-child-link"
                >
                  {child.name}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function CustomerCategoryMenu({
  categories,
  customerPreview,
  active,
}: {
  categories: MarketplaceCategory[];
  customerPreview: boolean;
  active: boolean;
}) {
  const tree = useMemo(
    () => buildMarketplaceCategoryTree(categories),
    [categories],
  );
  const [open, setOpen] = useState(false);
  const [activeSlug, setActiveSlug] = useState(tree[0]?.slug ?? "");
  const activeNode =
    tree.find((category) => category.slug === activeSlug) ?? tree[0];

  if (!tree.length) {
    return (
      <Link
        href={withCustomerPreview("/categories", customerPreview)}
        className={`px-3 py-2 font-semibold ${active ? "nav-link-active" : "nav-link"}`}
      >
        Categories
      </Link>
    );
  }

  return (
    <div
      className="category-menu relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        onFocus={() => setOpen(true)}
        className={`px-3 py-2 font-semibold ${active ? "nav-link-active" : "nav-link"}`}
      >
        Categories
      </button>
      {open ? (
        <div className="category-menu-shell">
          <div className="category-menu-panel">
            <div className="grid max-h-[32rem] lg:grid-cols-[15.5rem_1fr]">
              <div className="category-menu-sidebar">
                <Link
                  href={withCustomerPreview("/categories", customerPreview)}
                  className="category-menu-all-link"
                >
                  All categories
                </Link>
                <div className="category-menu-sidebar-list">
                  {tree.map((category) => (
                    <button
                      key={category.slug}
                      type="button"
                      onMouseEnter={() => setActiveSlug(category.slug)}
                      onClick={() => setActiveSlug(category.slug)}
                      className={`category-menu-category-link ${
                        activeNode?.slug === category.slug
                          ? "category-menu-category-link-active"
                          : ""
                      }`}
                    >
                      <span className="category-menu-icon">
                        <CategoryIcon slug={category.slug} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{category.name}</span>
                        <span className="block text-[0.72rem] font-semibold text-[var(--muted)]">
                          {category.nestedChildren.length
                            ? `${category.nestedChildren.length} subcategories`
                            : category.countLabel}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="category-menu-content">
                {activeNode ? (
                  <>
                    <div className="category-menu-content-head">
                      <div>
                        <p className="section-eyebrow">
                          Browse {activeNode.name}
                        </p>
                        <h3 className="mt-1.5 text-[1.35rem] font-black">
                          {activeNode.name}
                        </h3>
                        <p className="mt-1.5 max-w-lg text-sm leading-6 text-[var(--muted)]">
                          {activeNode.description}
                        </p>
                      </div>
                      <div className="category-menu-content-meta">
                        <span className="category-menu-count">
                          {activeNode.nestedChildren.length} sections
                        </span>
                        <Link
                          href={withCustomerPreview(
                            `/search?category=${activeNode.slug}`,
                            customerPreview,
                          )}
                          className="action-primary shrink-0 px-3 py-2 text-sm font-black"
                        >
                          View all
                        </Link>
                      </div>
                    </div>
                    {activeNode.nestedChildren.length ? (
                      <CategoryChildLinks
                        nodes={activeNode.nestedChildren}
                        customerPreview={customerPreview}
                      />
                    ) : (
                      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3 text-sm text-[var(--muted)]">
                        Listings in this category use the standard marketplace
                        filters.
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function isActive(pathname: string, href: string) {
  const baseHref = href.split("#")[0]?.split("?")[0] ?? href;

  if (baseHref === "/") return pathname === "/";
  if (baseHref === "/admin") return pathname === "/admin";
  if (href.includes("#")) return pathname === baseHref;

  return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
}

function isAdminUser(user: SessionUser | null) {
  return hasAnyAdminPermission(user?.role);
}

function getCustomerNavLinks(user: SessionUser | null) {
  return customerNavLinks.filter((link) => {
    if (link.href !== "/my-listings") {
      return true;
    }

    return Boolean(user?.sellerProfile);
  });
}

function getDesktopPrimaryNavLinks(user: SessionUser | null) {
  return getCustomerNavLinks(user).filter((link) =>
    desktopPrimaryNavLinkHrefs.has(link.href),
  );
}

function getDesktopSecondaryNavLinks(user: SessionUser | null) {
  if (!user) {
    return [];
  }

  return getCustomerNavLinks(user).filter(
    (link) =>
      !desktopPrimaryNavLinkHrefs.has(link.href) && link.href !== "/notifications",
  );
}

function AdminSidebar({
  pathname,
  role,
}: {
  pathname: string;
  role: string | null | undefined;
}) {
  const sections = useMemo(() => getAdminNavigationSections(role), [role]);
  const activeSectionId =
    sections.find((section) =>
      section.items.some((item) => isActive(pathname, item.href)),
    )?.id ?? sections[0]?.id ?? "";
  const [mobileState, setMobileState] = useState({
    open: false,
    pathname,
    sectionId: activeSectionId,
  });
  const [desktopSectionId, setDesktopSectionId] = useState("");
  const mobileOpen =
    mobileState.pathname === pathname ? mobileState.open : false;
  const mobileSectionId =
    mobileState.pathname === pathname &&
    sections.some((section) => section.id === mobileState.sectionId)
      ? mobileState.sectionId
      : activeSectionId;

  return (
    <>
      <div className="admin-sidebar-mobile">
        <button
          type="button"
          onClick={() =>
            setMobileState({
              open: !mobileOpen,
              pathname,
              sectionId: mobileSectionId,
            })
          }
          className="admin-sidebar-mobile-toggle"
          aria-expanded={mobileOpen}
          aria-controls="admin-sidebar-mobile-panel"
        >
          <span>
            <span className="admin-sidebar-mobile-label">
              Admin navigation
            </span>
            <span className="admin-sidebar-mobile-detail">
              Open admin pages
            </span>
          </span>
          <span className="admin-sidebar-mobile-arrow">
            {mobileOpen ? "Hide" : "Open"}
          </span>
        </button>
        {mobileOpen ? (
          <div
            id="admin-sidebar-mobile-panel"
            className="admin-sidebar-panel admin-sidebar-panel-mobile"
          >
            <AdminSidebarMobileSections
              pathname={pathname}
              sections={sections}
              activeSectionId={mobileSectionId}
              onToggleSection={(sectionId) =>
                setMobileState({
                  open: true,
                  pathname,
                  sectionId: mobileSectionId === sectionId ? "" : sectionId,
                })
              }
            />
          </div>
        ) : null}
      </div>
      <aside
        className="admin-sidebar-desktop"
        onMouseLeave={() => setDesktopSectionId("")}
        onPointerLeave={() => setDesktopSectionId("")}
      >
        <div className="admin-sidebar-desktop-shell">
          <AdminSidebarDesktopSections
            pathname={pathname}
            sections={sections}
            activeSectionId={desktopSectionId}
            onFocusSection={setDesktopSectionId}
          />
        </div>
      </aside>
    </>
  );
}

function AdminSidebarDesktopSections({
  pathname,
  sections,
  activeSectionId,
  onFocusSection,
}: {
  pathname: string;
  sections: ReturnType<typeof getAdminNavigationSections>;
  activeSectionId: string;
  onFocusSection: (sectionId: string) => void;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [submenuTop, setSubmenuTop] = useState(0);
  const activeSection =
    sections.find((section) => section.id === activeSectionId) ?? null;

  function handleOpenSection(
    sectionId: string,
    event: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>,
  ) {
    const shellTop = shellRef.current?.getBoundingClientRect().top ?? 0;
    const buttonTop = event.currentTarget.getBoundingClientRect().top;
    setSubmenuTop(buttonTop - shellTop);
    onFocusSection(sectionId);
  }

  return (
    <div ref={shellRef} className="admin-sidebar-rail">
      <div className="admin-sidebar-panel admin-sidebar-panel-desktop admin-sidebar-main-panel">
        <div className="admin-sidebar-header">
          <h2 className="admin-sidebar-title">Admin</h2>
        </div>
        <nav className="admin-sidebar-nav">
          {sections.map((section) => {
            const hasActiveItem = section.items.some((item) =>
              isActive(pathname, item.href),
            );
            return (
              <button
                key={section.id}
                type="button"
                onMouseEnter={(event) => handleOpenSection(section.id, event)}
                onPointerEnter={(event) => handleOpenSection(section.id, event)}
                onFocus={(event) => handleOpenSection(section.id, event)}
                className={`admin-sidebar-main-link ${
                  hasActiveItem ? "admin-sidebar-main-link-active" : ""
                }`}
              >
                <span>{section.label}</span>
                <span className="admin-sidebar-main-link-count">&gt;</span>
              </button>
            );
          })}
        </nav>
      </div>
      {activeSection ? (
        <div className="admin-sidebar-submenu panel" style={{ top: submenuTop }}>
          <div className="admin-sidebar-submenu-head">
            <p className="admin-sidebar-group-label">{activeSection.label}</p>
          </div>
          <div className="admin-sidebar-group-links">
            {activeSection.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-sidebar-nav-link ${
                  isActive(pathname, item.href)
                    ? "admin-sidebar-nav-link-active"
                    : ""
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AdminSidebarMobileSections({
  pathname,
  sections,
  activeSectionId,
  onToggleSection,
}: {
  pathname: string;
  sections: ReturnType<typeof getAdminNavigationSections>;
  activeSectionId: string;
  onToggleSection: (sectionId: string) => void;
}) {
  return (
    <div className="admin-sidebar-sections">
      {sections.map((section) => {
        const hasActiveItem = section.items.some((item) =>
          isActive(pathname, item.href),
        );
        const expanded = activeSectionId === section.id;

        return (
          <section
            key={section.id}
            className={`admin-sidebar-section ${
              hasActiveItem ? "admin-sidebar-section-active" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => onToggleSection(section.id)}
              className="admin-sidebar-section-toggle"
              aria-expanded={expanded}
            >
              <span className="admin-sidebar-section-head">
                <span className="admin-sidebar-section-label">{section.label}</span>
              </span>
              <span className="admin-sidebar-mobile-count">
                {expanded ? "Hide" : section.items.length}
              </span>
            </button>
            {expanded ? (
              <div className="admin-sidebar-group-links">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`admin-sidebar-nav-link ${
                      isActive(pathname, item.href)
                        ? "admin-sidebar-nav-link-active"
                        : ""
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function adminWorkspaceRoute(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/messages") ||
    pathname.startsWith("/notifications") ||
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

function getStoredColorProfile(
  storageKey: string,
  defaultProfile: "light" | "dark",
) {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored === "light" || stored === "dark" ? stored : defaultProfile;
  } catch {
    return defaultProfile;
  }
}

function applyColorProfile(profile: "light" | "dark") {
  const root = document.documentElement;
  root.dataset.colorProfile = profile;
  root.style.colorScheme = profile;
}

export function MarketplaceShell({
  children,
  user,
  categories,
  accessToken,
  notificationsApiBaseUrl,
}: {
  children: ReactNode;
  user: SessionUser | null;
  categories: MarketplaceCategory[];
  accessToken: string | null;
  notificationsApiBaseUrl: string;
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
  const shouldRedirectToAdmin = adminShell && !adminWorkspaceRoute(pathname);
  const search = searchParams.toString();
  const oneTapNextPath = search ? `${pathname}?${search}` : pathname;
  const showOneTap =
    !user &&
    !adminExperience &&
    pathname !== "/login" &&
    pathname !== "/register";
  const navLinks = adminShell
    ? []
    : adminLogin
      ? []
      : getCustomerNavLinks(user);
  const desktopPrimaryNavLinks = getDesktopPrimaryNavLinks(user);
  const desktopSecondaryNavLinks = getDesktopSecondaryNavLinks(user);
  const hasDesktopSecondaryActive = desktopSecondaryNavLinks.some((link) =>
    isActive(pathname, link.href),
  );

  useEffect(() => {
    const root = document.documentElement;

    if (adminExperience) {
      root.dataset.adminShell = "true";
      applyColorProfile(
        getStoredColorProfile(customerColorProfileStorageKey, "light"),
      );
      return;
    }

    delete root.dataset.adminShell;

    applyColorProfile(
      customerPreview
        ? "light"
        : getStoredColorProfile(customerColorProfileStorageKey, "light"),
    );
  }, [adminExperience, customerPreview]);

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
      {showOneTap ? <GoogleOneTapPrompt nextPath={oneTapNextPath} /> : null}
      <header
        className={`marketplace-header top-0 z-40 ${
          adminExperience ? "fixed inset-x-0" : "sticky"
        }`}
      >
        <div className="marketplace-header-shell mx-auto max-w-[92rem] px-4 py-4 sm:px-8 lg:px-10">
          <Link
            href={
              adminExperience
                ? "/admin"
                : withCustomerPreview("/", customerPreview)
            }
            className="marketplace-header-brand flex items-center gap-3"
          >
            <span className="marketplace-brand-mark flex h-11 w-11 items-center justify-center text-sm font-black text-white">
              CM
            </span>
            <span className="min-w-0">
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

          {desktopPrimaryNavLinks.length ? (
            <nav className="marketplace-desktop-nav hidden min-w-0 items-center justify-center gap-2 text-sm lg:flex">
              {desktopPrimaryNavLinks.map((link) =>
                !adminShell && link.href === "/categories" ? (
                  <CustomerCategoryMenu
                    key={link.href}
                    categories={categories}
                    customerPreview={customerPreview}
                    active={isActive(pathname, link.href)}
                  />
                ) : (
                  <Link
                    key={link.href}
                    href={
                      adminShell
                        ? link.href
                        : withCustomerPreview(link.href, customerPreview)
                    }
                    className={`px-3 py-2 font-semibold ${
                      isActive(pathname, link.href)
                        ? "nav-link-active"
                        : "nav-link"
                    }`}
                  >
                    {link.label}
                  </Link>
                ),
              )}
              {desktopSecondaryNavLinks.length ? (
                <HeaderMenu
                  label="More"
                  active={hasDesktopSecondaryActive}
                >
                  <div className="grid gap-1 p-2">
                    {desktopSecondaryNavLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={withCustomerPreview(link.href, customerPreview)}
                        className={`header-menu-link ${
                          isActive(pathname, link.href)
                            ? "header-menu-link-active"
                            : ""
                        }`}
                      >
                        <span>{link.label}</span>
                      </Link>
                    ))}
                  </div>
                </HeaderMenu>
              ) : null}
            </nav>
          ) : null}
          <div className="marketplace-header-actions flex flex-wrap items-center gap-2 text-sm">
            {adminExperience ? (
              <ColorProfileToggle
                storageKey={customerColorProfileStorageKey}
                defaultProfile="light"
              />
            ) : !customerPreview ? (
              <ColorProfileToggle
                storageKey={customerColorProfileStorageKey}
                defaultProfile="light"
              />
            ) : null}
            {user ? (
              <>
                {accessToken ? (
                  <NotificationBell
                    accessToken={accessToken}
                    apiBaseUrl={notificationsApiBaseUrl}
                  />
                ) : null}
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
                  <Link
                    href="/admin"
                    className="marketplace-header-button px-3 py-2 font-semibold"
                  >
                    Back to admin
                  </Link>
                ) : null}
                <HeaderMenu
                  label={
                    <span className="flex items-center gap-2">
                      <span className="marketplace-header-badge header-user-badge rounded-full px-3 py-1.5 font-semibold">
                        {user.displayName}
                      </span>
                    </span>
                  }
                  active={
                    isActive(pathname, "/profile") ||
                    isActive(pathname, "/wallet") ||
                    isActive(pathname, "/transactions") ||
                    isActive(pathname, "/reports") ||
                    isActive(pathname, "/notifications") ||
                    isActive(pathname, "/my-listings")
                  }
                  align="right"
                  tone="utility"
                >
                  <div className="grid gap-1 p-2">
                    <div className="border-b border-[var(--line)] px-3 py-2">
                      <p className="text-sm font-bold text-[var(--foreground)]">
                        {user.displayName}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        Manage your marketplace activity
                      </p>
                    </div>
                    {desktopSecondaryNavLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={withCustomerPreview(link.href, customerPreview)}
                        className={`header-menu-link ${
                          isActive(pathname, link.href)
                            ? "header-menu-link-active"
                            : ""
                        }`}
                      >
                        <span>{link.label}</span>
                      </Link>
                    ))}
                    <Link
                      href={withCustomerPreview("/notifications", customerPreview)}
                      className={`header-menu-link ${
                        isActive(pathname, "/notifications")
                          ? "header-menu-link-active"
                          : ""
                      }`}
                    >
                      <span>Notifications</span>
                    </Link>
                    <form action={logoutAction} className="pt-1">
                      <button className="header-menu-link w-full text-left text-[var(--foreground)]">
                        Sign out
                      </button>
                    </form>
                  </div>
                </HeaderMenu>
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
                    adminShell
                      ? link.href
                      : withCustomerPreview(link.href, customerPreview)
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
      <main className={adminExperience ? "pt-[7.5rem]" : undefined}>
        {adminShell ? (
          <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
            <div className="admin-workspace">
              <AdminSidebar pathname={pathname} role={user?.role} />
              <div className="admin-workspace-content">{children}</div>
            </div>
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
                A modern local marketplace for trusted discovery, item posting,
                and direct conversations.
              </p>
            </div>
            <div className="marketplace-footer-muted flex flex-wrap gap-3">
              <Link href={withCustomerPreview("/search", customerPreview)}>
                Browse
              </Link>
              <Link href={withCustomerPreview("/sell", customerPreview)}>
                Sell
              </Link>
              <Link href={withCustomerPreview("/messages", customerPreview)}>
                Messages
              </Link>
              <Link href={withCustomerPreview("/profile", customerPreview)}>
                Account
              </Link>
            </div>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
