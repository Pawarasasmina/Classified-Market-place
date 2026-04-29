import type { ReactNode } from "react";
import { MarketplaceShell } from "@/components/marketplace/app-shell";
import { getSessionUser } from "@/lib/auth-dal";

export default async function MainLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  return <MarketplaceShell user={user}>{children}</MarketplaceShell>;
}
