"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "react-toastify";
import { cn } from "@/lib/cn";

type EmployeeRole = "DONO" | "ATENDENTE" | "USUARIO";

type EmployeeFormErrors = {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
};

const roleLabels: Record<EmployeeRole, string> = {
  DONO: "Dono",
  ATENDENTE: "Atendente",
  USUARIO: "Usuário",
};

export default function CreateEmployeeForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<EmployeeRole>("ATENDENTE");
  const [errors, setErrors] = useState<EmployeeFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearFieldError = (field: keyof EmployeeFormErrors) => {
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      return {
        ...current,
        [field]: undefined,
      };
    });
  };

  const validateForm = () => {
    const nextErrors: EmployeeFormErrors = {};
    const normalizedEmail = email.trim();
    const normalizedPhone = phone.replace(/\D/g, "");

    if (fullName.trim().length < 3) {
      nextErrors.fullName = "Informe o nome completo";
    }

    if (!normalizedEmail) {
      nextErrors.email = "Informe um email valido";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        nextErrors.email = "Informe um email valido";
      }
    }

    if (normalizedPhone.length < 10) {
      nextErrors.phone = "Informe um telefone valido com DDD";
    } else if (normalizedPhone.length > 15) {
      nextErrors.phone = "Número muito longo";
    }

    if (password.length < 6) {
      nextErrors.password = "A senha precisa ter pelo menos 6 caracteres";
    }

    if (confirmPassword.length < 6) {
      nextErrors.confirmPassword = "Confirme a senha";
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = "As senhas não conferem";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/funcionarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          phone,
          password,
          role,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Falha ao criar funcionário");
      }

      toast.success("Funcionário criado com sucesso.");
      setFullName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setConfirmPassword("");
      setRole("ATENDENTE");
      setErrors({});
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao criar funcionário";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="w-full max-w-xl rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-[var(--app-text)] sm:text-xl">
          Adicionar funcionário
        </h1>
        <p className="mt-1 text-sm text-[var(--app-muted)]">
          Informe email, senha e permissão para criar um novo acesso no
          restaurante.
        </p>
      </div>

      <form className="space-y-4" noValidate onSubmit={handleSubmit}>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--app-text)]">
            Nome completo
          </span>
          <input
            type="text"
            value={fullName}
            disabled={isSubmitting}
            onChange={(event) => {
              setFullName(event.target.value);
              clearFieldError("fullName");
            }}
            placeholder="Nome e sobrenome"
            className={cn(
              "w-full rounded-md border bg-white px-3 py-2 text-sm text-[var(--app-text)] outline-none transition",
              errors.fullName
                ? "border-red-500"
                : "border-[var(--app-border)] focus:border-[var(--app-primary)]",
            )}
          />
          {errors.fullName ? (
            <p className="text-xs text-red-500">{errors.fullName}</p>
          ) : null}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--app-text)]">
            Email
          </span>
          <input
            type="email"
            value={email}
            disabled={isSubmitting}
            onChange={(event) => {
              setEmail(event.target.value);
              clearFieldError("email");
            }}
            placeholder="funcionário@restaurante.com"
            className={cn(
              "w-full rounded-md border bg-white px-3 py-2 text-sm text-[var(--app-text)] outline-none transition",
              errors.email
                ? "border-red-500"
                : "border-[var(--app-border)] focus:border-[var(--app-primary)]",
            )}
          />
          {errors.email ? (
            <p className="text-xs text-red-500">{errors.email}</p>
          ) : null}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--app-text)]">
            Telefone
          </span>
          <input
            type="text"
            value={phone}
            disabled={isSubmitting}
            onChange={(event) => {
              setPhone(event.target.value);
              clearFieldError("phone");
            }}
            placeholder="11999999999"
            className={cn(
              "w-full rounded-md border bg-white px-3 py-2 text-sm text-[var(--app-text)] outline-none transition",
              errors.phone
                ? "border-red-500"
                : "border-[var(--app-border)] focus:border-[var(--app-primary)]",
            )}
          />
          {errors.phone ? (
            <p className="text-xs text-red-500">{errors.phone}</p>
          ) : null}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--app-text)]">
            Senha
          </span>
          <input
            type="text"
            value={password}
            disabled={isSubmitting}
            onChange={(event) => {
              setPassword(event.target.value);
              clearFieldError("password");
            }}
            placeholder="Mínimo 6 caracteres"
            className={cn(
              "w-full rounded-md border bg-white px-3 py-2 text-sm text-[var(--app-text)] outline-none transition",
              errors.password
                ? "border-red-500"
                : "border-[var(--app-border)] focus:border-[var(--app-primary)]",
            )}
          />
          {errors.password ? (
            <p className="text-xs text-red-500">{errors.password}</p>
          ) : null}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--app-text)]">
            Repetir senha
          </span>
          <input
            type="text"
            value={confirmPassword}
            disabled={isSubmitting}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              clearFieldError("confirmPassword");
            }}
            placeholder="Repita a senha"
            className={cn(
              "w-full rounded-md border bg-white px-3 py-2 text-sm text-[var(--app-text)] outline-none transition",
              errors.confirmPassword
                ? "border-red-500"
                : "border-[var(--app-border)] focus:border-[var(--app-primary)]",
            )}
          />
          {errors.confirmPassword ? (
            <p className="text-xs text-red-500">{errors.confirmPassword}</p>
          ) : null}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--app-text)]">
            Permissão
          </span>
          <select
            value={role}
            disabled={isSubmitting}
            onChange={(event) => setRole(event.target.value as EmployeeRole)}
            className="w-full rounded-md border border-[var(--app-border)] bg-white px-3 py-2 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-primary)]"
          >
            <option value="DONO">{roleLabels.DONO}</option>
            <option value="ATENDENTE">{roleLabels.ATENDENTE}</option>
            <option value="USUARIO">{roleLabels.USUARIO}</option>
          </select>
          {role === "DONO" ? (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900">
              Atenção: esta permissão concede acesso total ao restaurante.
            </p>
          ) : null}
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--app-primary)] px-3 py-2 text-sm font-semibold text-[var(--app-primary-contrast)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          {isSubmitting ? "Criando..." : "Criar funcionário"}
        </button>
      </form>
    </section>
  );
}
