export default function PerfilLoading() {
  return (
    <section className="mx-auto mt-4 w-full max-w-[1280px] rounded-2xl border border-[var(--app-border,#e2e8f0)] bg-[var(--app-surface,#ffffff)] p-6 shadow-sm">
      <div className="mb-4 h-7 w-32 animate-pulse rounded bg-[var(--app-surface-muted,#e2e8f0)]" />
      <div className="mb-2 h-4 w-2/3 animate-pulse rounded bg-[var(--app-surface-muted,#e2e8f0)]" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--app-surface-muted,#e2e8f0)]" />
    </section>
  );
}
