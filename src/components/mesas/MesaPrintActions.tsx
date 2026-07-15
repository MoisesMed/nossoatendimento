"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ReceiptText } from "lucide-react";
import { toast } from "react-toastify";

type MesaPrintItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  pricingType?: "UNIDADE" | "PESO";
  weightKg?: number;
  additionalTitles?: string[];
  additionalTotal?: number;
};

type ContaPrintMode = "PARCIAL" | "TOTAL";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatPrintItemLabel(item: MesaPrintItem) {
  if (item.pricingType === "PESO" && item.weightKg && item.weightKg > 0) {
    return `1x ${item.name} (${item.weightKg.toLocaleString("pt-BR", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })} kg)`;
  }

  return `${item.quantity}x ${item.name}`;
}

function buildPrintHtml({
  title,
  mesaCode,
  mesaName,
  subtitle,
  items,
  extraLines,
  total,
}: {
  title: string;
  mesaCode: number;
  mesaName: string;
  subtitle: string;
  items: MesaPrintItem[];
  extraLines?: Array<{ label: string; value: string }>;
  total: number;
}) {
  const now = new Date();
  const itemsHtml = items
    .map((item) => {
      const lineTotal = item.quantity * item.price;
      const additionalTitles = item.additionalTitles ?? [];
      const hasAdditionalTitles = additionalTitles.length > 0;
      const additionalUnitTotal = Math.max(0, item.additionalTotal ?? 0);
      const additionalLineTotal = additionalUnitTotal * item.quantity;
      const hasAdditionals = hasAdditionalTitles || additionalLineTotal > 0;
      const additionalLabel = hasAdditionalTitles
        ? `+ ${additionalTitles.join(", ")}`
        : "+ Adicionais";

      return `
        <div class="line-item">
          <div class="line-item-top">
            <span>${escapeHtml(formatPrintItemLabel(item))}</span>
            <span>${formatCurrency(lineTotal)}</span>
          </div>
          ${hasAdditionals ? `<div class="line-item-extra"><span>${escapeHtml(additionalLabel)}</span><span>${formatCurrency(additionalLineTotal)}</span></div>` : ""}
        </div>
      `;
    })
    .join("");
  const extraLinesHtml = (extraLines ?? [])
    .map(
      (line) => `
        <div class="total" style="font-size: 11px; font-weight: 600; margin-top: 4px;">
          <span>${escapeHtml(line.label)}</span>
          <span>${escapeHtml(line.value)}</span>
        </div>
      `,
    )
    .join("");

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          @page {
            size: 58mm auto;
            margin: 4mm;
          }

          * {
            box-sizing: border-box;
            font-family: "Courier New", Courier, monospace;
          }

          body {
            margin: 0;
            color: #111827;
            background: #ffffff;
            font-size: 11px;
            line-height: 1.35;
          }

          .receipt {
            width: 100%;
          }

          .center {
            text-align: center;
          }

          .title {
            font-size: 14px;
            font-weight: 700;
            margin-bottom: 2px;
            text-transform: uppercase;
          }

          .subtitle {
            font-size: 11px;
            margin-bottom: 4px;
            text-transform: uppercase;
          }

          .separator {
            border-top: 1px dashed #111827;
            margin: 6px 0;
          }

          .line-item {
            margin-bottom: 5px;
          }

          .line-item-top {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            font-weight: 700;
          }

          .line-item-extra {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            color: #4b5563;
            font-size: 10px;
            margin-left: 10px;
          }

          .total {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            font-weight: 700;
            margin-top: 8px;
          }

          .meta {
            color: #4b5563;
            font-size: 10px;
          }
        </style>
      </head>
      <body>
        <main class="receipt">
          <div class="center">
            <div class="title">${escapeHtml(title)}</div>
            <div>Mesa ${escapeHtml(String(mesaCode))} - ${escapeHtml(mesaName)}</div>
            <div class="subtitle">${escapeHtml(subtitle)}</div>
            <div class="meta">${escapeHtml(now.toLocaleString("pt-BR"))}</div>
          </div>

          <div class="separator"></div>

          ${itemsHtml || '<div class="center">Sem itens para imprimir.</div>'}

          <div class="separator"></div>

          ${extraLinesHtml}

          <div class="total">
            <span>Total</span>
            <span>${formatCurrency(total)}</span>
          </div>
        </main>
      </body>
    </html>
  `;
}

function printThermalDocument(html: string) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const cleanup = () => {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  };

  iframe.onload = () => {
    const printWindow = iframe.contentWindow;

    if (!printWindow) {
      cleanup();
      toast.error("Não foi possível abrir a janela de impressão.");
      return;
    }

    printWindow.focus();
    printWindow.print();
    setTimeout(cleanup, 1200);
  };

  try {
    const iframeDoc = iframe.contentDocument;

    if (!iframeDoc) {
      cleanup();
      toast.error("Não foi possível preparar a impressão.");
      return;
    }

    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();
  } catch {
    cleanup();
    toast.error("Não foi possível abrir a janela de impressão.");
  }
}

export default function MesaPrintActions({
  mesaCode,
  mesaName,
  waitingItems,
  deliveredItems,
  allItems,
  peopleCount,
  couvertUnitValue,
  isCouvertEnabled,
  disabled,
}: {
  mesaCode: number;
  mesaName: string;
  waitingItems: MesaPrintItem[];
  deliveredItems: MesaPrintItem[];
  allItems: MesaPrintItem[];
  peopleCount: number;
  couvertUnitValue: number;
  isCouvertEnabled: boolean;
  disabled?: boolean;
}) {
  const [isContaMenuOpen, setIsContaMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) {
        return;
      }

      if (!menuRef.current.contains(event.target as Node)) {
        setIsContaMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handlePrintComanda = () => {
    if (waitingItems.length === 0) {
      toast.info("Não há itens aguardando envio para imprimir comanda.");
      return;
    }

    const total = waitingItems.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0,
    );

    printThermalDocument(
      buildPrintHtml({
        title: "Comanda",
        mesaCode,
        mesaName,
        subtitle: "Itens aguardando envio",
        items: waitingItems,
        total,
      }),
    );
  };

  const handlePrintConta = (mode: ContaPrintMode) => {
    const sourceItems = mode === "PARCIAL" ? deliveredItems : allItems;

    if (sourceItems.length === 0) {
      toast.info("Não há itens para emitir esta conta.");
      setIsContaMenuOpen(false);
      return;
    }

    const itemsTotal = sourceItems.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0,
    );
    const couvertTotal = isCouvertEnabled
      ? Math.max(0, peopleCount) * Math.max(0, couvertUnitValue)
      : 0;
    const total = itemsTotal + couvertTotal;

    printThermalDocument(
      buildPrintHtml({
        title: "Conta",
        mesaCode,
        mesaName,
        subtitle: mode === "PARCIAL" ? "Conta parcial" : "Conta total",
        items: sourceItems,
        extraLines: [
          {
            label: "Subtotal itens",
            value: formatCurrency(itemsTotal),
          },
          ...(isCouvertEnabled
            ? [
                {
                  label: `Couvert (${peopleCount} x ${formatCurrency(Math.max(0, couvertUnitValue))})`,
                  value: formatCurrency(couvertTotal),
                },
              ]
            : []),
        ],
        total,
      }),
    );

    setIsContaMenuOpen(false);
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsContaMenuOpen((current) => !current)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm font-semibold text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <ReceiptText className="h-4 w-4" /> CONTA
        <ChevronDown className="h-4 w-4" />
      </button>

      {isContaMenuOpen ? (
        <div className="absolute left-0 top-full z-30 mt-1 w-full min-w-[220px] rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-lg">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              handlePrintComanda();
              setIsContaMenuOpen(false);
            }}
            className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-[var(--app-text)] hover:bg-[var(--app-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Emitir comanda
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => handlePrintConta("PARCIAL")}
            className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-[var(--app-text)] hover:bg-[var(--app-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Emitir conta parcial
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => handlePrintConta("TOTAL")}
            className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-[var(--app-text)] hover:bg-[var(--app-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Emitir conta total
          </button>
        </div>
      ) : null}
    </div>
  );
}
