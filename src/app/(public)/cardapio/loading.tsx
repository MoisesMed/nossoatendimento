export default function CardapioLoading() {
  return (
    <section className="w-full px-4 pb-28 pt-4 sm:px-6">
      <div className="mb-4 h-10 w-full animate-pulse rounded-xl bg-[var(--app-surface-muted,#e2e8f0)]" />

      <div className="space-y-5">
        {Array.from({ length: 3 }).map((_, categoryIndex) => (
          <section key={categoryIndex} className="space-y-3">
            <div className="h-6 w-40 animate-pulse rounded bg-[var(--app-surface-muted,#e2e8f0)]" />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((__, itemIndex) => (
                <div
                  key={itemIndex}
                  className="rounded-2xl border border-[var(--app-border,#e2e8f0)] bg-[var(--app-surface,#ffffff)] p-4"
                >
                  <div className="mb-3 h-4 w-3/4 animate-pulse rounded bg-[var(--app-surface-muted,#e2e8f0)]" />
                  <div className="mb-2 h-3 w-full animate-pulse rounded bg-[var(--app-surface-muted,#e2e8f0)]" />
                  <div className="h-3 w-5/6 animate-pulse rounded bg-[var(--app-surface-muted,#e2e8f0)]" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
