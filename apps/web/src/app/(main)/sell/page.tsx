import { SellWizard } from "@/components/marketplace/sell-wizard";

export default function SellPage() {
  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-8 max-w-4xl">
        <p className="display-font text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-deep)]">
          Listing creation
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
          Multi-step posting flow with category schema fields and draft recovery.
        </h1>
        <p className="mt-4 text-base leading-8 text-[var(--muted)]">
          The TRD calls for a category-first wizard, dynamic attribute rendering,
          photo upload, pricing, location, and review. This Phase 1 route
          models that journey with local auto-save and reusable category schema
          definitions.
        </p>
      </div>

      <SellWizard />
    </div>
  );
}
