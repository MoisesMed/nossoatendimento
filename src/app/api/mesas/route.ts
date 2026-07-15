import { z } from "zod";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type MembershipRow = {
  tenant_id: string;
};

const createMesaSchema = z.object({
  name: z.string().trim().max(60).optional(),
  seats: z.number().int().min(1).max(30).optional(),
  notes: z.string().trim().max(300).optional(),
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

  const preferredSlug =
    typeof user.user_metadata?.tenant_slug === "string"
      ? user.user_metadata.tenant_slug
      : "manja";

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
    .from("restaurant_tables")
    .select("id, code, name, seats, status, notes")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("code", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Falha ao listar mesas" }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const context = await resolveTenantId();

  if ("error" in context) {
    return context.error;
  }

  const { supabase, tenantId } = context;

  const body = await request.json().catch(() => null);
  const parsed = createMesaSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
  }

  const { data: lastCodeRows, error: codeError } = await supabase
    .from("restaurant_tables")
    .select("code")
    .eq("tenant_id", tenantId)
    .order("code", { ascending: false })
    .limit(1);

  if (codeError) {
    return NextResponse.json({ error: "Falha ao gerar codigo da mesa" }, { status: 500 });
  }

  const nextCode = ((lastCodeRows as Array<{ code: number }> | null)?.[0]?.code ?? 0) + 1;
  const fallbackName = `Mesa ${nextCode}`;
  const safeName = parsed.data.name && parsed.data.name.length > 0 ? parsed.data.name : fallbackName;

  const { data, error } = await supabase
    .from("restaurant_tables")
    .insert({
      tenant_id: tenantId,
      code: nextCode,
      name: safeName,
      seats: parsed.data.seats ?? 4,
      notes: parsed.data.notes && parsed.data.notes.length > 0 ? parsed.data.notes : null,
    })
    .select("id, code, name, seats, status, notes")
    .single();

  if (error) {
    return NextResponse.json({ error: "Falha ao criar mesa" }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
