import Link from "next/link";
import { logoutAction } from "@/app/(main)/actions";
import { ProfileForm } from "@/components/marketplace/profile-form";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchMyListings } from "@/lib/marketplace-api";

export default async function ProfilePage() {
  const { accessToken, user } = await requireSessionContext("/profile");
  const listings = await fetchMyListings(accessToken);

  return (
    <div className="page grid gap-6 lg:grid-cols-[22rem_1fr]">
      <aside className="panel h-fit">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md bg-[var(--surface-strong)] text-2xl font-black">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              user.displayName.charAt(0)
            )}
          </div>
          <div>
            <h1 className="text-xl font-black">{user.displayName}</h1>
            <p className="text-sm text-[var(--muted)]">{user.email}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[var(--accent)]">{user.role}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 text-sm text-[var(--muted)]">
          <p><span className="font-bold text-[var(--foreground)]">Listings:</span> {listings.length}</p>
          <p><span className="font-bold text-[var(--foreground)]">Phone:</span> {user.phone ?? "Not added"}</p>
          <p><span className="font-bold text-[var(--foreground)]">Location:</span> {user.location ?? "Not added"}</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/my-listings" className="action-secondary px-3 py-2 text-sm font-bold">
            My listings
          </Link>
          <form action={logoutAction}>
            <button className="action-secondary px-3 py-2 text-sm font-bold">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <section className="grid gap-4">
        <div>
          <p className="section-eyebrow">Customer account</p>
          <h2 className="mt-2 text-3xl font-black">Profile</h2>
          <p className="mt-2 text-[var(--muted)]">Update your public seller information and avatar.</p>
        </div>
        <ProfileForm user={user} />
      </section>
    </div>
  );
}
