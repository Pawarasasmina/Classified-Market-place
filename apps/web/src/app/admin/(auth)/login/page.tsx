import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminLoginForm } from "@/components/marketplace/admin-login-form";
import { getSessionUser, isAdminRole } from "@/lib/auth-dal";
import { getSafeNextPath } from "@/lib/redirects";

type AdminLoginPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function AdminLoginPage(props: AdminLoginPageProps) {
  const searchParams = await props.searchParams;
  const nextPath = getSafeNextPath(searchParams.next, "/admin/dashboard");
  const user = await getSessionUser();

  if (user) {
    redirect(isAdminRole(user.role) ? nextPath : "/dashboard");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-[2.5rem] border border-[var(--line)] bg-[var(--surface)] p-8">
        <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
          Admin Login
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
          Admin Login
        </h1>
        <p className="mt-4 text-base leading-8 text-[var(--muted)]">
          Sign in with admin, super admin, or moderator credentials.
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Need access?{" "}
          <Link href="/admin/register" className="font-semibold text-[var(--brand-deep)]">
            Register as admin
          </Link>
          .
        </p>

        <AdminLoginForm nextPath={nextPath} />
      </div>
    </div>
  );
}
