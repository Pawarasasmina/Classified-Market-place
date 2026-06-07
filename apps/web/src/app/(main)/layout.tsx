import type { ReactNode } from "react";
import { Suspense } from "react";
import { MarketplaceShell } from "@/components/marketplace/app-shell";
import { getSessionContext } from "@/lib/auth-dal";
import { fetchCategories } from "@/lib/marketplace-api";
import { getNotificationsApiBaseUrl } from "@/lib/notifications-api";

export default async function MainLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [session, categories] = await Promise.all([
    getSessionContext(),
    fetchCategories().catch(() => []),
  ]);

  return (
    <Suspense fallback={<main>{children}</main>}>
      <MarketplaceShell
        user={session?.user ?? null}
        categories={categories}
        accessToken={session?.accessToken ?? null}
        notificationsApiBaseUrl={getNotificationsApiBaseUrl()}
      >
        {children}
      </MarketplaceShell>
    </Suspense>
  );
}
