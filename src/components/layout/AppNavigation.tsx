"use client";

import Link from "next/link";
import {
  Boxes,
  LogIn,
  Search,
  SquareKanban,
  UtensilsCrossed,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

type AppNavigationProps = {
  className?: string;
  userRole: "DONO" | "ATENDENTE" | "USUARIO" | "VISITANTE";
  variant?: "header" | "mobile-footer";
};

const linksByRole = {
  VISITANTE: [
    { href: "/cardapio", label: "Cardapio" },
    { href: "/login", label: "Login" },
  ],
  USUARIO: [{ href: "/cardapio", label: "Cardapio" }],
  ATENDENTE: [
    { href: "/mesas", label: "Mesas" },
    { href: "/cardapio", label: "Cardapio" },
  ],
  DONO: [
    { href: "/mesas", label: "Mesas" },
    { href: "/cardapio", label: "Cardápio" },
    { href: "/estoque", label: "Estoque" },
  ],
} as const;

export default function AppNavigation({
  className,
  userRole,
  variant = "header",
}: AppNavigationProps) {
  const pathname = usePathname();
  const allowedLinks = linksByRole[userRole];

  const iconByHref: Record<
    string,
    React.ComponentType<{ className?: string }>
  > = {
    "/": LogIn,
    "/login": LogIn,
    "/mesas": UtensilsCrossed,
    "/cardapio": Search,
    "/items": Search,
    "/estoque": Boxes,
    "/perfil": SquareKanban,
  };

  if (variant === "mobile-footer") {
    return (
      <nav
        className={cn(
          "grid items-center border-t border-[var(--app-border)] bg-[var(--app-surface)] px-2 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-2",
          className,
        )}
        style={{
          gridTemplateColumns: `repeat(${allowedLinks.length}, minmax(0, 1fr))`,
        }}
      >
        {allowedLinks.map((link) => {
          const isActive =
            pathname === link.href || pathname.startsWith(`${link.href}/`);
          const Icon = iconByHref[link.href] ?? SquareKanban;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-md py-1 text-[11px] leading-none transition",
                isActive
                  ? "text-[var(--app-text)]"
                  : "text-[var(--app-muted)] hover:text-[var(--app-text)]",
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className={cn("flex items-center gap-5", className)}>
      {allowedLinks.map((link) => {
        const isActive = pathname === link.href;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "relative whitespace-nowrap py-1 text-[15px] font-medium leading-none transition",
              isActive
                ? "text-[var(--app-text)] after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:bg-[var(--app-text)]"
                : "text-[var(--app-muted)] hover:text-[var(--app-text)]",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
