import Link from "next/link";
import AppNavigation from "@/components/layout/AppNavigation";

type PublicTopHeaderProps = {
  tenantName: string;
  maxWidthClass?: string;
};

export default function PublicTopHeader({
  tenantName,
  maxWidthClass = "max-w-[800px]",
}: PublicTopHeaderProps) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[var(--app-border)] bg-[var(--app-surface)]/95 backdrop-blur">
        <div className={`mx-auto w-full ${maxWidthClass} px-4 py-3 sm:px-6`}>
          <div className="flex items-center justify-between gap-3">
            <Link href="/cardapio" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface-muted)] text-sm font-semibold text-[var(--app-text)]">
                MG
              </div>
              <div>
                <p className="text-[15px] font-semibold leading-tight text-[var(--app-text)]">
                  {tenantName}
                </p>
                <p className="text-[12px] font-normal text-[var(--app-muted)]">
                  Cardapio da loja
                </p>
              </div>
            </Link>

            <div className="hidden md:flex">
              <AppNavigation userRole="VISITANTE" />
            </div>
          </div>
        </div>
      </header>

      <AppNavigation
        userRole="VISITANTE"
        variant="mobile-footer"
        className="fixed inset-x-0 bottom-0 z-40 md:hidden"
      />
    </>
  );
}
