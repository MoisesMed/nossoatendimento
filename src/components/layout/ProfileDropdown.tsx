"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, X } from "lucide-react";
import { toast } from "react-toastify";
import AppModal from "@/components/ui/AppModal";

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
  const [employeeRole, setEmployeeRole] = useState<"ATENDENTE" | "USUARIO">(
    "ATENDENTE",
  );
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
  };

  const handleOpenCreateEmployeeModal = () => {
    setIsOpen(false);
    setIsCreateEmployeeModalOpen(true);
  };

  const handleSubmitCreateEmployee = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (isSubmittingEmployee) {
      return;
    }

    if (employeePassword !== employeeConfirmPassword) {
      toast.error("As senhas nao conferem.");
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
          fullName: employeeFullName,
          email: employeeEmail,
          phone: employeePhone,
          password: employeePassword,
          role: employeeRole,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Falha ao criar funcionario");
      }

      toast.success("Funcionario criado com sucesso.");
      resetCreateEmployeeForm();
      setIsCreateEmployeeModalOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao criar funcionario";
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
            <p className="text-sm font-semibold text-[var(--app-text)]">{fullName}</p>
            <p className="truncate text-[12px] text-[var(--app-muted)]">{userEmail}</p>
          </div>

          {userRole === "DONO" ? (
            <button
              type="button"
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--app-muted)] transition hover:opacity-80"
              onClick={handleOpenCreateEmployeeModal}
            >
              Adicionar funcionario
            </button>
          ) : null}

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
                    Adicionar funcionario
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

                <form className="space-y-3" onSubmit={handleSubmitCreateEmployee}>
                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-slate-800">Nome completo</span>
                    <input
                      type="text"
                      required
                      minLength={3}
                      value={employeeFullName}
                      disabled={isSubmittingEmployee}
                      onChange={(event) =>
                        setEmployeeFullName(event.target.value)
                      }
                      placeholder="Nome e sobrenome"
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-slate-800">Email</span>
                    <input
                      type="email"
                      required
                      value={employeeEmail}
                      disabled={isSubmittingEmployee}
                      onChange={(event) => setEmployeeEmail(event.target.value)}
                      placeholder="funcionario@restaurante.com"
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-slate-800">Telefone</span>
                    <input
                      type="text"
                      required
                      value={employeePhone}
                      disabled={isSubmittingEmployee}
                      onChange={(event) => setEmployeePhone(event.target.value)}
                      placeholder="11999999999"
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-slate-800">Senha</span>
                    <input
                      type="text"
                      required
                      minLength={6}
                      value={employeePassword}
                      disabled={isSubmittingEmployee}
                      onChange={(event) =>
                        setEmployeePassword(event.target.value)
                      }
                      placeholder="Minimo 6 caracteres"
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-slate-800">Repetir senha</span>
                    <input
                      type="text"
                      required
                      minLength={6}
                      value={employeeConfirmPassword}
                      disabled={isSubmittingEmployee}
                      onChange={(event) =>
                        setEmployeeConfirmPassword(event.target.value)
                      }
                      placeholder="Repita a senha"
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-slate-800">Permissao</span>
                    <select
                      value={employeeRole}
                      disabled={isSubmittingEmployee}
                      onChange={(event) =>
                        setEmployeeRole(
                          event.target.value as "ATENDENTE" | "USUARIO",
                        )
                      }
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="ATENDENTE">Atendente</option>
                      <option value="USUARIO">Usuario</option>
                    </select>
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
