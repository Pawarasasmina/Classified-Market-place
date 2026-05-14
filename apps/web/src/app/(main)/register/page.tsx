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
      <div className="panel-dark p-6">
        <p className="section-eyebrow">Create account</p>
        <h1 className="mt-3 text-3xl font-black text-white">Start buying, selling, and chatting.</h1>
        <p className="mt-2 text-[#d7d9ea]">Create an account to post listings and contact sellers.</p>
      </div>
      <div className="mt-6">
        <RegisterForm nextPath={nextPath} />
      </div>
    </div>
  );
}
