import { redirect } from "next/navigation";
import { requireTenantContext } from "@/lib/tenantContext";

export default async function PerfilPage() {
  await requireTenantContext();
  redirect("/mesas");
}
