import { z } from "zod";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type MembershipRow = {
  tenant_id: string;
};

type RouteContext = {
  params: Promise<{
    id: string;
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

const createTableItemSchema = z.object({
  code: z.number().int().positive().nullable().optional(),
  name: z.string().trim().min(1).max(120),
  quantity: z.number().int().min(1).max(999),
  price: z.number().min(0).max(999999),
  originalPrice: z.number().min(0).max(999999).nullable().optional(),
  delivered: z.boolean().optional(),
  pricingType: z.enum(["UNIDADE", "PESO"]).optional(),
  weightKg: z.number().min(0).max(999).optional(),
  additionalTitles: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  additionalTotal: z.number().min(0).max(999999).optional(),
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
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1);

  const typedBySlug = membershipsBySlug as MembershipRow[] | null;

  if (!typedBySlug || typedBySlug.length === 0) {
    return { error: NextResponse.json({ error: "Usuario sem membership" }, { status: 403 }) };
  }

  return { supabase, tenantId: typedBySlug[0].tenant_id };
}

async function ensureTableExistsForTenant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  mesaId: string,
) {
  const { data, error } = await supabase
    .from("restaurant_tables")
    .select("id")
    .eq("id", mesaId)
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    return { error: NextResponse.json({ error: "Falha ao validar mesa" }, { status: 500 }) };
  }

  if (!data) {
    return { error: NextResponse.json({ error: "Mesa nao encontrada" }, { status: 404 }) };
  }

  return { data };
}

export async function POST(request: Request, { params }: RouteContext) {
  const { id: mesaId } = await params;
  const context = await resolveTenantId();

  if ("error" in context) {
    return context.error;
  }

  const { supabase, tenantId } = context;
  const tableCheck = await ensureTableExistsForTenant(supabase, tenantId, mesaId);
  if ("error" in tableCheck) {
    return tableCheck.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = createTableItemSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos para item da mesa" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("restaurant_table_items")
    .insert({
      tenant_id: tenantId,
      table_id: mesaId,
      code: parsed.data.code ?? null,
      name: parsed.data.name,
      quantity: parsed.data.quantity,
      price: parsed.data.price,
      original_price: parsed.data.originalPrice ?? null,
      delivered: parsed.data.delivered ?? false,
      pricing_type: parsed.data.pricingType ?? null,
      weight_kg: parsed.data.weightKg ?? null,
      additional_titles: parsed.data.additionalTitles ?? [],
      additional_total: parsed.data.additionalTotal ?? null,
    })
    .select(
      "id, table_id, code, name, quantity, price, original_price, delivered, pricing_type, weight_kg, additional_titles, additional_total",
    )
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Falha ao salvar item da mesa" }, { status: 500 });
  }

  return NextResponse.json({ data: toMesaItem(data as TableItemRow) }, { status: 201 });
}

export async function GET(_: Request, { params }: RouteContext) {
  const { id: mesaId } = await params;
  const context = await resolveTenantId();

  if ("error" in context) {
    return context.error;
  }

  const { supabase, tenantId } = context;
  const tableCheck = await ensureTableExistsForTenant(supabase, tenantId, mesaId);
  if ("error" in tableCheck) {
    return tableCheck.error;
  }

  const { data, error } = await supabase
    .from("restaurant_table_items")
    .select(
      "id, table_id, code, name, quantity, price, original_price, delivered, pricing_type, weight_kg, additional_titles, additional_total",
    )
    .eq("tenant_id", tenantId)
    .eq("table_id", mesaId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return NextResponse.json({ error: "Falha ao carregar itens da mesa" }, { status: 500 });
  }

  return NextResponse.json({
    data: (data as TableItemRow[]).map(toMesaItem),
  });
}

export async function DELETE(_: Request, { params }: RouteContext) {
  const { id: mesaId } = await params;
  const context = await resolveTenantId();

  if ("error" in context) {
    return context.error;
  }

  const { supabase, tenantId } = context;
  const tableCheck = await ensureTableExistsForTenant(supabase, tenantId, mesaId);
  if ("error" in tableCheck) {
    return tableCheck.error;
  }

  const { error } = await supabase
    .from("restaurant_table_items")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("table_id", mesaId);

  if (error) {
    return NextResponse.json({ error: "Falha ao limpar itens da mesa" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
