export default function ListingLoading() {
  return (
    <div className="page">
      <div className="grid gap-8 xl:grid-cols-[0.7fr_0.3fr]">
        <div className="panel space-y-6">
          <div className="h-72 animate-pulse rounded-md bg-[var(--surface-strong)]" />
          <div className="h-10 w-2/3 animate-pulse rounded-md bg-[var(--brand-soft)]" />
          <div className="h-28 animate-pulse rounded-md bg-[var(--surface-strong)]" />
        </div>
        <div className="panel">
          <div className="h-8 w-1/2 animate-pulse rounded-md bg-[var(--brand-soft)]" />
        </div>
      </div>
    </div>
  );
}
