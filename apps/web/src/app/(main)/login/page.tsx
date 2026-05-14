import { redirect } from "next/navigation";
import { LoginForm } from "@/components/marketplace/login-form";
import { getSessionUser } from "@/lib/auth-dal";
import { getPostAuthPath, getSafeNextPath } from "@/lib/redirects";

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
    redirect(getPostAuthPath(user, nextPath));
  }

  const adminLogin = nextPath.startsWith("/admin");

  return (
    <div className={`page max-w-3xl ${adminLogin ? "admin-login-page" : ""}`}>
      <div className={adminLogin ? "panel p-6" : "panel-dark p-6"}>
        <p className="section-eyebrow">
          {adminLogin ? "Admin access" : "Account access"}
        </p>
        <h1
          className={`mt-3 text-3xl font-black ${
            adminLogin ? "text-[var(--foreground)]" : "text-white"
          }`}
        >
          {adminLogin ? "Admin sign in" : "Sign in to SmartMarket."}
        </h1>
        <p className={adminLogin ? "mt-2 text-[var(--muted)]" : "mt-2 text-[#d7d9ea]"}>
          {adminLogin
            ? "Use your admin account to manage categories, listings, and support."
            : "Continue to messages, selling tools, saved items, and your profile."}
        </p>
      </div>
      <div className="mt-6">
        <LoginForm nextPath={nextPath} adminMode={adminLogin} />
      </div>
    </div>
  );
}
