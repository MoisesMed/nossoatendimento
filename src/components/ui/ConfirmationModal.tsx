import { Loader2, X } from "lucide-react";
import { Title } from "@/components/ui/Typography";

type ConfirmationModalProps = {
  isOpen: boolean;
  title: string;
  description: string;
  helperText?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: "danger" | "primary";
  isConfirming?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ConfirmationModal({
  isOpen,
  title,
  description,
  helperText,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  confirmTone = "danger",
  isConfirming = false,
  onConfirm,
  onClose,
}: ConfirmationModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end overflow-y-auto bg-black/45 p-3 sm:items-center sm:justify-center">
      <div className="w-full rounded-md border border-[var(--app-border)] bg-white p-4 shadow-2xl sm:max-w-md sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <Title as="h2" size="modal">
            {title}
          </Title>
          <button
            type="button"
            disabled={isConfirming}
            onClick={onClose}
            className="rounded-md p-1 text-[var(--app-muted)] hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Fechar confirmação"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-[var(--app-text)]">{description}</p>
        {helperText ? (
          <p className="mt-2 text-xs text-[var(--app-muted)]">{helperText}</p>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isConfirming}
            onClick={onClose}
            className="rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isConfirming}
            onClick={onConfirm}
            className={[
              "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60",
              confirmTone === "danger"
                ? "border border-rose-200 bg-rose-50 text-rose-700"
                : "bg-[var(--app-primary)] text-[var(--app-primary-contrast)]",
            ].join(" ")}
          >
            {isConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
