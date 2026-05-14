import type { ReactNode } from "react";
import { AdminDashboardShell } from "@/components/marketplace/admin-dashboard-shell";
import { requireAdminSession } from "@/lib/auth-dal";

export default async function AdminPanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdminSession("/admin/dashboard");
  return <AdminDashboardShell>{children}</AdminDashboardShell>;
}

