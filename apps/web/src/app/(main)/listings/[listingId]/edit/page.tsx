import { notFound, redirect } from "next/navigation";
import { ListingForm } from "@/components/marketplace/listing-form";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchCategories, fetchListing } from "@/lib/marketplace-api";

type EditListingPageProps = {
  params: Promise<{ listingId: string }>;
};

export default async function EditListingPage(props: EditListingPageProps) {
  const { listingId } = await props.params;
  const { user } = await requireSessionContext(`/listings/${listingId}/edit`);
  const [categories, listing] = await Promise.all([
    fetchCategories(),
    fetchListing(listingId),
  ]);

  if (!listing) {
    notFound();
  }

  if (listing.sellerId !== user.id && user.role.toUpperCase() !== "ADMIN") {
    redirect("/my-listings");
  }

  return (
    <div className="page grid gap-6">
      <div className="panel-dark p-6">
        <p className="section-eyebrow">Seller workspace</p>
        <h1 className="mt-3 text-3xl font-black text-white">Edit listing</h1>
        <p className="mt-2 max-w-3xl text-[#d7d9ea]">
          Keep the listing accurate with updated photos, price, and category fields.
          Admins can moderate final visibility from the dashboard.
        </p>
      </div>
      <ListingForm categories={categories} listing={listing} />
    </div>
  );
}
