import { notFound, redirect } from "next/navigation";
import { ListingForm } from "@/components/marketplace/listing-form";
import { normalizeRole } from "@/lib/admin-permissions";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchCategories, fetchMyListing } from "@/lib/marketplace-api";

type EditListingPageProps = {
  params: Promise<{ listingId: string }>;
};

export default async function EditListingPage(props: EditListingPageProps) {
  const { listingId } = await props.params;
  const { accessToken, user } = await requireSessionContext(`/listings/${listingId}/edit`);
  const [categories, listing] = await Promise.all([
    fetchCategories(),
    fetchMyListing(accessToken, listingId),
  ]);

  if (!listing) {
    notFound();
  }

  if (listing.sellerId !== user.id && normalizeRole(user.role) !== "ADMIN") {
    redirect("/my-listings");
  }

  return (
    <div className="page grid gap-6">
      <div className="panel-dark p-6">
        <p className="section-eyebrow">Your listing</p>
        <h1 className="mt-3 text-3xl font-black text-white">Edit listing</h1>
        <p className="mt-2 max-w-3xl text-[#d7d9ea]">
          Keep your item accurate with updated photos, price, and category fields.
          Saved changes return to moderation before public visibility.
        </p>
      </div>
      <ListingForm categories={categories} listing={listing} />
    </div>
  );
}
