import type { ReactNode } from "react";
import { MarketplaceShell } from "@/components/marketplace/app-shell";

export default function MainLayout({ children }: { children: ReactNode }) {
  return <MarketplaceShell>{children}</MarketplaceShell>;
}
