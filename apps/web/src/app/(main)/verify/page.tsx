import { redirect } from "next/navigation";
import { VerifyForm } from "@/components/marketplace/verify-form";
import { requireSessionContext } from "@/lib/auth-dal";
import { getSafeNextPath } from "@/lib/redirects";

type VerifyPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function VerifyPage(props: VerifyPageProps) {
  const searchParams = await props.searchParams;
  const nextPath = getSafeNextPath(searchParams.next, "/sell");
  const { user } = await requireSessionContext("/verify");

  if (user.phoneVerified) {
    redirect(nextPath);
  }

  return (
    <div className="page max-w-3xl">
      <div className="panel-dark p-6">
        <p className="section-eyebrow">OTP verification</p>
        <h1 className="mt-3 text-3xl font-black text-white">
          Verify your phone before listing creation.
        </h1>
        <p className="mt-4 text-base leading-8 text-[#d7d9ea]">
          Phone verification protects buyers and sellers before a listing goes live.
        </p>
      </div>

      <div className="mt-6 panel">
        <VerifyForm nextPath={nextPath} initialPhone={user.phone ?? ""} />
      </div>
    </div>
  );
}
