import { z } from "zod";
import { NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { requireTenantContext } from "@/lib/tenantContext";

const createEmployeeSchema = z.object({
    email: z.email("Email invalido"),
    fullName: z
        .string()
        .trim()
        .min(3, "Nome completo invalido")
        .max(120, "Nome completo muito longo"),
    phone: z
        .string()
        .trim()
        .min(10, "Telefone invalido")
        .max(20, "Telefone invalido"),
    password: z
        .string()
        .min(6, "Senha deve ter no minimo 6 caracteres")
        .max(72, "Senha muito longa"),
    role: z.enum(["DONO", "ATENDENTE", "USUARIO"]),
});

export async function POST(request: Request) {
    const { supabase, tenant, userRole } = await requireTenantContext();

    if (userRole !== "DONO") {
        return NextResponse.json(
            { error: "Apenas o dono pode adicionar funcionarios" },
            { status: 403 },
        );
    }

    const body = await request.json().catch(() => null);
    const parsed = createEmployeeSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json({ error: "Dados invalidos" }, { status: 400 });
    }

    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const normalizedFullName = parsed.data.fullName.trim();
    const normalizedPhone = parsed.data.phone.replace(/\D/g, "");

    if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
        return NextResponse.json({ error: "Telefone invalido" }, { status: 400 });
    }

    const { data: existingProfile, error: existingProfileError } = await supabase
        .from("tenant_user_profiles")
        .select("user_id, phone")
        .eq("tenant_id", tenant.id)
        .or(`email.eq.${normalizedEmail},phone.eq.${normalizedPhone}`)
        .maybeSingle();

    if (existingProfileError) {
        return NextResponse.json(
            { error: "Falha ao validar email no tenant" },
            { status: 500 },
        );
    }

    if (existingProfile) {
        const existingByPhone =
            typeof existingProfile.phone === "string" &&
            existingProfile.phone === normalizedPhone;

        return NextResponse.json(
            {
                error: existingByPhone
                    ? "Este telefone ja esta vinculado a este restaurante"
                    : "Este email ja esta vinculado a este restaurante",
            },
            { status: 409 },
        );
    }

    const supabaseUrl =
        process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json(
            {
                error:
                    "Configuracao de ambiente incompleta. Defina SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_SECRET_KEY.",
            },
            { status: 500 },
        );
    }

    const supabaseAdmin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    const { data: createdUser, error: createUserError } =
        await supabaseAdmin.auth.admin.createUser({
            email: normalizedEmail,
            password: parsed.data.password,
            email_confirm: true,
            user_metadata: {
                tenant_slug: tenant.slug,
                full_name: normalizedFullName,
                phone: normalizedPhone,
            },
        });

    if (createUserError || !createdUser.user) {
        const createUserMessage = (createUserError?.message ?? "").toLowerCase();

        if (
            createUserMessage.includes("already") ||
            createUserMessage.includes("registered")
        ) {
            return NextResponse.json(
                {
                    error:
                        "Este email ja possui cadastro. Se necessario, apenas vincule o usuario ao tenant.",
                },
                { status: 409 },
            );
        }

        return NextResponse.json(
            {
                error:
                    createUserError?.message ?? "Nao foi possivel criar o usuario",
            },
            { status: 400 },
        );
    }

    const createdUserId = createdUser.user.id;

    const { error: membershipError } = await supabase
        .from("memberships")
        .upsert(
            {
                tenant_id: tenant.id,
                user_id: createdUserId,
                role: parsed.data.role,
                active: true,
            },
            { onConflict: "tenant_id,user_id" },
        );

    if (membershipError) {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        return NextResponse.json(
            {
                error: "Falha ao vincular funcionario ao restaurante",
                detail: membershipError.message,
            },
            { status: 500 },
        );
    }

    const { data: existingCreatedProfile, error: profileLookupError } =
        await supabase
            .from("tenant_user_profiles")
            .select("user_id")
            .eq("tenant_id", tenant.id)
            .eq("user_id", createdUserId)
            .maybeSingle();

    if (profileLookupError) {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        return NextResponse.json(
            {
                error: "Falha ao validar perfil do funcionario",
                detail: profileLookupError.message,
            },
            { status: 500 },
        );
    }

    const profilePayload = {
        tenant_id: tenant.id,
        user_id: createdUserId,
        email: normalizedEmail,
        phone: normalizedPhone,
        full_name: normalizedFullName,
    };

    let profileError: { message: string } | null = null;

    if (existingCreatedProfile) {
        const { error: profileUpdateError } = await supabase
            .from("tenant_user_profiles")
            .update({
                email: normalizedEmail,
                phone: normalizedPhone,
                full_name: normalizedFullName,
            })
            .eq("tenant_id", tenant.id)
            .eq("user_id", createdUserId);

        profileError = profileUpdateError;
    } else {
        const { error: profileInsertError } = await supabaseAdmin
            .from("tenant_user_profiles")
            .insert(profilePayload);

        profileError = profileInsertError;
    }

    if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        return NextResponse.json(
            {
                error: "Falha ao salvar dados do funcionario",
                detail: profileError.message,
            },
            { status: 500 },
        );
    }

    return NextResponse.json(
        {
            data: {
                id: createdUserId,
                email: normalizedEmail,
                fullName: normalizedFullName,
                phone: normalizedPhone,
                role: parsed.data.role,
            },
        },
        { status: 201 },
    );
}
