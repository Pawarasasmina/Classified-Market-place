export default function MainLoading() {
  return (
    <div className="mx-auto w-full max-w-[92rem] px-4 py-10 sm:px-8 lg:px-10">
      <div className="animate-pulse space-y-6">
        <div className="h-16 rounded-2xl bg-[var(--surface-strong)]" />
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="h-72 rounded-[2rem] bg-[var(--surface-strong)]" />
          <div className="space-y-4">
            <div className="h-32 rounded-[1.5rem] bg-[var(--surface-strong)]" />
            <div className="h-32 rounded-[1.5rem] bg-[var(--surface-strong)]" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-32 rounded-[1.5rem] bg-[var(--surface-strong)]" />
          <div className="h-32 rounded-[1.5rem] bg-[var(--surface-strong)]" />
          <div className="h-32 rounded-[1.5rem] bg-[var(--surface-strong)]" />
        </div>
      </div>
    </div>
  );
}
