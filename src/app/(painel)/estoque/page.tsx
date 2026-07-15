import { redirect } from "next/navigation";
import { requireTenantContext } from "@/lib/tenantContext";

export default async function EstoquePage() {
  const { userRole } = await requireTenantContext();

  if (userRole !== "DONO") {
    redirect(userRole === "ATENDENTE" ? "/mesas" : "/cardapio");
  }

  return (
    <section className="mx-auto mt-4 w-full max-w-[1280px] rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-[var(--app-text)]">Estoque</h1>
    </section>
  );
}
