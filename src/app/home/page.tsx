import AppTopHeader from "@/components/layout/AppTopHeader";
import { redirect } from "next/navigation";
import { requireTenantContext } from "@/lib/tenantContext";
import { resolveTenantTheme, themeToCssVars } from "@/lib/theme";
import { createClient } from "@/utils/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    redirect("/cardapio");
  }

  const { user, tenant, userRole } = await requireTenantContext();

  if (userRole === "USUARIO") {
    redirect("/cardapio");
  }

  if (userRole === "ATENDENTE") {
    redirect("/mesas");
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
        <h1 className="text-2xl font-semibold text-[var(--app-text)]">Home</h1>
      </section>
    </main>
  );
}
