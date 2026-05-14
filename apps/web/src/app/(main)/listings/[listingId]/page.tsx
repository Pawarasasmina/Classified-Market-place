import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingCard } from "@/components/marketplace/listing-card";
import { getListingMedia } from "@/lib/listing-media";
import {
  fetchListing,
  fetchListings,
  fetchSellerProfile,
} from "@/lib/marketplace-api";

type ListingDetailPageProps = {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<{
    view?: string;
  }>;
};

function previewHref(path: string, customerPreview: boolean) {
  if (!customerPreview) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}view=customer`;
}

export default async function ListingDetailPage(props: ListingDetailPageProps) {
  const [{ listingId }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const customerPreview = searchParams.view === "customer";
  const listing = await fetchListing(listingId);

  if (!listing) {
    notFound();
  }

  const [seller, relatedListings] = await Promise.all([
    fetchSellerProfile(listing.sellerId),
    fetchListings({
      categorySlug: listing.categorySlug || undefined,
      take: 4,
    }),
  ]);
  const media = getListingMedia(listing);
  const related = relatedListings
    .filter((item) => item.id !== listing.id)
    .slice(0, 3);
  const gallery = listing.imageUrls.length
    ? listing.imageUrls
    : [media.src];

  return (
    <div className="page grid gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={previewHref("/search", customerPreview)}
          className="action-secondary px-3 py-2 text-sm font-bold"
        >
          Back to search
        </Link>
        <Link
          href={previewHref(`/search?category=${listing.categorySlug}`, customerPreview)}
          className="text-sm font-bold text-[var(--brand-strong)]"
        >
          More in {listing.subcategory}
        </Link>
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="overflow-hidden rounded-md border border-[var(--line)] bg-white shadow-sm">
          <div className="relative h-[28rem] bg-[var(--surface-strong)]">
            <img src={media.src} alt={media.alt} className="h-full w-full object-cover" />
            <div className="absolute inset-0" style={{ background: media.overlay }} />
            <div className="absolute left-4 top-4 flex flex-wrap gap-2">
              <span className="rounded-md bg-[rgba(9,12,26,0.78)] px-3 py-2 text-xs font-black uppercase tracking-wide text-white">
                {listing.subcategory}
              </span>
              <span className="rounded-md bg-white px-3 py-2 text-xs font-black text-[var(--brand-strong)]">
                {listing.status}
              </span>
            </div>
          </div>
          <div className="grid gap-6 p-5">
          <div>
            <h1 className="mt-3 text-3xl font-bold">{listing.title}</h1>
            <p className="mt-3 text-3xl font-black">{listing.priceLabel}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {listing.location} / {listing.postedLabel}
            </p>
            <p className="mt-5 leading-7 text-[var(--muted)]">
              {listing.description}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {listing.featureBullets.map((feature) => (
                <span
                  key={feature}
                  className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--muted)]"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>

          {gallery.length > 1 ? (
            <div>
              <p className="text-sm font-bold">Photos</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {gallery.slice(0, 6).map((src, index) => (
                  <div key={`${src}-${index}`} className="h-28 overflow-hidden rounded-md bg-[var(--surface-strong)]">
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

            {Object.keys(listing.attributes).length ? (
            <div>
              <p className="text-sm font-bold">Listing details</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {Object.entries(listing.attributes).map(([key, value]) => (
                  <div key={key} className="rounded-md border border-[var(--line)] p-3">
                    <p className="text-xs font-semibold uppercase text-[var(--muted)]">
                      {key}
                    </p>
                    <p className="mt-1 font-semibold">{String(value)}</p>
                  </div>
                ))}
              </div>
            </div>
            ) : null}
          </div>
        </div>

        <aside className="grid h-fit gap-4">
          <div className="panel">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-md bg-[linear-gradient(135deg,#6668e8,#a36e1d)] text-lg font-black text-white">
                {(seller?.name ?? listing.sellerDisplayName ?? "S")
                  .split(" ")
                  .slice(0, 2)
                  .map((part) => part.charAt(0).toUpperCase())
                  .join("")}
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-[var(--accent)]">
                  Seller
                </p>
                <h2 className="text-lg font-black">
                  {seller?.name ?? listing.sellerDisplayName ?? "Marketplace seller"}
                </h2>
              </div>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-[var(--muted)]">
              <p>
                {seller?.verified || listing.sellerVerified
                  ? "Verified seller"
                  : "Marketplace seller"}
              </p>
              <p>{seller?.joinedLabel ?? listing.sellerJoinedLabel ?? "Joined recently"}</p>
              <p>{seller?.totalListings ?? listing.sellerTotalListings ?? 0} active listings</p>
            </div>
            <div className="mt-5 grid gap-2">
              <Link
                href={previewHref(`/messages?listing=${listing.id}`, customerPreview)}
                className="action-primary px-4 py-3 text-center text-sm font-bold"
              >
                Chat with seller
              </Link>
              <Link
                href={previewHref("/saved", customerPreview)}
                className="action-secondary px-4 py-3 text-center text-sm font-bold"
              >
                Open saved items
              </Link>
            </div>
          </div>

          <div className="panel-dark p-5">
            <p className="text-sm font-black uppercase tracking-wide text-[#d7d9ea]">
              Buyer confidence
            </p>
            <div className="mt-4 grid gap-3 text-sm text-[#d7d9ea]">
              <p>Review the photos, seller verification, and listing details before meeting.</p>
              <p>Use in-app messages to keep the conversation attached to this listing.</p>
            </div>
          </div>
        </aside>
      </section>

      {related.length ? (
        <section className="grid gap-4">
          <h2 className="text-xl font-semibold">Related listings</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <ListingCard
                key={item.id}
                listing={item}
                compact
                customerView={customerPreview}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
