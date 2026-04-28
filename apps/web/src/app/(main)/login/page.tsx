import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <div className="rounded-[2.5rem] border border-[var(--line)] bg-[rgba(255,255,255,0.88)] p-8">
        <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
          Auth foundation
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
          Sign in to continue browsing, saving, posting, and chatting.
        </h1>

        <div className="mt-8 grid gap-4">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-[var(--foreground)]">
              Email
            </span>
            <input
              className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
              defaultValue="you@example.com"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-[var(--foreground)]">
              Password
            </span>
            <input
              type="password"
              className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
              defaultValue="phase1-demo"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/verify"
            className="rounded-full bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-[var(--surface)]"
          >
            Continue to OTP
          </Link>
          <button
            type="button"
            className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold text-[var(--foreground)]"
          >
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}
