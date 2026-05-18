import type { ReactNode } from "react";
import { Suspense } from "react";
import { MarketplaceShell } from "@/components/marketplace/app-shell";
import { getSessionUser } from "@/lib/auth-dal";
import { fetchCategories } from "@/lib/marketplace-api";

export default async function MainLayout({ children }: { children: ReactNode }) {
  const [user, categories] = await Promise.all([
    getSessionUser(),
    fetchCategories().catch(() => []),
  ]);

  return (
    <Suspense fallback={<main>{children}</main>}>
      <MarketplaceShell user={user} categories={categories}>
        {children}
      </MarketplaceShell>
    </Suspense>
  );
}
