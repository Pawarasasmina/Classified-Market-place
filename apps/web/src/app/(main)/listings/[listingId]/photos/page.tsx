import Link from "next/link";
import { notFound } from "next/navigation";
import { getListingMedia } from "@/lib/listing-media";
import { fetchListing } from "@/lib/marketplace-api";

type ListingPhotosPageProps = {
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

function PhotosIcon({
  name,
  className = "",
}: {
  name: "arrow" | "camera" | "chevron" | "location";
  className?: string;
}) {
  const paths = {
    arrow: (
      <>
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </>
    ),
    camera: (
      <>
        <path d="M14.5 5 13 3H8L6.5 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z" />
        <path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    location: (
      <>
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
        <path d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {paths[name]}
    </svg>
  );
}

export default async function ListingPhotosPage(props: ListingPhotosPageProps) {
  const [{ listingId }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const customerPreview = searchParams.view === "customer";
  const listing = await fetchListing(listingId);

  if (!listing) {
    notFound();
  }

  const media = getListingMedia(listing);
  const gallery = listing.imageUrls.length ? listing.imageUrls : [media.src];

  return (
    <div className="listing-photos-page page">
      <div className="listing-photos-topbar">
        <Link
          href={previewHref(`/listings/${listing.id}`, customerPreview)}
          className="listing-detail-back-link"
        >
          <PhotosIcon name="arrow" className="h-4 w-4" />
          <span>Back To Listing</span>
        </Link>
        <nav className="listing-detail-breadcrumb" aria-label="Photo breadcrumb">
          <Link href={previewHref("/search", customerPreview)}>Marketplace</Link>
          <PhotosIcon name="chevron" className="h-3.5 w-3.5" />
          <Link
            href={previewHref(
              `/search?category=${listing.categorySlug}`,
              customerPreview,
            )}
          >
            {listing.subcategory}
          </Link>
          <PhotosIcon name="chevron" className="h-3.5 w-3.5" />
          <span>Photos</span>
        </nav>
      </div>

      <header className="listing-photos-header">
        <div>
          <p className="listing-photos-kicker">
            <PhotosIcon name="camera" className="h-4 w-4" />
            {gallery.length} photos
          </p>
          <h1>{listing.title}</h1>
          <p>
            <PhotosIcon name="location" className="h-4 w-4" />
            <span>{listing.location}</span>
            <span>/</span>
            <span>{listing.priceLabel}</span>
          </p>
        </div>
      </header>

      <section className="listing-photos-grid" aria-label="All listing photos">
        {gallery.map((src, index) => (
          <figure
            key={`${src}-${index}`}
            className={index === 0 ? "listing-photo listing-photo-featured" : "listing-photo"}
          >
            <img
              src={src}
              alt={
                index === 0
                  ? media.alt
                  : `${listing.title} photo ${index + 1}`
              }
            />
            <figcaption>
              {index + 1} / {gallery.length}
            </figcaption>
          </figure>
        ))}
      </section>
    </div>
  );
}
