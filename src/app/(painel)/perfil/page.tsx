import { requireTenantContext } from "@/lib/tenantContext";

export default async function PerfilPage() {
  const { user } = await requireTenantContext();

  const fullName =
    (typeof user.user_metadata?.full_name === "string" &&
      user.user_metadata.full_name.trim()) ||
    "Usuario";

  return (
    <section className="mx-auto mt-4 w-full max-w-[1280px] rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-[var(--app-text)]">Perfil</h1>
      <p className="mt-3 text-sm text-[var(--app-text)]">Nome: {fullName}</p>
      <p className="text-sm text-[var(--app-text)]">
        Email: {user.email ?? "sem-email"}
      </p>
    </section>
  );
}
