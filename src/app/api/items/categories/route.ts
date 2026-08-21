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

const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  imagePath: z.string().trim().min(1).max(500).optional(),
  visibleInMenu: z.boolean().optional(),
});

const deleteCategorySchema = z.object({
  name: z.string().trim().min(2).max(60),
});

const reorderCategoriesSchema = z.object({
  categories: z.array(z.string().trim().min(2).max(60)).min(1),
});

const renameCategorySchema = z.object({
  currentName: z.string().trim().min(2).max(60),
  nextName: z.string().trim().min(2).max(60),
  imagePath: z.string().trim().min(1).max(500).nullable().optional(),
  visibleInMenu: z.boolean().optional(),
});

const UNCATEGORIZED_CATEGORY = "Sem Categoria";

async function withSignedCategoryImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: {
    name: string;
    image_path: string | null;
    sort_order: number | null;
    visible_in_menu: boolean;
  },
) {
  if (!row.image_path) {
    return {
      name: row.name,
      sort_order: row.sort_order,
      image_path: null,
      visible_in_menu: row.visible_in_menu,
      image_url: null,
    };
  }

  const { data: signedData } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.image_path, 60 * 60 * 24 * 30);

  return {
    name: row.name,
    sort_order: row.sort_order,
    image_path: row.image_path,
    visible_in_menu: row.visible_in_menu,
    image_url: signedData?.signedUrl ?? null,
  };
}

async function resolveTenantContext() {
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

  if (!memberships || memberships.length === 0) {
    return { error: NextResponse.json({ error: "Usuario sem membership" }, { status: 403 }) };
  }

  return {
    supabase,
    tenantId: memberships[0].tenant_id,
    userRole: memberships[0].role,
  };
}

export async function GET() {
  const context = await resolveTenantContext();

  if ("error" in context) {
    return context.error;
  }

  const { supabase, tenantId } = context;

  const { data: categoryRows } = await supabase
    .from("menu_categories")
    .select("name, sort_order, image_path, visible_in_menu")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const { data: itemRows } = await supabase
    .from("menu_items")
    .select("category")
    .eq("tenant_id", tenantId)
    .eq("active", true);

  const typedCategoryRows = (categoryRows ?? []) as Array<{
    name: string;
    sort_order: number | null;
    image_path: string | null;
    visible_in_menu: boolean;
  }>;

  const fromCategories = typedCategoryRows
    .map((row) => row.name?.trim())
    .filter(Boolean) as string[];
  const fromItems = (itemRows ?? []).map((row) => row.category?.trim()).filter(Boolean) as string[];

  const missingFromItems = fromItems
    .filter((name) => !fromCategories.includes(name))
    .sort((a, b) => a.localeCompare(b));

  const signedCategoryRows = await Promise.all(
    typedCategoryRows.map((row) => withSignedCategoryImage(supabase, row)),
  );

  const missingCategories = missingFromItems.map((name) => ({
    name,
    sort_order: null,
    image_path: null,
    visible_in_menu: true,
    image_url: null,
  }));

  const data = [...signedCategoryRows, ...missingCategories];

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const context = await resolveTenantContext();

  if ("error" in context) {
    return context.error;
  }

  const { supabase, tenantId, userRole } = context;

  if (userRole !== "DONO") {
    return NextResponse.json({ error: "Sem permissao para criar categoria" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createCategorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Nome de categoria invalido" }, { status: 400 });
  }

  const name = parsed.data.name;
  const imagePath = parsed.data.imagePath ?? null;
  const visibleInMenu = parsed.data.visibleInMenu ?? true;

  const { data: lastCategory } = await supabase
    .from("menu_categories")
    .select("sort_order")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSortOrder = (lastCategory?.sort_order ?? -1) + 1;

  const baseInsertPayload = {
    tenant_id: tenantId,
    name,
    sort_order: nextSortOrder,
    image_path: imagePath,
    visible_in_menu: visibleInMenu,
  };

  const insertWithVisibility = {
    ...baseInsertPayload,
    visible_in_menu_updated_at: new Date().toISOString(),
  };

  let { data, error } = await supabase
    .from("menu_categories")
    .insert(insertWithVisibility)
    .select("id, name, image_path, visible_in_menu")
    .single();

  if (error && error.code === "42703") {
    const retry = await supabase
      .from("menu_categories")
      .insert(baseInsertPayload)
      .select("id, name, image_path, visible_in_menu")
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Categoria ja existe" }, { status: 409 });
    }

    if (error.code === "42501") {
      return NextResponse.json({ error: "Sem permissao para criar categoria" }, { status: 403 });
    }

    return NextResponse.json({ error: "Falha ao criar categoria" }, { status: 500 });
  }

  const typedData = data as {
    id: string;
    name: string;
    image_path: string | null;
    visible_in_menu: boolean;
  };
  const signed = await withSignedCategoryImage(supabase, {
    name: typedData.name,
    image_path: typedData.image_path,
    sort_order: nextSortOrder,
    visible_in_menu: typedData.visible_in_menu,
  });

  return NextResponse.json(
    {
      data: {
        id: typedData.id,
        name: typedData.name,
        image_path: typedData.image_path,
        visible_in_menu: typedData.visible_in_menu,
        image_url: signed.image_url,
      },
    },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  const context = await resolveTenantContext();

  if ("error" in context) {
    return context.error;
  }

  const { supabase, tenantId, userRole } = context;

  if (userRole !== "DONO") {
    return NextResponse.json({ error: "Sem permissao para reordenar categoria" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);

  const renameParsed = renameCategorySchema.safeParse(body);
  if (renameParsed.success) {
    const currentName = renameParsed.data.currentName;
    const nextName = renameParsed.data.nextName;
    const imagePath = renameParsed.data.imagePath;
    const visibleInMenu = renameParsed.data.visibleInMenu;

    if (currentName === UNCATEGORIZED_CATEGORY || nextName === UNCATEGORIZED_CATEGORY) {
      return NextResponse.json(
        { error: "A categoria Sem Categoria nao pode ser renomeada" },
        { status: 400 },
      );
    }

    if (currentName === nextName && imagePath === undefined && visibleInMenu === undefined) {
      return NextResponse.json({
        data: {
          from: currentName,
          to: nextName,
          visibleInMenu: visibleInMenu ?? true,
        },
      });
    }

    if (currentName !== nextName) {
      const { data: existingTarget } = await supabase
        .from("menu_categories")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .eq("name", nextName)
        .maybeSingle();

      if (existingTarget) {
        return NextResponse.json({ error: "Categoria ja existe" }, { status: 409 });
      }
    }

    const { data: currentCategory } = await supabase
      .from("menu_categories")
      .select("sort_order")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .eq("name", currentName)
      .maybeSingle();

    const { count: linkedItemsCount, error: countError } = await supabase
      .from("menu_items")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .eq("category", currentName);

    if (countError) {
      return NextResponse.json({ error: "Falha ao validar categoria" }, { status: 500 });
    }

    const hasCategoryRow = Boolean(currentCategory);
    const hasLinkedItems = (linkedItemsCount ?? 0) > 0;

    if (!hasCategoryRow && !hasLinkedItems) {
      return NextResponse.json({ error: "Categoria nao encontrada" }, { status: 404 });
    }

    if (hasCategoryRow) {
      const categoryUpdatePayload: Record<string, string | boolean | null> = {
        name: nextName,
      };

      if (imagePath !== undefined) {
        categoryUpdatePayload.image_path = imagePath;
      }
      if (visibleInMenu !== undefined) {
        categoryUpdatePayload.visible_in_menu = visibleInMenu;
        categoryUpdatePayload.visible_in_menu_updated_at = new Date().toISOString();
      }

      const fallbackCategoryUpdatePayload: Record<string, string | boolean | null> = {
        ...categoryUpdatePayload,
      };
      delete fallbackCategoryUpdatePayload.visible_in_menu_updated_at;

      let { error: updateCategoryError } = await supabase
        .from("menu_categories")
        .update(categoryUpdatePayload)
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .eq("name", currentName);

      if (updateCategoryError && updateCategoryError.code === "42703") {
        const retry = await supabase
          .from("menu_categories")
          .update(fallbackCategoryUpdatePayload)
          .eq("tenant_id", tenantId)
          .eq("active", true)
          .eq("name", currentName);
        updateCategoryError = retry.error;
      }

      if (updateCategoryError) {
        if (updateCategoryError.code === "23505") {
          return NextResponse.json({ error: "Categoria ja existe" }, { status: 409 });
        }
        return NextResponse.json({ error: "Falha ao renomear categoria" }, { status: 500 });
      }
    } else {
      const { data: lastCategory } = await supabase
        .from("menu_categories")
        .select("sort_order")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextSortOrder = (lastCategory?.sort_order ?? -1) + 1;

      const baseUpsertPayload = {
        tenant_id: tenantId,
        name: nextName,
        active: true,
        sort_order: nextSortOrder,
        image_path: imagePath ?? null,
        visible_in_menu: visibleInMenu ?? true,
      };

      const upsertWithVisibility = {
        ...baseUpsertPayload,
        visible_in_menu_updated_at: new Date().toISOString(),
      };

      let { error: createCategoryError } = await supabase
        .from("menu_categories")
        .upsert(
          upsertWithVisibility,
          { onConflict: "tenant_id,name" },
        );

      if (createCategoryError && createCategoryError.code === "42703") {
        const retry = await supabase
          .from("menu_categories")
          .upsert(baseUpsertPayload, { onConflict: "tenant_id,name" });
        createCategoryError = retry.error;
      }

      if (createCategoryError) {
        if (createCategoryError.code === "23505") {
          return NextResponse.json({ error: "Categoria ja existe" }, { status: 409 });
        }
        return NextResponse.json({ error: "Falha ao renomear categoria" }, { status: 500 });
      }
    }

    if (currentName !== nextName) {
      const { error: moveItemsError } = await supabase
        .from("menu_items")
        .update({ category: nextName })
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .eq("category", currentName);

      if (moveItemsError) {
        return NextResponse.json(
          { error: "Falha ao atualizar itens da categoria" },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      data: { from: currentName, to: nextName, visibleInMenu: visibleInMenu ?? true },
    });
  }

  const reorderParsed = reorderCategoriesSchema.safeParse(body);

  if (!reorderParsed.success) {
    return NextResponse.json({ error: "Payload de categoria invalido" }, { status: 400 });
  }

  const uniqueCategories = Array.from(
    new Set(reorderParsed.data.categories.map((category) => category.trim()).filter(Boolean)),
  );

  const { data: existingCategories } = await supabase
    .from("menu_categories")
    .select("name, visible_in_menu")
    .eq("tenant_id", tenantId)
    .eq("active", true);

  const visibilityByName = new Map(
    ((existingCategories ?? []) as Array<{ name: string; visible_in_menu: boolean }>).map(
      (row) => [row.name, row.visible_in_menu],
    ),
  );

  const payload = uniqueCategories.map((name, index) => ({
    tenant_id: tenantId,
    name,
    sort_order: index,
    active: true,
    visible_in_menu: visibilityByName.get(name) ?? true,
  }));

  const { error } = await supabase
    .from("menu_categories")
    .upsert(payload, { onConflict: "tenant_id,name" });

  if (error) {
    return NextResponse.json({ error: "Falha ao salvar ordem de categorias" }, { status: 500 });
  }

  return NextResponse.json({ data: uniqueCategories });
}

export async function DELETE(request: Request) {
  const context = await resolveTenantContext();

  if ("error" in context) {
    return context.error;
  }

  const { supabase, tenantId, userRole } = context;

  if (userRole !== "DONO") {
    return NextResponse.json({ error: "Sem permissao para remover categoria" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = deleteCategorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Categoria invalida" }, { status: 400 });
  }

  const categoryName = parsed.data.name;

  if (categoryName === UNCATEGORIZED_CATEGORY) {
    return NextResponse.json(
      { error: "A categoria Sem Categoria nao pode ser removida" },
      { status: 400 },
    );
  }

  const { data: lastCategory } = await supabase
    .from("menu_categories")
    .select("sort_order")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fallbackSortOrder = (lastCategory?.sort_order ?? -1) + 1;

  const { error: upsertFallbackError } = await supabase
    .from("menu_categories")
    .upsert(
      {
        tenant_id: tenantId,
        name: UNCATEGORIZED_CATEGORY,
        active: true,
        sort_order: fallbackSortOrder,
      },
      { onConflict: "tenant_id,name" },
    );

  if (upsertFallbackError) {
    return NextResponse.json(
      { error: "Falha ao preparar categoria de fallback" },
      { status: 500 },
    );
  }

  const { error: moveItemsError } = await supabase
    .from("menu_items")
    .update({ category: UNCATEGORIZED_CATEGORY })
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .eq("category", categoryName);

  if (moveItemsError) {
    return NextResponse.json(
      { error: "Falha ao mover itens para Sem Categoria" },
      { status: 500 },
    );
  }

  const { error: deactivateCategoryError } = await supabase
    .from("menu_categories")
    .update({ active: false })
    .eq("tenant_id", tenantId)
    .eq("name", categoryName)
    .eq("active", true);

  if (deactivateCategoryError) {
    return NextResponse.json({ error: "Falha ao remover categoria" }, { status: 500 });
  }

  return NextResponse.json({ data: { name: categoryName, movedTo: UNCATEGORIZED_CATEGORY } });
}
