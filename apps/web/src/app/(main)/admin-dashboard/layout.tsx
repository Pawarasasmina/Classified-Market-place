import type { ReactNode } from "react";
import { redirect } from "next/navigation";

export default async function AdminDashboardLayout({
  children: _children,
}: {
  children: ReactNode;
}) {
  redirect("/admin/dashboard");
}
