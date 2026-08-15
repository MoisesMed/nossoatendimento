import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type MembershipRow = {
  tenant_id: string;
};

type TableItemRow = {
  id: string;
  table_id: string;
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

function toMesaItem(row: TableItemRow) {
  return {
    id: row.id,
    mesaId: row.table_id,
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

  const preferredSlug =
    typeof user.user_metadata?.tenant_slug === "string"
      ? user.user_metadata.tenant_slug.trim().toLowerCase()
      : "labavetteresto";

  const { data: membershipsBySlug, error: membershipError } = await supabase
    .from("memberships")
    .select("tenant_id, tenants!inner(slug)")
    .eq("user_id", user.id)
    .eq("active", true)
    .eq("tenants.slug", preferredSlug)
    .limit(1);

  if (membershipError) {
    return { error: NextResponse.json({ error: "Falha ao validar tenant" }, { status: 500 }) };
  }

  const typedBySlug = membershipsBySlug as MembershipRow[] | null;

  if (typedBySlug && typedBySlug.length > 0) {
    return { supabase, tenantId: typedBySlug[0].tenant_id };
  }

  const { data: fallbackMemberships, error: fallbackError } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1);

  if (fallbackError) {
    return { error: NextResponse.json({ error: "Falha ao validar tenant" }, { status: 500 }) };
  }

  const typedFallback = fallbackMemberships as MembershipRow[] | null;

  if (!typedFallback || typedFallback.length === 0) {
    return { error: NextResponse.json({ error: "Usuario sem membership" }, { status: 403 }) };
  }

  return { supabase, tenantId: typedFallback[0].tenant_id };
}

export async function GET() {
  const context = await resolveTenantId();

  if ("error" in context) {
    return context.error;
  }

  const { supabase, tenantId } = context;

  const { data, error } = await supabase
    .from("restaurant_table_items")
    .select(
      "id, table_id, name, quantity, price, original_price, delivered, pricing_type, weight_kg, additional_titles, additional_total",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Falha ao listar itens das mesas" }, { status: 500 });
  }

  const typedRows = (data ?? []) as TableItemRow[];
  return NextResponse.json({ data: typedRows.map(toMesaItem) });
}
