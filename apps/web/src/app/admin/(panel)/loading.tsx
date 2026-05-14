function MetricSkeleton() {
  return (
    <div className="rounded-[1.8rem] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_14px_36px_rgba(17,24,45,0.08)]">
      <div className="h-3 w-24 animate-pulse rounded-full bg-[var(--accent-soft)]" />
      <div className="mt-4 h-10 w-20 animate-pulse rounded-full bg-[color-mix(in_srgb,var(--surface-strong)_80%,white)]" />
    </div>
  );
}

export default function AdminPanelLoading() {
  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-[var(--line)] bg-[linear-gradient(180deg,var(--surface),color-mix(in_srgb,var(--surface)_82%,var(--background)))] p-6 shadow-[0_20px_50px_rgba(17,24,45,0.1)]">
        <div className="h-4 w-36 animate-pulse rounded-full bg-[var(--accent-soft)]" />
        <div className="mt-5 h-12 w-3/5 animate-pulse rounded-full bg-[color-mix(in_srgb,var(--surface-strong)_82%,white)]" />
        <div className="mt-4 h-5 w-2/3 animate-pulse rounded-full bg-[color-mix(in_srgb,var(--surface-strong)_72%,white)]" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-[1.8rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0_14px_36px_rgba(17,24,45,0.08)] xl:col-span-2">
          <div className="h-4 w-40 animate-pulse rounded-full bg-[var(--accent-soft)]" />
          <div className="mt-6 h-72 animate-pulse rounded-[1.5rem] bg-[color-mix(in_srgb,var(--surface-strong)_74%,white)]" />
        </div>
        <div className="rounded-[1.8rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0_14px_36px_rgba(17,24,45,0.08)]">
          <div className="h-4 w-32 animate-pulse rounded-full bg-[var(--accent-soft)]" />
          <div className="mt-6 space-y-4">
            <div className="h-16 animate-pulse rounded-[1.2rem] bg-[color-mix(in_srgb,var(--surface-strong)_74%,white)]" />
            <div className="h-16 animate-pulse rounded-[1.2rem] bg-[color-mix(in_srgb,var(--surface-strong)_74%,white)]" />
            <div className="h-16 animate-pulse rounded-[1.2rem] bg-[color-mix(in_srgb,var(--surface-strong)_74%,white)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
