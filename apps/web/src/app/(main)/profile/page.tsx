import Link from "next/link";
import { logoutAction } from "@/app/(main)/actions";
import {
  ChangePasswordForm,
  DeactivateAccountForm,
  EmailVerificationPanel,
  PhoneVerificationPanel,
  ProfileForm,
} from "@/components/marketplace/profile-form";
import { SellerRatingSummary } from "@/components/marketplace/seller-rating-summary";
import { requireSessionContext } from "@/lib/auth-dal";
import {
  fetchMyListings,
  fetchSellerRatingSummary,
} from "@/lib/marketplace-api";

export default async function ProfilePage() {
  const { accessToken, user } = await requireSessionContext("/profile");
  const [listings, ratingSummary] = await Promise.all([
    fetchMyListings(accessToken),
    fetchSellerRatingSummary(user.id),
  ]);

  return (
    <div className="page grid gap-6 lg:grid-cols-[22rem_1fr]">
      <aside className="panel h-fit">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md bg-[var(--surface-strong)] text-2xl font-black">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              user.displayName.charAt(0)
            )}
          </div>
          <div>
            <h1 className="text-xl font-black">{user.displayName}</h1>
            <p className="text-sm text-[var(--muted)]">{user.email}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[var(--accent)]">
              {user.role}
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 text-sm text-[var(--muted)]">
          <p>
            <span className="font-bold text-[var(--foreground)]">
              Listings:
            </span>{" "}
            {listings.length}
          </p>
          <p>
            <span className="font-bold text-[var(--foreground)]">Mobile:</span>{" "}
            {user.phone ?? "Not added"}
          </p>
          <p>
            <span className="font-bold text-[var(--foreground)]">
              Mobile status:
            </span>{" "}
            <span
              className={
                user.phoneVerified ? "text-[var(--success)]" : "text-[#b93820]"
              }
            >
              {user.phoneVerified ? "Verified" : "Not verified"}
            </span>
          </p>
          <p>
            <span className="font-bold text-[var(--foreground)]">
              Email status:
            </span>{" "}
            <span
              className={
                user.emailVerified ? "text-[var(--success)]" : "text-[#b93820]"
              }
            >
              {user.emailVerified ? "Verified" : "Not verified"}
            </span>
          </p>
          <p>
            <span className="font-bold text-[var(--foreground)]">
              Location:
            </span>{" "}
            {user.location ?? "Not added"}
          </p>
          <SellerRatingSummary
            averageRating={ratingSummary.averageRating}
            ratingCount={ratingSummary.ratingCount}
            reviewCount={ratingSummary.reviewCount}
          />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/my-listings"
            className="action-secondary px-3 py-2 text-sm font-bold"
          >
            My listings
          </Link>
          <Link
            href="/profile/sessions"
            className="action-secondary px-3 py-2 text-sm font-bold"
          >
            Sessions
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
          <p className="mt-2 text-[var(--muted)]">
            Update your public profile and avatar for buying, selling, and chat.
          </p>
        </div>
        <ProfileForm user={user} />
        <PhoneVerificationPanel
          phone={user.phone}
          verified={user.phoneVerified}
        />
        <EmailVerificationPanel verified={user.emailVerified} />
        <ChangePasswordForm />
        <DeactivateAccountForm />
      </section>
    </div>
  );
}
