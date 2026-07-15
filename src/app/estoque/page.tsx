import { redirect } from "next/navigation";
import AppTopHeader from "@/components/layout/AppTopHeader";
import { requireTenantContext } from "@/lib/tenantContext";
import { resolveTenantTheme, themeToCssVars } from "@/lib/theme";

export default async function EstoquePage() {
  const { user, tenant, userRole } = await requireTenantContext();

  if (userRole !== "DONO") {
    redirect(userRole === "ATENDENTE" ? "/mesas" : "/cardapio");
  }

  const fullName =
    (typeof user.user_metadata?.full_name === "string" &&
      user.user_metadata.full_name.trim()) ||
    "Usuario";

  const userEmail = user.email ?? "sem-email";
  const tenantTheme = resolveTenantTheme(tenant.theme);

  return (
    <main
      className="min-h-screen bg-[var(--app-bg)]"
      style={themeToCssVars(tenantTheme)}
    >
      <AppTopHeader
        fullName={fullName}
        userEmail={userEmail}
        tenantName={tenant.name}
        userRole={userRole}
      />

      <section className="mx-auto mt-4 w-full max-w-[1280px] rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-[var(--app-text)]">
          Estoque
        </h1>
      </section>
    </main>
  );
}
