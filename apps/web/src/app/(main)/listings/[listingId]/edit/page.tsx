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
      <div>
        <h1 className="text-2xl font-bold">Edit Listing</h1>
        <p className="mt-2 text-slate-600">
          Editing a listing sends it back to pending review.
        </p>
      </div>
      <ListingForm categories={categories} listing={listing} />
    </div>
  );
}
