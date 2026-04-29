import { InboxWorkspace } from "@/components/marketplace/inbox-workspace";
import { requireSessionContext } from "@/lib/auth-dal";
import {
  fetchListing,
  fetchListings,
  fetchSellerProfile,
} from "@/lib/marketplace-api";

type MessagesPageProps = {
  searchParams: Promise<{
    listing?: string;
  }>;
};

export default async function MessagesPage(props: MessagesPageProps) {
  await requireSessionContext("/messages");
  const searchParams = await props.searchParams;
  const listingId = searchParams.listing;

  const recentListingsPromise = fetchListings({ take: 8 });
  const selectedListingPromise = listingId ? fetchListing(listingId) : Promise.resolve(null);

  const [recentListings, selectedListing] = await Promise.all([
    recentListingsPromise,
    selectedListingPromise,
  ]);
  const seller = selectedListing
    ? await fetchSellerProfile(selectedListing.sellerId)
    : null;

  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-8 max-w-4xl">
        <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
          Chat MVP
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
          Real listing context today, conversation persistence next.
        </h1>
        <p className="mt-4 text-base leading-8 text-[var(--muted)]">
          The backend does not expose conversation endpoints yet, so this workspace
          now anchors on real listing and seller data instead of mock inbox threads.
          It is ready for the future chat module to plug into the same session layer.
        </p>
      </div>

      <InboxWorkspace
        selectedListing={selectedListing}
        seller={seller}
        recentListings={recentListings}
      />
    </div>
  );
}
