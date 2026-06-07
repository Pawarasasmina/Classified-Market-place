import { SellWizard } from "@/components/marketplace/sell-wizard";
import { requireVerifiedSession } from "@/lib/auth-dal";
import { fetchCategories } from "@/lib/marketplace-api";

export default async function SellPage() {
  await requireVerifiedSession("/sell");
  const categories = await fetchCategories();

  return (
    <div className="page grid gap-6">
      <div className="panel-dark p-6">
        <p className="section-eyebrow">Post from your account</p>
        <h1 className="mt-3 text-3xl font-black text-white">Create a listing that buyers can trust.</h1>
        <p className="mt-2 max-w-3xl text-[#d7d9ea]">
          Use your regular marketplace account to sell. Add clear details,
          category-specific attributes, and photos; new listings enter review
          before they appear in customer search.
        </p>
      </div>
      <SellWizard categories={categories} />
    </div>
  );
}
