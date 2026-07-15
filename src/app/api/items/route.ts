import { z } from "zod";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type MembershipRow = {
  tenant_id: string;
};

type TenantRow = {
  id: string;
  slug: string;
};

const BUCKET = "menu-item-images";

type ItemRow = {
  id: string;
  code: number;
  name: string;
  description: string | null;
  price: number;
  promotional_price: number | null;
  active: boolean;
  image_path: string | null;
  category: string;
  serves_people: number;
};

const createItemSchema = z.object({
  name: z.string().trim().min(2).max(80),
  category: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional(),
  price: z.number().min(0).max(999999),
  promotionalPrice: z.number().min(0).max(999999).nullable().optional(),
  servesPeople: z.number().int().min(1).max(99).optional(),
  imagePath: z.string().trim().min(1).max(500).optional(),
});

async function withSignedImage(supabase: Awaited<ReturnType<typeof createClient>>, row: ItemRow) {
  if (!row.image_path) {
    return {
      ...row,
      imageUrl: null,
    };
  }

  const { data: signedData } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.image_path, 60 * 60 * 24 * 30);

  return {
    ...row,
    imageUrl: signedData?.signedUrl ?? null,
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
      : null;

  let targetTenantId: string | null = null;

  if (preferredSlug) {
    const { data: preferredTenant } = await supabase
      .from("tenants")
      .select("id, slug")
      .eq("slug", preferredSlug)
      .maybeSingle();

    const typedPreferredTenant = preferredTenant as TenantRow | null;
    if (typedPreferredTenant) {
      targetTenantId = typedPreferredTenant.id;
    }
  }

  const membershipsBase = supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("active", true);

  let memberships: MembershipRow[] | null = null;

  if (targetTenantId) {
    const { data: preferredMemberships } = await membershipsBase
      .eq("tenant_id", targetTenantId)
      .limit(1);
    memberships = (preferredMemberships as MembershipRow[] | null) ?? null;
  }

  if (!memberships || memberships.length === 0) {
    const { data: fallbackMemberships } = await membershipsBase.limit(1);
    memberships = (fallbackMemberships as MembershipRow[] | null) ?? null;
  }

  const typedMemberships = memberships;

  if (!typedMemberships || typedMemberships.length === 0) {
    return { error: NextResponse.json({ error: "Usuario sem membership" }, { status: 403 }) };
  }

  return { supabase, tenantId: typedMemberships[0].tenant_id };
}

export async function GET() {
  const context = await resolveTenantId();

  if ("error" in context) {
    return context.error;
  }

  const { supabase, tenantId } = context;

  const { data, error } = await supabase
    .from("menu_items")
    .select("id, code, name, description, price, promotional_price, active, image_path, category, serves_people")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Falha ao listar items" }, { status: 500 });
  }

  const typedRows = (data ?? []) as ItemRow[];
  const signedRows = await Promise.all(typedRows.map((row) => withSignedImage(supabase, row)));

  return NextResponse.json({ data: signedRows });
}

export async function POST(request: Request) {
  const context = await resolveTenantId();

  if ("error" in context) {
    return context.error;
  }

  const { supabase, tenantId } = context;

  const body = await request.json().catch(() => null);
  const parsed = createItemSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados do item invalidos" }, { status: 400 });
  }

  if (
    parsed.success &&
    parsed.data.promotionalPrice !== undefined &&
    parsed.data.promotionalPrice !== null &&
    parsed.data.promotionalPrice >= parsed.data.price
  ) {
    return NextResponse.json(
      { error: "Preco promocional deve ser menor que o preco base" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("menu_items")
    .insert({
      tenant_id: tenantId,
      name: parsed.data.name,
      category: parsed.data.category,
      description: parsed.data.description && parsed.data.description.length > 0
        ? parsed.data.description
        : null,
      price: parsed.data.price,
      promotional_price: parsed.data.promotionalPrice ?? null,
      serves_people: parsed.data.servesPeople ?? 1,
      image_path: parsed.data.imagePath ?? null,
    })
    .select("id, code, name, description, price, promotional_price, active, image_path, category, serves_people")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Item ja existe no cardapio" }, { status: 409 });
    }

    if (error.code === "42501") {
      return NextResponse.json({ error: "Sem permissao para criar item" }, { status: 403 });
    }

    return NextResponse.json({ error: "Falha ao criar item" }, { status: 500 });
  }

  return NextResponse.json({ data: await withSignedImage(supabase, data as ItemRow) }, { status: 201 });
}
