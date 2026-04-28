import Link from "next/link";

export default function VerifyPage() {
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
          anchors that checkpoint in the Phase 1 onboarding flow.
        </p>

        <div className="mt-8 flex gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <input
              key={index}
              maxLength={1}
              defaultValue={index === 0 ? "8" : ""}
              className="h-14 w-14 rounded-2xl border border-[var(--line)] bg-white text-center text-lg font-bold outline-none"
            />
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/sell"
            className="rounded-full bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-[var(--surface)]"
          >
            Verification complete
          </Link>
          <button
            type="button"
            className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold text-[var(--foreground)]"
          >
            Resend code
          </button>
        </div>
      </div>
    </div>
  );
}
