import { redirect } from "next/navigation";
import { AdminRegisterForm } from "@/components/marketplace/admin-register-form";
import { getSessionUser, isAdminRole } from "@/lib/auth-dal";
import { getSafeNextPath } from "@/lib/redirects";

type AdminRegisterPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function AdminRegisterPage(props: AdminRegisterPageProps) {
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
          Admin Registration
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
          Register as Admin
        </h1>
        <p className="mt-4 text-base leading-8 text-[var(--muted)]">
          Register with a valid admin invite code to access admin operations.
        </p>

        <AdminRegisterForm nextPath={nextPath} />
      </div>
    </div>
  );
}
