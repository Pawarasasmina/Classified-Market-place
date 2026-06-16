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
    <div className="profile-settings-metric">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
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

function ProfileSettingsNav() {
  return (
    <aside className="profile-settings-nav">
      <div className="profile-settings-nav-group">
        <div className="profile-settings-nav-heading">
          <span className="profile-settings-nav-icon">P</span>
          <strong>Profile</strong>
          <span>^</span>
        </div>
        <a href="#basic-info" className="profile-settings-nav-item profile-settings-nav-item-active">
          Basic Info
        </a>
        <a href="#seller-center" className="profile-settings-nav-item">
          Seller Profile
        </a>
      </div>
      <div className="profile-settings-nav-group">
        <div className="profile-settings-nav-heading">
          <span className="profile-settings-nav-icon">A</span>
          <strong>Account</strong>
          <span>^</span>
        </div>
        <a href="#account-settings" className="profile-settings-nav-item">
          Phone numbers
        </a>
        <a href="#security-zone" className="profile-settings-nav-item">
          Security
        </a>
      </div>
      <form action={logoutAction} className="profile-settings-nav-logout">
        <button>Sign out</button>
      </form>
    </aside>
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
    <div className="profile-settings-page">
      <h1>Profile Settings</h1>
      <div className="profile-settings-layout">
        <ProfileSettingsNav />

        <main className="profile-settings-main">
          <section id="basic-info" className="profile-settings-basic">
            <div className="profile-settings-title-row">
              <div>
                <h2>My Profile</h2>
                <p>Update your profile details here.</p>
              </div>
              <div className="profile-settings-title-links">
                <Link href="#seller-center">Go to Seller Profile</Link>
                <Link href={`/sellers/${user.id}`}>Public Profile</Link>
              </div>
            </div>
            <ProfileForm user={user} />
          </section>

          <section className="profile-settings-status-strip" aria-label="Profile status">
            <OverviewMetric
              label="Active listings"
              value={activeCount}
              detail={`${listings.length} total in your inventory`}
            />
            <OverviewMetric
              label="Boosted listings"
              value={boostedCount}
              detail="Promoted ads with extra reach"
            />
            <OverviewMetric
              label="Ratings"
              value={ratingSummary.ratingCount}
              detail={`${ratingSummary.reviewCount} written reviews`}
            />
            <OverviewMetric
              label="Readiness"
              value={`${readiness}%`}
              detail={`Seller profile ${profileStatusLabel}`}
            />
          </section>

          <section id="seller-center" className="profile-settings-panel-stack">
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

          <section id="account-settings" className="profile-settings-panel-stack">
            <SectionHeader
              eyebrow="Account settings"
              title="Public details and verification"
              description="Update the information buyers see first, then handle mobile and email verification right below it."
            />

            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
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
          </section>

          <section id="security-zone" className="profile-settings-panel-stack">
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
        </main>
      </div>
    </div>
  );
}
