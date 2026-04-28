import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <div className="rounded-[2.5rem] border border-[var(--line)] bg-[rgba(255,255,255,0.88)] p-8">
        <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
          Registration
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
          Create a marketplace account with email, phone, and role basics.
        </h1>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[
            ["Full name", "Your full name"],
            ["Email", "name@example.com"],
            ["Phone", "+971 55 000 0000"],
            ["Role", "buyer / business"],
          ].map(([label, placeholder]) => (
            <label key={label} className="space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">
                {label}
              </span>
              <input
                placeholder={placeholder}
                className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
              />
            </label>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/verify"
            className="rounded-full bg-[linear-gradient(135deg,#d95d39,#f08a49)] px-5 py-3 text-sm font-semibold text-white"
          >
            Create account and verify
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold text-[var(--foreground)]"
          >
            Already have an account
          </Link>
        </div>
      </div>
    </div>
  );
}
