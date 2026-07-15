import MesasBoard from "@/components/mesas/MesasBoard";
import AppTopHeader from "@/components/layout/AppTopHeader";
import { redirect } from "next/navigation";
import { requireTenantContext } from "@/lib/tenantContext";
import { resolveTenantTheme, themeToCssVars } from "@/lib/theme";

type MesaStatus = "VAZIA" | "OCUPADA" | "EM_PREPARO" | "AGUARDANDO_PAGAMENTO";

type Mesa = {
  id: string;
  code: number;
  name: string;
  seats: number;
  status: MesaStatus;
  notes: string | null;
};

export default async function MesasPage() {
  const { supabase, user, tenant, userRole } = await requireTenantContext();

  if (userRole === "USUARIO") {
    redirect("/cardapio");
  }

  const fullName =
    (typeof user.user_metadata?.full_name === "string" &&
      user.user_metadata.full_name.trim()) ||
    "Usuario";

  const userEmail = user.email ?? "sem-email";
  const tenantTheme = resolveTenantTheme(tenant.theme);

  const { data: mesasData } = await supabase
    .from("restaurant_tables")
    .select("id, code, name, seats, status, notes")
    .eq("tenant_id", tenant.id)
    .eq("active", true)
    .order("code", { ascending: true });

  const mesas = (mesasData ?? []) as Mesa[];

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
        <section className="w-full px-4 pt-4 sm:px-6">
          <MesasBoard initialMesas={mesas} />
        </section>
      </div>
    </main>
  );
}
