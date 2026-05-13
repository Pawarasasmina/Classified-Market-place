import Image from "next/image";
import Link from "next/link";
import { ListingStatusActions } from "@/components/marketplace/listing-status-actions";
import { getListingMedia } from "@/lib/listing-media";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchMyListings } from "@/lib/marketplace-api";

export default async function MyListingsPage() {
  const { accessToken } = await requireSessionContext("/my-listings");
  const myListings = await fetchMyListings(accessToken);

  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
            Listing management
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
            Drafts, active listings, and owner actions powered by the live API.
          </h1>
        </div>
        <Link
          href="/sell"
          className="rounded-full bg-[linear-gradient(135deg,#d95d39,#f08a49)] px-5 py-3 text-sm font-semibold text-white"
        >
          Create new listing
        </Link>
      </div>

      <div className="mt-8 grid gap-5">
        {myListings.length ? (
          myListings.map((listing) => {
            const media = getListingMedia(listing);

            return (
              <section
                key={listing.id}
                className="grid gap-5 rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.86)] p-6 xl:grid-cols-[0.18fr_0.55fr_0.27fr]"
              >
                <div className="relative h-36 overflow-hidden rounded-[1.75rem]">
                  <Image
                    src={media.src}
                    alt={media.alt}
                    fill
                    unoptimized
                    sizes="(max-width: 1280px) 100vw, 18vw"
                    className="object-cover"
                  />
                  <div
                    className="absolute inset-0"
                    style={{ background: media.overlay }}
                  />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold text-[var(--foreground)]">
                      {listing.title}
                    </h2>
                    <span className="rounded-full bg-[rgba(31,107,90,0.1)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                      {listing.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                    {listing.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {listing.featureBullets.map((feature) => (
                      <span
                        key={feature}
                        className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs text-[var(--muted)]"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col justify-between gap-4">
                  <div>
                    <p className="display-font text-xl font-bold text-[var(--foreground)]">
                      {listing.priceLabel}
                    </p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {listing.postedLabel}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Link
                      href={`/listings/${listing.id}`}
                      className="rounded-full bg-[var(--foreground)] px-4 py-3 text-center text-sm font-semibold text-[var(--surface)]"
                    >
                      View listing
                    </Link>
                    <ListingStatusActions
                      listing={listing}
                      currentPath="/my-listings"
                    />
                  </div>
                </div>
              </section>
            );
          })
        ) : (
          <div className="rounded-[2rem] border border-dashed border-[var(--line)] bg-[rgba(255,255,255,0.7)] px-6 py-10 text-sm text-[var(--muted)]">
            You have not published any listings yet. Start with your first post to
            see it here.
          </div>
        )}
      </div>
    </div>
  );
}
