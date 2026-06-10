import Link from "next/link";
import { logoutAction } from "@/app/(main)/actions";
import {
  ChangePasswordForm,
  DeactivateAccountForm,
  EmailVerificationPanel,
  PhoneVerificationPanel,
  ProfileForm,
} from "@/components/marketplace/profile-form";
import { SellerOnboardingPanel } from "@/components/marketplace/seller-onboarding-panel";
import { SellerRatingSummary } from "@/components/marketplace/seller-rating-summary";
import {
  SellerProfileStatusPanel,
  SellerRatingsAndReviewsPanel,
  SellerTierUpgradesPanel,
} from "@/components/marketplace/seller-workspace-panels";
import { requireSessionContext } from "@/lib/auth-dal";
import {
  fetchMyListings,
  fetchMySellerProfile,
  fetchMySellerPrivileges,
  fetchReceivedSellerRatings,
  fetchSellerRatingSummary,
} from "@/lib/marketplace-api";

function getSellerProfileStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "APPROVED":
      return "Approved";
    case "PENDING":
      return "Pending review";
    case "REJECTED":
      return "Needs updates";
    case "SUSPENDED":
      return "Suspended";
    case "DRAFT":
      return "Draft";
    default:
      return "Not started";
  }
}

function getAccountReadiness({
  emailVerified,
  hasAvatar,
  hasLocation,
  hasPhone,
  phoneVerified,
}: {
  emailVerified: boolean;
  hasAvatar: boolean;
  hasLocation: boolean;
  hasPhone: boolean;
  phoneVerified: boolean;
}) {
  const checks = [
    emailVerified,
    hasAvatar,
    hasLocation,
    hasPhone,
    phoneVerified,
  ];
  const complete = checks.filter(Boolean).length;

  return Math.round((complete / checks.length) * 100);
}

function OverviewMetric({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[1.4rem] border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.08)] p-4 backdrop-blur-sm">
      <p className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-[#d7d9ea]">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm text-[#d7d9ea]">{detail}</p>
    </div>
  );
}

function SidebarChecklistItem({
  complete,
  label,
  value,
}: {
  complete: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3">
      <div>
        <p className="text-sm font-bold text-[var(--foreground)]">{label}</p>
        <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{value}</p>
      </div>
      <span
        className={`rounded-full px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-[0.18em] ${
          complete
            ? "bg-[rgba(31,122,95,0.12)] text-[var(--success)]"
            : "bg-[var(--surface)] text-[var(--muted)]"
        }`}
      >
        {complete ? "Ready" : "Open"}
      </span>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div>
      <p className="section-eyebrow">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-black text-[var(--foreground)]">
        {title}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
        {description}
      </p>
    </div>
  );
}

export default async function ProfilePage() {
  const { accessToken, user } = await requireSessionContext("/profile");
  const [
    listings,
    ratingSummary,
    sellerProfileEnvelope,
    privilegeTiers,
    receivedRatings,
  ] = await Promise.all([
    fetchMyListings(accessToken),
    fetchSellerRatingSummary(user.id),
    fetchMySellerProfile(accessToken).catch(() => ({
      sellerProfile: null,
      formDefinition: { fields: [] },
    })),
    fetchMySellerPrivileges(accessToken).catch(() => []),
    fetchReceivedSellerRatings(accessToken).catch(() => []),
  ]);

  const activeCount = listings.filter(
    (listing) => listing.status === "Active",
  ).length;
  const boostedCount = listings.filter((listing) => listing.isBoosted).length;
  const readiness = getAccountReadiness({
    emailVerified: user.emailVerified,
    hasAvatar: Boolean(user.avatarUrl),
    hasLocation: Boolean(user.location),
    hasPhone: Boolean(user.phone),
    phoneVerified: user.phoneVerified,
  });
  const currentPrivilegeTierId =
    sellerProfileEnvelope.sellerProfile?.privilegeTier?.id ?? null;
  const currentPrivilegeSortOrder =
    sellerProfileEnvelope.sellerProfile?.privilegeTier?.sortOrder ?? -1;
  const upgradeOptions = privilegeTiers.filter(
    (tier) =>
      tier.isActive &&
      tier.id !== currentPrivilegeTierId &&
      tier.sortOrder > currentPrivilegeSortOrder,
  );
  const profileStatusLabel = getSellerProfileStatusLabel(
    user.sellerProfileStatus,
  );

  return (
    <div className="page grid gap-6">
      <section className="panel-dark overflow-hidden p-0">
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.2fr)_22rem] lg:p-8">
          <div className="grid gap-6">
            <div className="flex flex-wrap items-start gap-5">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[1.8rem] border border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.12)] text-3xl font-black text-white shadow-[0_18px_50px_rgba(15,23,42,0.26)]">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  user.displayName.charAt(0).toUpperCase()
                )}
              </div>

              <div className="max-w-2xl">
                <p className="section-eyebrow">Profile hub</p>
                <h1 className="mt-2 text-4xl font-black tracking-tight text-white sm:text-5xl">
                  {user.displayName}
                </h1>
                <p className="mt-3 text-base leading-7 text-[#d7d9ea]">
                  One clean place to manage your personal details, seller
                  reputation, verification progress, and account security.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.1)] px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white">
                    {user.role}
                  </span>
                  <span className="rounded-full border border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.1)] px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white">
                    Seller profile {profileStatusLabel}
                  </span>
                  <span className="rounded-full border border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.1)] px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white">
                    Account readiness {readiness}%
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <OverviewMetric
                label="Active listings"
                value={activeCount}
                detail={`${listings.length} total in your inventory`}
              />
              <OverviewMetric
                label="Boosted listings"
                value={boostedCount}
                detail="Promoted inventory currently getting extra reach"
              />
              <OverviewMetric
                label="Ratings"
                value={ratingSummary.ratingCount}
                detail={`${ratingSummary.reviewCount} written reviews received`}
              />
              <OverviewMetric
                label="Reputation"
                value={ratingSummary.reputationScore}
                detail="Marketplace trust signal from ratings and activity"
              />
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.08)] p-5 backdrop-blur-sm">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-[#d7d9ea]">
              Quick access
            </p>
            <div className="mt-4 grid gap-3">
              <Link
                href="/my-listings"
                className="rounded-2xl border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.08)] px-4 py-3 text-sm font-bold text-white transition hover:bg-[rgba(255,255,255,0.12)]"
              >
                Manage listings
              </Link>
              <Link
                href="/wallet"
                className="rounded-2xl border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.08)] px-4 py-3 text-sm font-bold text-white transition hover:bg-[rgba(255,255,255,0.12)]"
              >
                Open wallet
              </Link>
              <Link
                href="/profile/sessions"
                className="rounded-2xl border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.08)] px-4 py-3 text-sm font-bold text-white transition hover:bg-[rgba(255,255,255,0.12)]"
              >
                Device sessions
              </Link>
            </div>

            <div className="mt-5 rounded-2xl border border-[rgba(255,255,255,0.14)] bg-[rgba(6,10,24,0.22)] p-4">
              <p className="text-sm font-bold text-white">Marketplace profile</p>
              <p className="mt-2 text-sm leading-6 text-[#d7d9ea]">
                Keep your public details polished so buyers can trust your
                listings and contact you with confidence.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="grid h-fit gap-4 xl:sticky xl:top-24">
          <section className="panel">
            <div className="flex items-center gap-4">
              <div className="flex h-18 w-18 items-center justify-center overflow-hidden rounded-2xl bg-[var(--surface-strong)] text-2xl font-black">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  user.displayName.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <h2 className="text-xl font-black text-[var(--foreground)]">
                  {user.displayName}
                </h2>
                <p className="text-sm text-[var(--muted)]">{user.email}</p>
                <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">
                  {user.role}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-[var(--foreground)]">
                  Account readiness
                </p>
                <span className="text-lg font-black text-[var(--foreground)]">
                  {readiness}%
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface)]">
                <div
                  className="h-full rounded-full bg-[var(--brand)]"
                  style={{ width: `${readiness}%` }}
                />
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                Complete the checks below to keep your profile strong for
                buying, selling, and verification.
              </p>
            </div>
          </section>

          <section className="panel grid gap-3">
            <div>
              <p className="section-eyebrow">Checklist</p>
              <h2 className="mt-2 text-2xl font-black text-[var(--foreground)]">
                Profile essentials
              </h2>
            </div>
            <SidebarChecklistItem
              label="Email verification"
              value={user.emailVerified ? "Verified for login and alerts" : "Needs email confirmation"}
              complete={user.emailVerified}
            />
            <SidebarChecklistItem
              label="Mobile verification"
              value={
                user.phone
                  ? user.phoneVerified
                    ? `${user.phone} verified`
                    : `${user.phone} needs verification`
                  : "Add a mobile number first"
              }
              complete={Boolean(user.phone) && user.phoneVerified}
            />
            <SidebarChecklistItem
              label="Public profile"
              value={
                user.location
                  ? `Location set to ${user.location}`
                  : "Location not added yet"
              }
              complete={Boolean(user.location && user.bio)}
            />
            <SidebarChecklistItem
              label="Seller onboarding"
              value={`Status: ${profileStatusLabel}`}
              complete={user.sellerProfileStatus === "APPROVED"}
            />
          </section>

          <section className="panel grid gap-3">
            <div>
              <p className="section-eyebrow">Navigation</p>
              <h2 className="mt-2 text-xl font-black text-[var(--foreground)]">
                Jump faster
              </h2>
            </div>
            <div className="grid gap-2">
              {[
                ["#seller-center", "Seller center"],
                ["#account-settings", "Account settings"],
                ["#security-zone", "Security zone"],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-bold text-[var(--foreground)] transition hover:border-[var(--brand)] hover:text-[var(--brand-strong)]"
                >
                  {label}
                </a>
              ))}
            </div>
            <form action={logoutAction}>
              <button className="action-secondary w-full px-4 py-3 text-sm font-bold">
                Sign out
              </button>
            </form>
          </section>
        </aside>

        <div className="grid gap-6">
          <section id="seller-center" className="grid gap-4">
            <SectionHeader
              eyebrow="Seller center"
              title="Seller visibility and trust"
              description="Your public seller identity, tier growth, and reviews are grouped here so you can manage marketplace credibility without hunting through account settings."
            />
            <SellerProfileStatusPanel
              activeCount={activeCount}
              boostedCount={boostedCount}
              listingsCount={listings.length}
              ratingSummary={ratingSummary}
              receivedReviewCount={receivedRatings.length}
              user={user}
            />
            <SellerTierUpgradesPanel
              currentTierName={
                sellerProfileEnvelope.sellerProfile?.privilegeTier?.name ?? "Free"
              }
              returnTo="/profile"
              upgradeOptions={upgradeOptions}
            />
            <SellerRatingsAndReviewsPanel
              ratingSummary={ratingSummary}
              reviews={receivedRatings}
            />
            {sellerProfileEnvelope.sellerProfile?.status !== "APPROVED" ? (
              <SellerOnboardingPanel
                envelope={sellerProfileEnvelope}
                returnTo="/profile"
                title="Complete seller onboarding"
              />
            ) : null}
          </section>

          <section id="account-settings" className="grid gap-4">
            <SectionHeader
              eyebrow="Account settings"
              title="Public details and verification"
              description="Update the information buyers see first, then handle mobile and email verification right below it."
            />

            <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <ProfileForm user={user} />

              <div className="grid gap-4">
                <section className="panel grid gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="section-eyebrow">Identity snapshot</p>
                      <h2 className="mt-2 text-2xl font-black text-[var(--foreground)]">
                        Buyer-facing preview
                      </h2>
                    </div>
                    <SellerRatingSummary
                      averageRating={ratingSummary.averageRating}
                      ratingCount={ratingSummary.ratingCount}
                      reviewCount={ratingSummary.reviewCount}
                    />
                  </div>
                  <div className="grid gap-3">
                    {[
                      ["Display name", user.displayName],
                      ["Email", user.email],
                      ["Mobile", user.phone ?? "Not added"],
                      ["Location", user.location ?? "Not added"],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3"
                      >
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--muted)]">
                          {label}
                        </p>
                        <p className="mt-2 text-sm font-bold text-[var(--foreground)]">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <PhoneVerificationPanel
                  phone={user.phone}
                  verified={user.phoneVerified}
                />
                <EmailVerificationPanel verified={user.emailVerified} />
              </div>
            </div>
          </section>

          <section id="security-zone" className="grid gap-4">
            <SectionHeader
              eyebrow="Security zone"
              title="Protect your account"
              description="Session control, password management, and account removal live together here to keep higher-risk actions separate from normal profile editing."
            />

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="grid gap-4">
                <ChangePasswordForm />
                <section className="panel grid gap-4">
                  <div>
                    <p className="section-eyebrow">Sessions</p>
                    <h2 className="mt-2 text-2xl font-black text-[var(--foreground)]">
                      Active devices
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      Review where your account is signed in and close sessions
                      you no longer trust.
                    </p>
                  </div>
                  <Link
                    href="/profile/sessions"
                    className="action-secondary w-fit px-5 py-3 text-sm font-bold"
                  >
                    Open sessions manager
                  </Link>
                </section>
              </div>

              <DeactivateAccountForm />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
