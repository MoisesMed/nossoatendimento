import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import AppNavigation from "@/components/layout/AppNavigation";

type AppTopHeaderProps = {
  fullName: string;
  userEmail: string;
  tenantName: string;
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
      <header className="sticky top-0 z-30 border-b border-[var(--app-border)] bg-[var(--app-surface)]/95 backdrop-blur">
        <div className="mx-auto w-full max-w-[1280px] px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-8">
              <Link href="/home" className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface-muted)] text-sm font-semibold text-[var(--app-text)]">
                  MG
                </div>
                <div>
                  <p className="text-[15px] font-semibold leading-tight text-[var(--app-text)]">
                    {tenantName}
                  </p>
                  <p className="text-[12px] font-normal text-[var(--app-muted)]">
                    Painel de atendimento
                  </p>
                </div>
              </Link>

              <div className="hidden md:flex">
                <AppNavigation userRole={userRole} />
              </div>
            </div>

            <details className="group relative">
              <summary className="list-none rounded-full ring-offset-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-border)]">
                <div className="flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--app-surface-muted)] text-xs font-bold text-[var(--app-text)]">
                    {initials}
                  </div>
                  <ChevronDown className="h-4 w-4 text-[var(--app-muted)]" />
                </div>
              </summary>

              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-2 shadow-xl">
                <div className="mb-2 border-b border-[var(--app-border)] px-2 pb-2">
                  <p className="text-sm font-semibold text-[var(--app-text)]">
                    {fullName}
                  </p>
                  <p className="truncate text-[12px] text-[var(--app-muted)]">
                    {userEmail}
                  </p>
                </div>

                <Link
                  href="/perfil"
                  className="block rounded-lg px-3 py-2 text-sm text-[var(--app-text)] transition hover:opacity-80"
                >
                  Perfil
                </Link>

                <form action={signOut}>
                  <button
                    type="submit"
                    className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--app-muted)] transition hover:opacity-80"
                  >
                    Sair
                  </button>
                </form>
              </div>
            </details>
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
