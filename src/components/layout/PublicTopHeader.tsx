import Link from "next/link";
import Image from "next/image";
import AppNavigation from "@/components/layout/AppNavigation";

type PublicTopHeaderProps = {
  tenantName: string;
  tenantLogoUrl?: string | null;
  maxWidthClass?: string;
};

export default function PublicTopHeader({
  tenantName,
  tenantLogoUrl = null,
  maxWidthClass = "max-w-[800px]",
}: PublicTopHeaderProps) {
  const initials = tenantName
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "LOG";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[var(--app-border)] bg-[var(--app-surface)]/95 backdrop-blur">
        <div className={`mx-auto w-full ${maxWidthClass} px-4 py-3 sm:px-6`}>
          <div className="flex items-center justify-between gap-3">
            <Link href="/cardapio" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[var(--app-border)] bg-[var(--app-surface-muted)] text-sm font-semibold text-[var(--app-text)]">
                {tenantLogoUrl ? (
                  <Image
                    src={tenantLogoUrl}
                    alt={`Logo de ${tenantName}`}
                    width={40}
                    height={40}
                    className="h-full w-full"
                  />
                ) : (
                  initials
                )}
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
