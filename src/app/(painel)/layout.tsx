import type { Metadata } from "next";
import AppTopHeader from "@/components/layout/AppTopHeader";
import { requireTenantContext } from "@/lib/tenantContext";
import { resolveTenantTheme, themeToCssVars } from "@/lib/theme";

const LOGO_BUCKET = "restaurant-logos";

export async function generateMetadata(): Promise<Metadata> {
  const { tenant } = await requireTenantContext();
  const tenantTitle =
    tenant.name.trim().length > 0 ? tenant.name : "Nosso Atendimento";

  if (!tenant.logo_path || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return {
      title: tenantTitle,
    };
  }

  const tenantLogoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${LOGO_BUCKET}/${tenant.logo_path}`;

  return {
    title: tenantTitle,
    icons: {
      icon: tenantLogoUrl,
      shortcut: tenantLogoUrl,
      apple: tenantLogoUrl,
    },
  };
}

export default async function PainelLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, tenant, userRole } = await requireTenantContext();

  const fullName =
    (typeof user.user_metadata?.full_name === "string" &&
      user.user_metadata.full_name.trim()) ||
    "Usuario";

  const userEmail = user.email ?? "sem-email";
  const tenantTheme = resolveTenantTheme(tenant.theme);
  const tenantLogoUrl = tenant.logo_path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${LOGO_BUCKET}/${tenant.logo_path}`
    : null;

  return (
    <main
      className="min-h-screen bg-[var(--app-bg)]"
      style={themeToCssVars(tenantTheme)}
    >
      <AppTopHeader
        fullName={fullName}
        userEmail={userEmail}
        tenantName={tenant.name}
        tenantLogoUrl={tenantLogoUrl}
        userRole={userRole}
      />
      {children}
    </main>
  );
}
