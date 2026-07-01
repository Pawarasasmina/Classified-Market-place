export default function SearchLoading() {
  return (
    <div className="mx-auto w-full max-w-[92rem] px-4 py-10 sm:px-8 lg:px-10">
      <div className="animate-pulse space-y-6">
        <div className="h-36 rounded-[2rem] bg-[var(--surface-strong)]" />
        <div className="flex flex-wrap gap-3">
          <div className="h-10 w-28 rounded-full bg-[var(--surface-strong)]" />
          <div className="h-10 w-32 rounded-full bg-[var(--surface-strong)]" />
          <div className="h-10 w-36 rounded-full bg-[var(--surface-strong)]" />
          <div className="h-10 w-24 rounded-full bg-[var(--surface-strong)]" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="h-72 rounded-[1.75rem] bg-[var(--surface-strong)]" />
          <div className="h-72 rounded-[1.75rem] bg-[var(--surface-strong)]" />
          <div className="h-72 rounded-[1.75rem] bg-[var(--surface-strong)]" />
        </div>
      </div>
    </div>
  );
}
