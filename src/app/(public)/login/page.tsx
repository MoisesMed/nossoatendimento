"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogIn, Store, UserPlus } from "lucide-react";
import { toast } from "react-toastify";
import { z } from "zod";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/cn";

const CURRENT_TENANT_SLUG = "manja";

const loginSchema = z.object({
  email: z.email("Informe um email valido"),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres"),
});

const registerSchema = z
  .object({
    fullName: z.string().min(3, "Informe o nome completo"),
    email: z.email("Informe um email valido"),
    phone: z
      .string()
      .min(10, "Informe um telefone valido com DDD")
      .max(15, "Numero muito longo"),
    password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres"),
    confirmPassword: z.string().min(6, "Confirme a senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas nao conferem",
  });

type LoginInput = z.infer<typeof loginSchema>;
type RegisterInput = z.infer<typeof registerSchema>;

export default function Page() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [accessWarning, setAccessWarning] = useState<string | null>(null);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<
    string | null
  >(null);

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        return;
      }

      const { data: memberships, error: membershipsError } = await supabase
        .from("memberships")
        .select("tenant_id")
        .eq("user_id", data.session.user.id)
        .eq("active", true)
        .limit(1);

      if (membershipsError) {
        setAccessWarning(
          "Nao foi possivel validar seu acesso agora. Tente entrar novamente.",
        );
        return;
      }

      if (Array.isArray(memberships) && memberships.length > 0) {
        router.replace("/mesas");
        return;
      }

      await supabase.rpc("ensure_default_membership");

      const { data: membershipsAfterBootstrap } = await supabase
        .from("memberships")
        .select("tenant_id")
        .eq("user_id", data.session.user.id)
        .eq("active", true)
        .limit(1);

      if (
        Array.isArray(membershipsAfterBootstrap) &&
        membershipsAfterBootstrap.length > 0
      ) {
        router.replace("/mesas");
        return;
      }

      setAccessWarning(
        "Seu usuario nao possui acesso ativo a nenhum restaurante.",
      );
    };

    void checkSession();
  }, [router]);

  const {
    register: loginRegister,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors, isSubmitting: isLoginSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const {
    register: registerRegister,
    handleSubmit: handleRegisterSubmit,
    formState: { errors: registerErrors, isSubmitting: isRegisterSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (input: LoginInput) => {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });

      if (error) {
        throw error;
      }
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (input: RegisterInput) => {
      const supabase = createClient();
      const normalizedEmail = input.email.trim().toLowerCase();
      const normalizedPhone = input.phone.replace(/\D/g, "");

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: input.password,
        options: {
          data: {
            full_name: input.fullName,
            phone: normalizedPhone,
            tenant_slug: CURRENT_TENANT_SLUG,
          },
        },
      });

      if (error) {
        throw error;
      }

      return data;
    },
  });

  const onLoginSubmit = async (data: LoginInput) => {
    try {
      const supabase = createClient();
      await loginMutation.mutateAsync(data);

      await supabase.rpc("ensure_default_membership");

      setAccessWarning(null);
      setPendingConfirmationEmail(null);
      router.replace("/mesas");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Email not confirmed")
      ) {
        toast.info("Confirme seu email antes de entrar.");
        return;
      }

      toast.error("Falha no login. Verifique email e senha.");
    }
  };

  const onRegisterSubmit = async (data: RegisterInput) => {
    try {
      const authData = await registerMutation.mutateAsync(data);

      if (authData.session) {
        setPendingConfirmationEmail(null);
        router.push("/mesas");
      } else {
        setPendingConfirmationEmail(authData.user?.email ?? data.email);
        toast.info("Cadastro realizado. Confirme seu email para continuar.");
      }

      setMode("login");
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";

      if (message.includes("tenant_user_profiles_tenant_id_email_key")) {
        toast.error("Este email ja esta em uso neste restaurante.");
        return;
      }

      if (message.includes("tenant_user_profiles_tenant_id_phone_key")) {
        toast.error("Este telefone ja esta em uso neste restaurante.");
        return;
      }

      toast.error("Falha no cadastro. Tente novamente.");
    }
  };

  const isLoginLoading = isLoginSubmitting || loginMutation.isPending;
  const isRegisterLoading = isRegisterSubmitting || registerMutation.isPending;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50 to-slate-100 p-4">
      <section className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <Store className="h-5 w-5 text-emerald-600" />
          <h1 className="text-xl font-semibold">Acesso do atendimento</h1>
        </div>

        <p className="mb-6 text-xs text-slate-500">
          Cada usuario pertence ao tenant MANJA. No futuro, o tenant sera
          resolvido por dominio.
        </p>

        {mode === "login" ? (
          <form
            className="space-y-4"
            onSubmit={handleLoginSubmit(onLoginSubmit)}
          >
            {accessWarning ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {accessWarning}
              </div>
            ) : null}

            {pendingConfirmationEmail ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Confirmacao pendente para {pendingConfirmationEmail}. Acesse seu
                email e confirme a conta para continuar.
              </div>
            ) : null}

            <label className="block space-y-1">
              <span className="text-sm font-medium">Email</span>
              <input
                {...loginRegister("email")}
                type="email"
                placeholder="voce@restaurante.com"
                disabled={isLoginLoading}
                className={cn(
                  "w-full rounded-xl border px-3 py-2 text-sm outline-none transition",
                  loginErrors.email
                    ? "border-red-500"
                    : "border-gray-300 focus:border-emerald-600",
                )}
              />
              {loginErrors.email ? (
                <p className="text-xs text-red-500">
                  {loginErrors.email.message}
                </p>
              ) : null}
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">Senha</span>
              <input
                {...loginRegister("password")}
                type="password"
                placeholder="******"
                disabled={isLoginLoading}
                className={cn(
                  "w-full rounded-xl border px-3 py-2 text-sm outline-none transition",
                  loginErrors.password
                    ? "border-red-500"
                    : "border-gray-300 focus:border-emerald-600",
                )}
              />
              {loginErrors.password ? (
                <p className="text-xs text-red-500">
                  {loginErrors.password.message}
                </p>
              ) : null}
            </label>

            <button
              type="submit"
              disabled={isLoginLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <LogIn className="h-4 w-4" />
              {isLoginLoading ? "Entrando..." : "Entrar"}
            </button>

            <button
              type="button"
              disabled={isLoginLoading}
              onClick={() => {
                setPendingConfirmationEmail(null);
                setMode("register");
              }}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Nao tenho conta, quero me registrar
            </button>
          </form>
        ) : (
          <form
            className="space-y-4"
            onSubmit={handleRegisterSubmit(onRegisterSubmit)}
          >
            <button
              type="button"
              disabled={isRegisterLoading}
              onClick={() => setMode("login")}
              className="mb-2 inline-flex items-center gap-1 text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar para login
            </button>

            <label className="block space-y-1">
              <span className="text-sm font-medium">Nome completo</span>
              <input
                {...registerRegister("fullName")}
                placeholder="Nome e sobrenome"
                disabled={isRegisterLoading}
                className={cn(
                  "w-full rounded-xl border px-3 py-2 text-sm outline-none transition",
                  registerErrors.fullName
                    ? "border-red-500"
                    : "border-gray-300 focus:border-emerald-600",
                )}
              />
              {registerErrors.fullName ? (
                <p className="text-xs text-red-500">
                  {registerErrors.fullName.message}
                </p>
              ) : null}
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">Email</span>
              <input
                {...registerRegister("email")}
                type="email"
                placeholder="voce@restaurante.com"
                disabled={isRegisterLoading}
                className={cn(
                  "w-full rounded-xl border px-3 py-2 text-sm outline-none transition",
                  registerErrors.email
                    ? "border-red-500"
                    : "border-gray-300 focus:border-emerald-600",
                )}
              />
              {registerErrors.email ? (
                <p className="text-xs text-red-500">
                  {registerErrors.email.message}
                </p>
              ) : null}
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">Telefone</span>
              <input
                {...registerRegister("phone")}
                placeholder="11999999999"
                disabled={isRegisterLoading}
                className={cn(
                  "w-full rounded-xl border px-3 py-2 text-sm outline-none transition",
                  registerErrors.phone
                    ? "border-red-500"
                    : "border-gray-300 focus:border-emerald-600",
                )}
              />
              {registerErrors.phone ? (
                <p className="text-xs text-red-500">
                  {registerErrors.phone.message}
                </p>
              ) : null}
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">Senha</span>
              <input
                {...registerRegister("password")}
                type="password"
                placeholder="******"
                disabled={isRegisterLoading}
                className={cn(
                  "w-full rounded-xl border px-3 py-2 text-sm outline-none transition",
                  registerErrors.password
                    ? "border-red-500"
                    : "border-gray-300 focus:border-emerald-600",
                )}
              />
              {registerErrors.password ? (
                <p className="text-xs text-red-500">
                  {registerErrors.password.message}
                </p>
              ) : null}
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">Confirmar senha</span>
              <input
                {...registerRegister("confirmPassword")}
                type="password"
                placeholder="******"
                disabled={isRegisterLoading}
                className={cn(
                  "w-full rounded-xl border px-3 py-2 text-sm outline-none transition",
                  registerErrors.confirmPassword
                    ? "border-red-500"
                    : "border-gray-300 focus:border-emerald-600",
                )}
              />
              {registerErrors.confirmPassword ? (
                <p className="text-xs text-red-500">
                  {registerErrors.confirmPassword.message}
                </p>
              ) : null}
            </label>

            <button
              type="submit"
              disabled={isRegisterLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <UserPlus className="h-4 w-4" />
              {isRegisterLoading ? "Cadastrando..." : "Criar conta"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
