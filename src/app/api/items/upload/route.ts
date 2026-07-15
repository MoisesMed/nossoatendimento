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

  const membershipsQuery = supabase
    .from("memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .eq("active", true);

  const { data: memberships } = targetTenantId
    ? await membershipsQuery.eq("tenant_id", targetTenantId).limit(1)
    : await membershipsQuery.limit(1);

  const typedMemberships = memberships as MembershipRow[] | null;

  if (!typedMemberships || typedMemberships.length === 0) {
    return { error: NextResponse.json({ error: "Usuario sem membership" }, { status: 403 }) };
  }

  const membership = typedMemberships[0];

  if (membership.role !== "DONO" && membership.role !== "ATENDENTE") {
    return {
      error: NextResponse.json(
        { error: "Sem permissao para subir imagem de item" },
        { status: 403 },
      ),
    };
  }

  return { supabase, tenantId: membership.tenant_id };
}

export async function POST(request: Request) {
  const context = await resolveTenantId();

  if ("error" in context) {
    return context.error;
  }

  const { supabase, tenantId } = context;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo invalido" }, { status: 400 });
  }

  const acceptedTypes = ["image/webp", "image/jpeg", "image/png"];

  if (!acceptedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Formato nao suportado" }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Imagem muito grande" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);
  const path = `${tenantId}/${crypto.randomUUID()}.webp`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, fileBuffer, {
      contentType: "image/webp",
      upsert: false,
      cacheControl: "31536000, immutable",
    });

  if (uploadError) {
    const message =
      uploadError.message?.toLowerCase().includes("row-level security")
        ? "Sem permissao para gravar imagem neste tenant"
        : "Falha no upload da imagem";

    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data: signedData, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 30);

  if (signError || !signedData?.signedUrl) {
    return NextResponse.json({ data: { imagePath: path } });
  }

  return NextResponse.json({
    data: {
      imagePath: path,
      imageUrl: signedData.signedUrl,
    },
  });
}
