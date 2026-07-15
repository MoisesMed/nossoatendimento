import AppTopHeader from "@/components/layout/AppTopHeader";
import PublicTopHeader from "@/components/layout/PublicTopHeader";
import { requireTenantContext } from "@/lib/tenantContext";
import { resolveTenantTheme, themeToCssVars } from "@/lib/theme";
import { createClient } from "@/utils/supabase/server";

const PUBLIC_TENANT_SLUG = "manja";

export default async function CardapioLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { user: authUser, tenant, userRole } = await requireTenantContext();

    const fullName =
      (typeof authUser.user_metadata?.full_name === "string" &&
        authUser.user_metadata.full_name.trim()) ||
      "Usuario";

    const userEmail = authUser.email ?? "sem-email";
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

        <div className="mx-auto flex min-h-screen w-full max-w-[1280px] flex-col pb-28">
          {children}
        </div>
      </main>
    );
  }

  let tenantName = "MANJA";
  let tenantTheme: unknown = null;

  const { data: publicTenant } = await supabase.rpc("get_public_tenant", {
    p_tenant_slug: PUBLIC_TENANT_SLUG,
  });

  const typedTenant =
    Array.isArray(publicTenant) && publicTenant.length > 0
      ? (publicTenant[0] as { name: string; theme: unknown })
      : null;

  if (typedTenant) {
    tenantName = typedTenant.name;
    tenantTheme = typedTenant.theme;
  }

  const resolvedTenantTheme = resolveTenantTheme(tenantTheme);

  return (
    <main
      className="min-h-screen bg-[var(--app-bg)]"
      style={themeToCssVars(resolvedTenantTheme)}
    >
      <PublicTopHeader tenantName={tenantName} maxWidthClass="max-w-[800px]" />

      <div className="mx-auto flex min-h-screen w-full max-w-[800px] flex-col pb-28">
        {children}
      </div>
    </main>
  );
}
