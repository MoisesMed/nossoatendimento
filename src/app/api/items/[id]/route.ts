import { z } from "zod";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type MembershipRow = {
  tenant_id: string;
  role: "DONO" | "ATENDENTE" | "USUARIO";
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
  pricing_type: "UNIDADE" | "PESO";
  active: boolean;
  visible_in_menu: boolean;
  image_path: string | null;
  category: string;
  serves_people: number;
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const updateItemSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  category: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().max(300).nullable().optional(),
  price: z.number().min(0).max(999999).optional(),
  promotionalPrice: z.number().min(0).max(999999).nullable().optional(),
  pricingType: z.enum(["UNIDADE", "PESO"]).optional(),
  servesPeople: z.number().int().min(1).max(99).optional(),
  imagePath: z.string().trim().min(1).max(500).nullable().optional(),
  visibleInMenu: z.boolean().optional(),
});

async function withSignedImage(supabase: Awaited<ReturnType<typeof createClient>>, row: ItemRow) {
  if (!row.image_path) {
    return {
      ...row,
      imageUrl: null,
    };
  }

  const { data: publicData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(row.image_path);

  return {
    ...row,
    imageUrl: publicData?.publicUrl ?? null,
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
    .select("tenant_id, role")
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

  return {
    supabase,
    tenantId: typedMemberships[0].tenant_id,
    userRole: typedMemberships[0].role,
  };
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const context = await resolveTenantId();

  if ("error" in context) {
    return context.error;
  }

  const { supabase, tenantId, userRole } = context;

  if (userRole !== "DONO") {
    return NextResponse.json({ error: "Sem permissao para atualizar item" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateItemSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
  }

  if (
    parsed.data.promotionalPrice !== undefined &&
    parsed.data.promotionalPrice !== null &&
    parsed.data.price !== undefined &&
    parsed.data.promotionalPrice >= parsed.data.price
  ) {
    return NextResponse.json(
      { error: "Preco promocional deve ser menor que o preco base" },
      { status: 400 },
    );
  }

  const payload = {
    ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    ...(parsed.data.category !== undefined ? { category: parsed.data.category } : {}),
    ...(parsed.data.description !== undefined
      ? {
        description:
          parsed.data.description && parsed.data.description.length > 0
            ? parsed.data.description
            : null,
      }
      : {}),
    ...(parsed.data.price !== undefined ? { price: parsed.data.price } : {}),
    ...(parsed.data.promotionalPrice !== undefined
      ? { promotional_price: parsed.data.promotionalPrice }
      : {}),
    ...(parsed.data.pricingType !== undefined
      ? { pricing_type: parsed.data.pricingType }
      : {}),
    ...(parsed.data.servesPeople !== undefined ? { serves_people: parsed.data.servesPeople } : {}),
    ...(parsed.data.imagePath !== undefined ? { image_path: parsed.data.imagePath } : {}),
    ...(parsed.data.visibleInMenu !== undefined
      ? {
        visible_in_menu: parsed.data.visibleInMenu,
        visible_in_menu_updated_at: new Date().toISOString(),
      }
      : {}),
  };

  const fallbackPayload = {
    ...payload,
  };
  delete fallbackPayload.visible_in_menu_updated_at;

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  let { data, error } = await supabase
    .from("menu_items")
    .update(payload)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .select("id, code, name, description, price, promotional_price, pricing_type, active, visible_in_menu, image_path, category, serves_people")
    .single();

  if (error && error.code === "42703") {
    const retry = await supabase
      .from("menu_items")
      .update(fallbackPayload)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .select("id, code, name, description, price, promotional_price, pricing_type, active, visible_in_menu, image_path, category, serves_people")
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Item ja existe no cardapio" }, { status: 409 });
    }

    return NextResponse.json({ error: "Falha ao atualizar item" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Falha ao atualizar item" }, { status: 500 });
  }

  return NextResponse.json({ data: await withSignedImage(supabase, data as ItemRow) });
}

export async function DELETE(_: Request, { params }: RouteContext) {
  const { id } = await params;
  const context = await resolveTenantId();

  if ("error" in context) {
    return context.error;
  }

  const { supabase, tenantId, userRole } = context;

  if (userRole !== "DONO") {
    return NextResponse.json({ error: "Sem permissao para remover item" }, { status: 403 });
  }

  const { error } = await supabase
    .from("menu_items")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .eq("active", true);

  if (error) {
    return NextResponse.json({ error: "Falha ao remover item" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
