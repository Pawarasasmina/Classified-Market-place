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
      <section className="panel">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-2xl font-bold">
            {seller.avatarUrl ? (
              <img src={seller.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              seller.name.charAt(0)
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{seller.name}</h1>
            <p className="text-slate-600">{seller.location ?? seller.joinedLabel}</p>
            <p className="text-sm text-slate-600">
              {seller.verified ? "Verified seller" : "Marketplace seller"} · {seller.totalListings} listings
            </p>
          </div>
        </div>
        {seller.bio ? <p className="mt-4 max-w-2xl text-slate-700">{seller.bio}</p> : null}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Active listings</h2>
          <Link href="/search" className="text-sm font-semibold">Back to search</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {listings.length ? (
            listings.map((listing) => <ListingCard key={listing.id} listing={listing} compact />)
          ) : (
            <div className="panel md:col-span-2 lg:col-span-3">No active listings yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}
