import { redirect } from "next/navigation";
import { requireTenantContext } from "@/lib/tenantContext";

export default async function EstoquePage() {
  await requireTenantContext();
  redirect("/mesas");
}
