import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/tenantContext";

type MembershipRole = "DONO" | "ATENDENTE" | "USUARIO";

type MembershipRoleRow = {
  role: MembershipRole;
};

const BUCKET = "restaurant-logos";

export async function POST(request: Request) {
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

  if (typedMembership.role !== "DONO") {
    return NextResponse.json({ error: "Apenas o dono pode atualizar a logo" }, { status: 403 });
  }

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
  const path = `${tenant.id}/${crypto.randomUUID()}.webp`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, fileBuffer, {
      contentType: "image/webp",
      upsert: false,
      cacheControl: "31536000, immutable",
    });

  if (uploadError) {
    return NextResponse.json({ error: "Falha no upload da logo" }, { status: 500 });
  }

  const previousLogoPath = tenant.logo_path;

  const { error: updateError } = await supabase
    .from("tenants")
    .update({ logo_path: path })
    .eq("id", tenant.id);

  if (updateError) {
    await supabase.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: "Falha ao salvar a logo" }, { status: 500 });
  }

  if (previousLogoPath && previousLogoPath !== path) {
    await supabase.storage.from(BUCKET).remove([previousLogoPath]);
  }

  const imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

  return NextResponse.json({
    data: {
      imagePath: path,
      imageUrl,
    },
  });
}
