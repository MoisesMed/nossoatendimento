import { z } from "zod";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type MembershipRow = {
  tenant_id: string;
  role: "DONO" | "ATENDENTE" | "USUARIO";
};

type RouteContext = {
  params: Promise<{
    id: string;
    itemId: string;
  }>;
};

type TableItemRow = {
  id: string;
  table_id: string;
  code: number | null;
  name: string;
  quantity: number;
  price: number;
  original_price: number | null;
  delivered: boolean;
  pricing_type: "UNIDADE" | "PESO" | null;
  weight_kg: number | null;
  additional_titles: string[];
  additional_total: number | null;
};

const updateTableItemSchema = z.object({
  delivered: z.boolean(),
});

function toMesaItem(row: TableItemRow) {
  return {
    id: row.id,
    mesaId: row.table_id,
    code: row.code ?? undefined,
    name: row.name,
    quantity: row.quantity,
    price: row.price,
    originalPrice: row.original_price,
    delivered: row.delivered,
    pricingType: row.pricing_type ?? undefined,
    weightKg: row.weight_kg ?? undefined,
    additionalTitles: row.additional_titles ?? [],
    additionalTotal: row.additional_total ?? undefined,
  };
}

async function resolveTenantId() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Nao autenticado" }, { status: 401 }) };
  }

  const { data: membershipsBySlug } = await supabase
    .from("memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1);

  const typedBySlug = membershipsBySlug as MembershipRow[] | null;

  if (!typedBySlug || typedBySlug.length === 0) {
    return { error: NextResponse.json({ error: "Usuario sem membership" }, { status: 403 }) };
  }

  return {
    supabase,
    tenantId: typedBySlug[0].tenant_id,
    userRole: typedBySlug[0].role,
  };
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id: mesaId, itemId } = await params;
  const context = await resolveTenantId();

  if ("error" in context) {
    return context.error;
  }

  const { supabase, tenantId, userRole } = context;

  if (userRole === "USUARIO") {
    return NextResponse.json({ error: "Sem permissao para atualizar item da mesa" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateTableItemSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("restaurant_table_items")
    .update({ delivered: parsed.data.delivered })
    .eq("tenant_id", tenantId)
    .eq("table_id", mesaId)
    .eq("id", itemId)
    .select(
      "id, table_id, code, name, quantity, price, original_price, delivered, pricing_type, weight_kg, additional_titles, additional_total",
    )
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Item da mesa nao encontrado" }, { status: 404 });
    }

    return NextResponse.json({ error: "Falha ao atualizar item da mesa" }, { status: 500 });
  }

  return NextResponse.json({ data: toMesaItem(data as TableItemRow) });
}

export async function DELETE(_: Request, { params }: RouteContext) {
  const { id: mesaId, itemId } = await params;
  const context = await resolveTenantId();

  if ("error" in context) {
    return context.error;
  }

  const { supabase, tenantId, userRole } = context;

  if (userRole === "USUARIO") {
    return NextResponse.json({ error: "Sem permissao para remover item da mesa" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("restaurant_table_items")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("table_id", mesaId)
    .eq("id", itemId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Falha ao remover item da mesa" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Item da mesa nao encontrado" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
