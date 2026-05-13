import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/marketplace/register-form";
import { getSessionUser } from "@/lib/auth-dal";
import { getSafeNextPath } from "@/lib/redirects";

type RegisterPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function RegisterPage(props: RegisterPageProps) {
  const searchParams = await props.searchParams;
  const nextPath = getSafeNextPath(searchParams.next, "/sell");
  const user = await getSessionUser();

  if (user) {
    redirect(nextPath);
  }

  return (
    <div className="page max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Register</h1>
        <p className="mt-2 text-slate-600">Create an account to post listings and chat.</p>
        <RegisterForm nextPath={nextPath} />
      </div>
    </div>
  );
}
