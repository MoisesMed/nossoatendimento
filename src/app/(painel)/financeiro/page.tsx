import { redirect } from "next/navigation";
import FinancialDashboard from "@/components/financeiro/FinancialDashboard";
import { requireTenantContext } from "@/lib/tenantContext";

export default async function FinanceiroPage() {
  const { userRole } = await requireTenantContext();

  if (userRole !== "DONO") {
    redirect("/mesas");
  }

  return <FinancialDashboard />;
}
