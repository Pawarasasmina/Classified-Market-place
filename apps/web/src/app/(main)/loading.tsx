function LoadingCard() {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] shadow-[0_18px_50px_rgba(17,24,45,0.08)]">
      <div className="h-52 animate-pulse bg-[linear-gradient(135deg,color-mix(in_srgb,var(--brand)_14%,white),color-mix(in_srgb,var(--surface)_82%,var(--background)))]" />
      <div className="space-y-4 p-6">
        <div className="h-4 w-24 animate-pulse rounded-full bg-[var(--accent-soft)]" />
        <div className="h-8 w-3/4 animate-pulse rounded-full bg-[color-mix(in_srgb,var(--surface-strong)_82%,white)]" />
        <div className="h-4 w-full animate-pulse rounded-full bg-[color-mix(in_srgb,var(--surface-strong)_72%,white)]" />
        <div className="h-4 w-5/6 animate-pulse rounded-full bg-[color-mix(in_srgb,var(--surface-strong)_72%,white)]" />
      </div>
    </div>
  );
}

export default function MainLoading() {
  return (
    <div className="mx-auto max-w-[92rem] px-5 py-10 sm:px-8 lg:px-10">
      <div className="rounded-[2.4rem] border border-[var(--line)] bg-[linear-gradient(180deg,var(--surface),color-mix(in_srgb,var(--surface)_88%,var(--background)))] p-8 shadow-[0_22px_60px_rgba(17,24,45,0.1)]">
        <div className="h-4 w-32 animate-pulse rounded-full bg-[var(--accent-soft)]" />
        <div className="mt-5 h-12 w-3/5 animate-pulse rounded-full bg-[color-mix(in_srgb,var(--surface-strong)_82%,white)]" />
        <div className="mt-4 h-5 w-2/3 animate-pulse rounded-full bg-[color-mix(in_srgb,var(--surface-strong)_72%,white)]" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <LoadingCard />
            <LoadingCard />
            <LoadingCard />
          </div>
          <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(17,24,45,0.08)]">
            <div className="h-4 w-28 animate-pulse rounded-full bg-[var(--accent-soft)]" />
            <div className="mt-5 space-y-4">
              <div className="h-20 animate-pulse rounded-[1.5rem] bg-[color-mix(in_srgb,var(--surface-strong)_72%,white)]" />
              <div className="h-20 animate-pulse rounded-[1.5rem] bg-[color-mix(in_srgb,var(--surface-strong)_72%,white)]" />
              <div className="h-20 animate-pulse rounded-[1.5rem] bg-[color-mix(in_srgb,var(--surface-strong)_72%,white)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
