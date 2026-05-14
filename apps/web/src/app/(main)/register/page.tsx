import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/marketplace/register-form";
import { getSessionUser } from "@/lib/auth-dal";
import { getSafeNextPath } from "@/lib/redirects";
import { isAdminRole } from "@/lib/roles";

type RegisterPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function RegisterPage(props: RegisterPageProps) {
  const searchParams = await props.searchParams;
  const nextPath = getSafeNextPath(searchParams.next, "/dashboard");
  const user = await getSessionUser();

  if (user) {
    redirect(isAdminRole(user.role) ? "/admin/dashboard" : nextPath);
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <div className="rounded-[2.5rem] border border-[var(--line)] bg-[rgba(255,255,255,0.88)] p-8">
        <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
          Registration
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
          Create a marketplace account with email, phone, and role basics.
        </h1>

        <RegisterForm nextPath={nextPath} />
      </div>
    </div>
  );
}
