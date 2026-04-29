import { SellWizard } from "@/components/marketplace/sell-wizard";
import { requireVerifiedSession } from "@/lib/auth-dal";
import { fetchCategories } from "@/lib/marketplace-api";

export default async function SellPage() {
  await requireVerifiedSession("/sell");
  const categories = await fetchCategories();

  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-8 max-w-4xl">
        <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
          Listing creation
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
          Multi-step posting flow with live category schema and publish actions.
        </h1>
        <p className="mt-4 text-base leading-8 text-[var(--muted)]">
          The posting flow now uses the backend category catalog and publishes to
          the real listings endpoint after local draft review.
        </p>
      </div>

      <SellWizard categories={categories} />
    </div>
  );
}
