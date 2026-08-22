import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type MembershipRow = {
  tenant_id: string;
  role: "DONO" | "ATENDENTE" | "USUARIO";
};

async function resolveTenantId() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Nao autenticado" }, { status: 401 }) };
  }

  const { data: memberships } = await supabase
    .from("memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1);

  const typedMemberships = memberships as MembershipRow[] | null;

  if (!typedMemberships || typedMemberships.length === 0) {
    return { error: NextResponse.json({ error: "Usuario sem membership" }, { status: 403 }) };
  }

  return {
    supabase,
    tenantId: typedMemberships[0].tenant_id,
    userRole: typedMemberships[0].role,
  };
}

export async function GET() {
  const context = await resolveTenantId();

  if ("error" in context) {
    return context.error;
  }

  const { supabase, tenantId, userRole } = context;

  if (userRole === "USUARIO") {
    return NextResponse.json({ error: "Sem permissao para consultar vendas" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("restaurant_sales")
    .select("id, mesa_id, mesa_code, mesa_name, closed_at, subtotal, couvert_total, service_charge_total, grand_total, paid_total, remaining_total, observation, items, payments")
    .eq("tenant_id", tenantId)
    .order("closed_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Falha ao buscar vendas" }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
