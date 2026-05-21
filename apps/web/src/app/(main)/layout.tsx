import type { ReactNode } from "react";
import { Suspense } from "react";
import { MarketplaceShell } from "@/components/marketplace/app-shell";
import { getSessionContext } from "@/lib/auth-dal";
import { getNotificationsApiBaseUrl } from "@/lib/notifications-api";

export default async function MainLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSessionContext();

  return (
    <Suspense fallback={<main>{children}</main>}>
      <MarketplaceShell
        user={session?.user ?? null}
        accessToken={session?.accessToken ?? null}
        notificationsApiBaseUrl={getNotificationsApiBaseUrl()}
      >
        {children}
      </MarketplaceShell>
    </Suspense>
  );
}
