import { ListingForm } from "@/components/marketplace/listing-form";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchCategories } from "@/lib/marketplace-api";

export default async function SellPage() {
  await requireSessionContext("/sell");
  const categories = await fetchCategories();

  return (
    <div className="page grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Create Listing</h1>
        <p className="mt-2 text-slate-600">
          New listings are saved as pending until an admin approves them.
        </p>
      </div>
      <ListingForm categories={categories} />
    </div>
  );
}
