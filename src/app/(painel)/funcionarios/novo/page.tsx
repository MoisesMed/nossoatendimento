import { redirect } from "next/navigation";
import CreateEmployeeForm from "@/components/funcionarios/CreateEmployeeForm";
import { requireTenantContext } from "@/lib/tenantContext";

export default async function NovoFuncionarioPage() {
  const { userRole } = await requireTenantContext();

  if (userRole !== "DONO") {
    redirect("/mesas");
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1280px] flex-col pb-28">
      <section className="w-full px-4 pt-4 sm:px-6">
        <CreateEmployeeForm />
      </section>
    </div>
  );
}
