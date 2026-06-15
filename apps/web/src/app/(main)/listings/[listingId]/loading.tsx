export default function ListingLoading() {
  return (
    <div className="listing-detail-page page grid gap-6">
      <div className="listing-detail-topbar">
        <div className="h-8 w-36 animate-pulse rounded-full bg-[var(--surface-strong)]" />
        <div className="h-8 w-80 animate-pulse rounded-full bg-[var(--surface-strong)]" />
      </div>
      <div className="listing-detail-gallery-hero">
        <div className="listing-detail-gallery-primary animate-pulse bg-[var(--surface-strong)]" />
        <div className="listing-detail-gallery-side">
          <div className="listing-detail-gallery-side-item animate-pulse bg-[var(--surface-strong)]" />
          <div className="listing-detail-gallery-side-item animate-pulse bg-[var(--surface-strong)]" />
        </div>
      </div>
      <div className="listing-detail-layout">
        <div className="listing-detail-main-card">
          <div className="grid gap-5 p-5">
            <div className="h-5 w-32 animate-pulse rounded-md bg-[var(--brand-soft)]" />
            <div className="h-11 w-2/3 animate-pulse rounded-md bg-[var(--surface-strong)]" />
            <div className="grid gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-16 animate-pulse rounded-xl bg-[var(--surface-strong)]"
                />
              ))}
            </div>
            <div className="h-28 animate-pulse rounded-xl bg-[var(--surface-strong)]" />
          </div>
        </div>
        <div className="listing-detail-sidebar">
          <div className="listing-detail-seller-card">
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 animate-pulse rounded-2xl bg-[var(--brand-soft)]" />
              <div className="grid flex-1 gap-2">
                <div className="h-4 w-20 animate-pulse rounded-md bg-[var(--brand-soft)]" />
                <div className="h-6 w-40 animate-pulse rounded-md bg-[var(--surface-strong)]" />
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <div className="h-11 animate-pulse rounded-full bg-[var(--brand-soft)]" />
              <div className="h-11 animate-pulse rounded-full bg-[var(--surface-strong)]" />
            </div>
          </div>
          <div className="listing-detail-side-panel">
            <div className="h-5 w-28 animate-pulse rounded-md bg-[var(--brand-soft)]" />
            <div className="mt-4 h-16 animate-pulse rounded-xl bg-[var(--surface-strong)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
