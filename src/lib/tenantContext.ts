import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  theme: unknown;
};

type MembershipRow = {
  tenant_id: string;
  role: "DONO" | "ATENDENTE" | "USUARIO";
};

async function getFirstActiveMembership(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("memberships")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  return (data as MembershipRow | null) ?? null;
}

export async function requireTenantContext() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/cardapio");
  }

  const preferredSlug =
    typeof user.user_metadata?.tenant_slug === "string"
      ? user.user_metadata.tenant_slug.trim().toLowerCase()
      : "manja";

  const { data: preferredTenant } = await supabase
    .from("tenants")
    .select("id, slug, name, theme")
    .eq("slug", preferredSlug)
    .maybeSingle();

  const typedPreferredTenant = preferredTenant as TenantRow | null;

  if (typedPreferredTenant) {
    const { data: preferredMembership } = await supabase
      .from("memberships")
      .select("tenant_id, role")
      .eq("tenant_id", typedPreferredTenant.id)
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();

    const typedPreferredMembership = preferredMembership as MembershipRow | null;

    if (typedPreferredMembership) {
      return {
        supabase,
        user,
        tenant: typedPreferredTenant,
        userRole: typedPreferredMembership.role,
      };
    }
  }

  let typedMembership = await getFirstActiveMembership(supabase, user.id);

  if (!typedMembership) {
    await supabase.rpc("ensure_default_membership");
    typedMembership = await getFirstActiveMembership(supabase, user.id);
  }

  if (!typedMembership) {
    redirect("/");
  }

  const { data: fallbackTenant } = await supabase
    .from("tenants")
    .select("id, slug, name, theme")
    .eq("id", typedMembership.tenant_id)
    .single();

  const typedFallbackTenant = fallbackTenant as TenantRow | null;

  if (!typedFallbackTenant) {
    redirect("/");
  }

  return {
    supabase,
    user,
    tenant: typedFallbackTenant,
    userRole: typedMembership.role,
  };
}
