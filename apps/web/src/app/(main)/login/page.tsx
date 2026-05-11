import { redirect } from "next/navigation";
import { LoginForm } from "@/components/marketplace/login-form";
import { getSessionUser } from "@/lib/auth-dal";
import { getSafeNextPath } from "@/lib/redirects";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function LoginPage(props: LoginPageProps) {
  const searchParams = await props.searchParams;
  const nextPath = getSafeNextPath(searchParams.next, "/");
  const user = await getSessionUser();

  if (user) {
    redirect(nextPath);
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <div className="rounded-[2.5rem] border border-[var(--line)] bg-[rgba(255,255,255,0.88)] p-8">
        <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
          Auth foundation
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
          Sign in to continue browsing, saving, posting, and chatting.
        </h1>

        <LoginForm nextPath={nextPath} />
      </div>
    </div>
  );
}
