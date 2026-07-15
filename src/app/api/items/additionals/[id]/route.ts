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

type RouteContext = {
    params: Promise<{
        id: string;
    }>;
};

const updateAdditionalSchema = z.object({
    menuItemId: z.string().uuid().optional(),
    title: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(300).nullable().optional(),
    price: z.number().min(0).max(999999).optional(),
});

async function resolveTenantId() {
    const supabase = await createClient();

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return {
            error: NextResponse.json({ error: "Nao autenticado" }, { status: 401 }),
        };
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

    if (!memberships || memberships.length === 0) {
        return {
            error: NextResponse.json(
                { error: "Usuario sem membership" },
                { status: 403 },
            ),
        };
    }

    return { supabase, tenantId: memberships[0].tenant_id };
}

export async function PATCH(request: Request, { params }: RouteContext) {
    const { id } = await params;
    const context = await resolveTenantId();

    if ("error" in context) {
        return context.error;
    }

    const { supabase, tenantId } = context;

    const body = await request.json().catch(() => null);
    const parsed = updateAdditionalSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
    }

    if (parsed.data.menuItemId) {
        const { data: menuItem } = await supabase
            .from("menu_items")
            .select("id")
            .eq("id", parsed.data.menuItemId)
            .eq("tenant_id", tenantId)
            .eq("active", true)
            .maybeSingle();

        if (!menuItem) {
            return NextResponse.json(
                { error: "Item do cardapio invalido" },
                { status: 400 },
            );
        }
    }

    const payload = {
        ...(parsed.data.menuItemId !== undefined
            ? { menu_item_id: parsed.data.menuItemId }
            : {}),
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.description !== undefined
            ? {
                description:
                    parsed.data.description && parsed.data.description.length > 0
                        ? parsed.data.description
                        : null,
            }
            : {}),
        ...(parsed.data.price !== undefined ? { price: parsed.data.price } : {}),
    };

    if (Object.keys(payload).length === 0) {
        return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
    }

    const { data: updatedAdditional, error } = await supabase
        .from("menu_item_additionals")
        .update(payload)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .select("id, menu_item_id, title, description, price, sort_order, active")
        .single();

    if (error || !updatedAdditional) {
        if (error?.code === "23505") {
            return NextResponse.json(
                { error: "Adicional ja existe para este item" },
                { status: 409 },
            );
        }

        return NextResponse.json(
            { error: "Falha ao atualizar adicional" },
            { status: 500 },
        );
    }

    const { data: menuItem } = await supabase
        .from("menu_items")
        .select("name")
        .eq("id", updatedAdditional.menu_item_id)
        .eq("tenant_id", tenantId)
        .maybeSingle();

    return NextResponse.json({
        data: {
            ...updatedAdditional,
            item_name: menuItem?.name ?? null,
        },
    });
}

export async function DELETE(_: Request, { params }: RouteContext) {
    const { id } = await params;
    const context = await resolveTenantId();

    if ("error" in context) {
        return context.error;
    }

    const { supabase, tenantId } = context;

    const { error } = await supabase
        .from("menu_item_additionals")
        .update({ active: false })
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .eq("active", true);

    if (error) {
        return NextResponse.json(
            { error: "Falha ao remover adicional" },
            { status: 500 },
        );
    }

    return NextResponse.json({ success: true });
}
