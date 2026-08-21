import MesasBoard from "@/components/mesas/MesasBoard";
import MesasBoardProviders from "@/components/mesas/MesasBoardProviders";
import { redirect } from "next/navigation";
import { requireTenantContext } from "@/lib/tenantContext";

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
  const { supabase, tenant, userRole, user } = await requireTenantContext();

  if (userRole === "USUARIO") {
    redirect("/cardapio");
  }

  const { data: mesasData } = await supabase
    .from("restaurant_tables")
    .select("id, code, name, seats, status, notes")
    .eq("tenant_id", tenant.id)
    .eq("active", true)
    .order("code", { ascending: true });

  const mesas = (mesasData ?? []) as Mesa[];
  const currentUserName =
    (typeof user.user_metadata?.full_name === "string" &&
      user.user_metadata.full_name.trim()) ||
    user.email ||
    "Garcom";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1280px] flex-col pb-28">
      <section className="w-full px-4 pt-4 sm:px-6">
        <MesasBoardProviders>
          <MesasBoard
            initialMesas={mesas}
            tenantId={tenant.id}
            currentUserId={user.id}
            currentUserName={currentUserName}
          />
        </MesasBoardProviders>
      </section>
    </div>
  );
}
