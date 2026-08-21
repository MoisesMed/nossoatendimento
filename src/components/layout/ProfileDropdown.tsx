"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, X } from "lucide-react";
import { toast } from "react-toastify";
import AppModal from "@/components/ui/AppModal";
import { cn } from "@/lib/cn";

type EmployeeRole = "DONO" | "ATENDENTE" | "USUARIO";

type EmployeeFormErrors = {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
};

type ProfileDropdownProps = {
  fullName: string;
  userEmail: string;
  initials: string;
  userRole: "DONO" | "ATENDENTE" | "USUARIO";
  signOutAction: () => Promise<void>;
};

export default function ProfileDropdown({
  fullName,
  userEmail,
  initials,
  userRole,
  signOutAction,
}: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateEmployeeModalOpen, setIsCreateEmployeeModalOpen] =
    useState(false);
  const [employeeFullName, setEmployeeFullName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeePhone, setEmployeePhone] = useState("");
  const [employeePassword, setEmployeePassword] = useState("");
  const [employeeConfirmPassword, setEmployeeConfirmPassword] = useState("");
  const [employeeRole, setEmployeeRole] = useState<EmployeeRole>("ATENDENTE");
  const [employeeErrors, setEmployeeErrors] = useState<EmployeeFormErrors>({});
  const [isSubmittingEmployee, setIsSubmittingEmployee] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;

      if (!rootRef.current || !target) {
        return;
      }

      if (!rootRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleScrollClose = () => {
      setIsOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick, {
      passive: true,
    });
    window.addEventListener("scroll", handleScrollClose, {
      capture: true,
      passive: true,
    });

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      window.removeEventListener("scroll", handleScrollClose, true);
    };
  }, [isOpen]);

  const closeCreateEmployeeModal = () => {
    if (isSubmittingEmployee) {
      return;
    }

    setIsCreateEmployeeModalOpen(false);
  };

  const resetCreateEmployeeForm = () => {
    setEmployeeFullName("");
    setEmployeeEmail("");
    setEmployeePhone("");
    setEmployeePassword("");
    setEmployeeConfirmPassword("");
    setEmployeeRole("ATENDENTE");
    setEmployeeErrors({});
  };

  const handleOpenCreateEmployeeModal = () => {
    setIsOpen(false);
    setEmployeeErrors({});
    setIsCreateEmployeeModalOpen(true);
  };

  const clearEmployeeFieldError = (field: keyof EmployeeFormErrors) => {
    setEmployeeErrors((current) => {
      if (!current[field]) {
        return current;
      }

      return {
        ...current,
        [field]: undefined,
      };
    });
  };

  const validateEmployeeForm = () => {
    const nextErrors: EmployeeFormErrors = {};
    const normalizedEmail = employeeEmail.trim();
    const normalizedPhone = employeePhone.replace(/\D/g, "");

    if (employeeFullName.trim().length < 3) {
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

    if (employeePassword.length < 6) {
      nextErrors.password = "A senha precisa ter pelo menos 6 caracteres";
    }

    if (employeeConfirmPassword.length < 6) {
      nextErrors.confirmPassword = "Confirme a senha";
    } else if (employeePassword !== employeeConfirmPassword) {
      nextErrors.confirmPassword = "As senhas não conferem";
    }

    setEmployeeErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmitCreateEmployee = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (isSubmittingEmployee) {
      return;
    }

    if (!validateEmployeeForm()) {
      return;
    }

    setIsSubmittingEmployee(true);

    try {
      const response = await fetch("/api/funcionarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: employeeFullName.trim(),
          email: employeeEmail.trim(),
          phone: employeePhone,
          password: employeePassword,
          role: employeeRole,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Falha ao criar funcionário");
      }

      toast.success("Funcionário criado com sucesso.");
      resetCreateEmployeeForm();
      setIsCreateEmployeeModalOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao criar funcionário";
      toast.error(message);
    } finally {
      setIsSubmittingEmployee(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="list-none rounded-full ring-offset-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-border)]"
        aria-expanded={isOpen}
        aria-label="Abrir menu de perfil"
      >
        <div className="flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--app-surface-muted)] text-xs font-bold text-[var(--app-text)]">
            {initials}
          </div>
          <ChevronDown className="h-4 w-4 text-[var(--app-muted)]" />
        </div>
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-[60] mt-2 w-56 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-2 shadow-xl">
          <div className="mb-2 border-b border-[var(--app-border)] px-2 pb-2">
            <p className="text-sm font-semibold text-[var(--app-text)]">
              {fullName}
            </p>
            <p className="truncate text-[12px] text-[var(--app-muted)]">
              {userEmail}
            </p>
          </div>

          {userRole === "DONO" ? (
            <button
              type="button"
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--app-muted)] transition hover:opacity-80"
              onClick={handleOpenCreateEmployeeModal}
            >
              Adicionar funcionário
            </button>
          ) : null}

          {(userRole === "DONO" || userRole === "ATENDENTE") && (
            <Link
              href="/auditoria"
              className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--app-muted)] transition hover:opacity-80"
              onClick={() => setIsOpen(false)}
            >
              Auditoria
            </Link>
          )}

          <form action={signOutAction}>
            <button
              type="submit"
              className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--app-muted)] transition hover:opacity-80"
            >
              Sair
            </button>
          </form>
        </div>
      ) : null}

      <AppModal
        isOpen={isCreateEmployeeModalOpen}
        onClose={closeCreateEmployeeModal}
        portal
        overlayClassName="z-[200]"
        panelClassName="w-full rounded-2xl bg-white p-5 shadow-xl sm:max-w-md sm:p-6"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-slate-900">
            Adicionar funcionário
          </h2>
          <button
            type="button"
            disabled={isSubmittingEmployee}
            onClick={closeCreateEmployeeModal}
            className="rounded-md p-1 text-slate-500 transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="space-y-3"
          noValidate
          onSubmit={handleSubmitCreateEmployee}
        >
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-800">
              Nome completo
            </span>
            <input
              type="text"
              value={employeeFullName}
              disabled={isSubmittingEmployee}
              onChange={(event) => {
                setEmployeeFullName(event.target.value);
                clearEmployeeFieldError("fullName");
              }}
              placeholder="Nome e sobrenome"
              className={cn(
                "w-full rounded-xl border px-3 py-2 text-sm text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:opacity-60",
                employeeErrors.fullName
                  ? "border-red-500"
                  : "border-gray-300 focus:border-emerald-600",
              )}
            />
            {employeeErrors.fullName ? (
              <p className="text-xs text-red-500">{employeeErrors.fullName}</p>
            ) : null}
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-800">Email</span>
            <input
              type="email"
              value={employeeEmail}
              disabled={isSubmittingEmployee}
              onChange={(event) => {
                setEmployeeEmail(event.target.value);
                clearEmployeeFieldError("email");
              }}
              placeholder="funcionário@restaurante.com"
              className={cn(
                "w-full rounded-xl border px-3 py-2 text-sm text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:opacity-60",
                employeeErrors.email
                  ? "border-red-500"
                  : "border-gray-300 focus:border-emerald-600",
              )}
            />
            {employeeErrors.email ? (
              <p className="text-xs text-red-500">{employeeErrors.email}</p>
            ) : null}
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-800">Telefone</span>
            <input
              type="text"
              value={employeePhone}
              disabled={isSubmittingEmployee}
              onChange={(event) => {
                setEmployeePhone(event.target.value);
                clearEmployeeFieldError("phone");
              }}
              placeholder="11999999999"
              className={cn(
                "w-full rounded-xl border px-3 py-2 text-sm text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:opacity-60",
                employeeErrors.phone
                  ? "border-red-500"
                  : "border-gray-300 focus:border-emerald-600",
              )}
            />
            {employeeErrors.phone ? (
              <p className="text-xs text-red-500">{employeeErrors.phone}</p>
            ) : null}
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-800">Senha</span>
            <input
              type="text"
              value={employeePassword}
              disabled={isSubmittingEmployee}
              onChange={(event) => {
                setEmployeePassword(event.target.value);
                clearEmployeeFieldError("password");
              }}
              placeholder="Mínimo 6 caracteres"
              className={cn(
                "w-full rounded-xl border px-3 py-2 text-sm text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:opacity-60",
                employeeErrors.password
                  ? "border-red-500"
                  : "border-gray-300 focus:border-emerald-600",
              )}
            />
            {employeeErrors.password ? (
              <p className="text-xs text-red-500">{employeeErrors.password}</p>
            ) : null}
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-800">
              Repetir senha
            </span>
            <input
              type="text"
              value={employeeConfirmPassword}
              disabled={isSubmittingEmployee}
              onChange={(event) => {
                setEmployeeConfirmPassword(event.target.value);
                clearEmployeeFieldError("confirmPassword");
              }}
              placeholder="Repita a senha"
              className={cn(
                "w-full rounded-xl border px-3 py-2 text-sm text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:opacity-60",
                employeeErrors.confirmPassword
                  ? "border-red-500"
                  : "border-gray-300 focus:border-emerald-600",
              )}
            />
            {employeeErrors.confirmPassword ? (
              <p className="text-xs text-red-500">
                {employeeErrors.confirmPassword}
              </p>
            ) : null}
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-800">
              Permissão
            </span>
            <select
              value={employeeRole}
              disabled={isSubmittingEmployee}
              onChange={(event) =>
                setEmployeeRole(event.target.value as EmployeeRole)
              }
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="DONO">Dono</option>
              <option value="ATENDENTE">Atendente</option>
              <option value="USUARIO">Usuário</option>
            </select>
            {employeeRole === "DONO" ? (
              <p className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                Atenção: esta permissão concede acesso total ao restaurante.
              </p>
            ) : null}
          </label>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              disabled={isSubmittingEmployee}
              onClick={closeCreateEmployeeModal}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmittingEmployee}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmittingEmployee ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Criar
            </button>
          </div>
        </form>
      </AppModal>
    </div>
  );
}
