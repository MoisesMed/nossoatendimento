export default function MesasLoading() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1280px] flex-col pb-28">
      <section className="w-full px-4 pt-4 sm:px-6">
        <div className="mb-4 h-8 w-48 animate-pulse rounded-md bg-[var(--app-surface-muted,#e2e8f0)]" />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-[var(--app-border,#e2e8f0)] bg-[var(--app-surface,#ffffff)] p-3"
            >
              <div className="mx-auto mb-3 h-20 w-20 animate-pulse rounded-xl bg-[var(--app-surface-muted,#e2e8f0)]" />
              <div className="mb-2 h-4 w-2/3 animate-pulse rounded bg-[var(--app-surface-muted,#e2e8f0)]" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--app-surface-muted,#e2e8f0)]" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
