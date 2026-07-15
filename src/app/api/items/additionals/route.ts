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

type AdditionalRow = {
    id: string;
    menu_item_id: string;
    title: string;
    description: string | null;
    price: number;
    sort_order: number;
    active: boolean;
};

const createAdditionalSchema = z.object({
    menuItemId: z.string().uuid(),
    title: z.string().trim().min(2).max(80),
    description: z.string().trim().max(300).optional(),
    price: z.number().min(0).max(999999),
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

export async function GET() {
    const context = await resolveTenantId();

    if ("error" in context) {
        return context.error;
    }

    const { supabase, tenantId } = context;

    const { data, error } = await supabase
        .from("menu_item_additionals")
        .select("id, menu_item_id, title, description, price, sort_order, active")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .order("sort_order", { ascending: true });

    if (error) {
        if (error.code === "42501") {
            return NextResponse.json(
                { error: "Sem permissao para listar adicionais" },
                { status: 403 },
            );
        }

        return NextResponse.json(
            { error: "Falha ao carregar adicionais" },
            { status: 500 },
        );
    }

    return NextResponse.json({ data: (data as AdditionalRow[] | null) ?? [] });
}

export async function POST(request: Request) {
    const context = await resolveTenantId();

    if ("error" in context) {
        return context.error;
    }

    const { supabase, tenantId } = context;

    const body = await request.json().catch(() => null);
    const parsed = createAdditionalSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            { error: "Dados do adicional invalidos" },
            { status: 400 },
        );
    }

    const { data: menuItem } = await supabase
        .from("menu_items")
        .select("id, name")
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

    const { data: lastAdditional } = await supabase
        .from("menu_item_additionals")
        .select("sort_order")
        .eq("tenant_id", tenantId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

    const nextSortOrder = (lastAdditional?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
        .from("menu_item_additionals")
        .insert({
            tenant_id: tenantId,
            menu_item_id: parsed.data.menuItemId,
            title: parsed.data.title,
            description:
                parsed.data.description && parsed.data.description.length > 0
                    ? parsed.data.description
                    : null,
            price: parsed.data.price,
            sort_order: nextSortOrder,
            active: true,
        })
        .select("id, menu_item_id, title, description, price, sort_order, active")
        .single();

    if (error) {
        if (error.code === "23505") {
            return NextResponse.json(
                { error: "Adicional ja existe para este item" },
                { status: 409 },
            );
        }

        if (error.code === "42501") {
            return NextResponse.json(
                { error: "Sem permissao para criar adicional" },
                { status: 403 },
            );
        }

        return NextResponse.json(
            { error: "Falha ao criar adicional" },
            { status: 500 },
        );
    }

    const additional = data as AdditionalRow;

    return NextResponse.json(
        {
            data: {
                ...additional,
                item_name: menuItem.name as string,
            },
        },
        { status: 201 },
    );
}
