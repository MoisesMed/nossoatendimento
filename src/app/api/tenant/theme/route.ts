import { z } from "zod";
import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/tenantContext";
import { resolveTenantTheme } from "@/lib/theme";

type MembershipRole = "DONO" | "ATENDENTE" | "USUARIO";

type MembershipRoleRow = {
  role: MembershipRole;
};

const updateThemeSchema = z.object({
  background: z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/).optional(),
  surface: z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/).optional(),
  surfaceMuted: z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/).optional(),
  border: z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/).optional(),
  text: z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/).optional(),
  muted: z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/).optional(),
  primary: z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/).optional(),
  primaryContrast: z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/).optional(),
});

function isAdminLike(role: MembershipRole) {
  return role === "DONO" || role === "ATENDENTE";
}

export async function GET() {
  const { tenant } = await requireTenantContext();

  return NextResponse.json({
    data: resolveTenantTheme(tenant.theme),
  });
}

export async function PATCH(request: Request) {
  const { supabase, user, tenant } = await requireTenantContext();

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("role")
    .eq("tenant_id", tenant.id)
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json({ error: "Falha ao validar permissao" }, { status: 500 });
  }

  const typedMembership = membership as MembershipRoleRow;

  if (!isAdminLike(typedMembership.role)) {
    return NextResponse.json({ error: "Sem permissao para atualizar tema" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = updateThemeSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload de tema invalido" }, { status: 400 });
  }

  const nextTheme = {
    ...resolveTenantTheme(tenant.theme),
    ...parsed.data,
  };

  const { data, error } = await supabase
    .from("tenants")
    .update({ theme: nextTheme })
    .eq("id", tenant.id)
    .select("theme")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Falha ao atualizar tema" }, { status: 500 });
  }

  return NextResponse.json({
    data: resolveTenantTheme((data as { theme: unknown }).theme),
  });
}
