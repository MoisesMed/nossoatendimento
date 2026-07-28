"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

type AppModalProps = {
  isOpen: boolean;
  onClose?: () => void;
  children: ReactNode;
  panelClassName: string;
  overlayClassName?: string;
  closeOnBackdrop?: boolean;
  portal?: boolean;
};

export default function AppModal({
  isOpen,
  onClose,
  children,
  panelClassName,
  overlayClassName,
  closeOnBackdrop = true,
  portal = false,
}: AppModalProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isOpen) {
    return null;
  }

  const modalContent = (
    <div
      className={cn(
        "fixed inset-0 z-[120] flex items-end overflow-y-auto bg-black/45 p-3 sm:items-center sm:justify-center",
        overlayClassName,
      )}
      onClick={() => {
        if (!closeOnBackdrop) {
          return;
        }

        onClose?.();
      }}
    >
      <div className={panelClassName} onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );

  if (portal) {
    if (!isMounted) {
      return null;
    }

    return createPortal(modalContent, document.body);
  }

  return modalContent;
}
