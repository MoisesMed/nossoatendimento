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

type MesaPrintPayment = {
  id: string;
  method: "CREDITO" | "DEBITO" | "PIX" | "DINHEIRO";
  amount: number;
};

const paymentMethodLabels: Record<MesaPrintPayment["method"], string> = {
  CREDITO: "Cartão de Crédito",
  DEBITO: "Cartão de Débito",
  PIX: "PIX",
  DINHEIRO: "Dinheiro",
};

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
  topSummaryLines,
  extraLines,
  total,
  showSummary = true,
}: {
  title: string;
  mesaCode: number;
  mesaName: string;
  subtitle: string;
  items: MesaPrintItem[];
  topSummaryLines?: Array<{ label: string; value: string }>;
  extraLines?: Array<{ label: string; value: string }>;
  total: number;
  showSummary?: boolean;
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
        <div class="summary-line">
          <span>${escapeHtml(line.label)}</span>
          <span>${escapeHtml(line.value)}</span>
        </div>
      `,
    )
    .join("");
  const topSummaryLinesHtml = (topSummaryLines ?? [])
    .map(
      (line) => `
        <div class="top-summary-line">
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
            font-size: 16px;
            line-height: 1.35;
          }

          .receipt {
            width: 100%;
          }

          .center {
            text-align: center;
          }

          .title {
            font-size: 17.5px;
            font-weight: 700;
            margin-bottom: 2px;
            text-transform: uppercase;
          }

          .subtitle {
            font-size: 16px;
            margin-bottom: 4px;
            text-transform: uppercase;
          }

          .separator {
            border-top: 1px dashed #111827;
            margin: 12px 0;
          }

          .summary {
            margin-top: 4px;
          }

          .top-summary {
            margin-top: 10px;
            border: 1px solid #111827;
            border-radius: 6px;
            padding: 8px 10px;
            background: #f8fafc;
          }

          .top-summary-line {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            font-size: 15px;
            font-weight: 700;
            margin-top: 2px;
          }

          .top-summary-line:first-child {
            margin-top: 0;
          }

          .summary-line {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            font-size: 16px;
            font-weight: 600;
            margin-top: 4px;
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
            font-size: 14px;
            margin-left: 10px;
          }

          .total {
            display: flex;
            justify-content: space-between;
            font-size: 17px;
            font-weight: 700;
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px dashed #111827;
          }

          .meta {
            color: #4b5563;
            font-size: 14px;
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

          ${topSummaryLinesHtml ? `<div class="top-summary">${topSummaryLinesHtml}</div>` : ""}

          <div class="separator"></div>

          ${itemsHtml || '<div class="center">Sem itens para imprimir.</div>'}

          ${
            showSummary
              ? `
          <div class="separator"></div>

          <div class="summary">
            ${extraLinesHtml}

            <div class="total" style="margin-top: 12px;">
              <span>Total</span>
              <span>${formatCurrency(total)}</span>
            </div>
          </div>
          `
              : ""
          }
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
  serviceChargePercent,
  isServiceChargeEnabled,
  payments,
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
  serviceChargePercent: number;
  isServiceChargeEnabled: boolean;
  payments: MesaPrintPayment[];
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
        title: "Comanda Cozinha",
        mesaCode,
        mesaName,
        subtitle: "Itens para preparo",
        items: waitingItems,
        total,
        showSummary: false,
      }),
    );
  };

  const handlePrintConta = () => {
    const sourceItems = allItems;

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
    const serviceChargeTotal = isServiceChargeEnabled
      ? (itemsTotal * Math.max(0, serviceChargePercent)) / 100
      : 0;
    const total = itemsTotal + couvertTotal + serviceChargeTotal;
    const paidTotal = payments.reduce(
      (sum, payment) => sum + Math.max(0, payment.amount),
      0,
    );
    const remainingTotal = Math.max(0, total - paidTotal);
    const topSummaryLines = [
      ...(total > 0
        ? [{ label: "Total da mesa", value: formatCurrency(total) }]
        : []),
      ...(paidTotal > 0
        ? [{ label: "Total pago", value: formatCurrency(paidTotal) }]
        : []),
      ...(remainingTotal > 0
        ? [{ label: "Saldo restante", value: formatCurrency(remainingTotal) }]
        : []),
    ];

    const paymentSummaryByMethod = payments.reduce<
      Partial<Record<MesaPrintPayment["method"], number>>
    >((acc, payment) => {
      const previous = acc[payment.method] ?? 0;
      acc[payment.method] = previous + Math.max(0, payment.amount);
      return acc;
    }, {});

    const paymentLines = (
      Object.entries(paymentSummaryByMethod) as Array<
        [MesaPrintPayment["method"], number]
      >
    )
      .filter(([, amount]) => amount > 0)
      .map(([method, amount]) => ({
        label: `Pago (${paymentMethodLabels[method]})`,
        value: formatCurrency(amount),
      }));

    printThermalDocument(
      buildPrintHtml({
        title: "Conta",
        mesaCode,
        mesaName,
        subtitle: "Conta parcial",
        items: sourceItems,
        topSummaryLines,
        extraLines: [
          {
            label: "Subtotal itens",
            value: formatCurrency(itemsTotal),
          },
          ...(isCouvertEnabled
            ? [
                {
                  label: `Couvert Artístico (${peopleCount} x ${formatCurrency(Math.max(0, couvertUnitValue))})`,
                  value: formatCurrency(couvertTotal),
                },
              ]
            : []),
          ...(isServiceChargeEnabled
            ? [
                {
                  label: `Taxa de serviço (${serviceChargePercent}%)`,
                  value: formatCurrency(serviceChargeTotal),
                },
              ]
            : []),
          ...paymentLines,
          ...(paidTotal > 0
            ? [
                {
                  label: "Total pago",
                  value: formatCurrency(paidTotal),
                },
                {
                  label: "Restante",
                  value: formatCurrency(remainingTotal),
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
            Emitir comanda cozinha
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => handlePrintConta()}
            className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-[var(--app-text)] hover:bg-[var(--app-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Emitir conta parcial
          </button>
        </div>
      ) : null}
    </div>
  );
}
