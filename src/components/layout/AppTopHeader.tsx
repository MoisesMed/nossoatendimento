import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import AppNavigation from "@/components/layout/AppNavigation";
import ProfileDropdown from "@/components/layout/ProfileDropdown";
import TenantLogoUploader from "@/components/layout/TenantLogoUploader";

type AppTopHeaderProps = {
  fullName: string;
  userEmail: string;
  tenantName: string;
  tenantLogoUrl: string | null;
  userRole: "DONO" | "ATENDENTE" | "USUARIO";
};

function getInitials(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AppTopHeader({
  fullName,
  userEmail,
  tenantName,
  tenantLogoUrl,
  userRole,
}: AppTopHeaderProps) {
  const initials = getInitials(fullName) || "U";

  const signOut = async () => {
    "use server";

    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/");
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[var(--app-border)] bg-[var(--app-surface)]/95 backdrop-blur">
        <div className="mx-auto w-full max-w-[1280px] px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-8">
              <div className="flex items-center gap-3">
                <TenantLogoUploader
                  tenantName={tenantName}
                  tenantLogoUrl={tenantLogoUrl}
                  canEdit={userRole === "DONO"}
                />

                <Link href="/mesas">
                  <p className="text-[15px] font-semibold leading-tight text-[var(--app-text)]">
                    {tenantName}
                  </p>
                  <p className="text-[12px] font-normal text-[var(--app-muted)]">
                    Painel de atendimento
                  </p>
                </Link>
              </div>

              <div className="hidden md:flex">
                <AppNavigation userRole={userRole} />
              </div>
            </div>

            <ProfileDropdown
              fullName={fullName}
              userEmail={userEmail}
              initials={initials}
              userRole={userRole}
              signOutAction={signOut}
            />
          </div>
        </div>
      </header>

      <AppNavigation
        userRole={userRole}
        variant="mobile-footer"
        className="fixed inset-x-0 bottom-0 z-40 md:hidden"
      />
    </>
  );
}
