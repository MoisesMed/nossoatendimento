"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "react-toastify";

type TenantLogoUploaderProps = {
  tenantName: string;
  tenantLogoUrl: string | null;
  canEdit: boolean;
};

function getInitials(tenantName: string) {
  const parts = tenantName
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3);

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "LOG";
}

export default function TenantLogoUploader({
  tenantName,
  tenantLogoUrl,
  canEdit,
}: TenantLogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();

  const initials = getInitials(tenantName);

  const handlePickFile = () => {
    if (!canEdit || isUploading) {
      return;
    }

    inputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";

    if (!file || !canEdit) {
      return;
    }

    const acceptedTypes = ["image/webp", "image/jpeg", "image/png"];

    if (!acceptedTypes.includes(file.type)) {
      toast.error("Formato invalido. Use WEBP, JPG ou PNG.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no maximo 5MB.");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/tenant/logo", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao atualizar logo");
      }

      toast.success("Logo atualizada com sucesso.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao atualizar logo",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const triggerClasses = canEdit
    ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-border)]"
    : "cursor-default";

  return (
    <>
      <button
        type="button"
        className={`group relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[var(--app-border)] bg-[var(--app-surface-muted)] text-sm font-semibold text-[var(--app-text)] ${triggerClasses}`}
        onClick={handlePickFile}
        aria-label={canEdit ? "Atualizar logo do restaurante" : "Logo do restaurante"}
        title={canEdit ? "Clique para trocar a logo" : "Logo do restaurante"}
        disabled={isUploading}
      >
        {tenantLogoUrl ? (
          <Image
            src={tenantLogoUrl}
            alt={`Logo de ${tenantName}`}
            width={40}
            height={40}
            className="h-full w-full"
          />
        ) : (
          <span>{initials}</span>
        )}

        {canEdit ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <Upload className="h-4 w-4 text-white" />
            )}
          </span>
        ) : null}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/webp,image/jpeg,image/png"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  );
}