import Link from "next/link";
import { requireClientSession } from "@/lib/auth-dal";
import { fetchMyListings, fetchSavedListings, fetchConversations } from "@/lib/marketplace-api";

export default async function ClientDashboardPage() {
  const { accessToken, user } = await requireClientSession("/dashboard");
  const [myListings, savedListings, conversations] = await Promise.all([
    fetchMyListings(accessToken),
    fetchSavedListings(accessToken),
    fetchConversations(accessToken, user.id, { take: 8 }),
  ]);

  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:px-10">
      <div className="rounded-[2.25rem] border border-[var(--line)] bg-[var(--surface)] p-6">
        <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
          Client dashboard
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
          Welcome back, {user.displayName}.
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
          Manage your listings, saved items, messages, profile, and account settings from here.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">My listings</p>
          <p className="mt-2 text-3xl font-bold text-[var(--foreground)]">{myListings.length}</p>
        </div>
        <div className="rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Saved items</p>
          <p className="mt-2 text-3xl font-bold text-[var(--foreground)]">{savedListings.length}</p>
        </div>
        <div className="rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Messages</p>
          <p className="mt-2 text-3xl font-bold text-[var(--foreground)]">{conversations.length}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[
          { href: "/my-listings", label: "My listings" },
          { href: "/saved", label: "Saved items" },
          { href: "/messages", label: "Messages" },
          { href: "/profile", label: "My profile" },
          { href: "/verify", label: "Notifications / verification" },
          { href: "/profile", label: "Account settings" },
        ].map((item) => (
          <Link
            key={item.href + item.label}
            href={item.href}
            className="rounded-[1.4rem] border border-[var(--line)] bg-[var(--surface)] px-4 py-4 text-sm font-semibold text-[var(--foreground)]"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

