import Link from "next/link";
import { EmailVerificationAutoLogin } from "@/components/marketplace/email-verification-auto-login";
import {
  EmailVerificationPanel,
  PublicEmailVerificationPanel,
} from "@/components/marketplace/profile-form";
import { getSessionUser } from "@/lib/auth-dal";
import { getSafeNextPath } from "@/lib/redirects";

type VerifyEmailPageProps = {
  searchParams: Promise<{
    token?: string;
    next?: string;
    preview?: string;
    email?: string;
    registered?: string;
  }>;
};

export default async function VerifyEmailPage(props: VerifyEmailPageProps) {
  const searchParams = await props.searchParams;
  const nextPath = getSafeNextPath(searchParams.next, "/my-listings");
  const user = await getSessionUser();

  return (
    <div className="page max-w-3xl">
      <div className="panel-dark p-6">
        <p className="section-eyebrow">Email verification</p>
        <h1 className="mt-3 text-3xl font-black text-white">Verify your email.</h1>
        <p className="mt-2 text-[#d7d9ea]">
          Check your inbox for the verification link. Dev mode can also show the link directly.
        </p>
      </div>

      <div className="mt-6 grid gap-4">
        {searchParams.token ? (
          <EmailVerificationAutoLogin
            token={searchParams.token}
            nextPath={nextPath}
          />
        ) : searchParams.preview ? (
          <div className="panel text-sm text-[var(--muted)]">
            Dev verification link: {searchParams.preview}
          </div>
        ) : null}

        {!searchParams.token && searchParams.registered ? (
          <div className="panel">
            <p className="text-sm font-semibold text-[var(--muted)]">
              We sent a verification email
              {searchParams.email ? ` to ${searchParams.email}` : ""}. Open that
              link to verify your account. After verification, we will sign you in
              automatically.
            </p>
            <Link
              href="/login"
              className="action-secondary mt-4 inline-flex px-5 py-3 text-sm font-bold"
            >
              Back to sign in
            </Link>
          </div>
        ) : null}

        {!searchParams.token && searchParams.email && !user ? (
          <PublicEmailVerificationPanel email={searchParams.email} />
        ) : !searchParams.token && user ? (
          <EmailVerificationPanel verified={user.emailVerified} />
        ) : !searchParams.token ? (
          <div className="panel text-sm text-[var(--muted)]">
            Open the verification link from your email to finish signing in.
          </div>
        ) : null}
      </div>
    </div>
  );
}
