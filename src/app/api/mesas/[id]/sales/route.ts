import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

type MembershipRow = {
  tenant_id: string;
  role: "DONO" | "ATENDENTE" | "USUARIO";
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const createSaleSchema = z.object({
  sourceId: z.string().trim().min(1).nullable().optional(),
  mesaCode: z.number().int().nullable().optional(),
  mesaName: z.string().trim().min(1),
  closedAt: z.string().datetime().optional(),
  subtotal: z.number().min(0),
  couvertTotal: z.number().min(0),
  serviceChargeTotal: z.number().min(0),
  grandTotal: z.number().min(0),
  paidTotal: z.number().min(0),
  remainingTotal: z.number().min(0),
  observation: z.string().trim().max(500).nullable().optional(),
  items: z.array(z.any()),
  payments: z.array(z.any()),
});

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

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const context = await resolveTenantId();

  if ("error" in context) {
    return context.error;
  }

  const { supabase, tenantId, userRole } = context;

  if (userRole === "USUARIO") {
    return NextResponse.json({ error: "Sem permissao para registrar venda" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSaleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
  }

  const payload = {
    tenant_id: tenantId,
    source_id: parsed.data.sourceId ?? null,
    mesa_id: id,
    mesa_code: parsed.data.mesaCode ?? null,
    mesa_name: parsed.data.mesaName,
    closed_at: parsed.data.closedAt ?? new Date().toISOString(),
    subtotal: parsed.data.subtotal,
    couvert_total: parsed.data.couvertTotal,
    service_charge_total: parsed.data.serviceChargeTotal,
    grand_total: parsed.data.grandTotal,
    paid_total: parsed.data.paidTotal,
    remaining_total: parsed.data.remainingTotal,
    observation: parsed.data.observation ?? null,
    items: parsed.data.items,
    payments: parsed.data.payments,
  };

  const { data, error } = await supabase
    .from("restaurant_sales")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Falha ao registrar venda" }, { status: 500 });
  }

  return NextResponse.json({ data });
}
