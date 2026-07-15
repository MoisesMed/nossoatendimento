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

const updateMesaSchema = z.object({
  code: z.number().int().min(1).max(9999).optional(),
  name: z.string().trim().max(60).optional(),
  seats: z.number().int().min(1).max(30).optional(),
  notes: z.string().trim().max(300).nullable().optional(),
  status: z
    .enum(["VAZIA", "OCUPADA", "EM_PREPARO", "AGUARDANDO_PAGAMENTO"])
    .optional(),
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

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const context = await resolveTenantId();

  if ("error" in context) {
    return context.error;
  }

  const { supabase, tenantId } = context;

  const body = await request.json().catch(() => null);
  const parsed = updateMesaSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
  }

  const payload = {
    ...(parsed.data.code !== undefined ? { code: parsed.data.code } : {}),
    ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    ...(parsed.data.seats !== undefined ? { seats: parsed.data.seats } : {}),
    ...(parsed.data.notes !== undefined
      ? { notes: parsed.data.notes && parsed.data.notes.length > 0 ? parsed.data.notes : null }
      : {}),
    ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
  };

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("restaurant_tables")
    .update(payload)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .select("id, code, name, seats, status, notes")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Numero da mesa ja existe neste restaurante" }, { status: 409 });
    }

    return NextResponse.json({ error: "Falha ao atualizar mesa" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Falha ao atualizar mesa" }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(_: Request, { params }: RouteContext) {
  const { id } = await params;
  const context = await resolveTenantId();

  if ("error" in context) {
    return context.error;
  }

  const { supabase, tenantId } = context;

  const { error } = await supabase
    .from("restaurant_tables")
    .update({ active: false })
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .eq("active", true);

  if (error) {
    return NextResponse.json({ error: "Falha ao deletar mesa" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
