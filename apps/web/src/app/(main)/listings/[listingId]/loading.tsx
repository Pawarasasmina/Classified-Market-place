export default function ListingLoading() {
  return (
    <div className="mx-auto max-w-[92rem] px-5 py-8 sm:px-8 lg:px-10">
      <div className="grid gap-8 xl:grid-cols-[0.7fr_0.3fr]">
        <div className="space-y-6 rounded-[2.5rem] border border-[var(--line)] bg-[rgba(255,255,255,0.8)] p-6">
          <div className="h-72 animate-pulse rounded-[2rem] bg-[rgba(31,107,90,0.1)]" />
          <div className="h-10 w-2/3 animate-pulse rounded-full bg-[rgba(217,93,57,0.1)]" />
          <div className="h-28 animate-pulse rounded-[2rem] bg-[rgba(31,107,90,0.08)]" />
        </div>
        <div className="rounded-[2.5rem] border border-[var(--line)] bg-[rgba(255,255,255,0.8)] p-6">
          <div className="h-8 w-1/2 animate-pulse rounded-full bg-[rgba(217,93,57,0.1)]" />
        </div>
      </div>
    </div>
  );
}
