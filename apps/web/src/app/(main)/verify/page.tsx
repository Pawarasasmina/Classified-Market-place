import { redirect } from "next/navigation";
import { VerifyForm } from "@/components/marketplace/verify-form";
import { requireClientSession } from "@/lib/auth-dal";
import { getSafeNextPath } from "@/lib/redirects";

type VerifyPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function VerifyPage(props: VerifyPageProps) {
  const searchParams = await props.searchParams;
  const nextPath = getSafeNextPath(searchParams.next, "/sell");
  const { user } = await requireClientSession("/verify");

  if (user.phoneVerified) {
    redirect(nextPath);
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <div className="rounded-[2.5rem] border border-[var(--line)] bg-[rgba(255,255,255,0.88)] p-8">
        <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
          OTP verification
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
          Phone verification required before listing creation.
        </h1>
        <p className="mt-4 text-base leading-8 text-[var(--muted)]">
          The TRD marks phone OTP as mandatory for listing creation. This screen
          now verifies against the backend phone endpoint before sending you back
          into the posting flow.
        </p>

        <VerifyForm nextPath={nextPath} initialPhone={user.phone ?? ""} />
      </div>
    </div>
  );
}
