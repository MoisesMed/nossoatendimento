import AppTopHeader from "@/components/layout/AppTopHeader";
import { requireTenantContext } from "@/lib/tenantContext";
import { resolveTenantTheme, themeToCssVars } from "@/lib/theme";

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
      {children}
    </main>
  );
}
