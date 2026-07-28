import AppTopHeader from "@/components/layout/AppTopHeader";
import PublicTopHeader from "@/components/layout/PublicTopHeader";
import { requireTenantContext } from "@/lib/tenantContext";
import { resolveTenantTheme, themeToCssVars } from "@/lib/theme";
import { createClient } from "@/utils/supabase/server";

const PUBLIC_TENANT_SLUG = "labavetteresto";
const LOGO_BUCKET = "restaurant-logos";

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
          tenantLogoUrl={
            tenant.logo_path
              ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${LOGO_BUCKET}/${tenant.logo_path}`
              : null
          }
          userRole={userRole}
        />

        <div className="mx-auto flex min-h-screen w-full max-w-[1280px] flex-col pb-28">
          {children}
        </div>
      </main>
    );
  }

  let tenantName = "Lá Bavette Restô";
  let tenantTheme: unknown = null;
  let tenantLogoUrl: string | null = null;

  const { data: publicTenant } = await supabase.rpc("get_public_tenant", {
    p_tenant_slug: PUBLIC_TENANT_SLUG,
  });

  const typedTenant =
    Array.isArray(publicTenant) && publicTenant.length > 0
      ? (publicTenant[0] as {
          name: string;
          theme: unknown;
          logo_path: string | null;
        })
      : null;

  if (typedTenant) {
    tenantName = typedTenant.name;
    tenantTheme = typedTenant.theme;
    tenantLogoUrl = typedTenant.logo_path
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${LOGO_BUCKET}/${typedTenant.logo_path}`
      : null;
  }

  const resolvedTenantTheme = resolveTenantTheme(tenantTheme);

  return (
    <main
      className="min-h-screen bg-[var(--app-bg)]"
      style={themeToCssVars(resolvedTenantTheme)}
    >
      <PublicTopHeader
        tenantName={tenantName}
        tenantLogoUrl={tenantLogoUrl}
        maxWidthClass="max-w-[800px]"
      />

      <div className="mx-auto flex min-h-screen w-full max-w-[800px] flex-col pb-28">
        {children}
      </div>
    </main>
  );
}
