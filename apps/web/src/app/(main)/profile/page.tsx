import { currentUser } from "@/lib/phase1-data";

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:px-10">
      <div className="grid gap-8 xl:grid-cols-[0.34fr_0.66fr]">
        <aside className="rounded-[2.25rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)] p-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-[linear-gradient(135deg,#d95d39,#1f6b5a)] text-2xl font-bold text-white">
            {currentUser.avatar}
          </div>
          <h1 className="mt-5 text-3xl font-bold text-[var(--foreground)]">
            {currentUser.name}
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{currentUser.bio}</p>

          <div className="mt-6 grid gap-3">
            {[
              currentUser.joinedLabel,
              `${currentUser.responseRate} response rate`,
              `${currentUser.totalListings} listings`,
              currentUser.location,
            ].map((item) => (
              <div
                key={item}
                className="rounded-[1.25rem] border border-[var(--line)] bg-[rgba(255,250,244,0.75)] px-4 py-3 text-sm text-[var(--muted)]"
              >
                {item}
              </div>
            ))}
          </div>
        </aside>

        <section className="rounded-[2.25rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)] p-6">
          <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
            Profile CRUD placeholder
          </p>
          <h2 className="mt-3 text-3xl font-bold text-[var(--foreground)]">
            Seller profile basics and verification status fields for Sprint 2.
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              ["Display name", currentUser.name],
              ["Email", "you@example.com"],
              ["Phone", "+971 55 000 0000"],
              ["Verification", currentUser.verified ? "Verified" : "Pending"],
            ].map(([label, value]) => (
              <label
                key={label}
                className="space-y-2 rounded-[1.5rem] border border-[var(--line)] bg-white p-4"
              >
                <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  {label}
                </span>
                <input
                  defaultValue={value}
                  className="w-full bg-transparent text-sm font-semibold text-[var(--foreground)] outline-none"
                />
              </label>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
