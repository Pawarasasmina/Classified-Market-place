import Link from "next/link";
import { logoutAction } from "@/app/(main)/actions";
import { ProfileForm } from "@/components/marketplace/profile-form";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchMyListings } from "@/lib/marketplace-api";

export default async function ProfilePage() {
  const { accessToken, user } = await requireSessionContext("/profile");
  const listings = await fetchMyListings(accessToken);

  return (
    <div className="page grid gap-6 lg:grid-cols-[1fr_2fr]">
      <aside className="panel h-fit">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-2xl font-bold">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              user.displayName.charAt(0)
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold">{user.displayName}</h1>
            <p className="text-sm text-slate-600">{user.email}</p>
            <p className="mt-1 text-xs font-semibold uppercase text-slate-500">{user.role}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 text-sm">
          <p>Total listings: {listings.length}</p>
          <p>Phone: {user.phone ?? "Not added"}</p>
          <p>Location: {user.location ?? "Not added"}</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/my-listings" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold">
            Dashboard
          </Link>
          <form action={logoutAction}>
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <section className="grid gap-4">
        <div>
          <h2 className="text-2xl font-bold">Profile</h2>
          <p className="mt-2 text-slate-600">Update your public seller information and avatar.</p>
        </div>
        <ProfileForm user={user} />
      </section>
    </div>
  );
}
