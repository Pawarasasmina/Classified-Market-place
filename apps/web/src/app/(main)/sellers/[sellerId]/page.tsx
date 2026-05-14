import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingCard } from "@/components/marketplace/listing-card";
import { fetchListings, fetchSellerProfile } from "@/lib/marketplace-api";

type SellerPageProps = {
  params: Promise<{ sellerId: string }>;
};

export default async function SellerPage(props: SellerPageProps) {
  const { sellerId } = await props.params;
  const [seller, listings] = await Promise.all([
    fetchSellerProfile(sellerId),
    fetchListings({ sellerId }),
  ]);

  if (!seller) {
    notFound();
  }

  return (
    <div className="page grid gap-6">
      <section className="panel-dark p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[rgba(181,183,202,0.24)] bg-[rgba(255,255,255,0.08)] text-2xl font-black text-white">
              {seller.avatarUrl ? (
                <img src={seller.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                seller.name.charAt(0)
              )}
            </div>
            <div>
              <p className="section-eyebrow">Seller profile</p>
              <h1 className="mt-2 text-3xl font-black text-white">{seller.name}</h1>
              <p className="mt-2 text-sm text-[#d7d9ea]">
                {seller.location ?? seller.joinedLabel}
              </p>
              <p className="mt-2 text-sm text-[#d7d9ea]">
                {seller.verified ? "Verified seller" : "Marketplace seller"} - {seller.totalListings} listings
              </p>
            </div>
          </div>
          <Link
            href="/search"
            className="rounded-md border border-[rgba(181,183,202,0.32)] px-4 py-3 text-center text-sm font-bold text-white hover:bg-[rgba(255,255,255,0.08)]"
          >
            Back to search
          </Link>
        </div>
        {seller.bio ? (
          <p className="mt-6 max-w-3xl text-sm leading-7 text-[#d7d9ea] sm:text-base">
            {seller.bio}
          </p>
        ) : null}
      </section>

      <section>
        <div className="mb-4">
          <p className="section-eyebrow">Inventory</p>
          <h2 className="mt-2 text-2xl font-black text-[var(--foreground)]">
            Active listings
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {listings.length ? (
            listings.map((listing) => <ListingCard key={listing.id} listing={listing} compact />)
          ) : (
            <div className="panel md:col-span-2 lg:col-span-3">
              No active listings yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
