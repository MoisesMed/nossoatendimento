"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "react-toastify";

type EmployeeRole = "ATENDENTE" | "USUARIO";

const roleLabels: Record<EmployeeRole, string> = {
  ATENDENTE: "Atendente",
  USUARIO: "Usuario",
};

export default function CreateEmployeeForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<EmployeeRole>("ATENDENTE");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (password !== confirmPassword) {
      toast.error("As senhas nao conferem.");
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
          fullName,
          email,
          phone,
          password,
          role,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Falha ao criar funcionario");
      }

      toast.success("Funcionario criado com sucesso.");
      setFullName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setConfirmPassword("");
      setRole("ATENDENTE");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao criar funcionario";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="w-full max-w-xl rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-[var(--app-text)] sm:text-xl">
          Adicionar funcionario
        </h1>
        <p className="mt-1 text-sm text-[var(--app-muted)]">
          Informe email, senha e permissao para criar um novo acesso no
          restaurante.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--app-text)]">
            Nome completo
          </span>
          <input
            type="text"
            required
            minLength={3}
            value={fullName}
            disabled={isSubmitting}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Nome e sobrenome"
            className="w-full rounded-md border border-[var(--app-border)] bg-white px-3 py-2 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-primary)]"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--app-text)]">
            Email
          </span>
          <input
            type="email"
            required
            value={email}
            disabled={isSubmitting}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="funcionario@restaurante.com"
            className="w-full rounded-md border border-[var(--app-border)] bg-white px-3 py-2 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-primary)]"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--app-text)]">
            Telefone
          </span>
          <input
            type="text"
            required
            value={phone}
            disabled={isSubmitting}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="11999999999"
            className="w-full rounded-md border border-[var(--app-border)] bg-white px-3 py-2 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-primary)]"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--app-text)]">
            Senha
          </span>
          <input
            type="text"
            required
            minLength={6}
            value={password}
            disabled={isSubmitting}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimo 6 caracteres"
            className="w-full rounded-md border border-[var(--app-border)] bg-white px-3 py-2 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-primary)]"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--app-text)]">
            Repetir senha
          </span>
          <input
            type="text"
            required
            minLength={6}
            value={confirmPassword}
            disabled={isSubmitting}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repita a senha"
            className="w-full rounded-md border border-[var(--app-border)] bg-white px-3 py-2 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-primary)]"
          />
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
            <option value="ATENDENTE">{roleLabels.ATENDENTE}</option>
            <option value="USUARIO">{roleLabels.USUARIO}</option>
          </select>
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
          {isSubmitting ? "Criando..." : "Criar funcionario"}
        </button>
      </form>
    </section>
  );
}
