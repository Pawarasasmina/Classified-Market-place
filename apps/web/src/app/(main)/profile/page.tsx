import Image from "next/image";
import Link from "next/link";
import { logoutAction } from "@/app/(main)/actions";
import { ProfileForm } from "@/components/marketplace/profile-form";
import { requireClientSession } from "@/lib/auth-dal";
import { getListingMedia } from "@/lib/listing-media";
import { fetchMyListings } from "@/lib/marketplace-api";

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatJoinedLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Member recently"
    : `Member since ${date.getFullYear()}`;
}

function formatRole(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export default async function ProfilePage() {
  const { accessToken, user } = await requireClientSession("/profile");
  const myListings = await fetchMyListings(accessToken);
  const activeListings = myListings.filter((listing) => listing.status === "Active");
  const draftListings = myListings.filter((listing) => listing.status === "Draft");
  const featuredListings = myListings.slice(0, 3);

  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:px-10">
      <div className="grid gap-8 xl:grid-cols-[0.31fr_0.69fr]">
        <aside className="space-y-6">
          <section className="overflow-hidden rounded-[2.25rem] border border-[var(--line)] bg-[var(--surface)]">
            <div className="bg-[var(--surface-strong)] px-6 pb-10 pt-6 text-[var(--foreground)]">
              <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
                Account overview
              </p>
              <div className="mt-6 flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-[var(--chip-bg)] text-2xl font-bold">
                  {getInitials(user.displayName)}
                </div>
                <div>
                  <h1 className="text-3xl font-bold">{user.displayName}</h1>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {user.email}
                  </p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    {formatRole(user.role)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 p-6">
              {[
                formatJoinedLabel(user.createdAt),
                user.phoneVerified ? "Phone verified" : "Phone verification pending",
                "Email used for sign-in",
                `${user.reputationScore} reputation score`,
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--muted)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6">
            <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
              Marketplace health
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {[
                { label: "Total listings", value: String(myListings.length) },
                { label: "Active listings", value: String(activeListings.length) },
                { label: "Draft listings", value: String(draftListings.length) },
                {
                  label: "Verification",
                  value: user.phoneVerified ? "Ready to sell" : "Action needed",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-4"
                >
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-xl font-bold text-[var(--foreground)]">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6">
            <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
              Quick actions
            </p>
            <div className="mt-4 grid gap-3">
              {[
                { href: "/sell", label: "Create a new listing" },
                { href: "/my-listings", label: "Manage my listings" },
                { href: "/messages", label: "Open messages" },
                { href: "/saved", label: "Review saved items" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-[1.35rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-4 text-sm font-semibold text-[var(--foreground)]"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </section>
        </aside>

        <div className="space-y-8">
          <section className="rounded-[2.25rem] border border-[var(--line)] bg-[var(--surface)] p-6">
            <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
              Profile settings
            </p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold text-[var(--foreground)]">
                  Keep your seller identity accurate and verified.
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                  This page is connected to the live user API, so edits here update
                  the same account used for posting, verification, and listing
                  ownership.
                </p>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-5 py-3 text-sm font-semibold text-[var(--foreground)]"
                >
                  Sign out
                </button>
              </form>
            </div>
            <ProfileForm user={user} />
          </section>

          <section className="grid gap-6 lg:grid-cols-[0.56fr_0.44fr]">
            <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
                    Recent listings
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-[var(--foreground)]">
                    What buyers will see from your account.
                  </h3>
                </div>
                <Link href="/my-listings" className="text-sm font-semibold text-[var(--accent)]">
                  View all
                </Link>
              </div>

              <div className="mt-5 grid gap-4">
                {featuredListings.length ? (
                  featuredListings.map((listing) => {
                    const media = getListingMedia(listing);

                    return (
                      <Link
                        key={listing.id}
                        href={`/listings/${listing.id}`}
                        className="grid gap-4 rounded-[1.6rem] border border-[var(--line)] bg-[var(--surface-strong)] p-4 md:grid-cols-[0.28fr_0.72fr]"
                      >
                        <div className="relative h-32 overflow-hidden rounded-[1.35rem]">
                          <Image
                            src={media.src}
                            alt={media.alt}
                            fill
                            unoptimized
                            sizes="(max-width: 768px) 100vw, 18vw"
                            className="object-cover"
                          />
                          <div
                            className="absolute inset-0"
                            style={{ background: media.overlay }}
                          />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-lg font-bold text-[var(--foreground)]">
                              {listing.title}
                            </h4>
                            <span className="rounded-full bg-[rgba(102,104,232,0.2)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--foreground)]">
                              {listing.status}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                            {listing.priceLabel}
                          </p>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {listing.location} - {listing.postedLabel}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {listing.featureBullets.slice(0, 3).map((feature) => (
                              <span
                                key={feature}
                                className="rounded-full border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-1 text-xs text-[var(--muted)]"
                              >
                                {feature}
                              </span>
                            ))}
                          </div>
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <div className="rounded-[1.6rem] border border-dashed border-[var(--line)] bg-[var(--surface-strong)] px-5 py-10 text-sm text-[var(--muted)]">
                    You have not created any listings yet. Post your first item to
                    start building a seller profile buyers can trust.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6">
                <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
                  Verification guide
                </p>
                <h3 className="mt-2 text-2xl font-bold text-[var(--foreground)]">
                  Keep your account ready for trust-sensitive actions.
                </h3>
                <div className="mt-5 grid gap-3">
                  {[
                    user.phoneVerified
                      ? "Phone verification is complete."
                      : "Phone verification is still required for posting flows.",
                    "Email is currently your sign-in and account contact address.",
                    "Changing your phone number resets the phone verification flag until the new number is verified.",
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm leading-6 text-[var(--muted)]"
                    >
                      {item}
                    </div>
                  ))}
                </div>
                {!user.phoneVerified ? (
                  <Link
                    href="/verify?next=%2Fprofile"
                    className="mt-5 inline-flex rounded-full bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-[var(--foreground)]"
                  >
                    Verify phone now
                  </Link>
                ) : null}
              </section>

              <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6">
                <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
                  Account snapshot
                </p>
                <div className="mt-5 space-y-3">
                  {[
                    { label: "Display name", value: user.displayName },
                    { label: "Email", value: user.email },
                    { label: "Phone", value: user.phone ?? "Not added yet" },
                    { label: "Role", value: formatRole(user.role) },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3"
                    >
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                        {item.label}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
