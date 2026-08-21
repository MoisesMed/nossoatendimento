"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import Select, {
  components,
  type DropdownIndicatorProps,
  type GroupBase,
  type SingleValue,
  type StylesConfig,
} from "react-select";
import {
  ChevronDown,
  CheckCircle2,
  Clock3,
  Info,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Percent,
  Trash2,
  Users,
  Wallet,
  type LucideIcon,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import MesaPrintActions from "@/components/mesas/MesaPrintActions";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import AppModal from "@/components/ui/AppModal";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type MesaStatus = "VAZIA" | "OCUPADA" | "EM_PREPARO" | "AGUARDANDO_PAGAMENTO";

type Mesa = {
  id: string;
  code: number;
  name: string;
  seats: number;
  status: MesaStatus;
  notes: string | null;
};

type CreateMesaInput = {
  code: string;
  name: string;
  seats: string;
  notes: string;
};

type MesaItem = {
  id: string;
  mesaId?: string;
  code?: number;
  name: string;
  quantity: number;
  price: number;
  originalPrice: number | null;
  delivered: boolean;
  pricingType?: "UNIDADE" | "PESO";
  weightKg?: number;
  additionalTitles?: string[];
  additionalTotal?: number;
};

type RestaurantTableRealtimeRow = {
  id: string;
  tenant_id?: string;
  code: number;
  name: string;
  seats: number;
  status: MesaStatus;
  notes: string | null;
  active: boolean;
};

type RestaurantTableItemRealtimeRow = {
  id: string;
  tenant_id?: string;
  table_id: string;
  code: number | null;
  name: string;
  quantity: number;
  price: number;
  original_price: number | null;
  delivered: boolean;
  pricing_type: "UNIDADE" | "PESO" | null;
  weight_kg: number | null;
  additional_titles: string[] | null;
  additional_total: number | null;
};

type PaymentMethod = "CREDITO" | "DEBITO" | "PIX" | "DINHEIRO";

type MesaPayment = {
  id: string;
  method: PaymentMethod;
  amount: number;
  createdAt: string;
};

type ClosedComanda = {
  id: string;
  mesaId: string;
  mesaCode: number;
  mesaName: string;
  closedAt: string;
  subtotal: number;
  couvertTotal: number;
  serviceChargeTotal: number;
  grandTotal: number;
  paidTotal: number;
  remainingTotal: number;
  observation: string | null;
  items: MesaItem[];
  payments: MesaPayment[];
};

type MesaCouvertOverride = {
  enabled: boolean;
  value: number;
};

type MesaServiceChargeOverride = {
  enabled: boolean;
  value: number;
};

type MesaItemDraft = {
  catalogItemId: string;
  quantity: string;
  weightKg: string;
};

type CatalogItem = {
  id: string;
  code: number;
  name: string;
  category: string;
  price: number;
  promotional_price: number | null;
  pricing_type: "UNIDADE" | "PESO";
  active: boolean;
};

type CatalogItemAdditional = {
  id: string;
  menu_item_id: string;
  item_name?: string | null;
  title: string;
  description: string | null;
  price: number;
  sort_order: number;
  active: boolean;
};

type CatalogItemSelectOption = {
  value: string;
  label: string;
};

type QuickCatalogItemForm = {
  name: string;
  category: string;
  price: string;
  promotionalPrice: string;
  pricingType: "UNIDADE" | "PESO";
};

const CREATE_NEW_CATALOG_ITEM_VALUE = "__CREATE_NEW_CATALOG_ITEM__";
const DAILY_COUVERT_STORAGE_PREFIX = "nossoatendimento-daily-couvert";
const DAILY_COUVERT_ENABLED_STORAGE_PREFIX =
  "nossoatendimento-daily-couvert-enabled";
const MESA_COUVERT_OVERRIDES_STORAGE_PREFIX =
  "nossoatendimento-mesa-couvert-overrides";
const DAILY_SERVICE_CHARGE_STORAGE_PREFIX =
  "nossoatendimento-daily-service-charge";
const DAILY_SERVICE_CHARGE_ENABLED_STORAGE_PREFIX =
  "nossoatendimento-daily-service-charge-enabled";
const MESA_SERVICE_CHARGE_OVERRIDES_STORAGE_PREFIX =
  "nossoatendimento-mesa-service-charge-overrides";
const MESA_PAYMENTS_STORAGE_KEY = "nossoatendimento-mesa-payments";
const CLOSED_COMANDAS_STORAGE_KEY = "nossoatendimento-closed-comandas";

let catalogItemsRequest: Promise<CatalogItem[]> | null = null;
let catalogItemsCache: CatalogItem[] | null = null;
let catalogItemAdditionalsRequest: Promise<CatalogItemAdditional[]> | null =
  null;
let catalogItemAdditionalsCache: CatalogItemAdditional[] | null = null;

const paymentMethodLabels: Record<PaymentMethod, string> = {
  CREDITO: "Cartão de Credito",
  DEBITO: "Cartão de Debito",
  PIX: "PIX (QR Code)",
  DINHEIRO: "Dinheiro",
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatWeightMaskInput(raw: string) {
  const digitsOnly = raw.replace(/\D/g, "").slice(0, 9);

  if (!digitsOnly) {
    return "";
  }

  const valueKg = Number(digitsOnly) / 1000;

  return valueKg.toLocaleString("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function maskedWeightToNumber(masked: string) {
  const digitsOnly = masked.replace(/\D/g, "");

  if (!digitsOnly) {
    return 0;
  }

  return Number(digitsOnly) / 1000;
}

function formatMesaItemName(item: MesaItem) {
  if (item.pricingType === "PESO" && item.weightKg && item.weightKg > 0) {
    return `${item.name} (${item.weightKg.toLocaleString("pt-BR", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })} kg)`;
  }

  return item.name;
}

function parseNonNegativeNumber(value: string) {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return 0;
  }

  return Math.max(0, numericValue);
}

async function fetchCatalogItemsOnce() {
  if (catalogItemsCache) {
    return catalogItemsCache;
  }

  if (!catalogItemsRequest) {
    catalogItemsRequest = (async () => {
      const response = await fetch("/api/items", { method: "GET" });
      const result = (await response.json().catch(() => ({}))) as {
        data?: CatalogItem[];
        error?: string;
      };

      if (!response.ok || !result.data) {
        throw new Error(result.error ?? "Falha ao carregar itens do cardápio.");
      }

      const normalized = result.data
        .filter((item) => item.active)
        .sort((a, b) => a.name.localeCompare(b.name));
      catalogItemsCache = normalized;
      return normalized;
    })().finally(() => {
      catalogItemsRequest = null;
    });
  }

  return catalogItemsRequest;
}

async function fetchCatalogItemAdditionalsOnce() {
  if (catalogItemAdditionalsCache) {
    return catalogItemAdditionalsCache;
  }

  if (!catalogItemAdditionalsRequest) {
    catalogItemAdditionalsRequest = (async () => {
      const response = await fetch("/api/items/additionals", {
        method: "GET",
      });
      const result = (await response.json().catch(() => ({}))) as {
        data?: CatalogItemAdditional[];
        error?: string;
      };

      if (!response.ok || !result.data) {
        throw new Error(result.error ?? "Falha ao carregar adicionais.");
      }

      const normalized = result.data.filter((additional) => additional.active);
      catalogItemAdditionalsCache = normalized;
      return normalized;
    })().finally(() => {
      catalogItemAdditionalsRequest = null;
    });
  }

  return catalogItemAdditionalsRequest;
}

async function fetchMesaItemsSnapshot() {
  const response = await fetch("/api/mesas/items", { method: "GET" });
  const result = (await response.json().catch(() => ({}))) as {
    data?: MesaItem[];
    error?: string;
  };

  if (!response.ok || !result.data) {
    throw new Error(
      result.error ?? "Falha ao atualizar itens das mesas em tempo real.",
    );
  }

  return result.data;
}

async function fetchMesasSnapshot() {
  const response = await fetch("/api/mesas", { method: "GET" });
  const result = (await response.json().catch(() => ({}))) as {
    data?: Mesa[];
    error?: string;
  };

  if (!response.ok || !result.data) {
    throw new Error(result.error ?? "Falha ao atualizar mesas em tempo real.");
  }

  return result.data;
}

function mapRealtimeTableToMesa(row: RestaurantTableRealtimeRow): Mesa {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    seats: row.seats,
    status: row.status,
    notes: row.notes,
  };
}

function mapRealtimeTableItemToMesaItem(
  row: RestaurantTableItemRealtimeRow,
): MesaItem {
  return {
    id: row.id,
    mesaId: row.table_id,
    code: row.code ?? undefined,
    name: row.name,
    quantity: row.quantity,
    price: row.price,
    originalPrice: row.original_price,
    delivered: row.delivered,
    pricingType: row.pricing_type ?? undefined,
    weightKg: row.weight_kg ?? undefined,
    additionalTitles: row.additional_titles ?? [],
    additionalTotal: row.additional_total ?? undefined,
  };
}

function ItemDropdownIndicator(
  props: DropdownIndicatorProps<
    CatalogItemSelectOption,
    false,
    GroupBase<CatalogItemSelectOption>
  >,
) {
  return (
    <components.DropdownIndicator {...props}>
      <ChevronDown className="h-3.5 w-3.5" />
    </components.DropdownIndicator>
  );
}

const itemSelectStyles: StylesConfig<
  CatalogItemSelectOption,
  false,
  GroupBase<CatalogItemSelectOption>
> = {
  control: (base, state) => ({
    ...base,
    minHeight: 40,
    borderRadius: 8,
    borderColor: "var(--app-border)",
    boxShadow: state.isFocused
      ? "0 0 0 2px color-mix(in oklab, var(--app-primary) 20%, transparent)"
      : "none",
    backgroundColor: "var(--app-surface)",
    ":hover": {
      borderColor: "var(--app-border)",
    },
  }),
  singleValue: (base) => ({
    ...base,
    color: "var(--app-text)",
    fontSize: 14,
  }),
  input: (base) => ({
    ...base,
    color: "var(--app-text)",
    fontSize: 14,
  }),
  placeholder: (base) => ({
    ...base,
    color: "var(--app-muted)",
    fontSize: 14,
  }),
  indicatorSeparator: () => ({
    display: "none",
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: "var(--app-muted)",
    transform: state.selectProps.menuIsOpen ? "rotate(180deg)" : "none",
    transition: "transform .15s ease",
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 8,
    border: "1px solid var(--app-border)",
    overflow: "hidden",
    boxShadow: "0 10px 26px rgba(15, 23, 42, 0.12)",
    zIndex: 90,
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 9999,
  }),
  menuList: (base) => ({
    ...base,
    padding: 4,
    backgroundColor: "#ffffff",
  }),
  option: (base, state) => ({
    ...base,
    borderRadius: 6,
    fontSize: 14,
    padding: "8px 10px",
    cursor: "pointer",
    backgroundColor: state.isSelected
      ? "var(--app-primary)"
      : state.isFocused
        ? "var(--app-surface-muted)"
        : "#ffffff",
    color: state.isSelected ? "var(--app-primary-contrast)" : "var(--app-text)",
  }),
};

const statusStyles: Record<
  MesaStatus,
  {
    card: string;
    label: string;
    bullet: string;
    icon: LucideIcon;
    statusChip: string;
    table: string;
    chairStroke: string;
    code: string;
  }
> = {
  VAZIA: {
    card: "border-slate-200 bg-white",
    label: "Vazia",
    bullet: "bg-emerald-600",
    icon: CheckCircle2,
    statusChip: "bg-emerald-100 text-emerald-800",
    table: "bg-emerald-100",
    chairStroke: "bg-emerald-700",
    code: "text-emerald-800",
  },
  OCUPADA: {
    card: "border-zinc-300 bg-zinc-100",
    label: "Ocupada",
    bullet: "bg-zinc-800",
    icon: Users,
    statusChip: "bg-zinc-200 text-zinc-800",
    table: "bg-zinc-700",
    chairStroke: "bg-zinc-700",
    code: "text-white",
  },
  EM_PREPARO: {
    card: "border-amber-300 bg-amber-100",
    label: "Em preparo",
    bullet: "bg-amber-600",
    icon: Clock3,
    statusChip: "bg-amber-200 text-amber-700",
    table: "bg-amber-600",
    chairStroke: "bg-amber-700",
    code: "text-white",
  },
  AGUARDANDO_PAGAMENTO: {
    card: "border-rose-300 bg-rose-100",
    label: "Aguardando Pagamento",
    bullet: "bg-rose-700",
    icon: Wallet,
    statusChip: "bg-rose-200 text-rose-700",
    table: "bg-rose-700",
    chairStroke: "bg-rose-700",
    code: "text-white",
  },
};

function MesaIcon({
  code,
  seats,
  status,
  isStatusUpdating,
}: {
  code: number;
  seats: number;
  status: MesaStatus;
  isStatusUpdating: boolean;
}) {
  const style = statusStyles[status];
  const totalSeats = Math.max(1, seats);
  const tableWidth =
    totalSeats <= 4 ? 46 : Math.min(46 + (totalSeats - 4) * 10, 98);
  const tableHeight = 46;

  const sideChairs = Math.min(2, totalSeats);
  const remainingSeats = Math.max(0, totalSeats - sideChairs);
  const topChairs = Math.ceil(remainingSeats / 2);
  const bottomChairs = Math.floor(remainingSeats / 2);

  const topChairPositions = Array.from({ length: topChairs }, (_, index) => {
    const offsetPercent = ((index + 1) / (topChairs + 1)) * 100;
    return offsetPercent;
  });

  const bottomChairPositions = Array.from(
    { length: bottomChairs },
    (_, index) => {
      const offsetPercent = ((index + 1) / (bottomChairs + 1)) * 100;
      return offsetPercent;
    },
  );

  return (
    <div className="mx-auto mb-2 h-20 w-full max-w-28">
      <div className="relative h-full w-full">
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: tableWidth, height: tableHeight }}
        >
          {sideChairs >= 1 ? (
            <span
              className={`absolute left-0.5 top-1/2 h-4 w-1.5 -translate-x-3 -translate-y-1/2 rounded ${style.chairStroke}`}
            />
          ) : null}

          {sideChairs >= 2 ? (
            <span
              className={`absolute right-0.5 top-1/2 h-4 w-1.5 translate-x-3 -translate-y-1/2 rounded ${style.chairStroke}`}
            />
          ) : null}

          {topChairPositions.map((leftPercent, index) => (
            <span
              key={`${code}-top-${index}`}
              className={`absolute -top-2.5 h-1.5 w-4 -translate-x-1/2 rounded ${style.chairStroke}`}
              style={{ left: `${leftPercent}%` }}
            />
          ))}

          {bottomChairPositions.map((leftPercent, index) => (
            <span
              key={`${code}-bottom-${index}`}
              className={`absolute -bottom-2.5 h-1.5 w-4 -translate-x-1/2 rounded ${style.chairStroke}`}
              style={{ left: `${leftPercent}%` }}
            />
          ))}

          <div
            className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg ${style.table}`}
            style={{ width: tableWidth, height: tableHeight }}
          >
            {isStatusUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <span className={`text-base font-semibold ${style.code}`}>
                {code}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MesaCard({
  mesa,
  menuOpen,
  isBusy,
  isStatusUpdating,
  hasExternalChange,
  waitingItemsCount,
  deliveredItemsCount,
  onOpen,
  onToggleMenu,
  onOpenStatus,
  onOpenEdit,
  couvertActionLabel,
  onToggleCouvert,
  serviceChargeActionLabel,
  onToggleServiceCharge,
  onDelete,
}: {
  mesa: Mesa;
  menuOpen: boolean;
  isBusy: boolean;
  isStatusUpdating: boolean;
  hasExternalChange: boolean;
  waitingItemsCount: number;
  deliveredItemsCount: number;
  onOpen: (mesa: Mesa) => void;
  onToggleMenu: (mesaId: string) => void;
  onOpenStatus: (mesa: Mesa) => void;
  onOpenEdit: (mesa: Mesa) => void;
  couvertActionLabel: string;
  onToggleCouvert: (mesa: Mesa) => void;
  serviceChargeActionLabel: string;
  onToggleServiceCharge: (mesa: Mesa) => void;
  onDelete: (mesa: Mesa) => void;
}) {
  const style = statusStyles[mesa.status];
  const StatusIcon = style.icon;
  const menuRootRef = useRef<HTMLDivElement | null>(null);
  const [menuHorizontalAlign, setMenuHorizontalAlign] = useState<
    "open-left" | "open-right"
  >("open-left");

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const updateMenuAlign = () => {
      const root = menuRootRef.current;

      if (!root) {
        return;
      }

      const rootRect = root.getBoundingClientRect();
      const menuWidth = 192;
      const spacing = 12;

      const availableToRight = window.innerWidth - rootRect.left - spacing;
      const availableToLeft = rootRect.right - spacing;

      if (availableToRight >= menuWidth || availableToRight > availableToLeft) {
        setMenuHorizontalAlign("open-right");
        return;
      }

      setMenuHorizontalAlign("open-left");
    };

    updateMenuAlign();
    window.addEventListener("resize", updateMenuAlign);

    return () => {
      window.removeEventListener("resize", updateMenuAlign);
    };
  }, [menuOpen]);

  return (
    <div
      className={`relative min-h-32 rounded-xl border p-2 shadow-sm ${style.card}`}
    >
      {hasExternalChange ? (
        <span className="absolute left-2 top-2 z-30 h-2.5 w-2.5 rounded-full bg-rose-600 ring-2 ring-white" />
      ) : null}
      <div
        ref={menuRootRef}
        data-mesa-menu-root="true"
        className="absolute right-2 top-2 z-30"
      >
        <button
          type="button"
          aria-label="Abrir opções da mesa"
          disabled={isBusy}
          onClick={() => onToggleMenu(mesa.id)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--app-muted)] transition hover:bg-[var(--app-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {menuOpen ? (
          <div
            className={[
              "absolute z-40 mt-1 w-48 max-w-[calc(100vw-1rem)] rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-lg z-50",
              menuHorizontalAlign === "open-right" ? "left-0" : "right-0",
            ].join(" ")}
          >
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onOpenStatus(mesa)}
              className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-[var(--app-text)] hover:bg-[var(--app-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mudar status
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onOpenEdit(mesa)}
              className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-xs text-[var(--app-text)] hover:bg-[var(--app-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar mesa
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onToggleCouvert(mesa)}
              className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-xs text-[var(--app-text)] hover:bg-[var(--app-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Wallet className="h-3.5 w-3.5" /> {couvertActionLabel}
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onToggleServiceCharge(mesa)}
              className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-xs text-[var(--app-text)] hover:bg-[var(--app-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Percent className="h-3.5 w-3.5" /> {serviceChargeActionLabel}
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onDelete(mesa)}
              className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-xs text-[var(--app-text)] hover:bg-[var(--app-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Deletar mesa
            </button>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        disabled={isBusy}
        onClick={() => onOpen(mesa)}
        className="relative z-0 block w-full pt-3 text-center transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-80"
      >
        <MesaIcon
          code={mesa.code}
          seats={mesa.seats}
          status={mesa.status}
          isStatusUpdating={isStatusUpdating}
        />

        <p className="text-[15px] font-semibold text-slate-800">{mesa.name}</p>
        <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--app-muted)]">
          <StatusIcon className="h-3.5 w-3.5" />
          {style.label}
        </p>
        <p className="mt-0.5 text-xs text-[var(--app-muted)]">
          {mesa.seats} {mesa.seats === 1 ? "cadeira" : "cadeiras"}
        </p>
        {waitingItemsCount > 0 || deliveredItemsCount > 0 ? (
          <p className="mt-1 text-[11px] font-medium text-[var(--app-muted)]">
            {waitingItemsCount} aguardando · {deliveredItemsCount} enviados
          </p>
        ) : null}
      </button>
    </div>
  );
}

export default function MesasBoard({
  initialMesas,
  tenantId,
}: {
  initialMesas: Mesa[];
  tenantId: string;
}) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const [mesas, setMesas] = useState<Mesa[]>(initialMesas);
  const [openLegendModal, setOpenLegendModal] = useState(false);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [isDailyCouvertEnabled, setIsDailyCouvertEnabled] = useState(false);
  const [dailyCouvertValue, setDailyCouvertValue] = useState("0");
  const [mesaCouvertOverrides, setMesaCouvertOverrides] = useState<
    Record<string, MesaCouvertOverride>
  >({});
  const [isDailyServiceChargeEnabled, setIsDailyServiceChargeEnabled] =
    useState(false);
  const [dailyServiceChargeValue, setDailyServiceChargeValue] = useState("10");
  const [mesaServiceChargeOverrides, setMesaServiceChargeOverrides] = useState<
    Record<string, MesaServiceChargeOverride>
  >({});
  const [couvertModalState, setCouvertModalState] = useState<{
    scope: "global" | "mesa";
    mesaId?: string;
    mesaName?: string;
  } | null>(null);
  const [couvertDraftValue, setCouvertDraftValue] = useState("0");
  const [serviceChargeModalState, setServiceChargeModalState] = useState<{
    scope: "global" | "mesa";
    mesaId?: string;
    mesaName?: string;
  } | null>(null);
  const [serviceChargeDraftValue, setServiceChargeDraftValue] = useState("10");
  const [pendingDisableConfig, setPendingDisableConfig] = useState<{
    type: "couvert" | "service-charge";
    scope: "global" | "mesa";
    mesa?: Mesa;
  } | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isQuickCreateItemModalOpen, setIsQuickCreateItemModalOpen] =
    useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isPagamentoMenuOpen, setIsPagamentoMenuOpen] = useState(false);
  const [pagamentoMenuAlign, setPagamentoMenuAlign] = useState<
    "open-left" | "open-right"
  >("open-left");
  const pagamentoMenuRef = useRef<HTMLDivElement | null>(null);
  const [openCloseComandaConfirm, setOpenCloseComandaConfirm] = useState(false);
  const [closeComandaObservation, setCloseComandaObservation] = useState("");
  const [isClosingComanda, setIsClosingComanda] = useState(false);
  const [deleteMesaAfterClose, setDeleteMesaAfterClose] = useState(false);
  const [mesaForDetail, setMesaForDetail] = useState<Mesa | null>(null);
  const [mesaForEdit, setMesaForEdit] = useState<Mesa | null>(null);
  const [mesaPendingDelete, setMesaPendingDelete] = useState<Mesa | null>(null);
  const [mesaItemPendingDelete, setMesaItemPendingDelete] =
    useState<MesaItem | null>(null);
  const [menuMesaId, setMenuMesaId] = useState<string | null>(null);
  const [statusPendingMesaId, setStatusPendingMesaId] = useState<string | null>(
    null,
  );
  const [mesaItemsByMesaId, setMesaItemsByMesaId] = useState<
    Record<string, MesaItem[]>
  >({});
  const [mesaPaymentsByMesaId, setMesaPaymentsByMesaId] = useState<
    Record<string, MesaPayment[]>
  >({});
  const [closedComandas, setClosedComandas] = useState<ClosedComanda[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogItemAdditionals, setCatalogItemAdditionals] = useState<
    CatalogItemAdditional[]
  >([]);
  const [isLoadingCatalogItems, setIsLoadingCatalogItems] = useState(false);
  const [isLoadingCatalogItemAdditionals, setIsLoadingCatalogItemAdditionals] =
    useState(false);
  const [paymentDraft, setPaymentDraft] = useState<{
    method: PaymentMethod;
    amount: string;
  }>({
    method: "CREDITO",
    amount: "",
  });
  const [itemDraft, setItemDraft] = useState<MesaItemDraft>({
    catalogItemId: "",
    quantity: "1",
    weightKg: "",
  });
  const [selectedAdditionalIds, setSelectedAdditionalIds] = useState<string[]>(
    [],
  );
  const [quickCatalogItemForm, setQuickCatalogItemForm] =
    useState<QuickCatalogItemForm>({
      name: "",
      category: "Sem Categoria",
      price: "",
      promotionalPrice: "",
      pricingType: "UNIDADE",
    });
  const [formData, setFormData] = useState<CreateMesaInput>({
    code: "",
    name: "",
    seats: "4",
    notes: "",
  });
  const [mesaExternalChangeById, setMesaExternalChangeById] = useState<
    Record<string, true>
  >({});
  const [syncingMesaItemsById, setSyncingMesaItemsById] = useState<
    Record<string, true>
  >({});
  const isAnyModalOpen =
    openLegendModal ||
    openCreateModal ||
    Boolean(mesaForEdit) ||
    Boolean(mesaForDetail) ||
    Boolean(couvertModalState) ||
    Boolean(serviceChargeModalState) ||
    Boolean(mesaPendingDelete) ||
    Boolean(mesaItemPendingDelete) ||
    isPaymentModalOpen ||
    openCloseComandaConfirm ||
    isAddItemModalOpen ||
    isQuickCreateItemModalOpen;
  const mesasRef = useRef<Mesa[]>(initialMesas);
  const activeMesaDetailIdRef = useRef<string | null>(null);
  const mesaItemsByMesaIdRef = useRef<Record<string, MesaItem[]>>({});
  const localMesaChangeUntilRef = useRef<Record<string, number>>({});
  const mesaItemsSyncCountByIdRef = useRef<Record<string, number>>({});
  const realtimeToastDedupRef = useRef<Record<string, number>>({});

  const startMesaItemsSync = (mesaId: string) => {
    const currentCount = mesaItemsSyncCountByIdRef.current[mesaId] ?? 0;
    mesaItemsSyncCountByIdRef.current[mesaId] = currentCount + 1;

    setSyncingMesaItemsById((previous) => {
      if (previous[mesaId]) {
        return previous;
      }

      return {
        ...previous,
        [mesaId]: true,
      };
    });
  };

  const finishMesaItemsSync = (mesaId: string) => {
    const currentCount = mesaItemsSyncCountByIdRef.current[mesaId] ?? 0;

    if (currentCount <= 1) {
      delete mesaItemsSyncCountByIdRef.current[mesaId];

      setSyncingMesaItemsById((previous) => {
        if (!previous[mesaId]) {
          return previous;
        }

        const next = { ...previous };
        delete next[mesaId];
        return next;
      });
      return;
    }

    mesaItemsSyncCountByIdRef.current[mesaId] = currentCount - 1;
  };

  const markLocalMesaChange = (mesaId: string) => {
    localMesaChangeUntilRef.current[mesaId] = Date.now() + 5000;
  };

  const isLikelyLocalMesaChange = (mesaId: string) => {
    const expiration = localMesaChangeUntilRef.current[mesaId];

    if (!expiration) {
      return false;
    }

    if (expiration < Date.now()) {
      delete localMesaChangeUntilRef.current[mesaId];
      return false;
    }

    return true;
  };

  const markMesaAsExternallyChanged = (mesaId: string) => {
    if (activeMesaDetailIdRef.current === mesaId) {
      return;
    }

    if (isLikelyLocalMesaChange(mesaId)) {
      return;
    }

    setMesaExternalChangeById((previous) => {
      if (previous[mesaId]) {
        return previous;
      }

      return {
        ...previous,
        [mesaId]: true,
      };
    });
  };

  const clearMesaExternalChange = (mesaId: string) => {
    setMesaExternalChangeById((previous) => {
      if (!previous[mesaId]) {
        return previous;
      }

      const next = { ...previous };
      delete next[mesaId];
      return next;
    });
  };

  const getMesaLabelById = (mesaId: string) => {
    const mesa = mesasRef.current.find((item) => item.id === mesaId);

    if (!mesa) {
      return "mesa";
    }

    return `${mesa.code} (${mesa.name})`;
  };

  const notifyRealtimeChange = (
    dedupKey: string,
    message: string,
    options?: {
      mesaId?: string;
      allowNavigateToMesa?: boolean;
    },
  ) => {
    const now = Date.now();
    const lastNotificationAt = realtimeToastDedupRef.current[dedupKey] ?? 0;

    if (now - lastNotificationAt < 1500) {
      return;
    }

    realtimeToastDedupRef.current[dedupKey] = now;

    if (options?.mesaId && options.allowNavigateToMesa !== false) {
      toast.info(message, {
        onClick: () => {
          const mesa = mesasRef.current.find(
            (item) => item.id === options.mesaId,
          );

          if (!mesa) {
            return;
          }

          handleOpenMesaDetail(mesa);
        },
      });
      return;
    }

    toast.info(message);
  };

  useEffect(() => {
    activeMesaDetailIdRef.current = mesaForDetail?.id ?? null;
  }, [mesaForDetail]);

  useEffect(() => {
    mesasRef.current = mesas;
  }, [mesas]);

  useEffect(() => {
    mesaItemsByMesaIdRef.current = mesaItemsByMesaId;
  }, [mesaItemsByMesaId]);

  useEffect(() => {
    if (!isAnyModalOpen) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isAnyModalOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!pagamentoMenuRef.current) {
        return;
      }

      if (!pagamentoMenuRef.current.contains(event.target as Node)) {
        setIsPagamentoMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!menuMesaId) {
      return;
    }

    const handleOutsideMesaMenu = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;

      if (target?.closest('[data-mesa-menu-root="true"]')) {
        return;
      }

      setMenuMesaId(null);
    };

    const handleScrollCloseMesaMenu = () => {
      setMenuMesaId(null);
    };

    document.addEventListener("mousedown", handleOutsideMesaMenu);
    document.addEventListener("touchstart", handleOutsideMesaMenu, {
      passive: true,
    });
    window.addEventListener("scroll", handleScrollCloseMesaMenu, {
      capture: true,
      passive: true,
    });

    return () => {
      document.removeEventListener("mousedown", handleOutsideMesaMenu);
      document.removeEventListener("touchstart", handleOutsideMesaMenu);
      window.removeEventListener("scroll", handleScrollCloseMesaMenu, true);
    };
  }, [menuMesaId]);

  useEffect(() => {
    if (!isPagamentoMenuOpen) {
      return;
    }

    const updatePagamentoMenuAlign = () => {
      const root = pagamentoMenuRef.current;

      if (!root) {
        return;
      }

      const rootRect = root.getBoundingClientRect();
      const menuWidth = 220;
      const spacing = 12;
      const availableToRight = window.innerWidth - rootRect.left - spacing;
      const availableToLeft = rootRect.right - spacing;

      if (availableToRight >= menuWidth || availableToRight > availableToLeft) {
        setPagamentoMenuAlign("open-right");
        return;
      }

      setPagamentoMenuAlign("open-left");
    };

    updatePagamentoMenuAlign();
    window.addEventListener("resize", updatePagamentoMenuAlign);

    return () => {
      window.removeEventListener("resize", updatePagamentoMenuAlign);
    };
  }, [isPagamentoMenuOpen]);

  const statusLegend = useMemo(
    () => [
      {
        key: "VAZIA",
        label: statusStyles.VAZIA.label,
        color: statusStyles.VAZIA.bullet,
      },
      {
        key: "OCUPADA",
        label: statusStyles.OCUPADA.label,
        color: statusStyles.OCUPADA.bullet,
      },
      {
        key: "EM_PREPARO",
        label: statusStyles.EM_PREPARO.label,
        color: statusStyles.EM_PREPARO.bullet,
      },
      {
        key: "AGUARDANDO_PAGAMENTO",
        label: statusStyles.AGUARDANDO_PAGAMENTO.label,
        color: statusStyles.AGUARDANDO_PAGAMENTO.bullet,
      },
    ],
    [],
  );

  const createMesaMutation = useMutation({
    mutationFn: async (input: CreateMesaInput) => {
      const payload = {
        name: input.name.trim() || undefined,
        seats: Number(input.seats),
        notes: input.notes.trim() || undefined,
      };

      const response = await fetch("/api/mesas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as {
        data?: Mesa;
        error?: string;
      };

      if (!response.ok || !result.data) {
        throw new Error(result.error ?? "Falha ao criar mesa");
      }

      return result.data;
    },
    onSuccess: (newMesa) => {
      markLocalMesaChange(newMesa.id);
      setMesas((prev) => [...prev, newMesa].sort((a, b) => a.code - b.code));
      setFormData({ code: "", name: "", seats: "4", notes: "" });
      setOpenCreateModal(false);
      toast.success("Mesa criada com sucesso.");
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(error.message);
        return;
      }

      toast.error("Não foi possível criar a mesa.");
    },
  });

  const createCatalogItemMutation = useMutation({
    mutationFn: async (input: QuickCatalogItemForm) => {
      const price = Number(input.price);
      const promotionalPriceRaw = input.promotionalPrice.trim();
      const promotionalPriceCandidate =
        promotionalPriceRaw.length > 0 ? Number(promotionalPriceRaw) : null;
      const promotionalPrice =
        promotionalPriceCandidate !== null && promotionalPriceCandidate > 0
          ? promotionalPriceCandidate
          : null;

      const payload = {
        name: input.name.trim(),
        category: input.category.trim(),
        price,
        promotionalPrice,
        pricingType: input.pricingType,
        servesPeople: 1,
      };

      const response = await fetch("/api/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => ({}))) as {
        data?: CatalogItem;
        error?: string;
      };

      if (!response.ok || !result.data) {
        throw new Error(result.error ?? "Falha ao criar item de catálogo");
      }

      return result.data;
    },
  });

  const handleCreateMesa = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.seats || Number(formData.seats) < 1) {
      toast.error("Informe uma quantidade de lugares valida.");
      return;
    }

    await createMesaMutation.mutateAsync(formData);
  };

  const loadMesaItemsMutation = useMutation({
    mutationFn: async (mesaId: string) => {
      const response = await fetch(`/api/mesas/${mesaId}/items`, {
        method: "GET",
      });
      const result = (await response.json().catch(() => ({}))) as {
        data?: MesaItem[];
        error?: string;
      };

      if (!response.ok || !result.data) {
        throw new Error(result.error ?? "Falha ao carregar itens da mesa");
      }

      return result.data;
    },
    onSuccess: (items, mesaId) => {
      setMesaItemsByMesaId((prev) => ({
        ...prev,
        [mesaId]: items,
      }));
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(error.message);
        return;
      }

      toast.error("Não foi possível carregar os itens das mesas.");
    },
  });

  const refreshMesaItemsSilently = async (mesaId: string) => {
    startMesaItemsSync(mesaId);

    try {
      const response = await fetch(`/api/mesas/${mesaId}/items`, {
        method: "GET",
      });
      const result = (await response.json().catch(() => ({}))) as {
        data?: MesaItem[];
      };

      if (!response.ok || !result.data) {
        return;
      }

      setMesaItemsByMesaId((prev) => ({
        ...prev,
        [mesaId]: result.data ?? [],
      }));
    } catch {
      return;
    } finally {
      finishMesaItemsSync(mesaId);
    }
  };

  const resolveNextMesaStatusFromItems = (
    currentStatus: MesaStatus,
    nextItems: MesaItem[],
  ) => {
    const hasWaitingItems = nextItems.some((item) => !item.delivered);

    if (hasWaitingItems && currentStatus !== "EM_PREPARO") {
      return "EM_PREPARO" as const;
    }

    if (
      !hasWaitingItems &&
      nextItems.length > 0 &&
      currentStatus === "EM_PREPARO"
    ) {
      return "OCUPADA" as const;
    }

    return null;
  };

  const syncMesaStatusByItemsSilently = async (
    mesaId: string,
    nextItems: MesaItem[],
  ) => {
    const currentMesa = mesasRef.current.find((mesa) => mesa.id === mesaId);

    if (!currentMesa) {
      return;
    }

    const nextStatus = resolveNextMesaStatusFromItems(
      currentMesa.status,
      nextItems,
    );

    if (!nextStatus) {
      return;
    }

    markLocalMesaChange(mesaId);

    try {
      const response = await fetch(`/api/mesas/${mesaId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      const result = (await response.json().catch(() => ({}))) as {
        data?: Mesa;
      };

      if (!response.ok || !result.data) {
        return;
      }

      const updatedMesa = result.data;

      setMesas((prev) =>
        prev
          .map((mesa) => (mesa.id === updatedMesa.id ? updatedMesa : mesa))
          .sort((a, b) => a.code - b.code),
      );
      setMesaForDetail((prev) =>
        prev && prev.id === updatedMesa.id ? updatedMesa : prev,
      );
    } catch {
      return;
    }
  };

  const createMesaItemMutation = useMutation({
    onMutate: ({ mesaId }) => {
      markLocalMesaChange(mesaId);
    },
    mutationFn: async ({
      mesaId,
      payload,
    }: {
      mesaId: string;
      payload: Omit<MesaItem, "id">;
    }) => {
      const response = await fetch(`/api/mesas/${mesaId}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => ({}))) as {
        data?: MesaItem;
        error?: string;
      };

      if (!response.ok || !result.data) {
        throw new Error(result.error ?? "Falha ao salvar item da mesa");
      }

      return result.data;
    },
    onSuccess: (createdItem, variables) => {
      let nextItemsForMesa: MesaItem[] = [];

      setMesaItemsByMesaId((prev) => {
        nextItemsForMesa = [...(prev[variables.mesaId] ?? []), createdItem];

        return {
          ...prev,
          [variables.mesaId]: nextItemsForMesa,
        };
      });

      void syncMesaStatusByItemsSilently(variables.mesaId, nextItemsForMesa);
    },
  });

  const updateMesaItemMutation = useMutation({
    onMutate: ({ mesaId }) => {
      markLocalMesaChange(mesaId);
    },
    mutationFn: async ({
      mesaId,
      itemId,
      delivered,
    }: {
      mesaId: string;
      itemId: string;
      delivered: boolean;
    }) => {
      const response = await fetch(`/api/mesas/${mesaId}/items/${itemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ delivered }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        data?: MesaItem;
        error?: string;
      };

      if (!response.ok || !result.data) {
        throw new Error(result.error ?? "Falha ao atualizar item da mesa");
      }

      return result.data;
    },
    onSuccess: (updatedItem, variables) => {
      let nextItemsForMesa: MesaItem[] = [];

      setMesaItemsByMesaId((prev) => {
        nextItemsForMesa = (prev[variables.mesaId] ?? []).map((item) =>
          item.id === updatedItem.id ? updatedItem : item,
        );

        return {
          ...prev,
          [variables.mesaId]: nextItemsForMesa,
        };
      });

      void syncMesaStatusByItemsSilently(variables.mesaId, nextItemsForMesa);
    },
  });

  const deleteMesaItemMutation = useMutation({
    onMutate: ({ mesaId }) => {
      markLocalMesaChange(mesaId);
    },
    mutationFn: async ({
      mesaId,
      itemId,
    }: {
      mesaId: string;
      itemId: string;
    }) => {
      const response = await fetch(`/api/mesas/${mesaId}/items/${itemId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(result.error ?? "Falha ao remover item da mesa");
      }
    },
    onSuccess: (_, variables) => {
      let nextItemsForMesa: MesaItem[] = [];

      setMesaItemsByMesaId((prev) => {
        nextItemsForMesa = (prev[variables.mesaId] ?? []).filter(
          (item) => item.id !== variables.itemId,
        );

        return {
          ...prev,
          [variables.mesaId]: nextItemsForMesa,
        };
      });

      void syncMesaStatusByItemsSilently(variables.mesaId, nextItemsForMesa);

      setMesaItemPendingDelete((prev) =>
        prev?.id === variables.itemId ? null : prev,
      );
      toast.success("Item removido da mesa.");
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(error.message);
        return;
      }

      toast.error("Não foi possível remover o item da mesa.");
    },
  });

  const clearMesaItemsMutation = useMutation({
    onMutate: (mesaId: string) => {
      markLocalMesaChange(mesaId);
    },
    mutationFn: async (mesaId: string) => {
      const response = await fetch(`/api/mesas/${mesaId}/items`, {
        method: "DELETE",
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Falha ao limpar itens da mesa");
      }
    },
  });

  const updateMesaMutation = useMutation({
    onMutate: ({ mesaId }) => {
      markLocalMesaChange(mesaId);
    },
    mutationFn: async ({
      mesaId,
      payload,
    }: {
      mesaId: string;
      payload: Partial<Mesa>;
    }) => {
      const response = await fetch(`/api/mesas/${mesaId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as {
        data?: Mesa;
        error?: string;
      };

      if (!response.ok || !result.data) {
        throw new Error(result.error ?? "Falha ao atualizar mesa");
      }

      return result.data;
    },
    onSuccess: (updatedMesa) => {
      setMesas((prev) =>
        prev.map((mesa) => (mesa.id === updatedMesa.id ? updatedMesa : mesa)),
      );
      setMesaForDetail((prev) =>
        prev && prev.id === updatedMesa.id ? updatedMesa : prev,
      );
      setMesaForEdit(null);
      toast.success("Mesa atualizada com sucesso.");
    },
    onError: () => {
      toast.error("Não foi possível atualizar a mesa.");
    },
  });

  const deleteMesaMutation = useMutation({
    onMutate: (mesaId: string) => {
      markLocalMesaChange(mesaId);
    },
    mutationFn: async (mesaId: string) => {
      const response = await fetch(`/api/mesas/${mesaId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(result.error ?? "Falha ao deletar mesa");
      }
    },
    onSuccess: (_, mesaId) => {
      setMesas((prev) => prev.filter((mesa) => mesa.id !== mesaId));
      setMesaForDetail((prev) => (prev?.id === mesaId ? null : prev));
      setMesaForEdit((prev) => (prev?.id === mesaId ? null : prev));
      setMenuMesaId(null);
      clearMesaExternalChange(mesaId);
      toast.success("Mesa removida com sucesso.");
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(error.message);
        return;
      }
      toast.error("Não foi possível deletar a mesa.");
    },
  });

  const currentMesaItems = useMemo(
    () => (mesaForDetail ? (mesaItemsByMesaId[mesaForDetail.id] ?? []) : []),
    [mesaForDetail, mesaItemsByMesaId],
  );
  const mesaItemsResumeByMesaId = useMemo(() => {
    const resume: Record<string, { waiting: number; delivered: number }> = {};

    Object.entries(mesaItemsByMesaId).forEach(([mesaId, items]) => {
      let waiting = 0;
      let delivered = 0;

      items.forEach((item) => {
        if (item.delivered) {
          delivered += item.quantity;
          return;
        }

        waiting += item.quantity;
      });

      resume[mesaId] = { waiting, delivered };
    });

    return resume;
  }, [mesaItemsByMesaId]);
  const isAnyMesaMutationPending =
    createMesaMutation.isPending ||
    updateMesaMutation.isPending ||
    deleteMesaMutation.isPending ||
    createMesaItemMutation.isPending ||
    updateMesaItemMutation.isPending ||
    deleteMesaItemMutation.isPending ||
    clearMesaItemsMutation.isPending;
  const isCreateModalBusy = createMesaMutation.isPending;
  const isEditModalBusy = updateMesaMutation.isPending;
  const isLoadingMesaItems = loadMesaItemsMutation.isPending;
  const isMesaDetailSyncing =
    !!mesaForDetail && Boolean(syncingMesaItemsById[mesaForDetail.id]);
  const isAnyMesaItemsSyncing = Object.keys(syncingMesaItemsById).length > 0;
  const isDetailStatusBusy =
    !!mesaForDetail &&
    statusPendingMesaId === mesaForDetail.id &&
    updateMesaMutation.isPending;

  const deliveredItems = currentMesaItems.filter((item) => item.delivered);
  const waitingItems = currentMesaItems.filter((item) => !item.delivered);
  const mesaTotal = currentMesaItems.reduce(
    (total, item) => total + item.quantity * item.price,
    0,
  );
  const dailyCouvertAmount = isDailyCouvertEnabled
    ? parseNonNegativeNumber(dailyCouvertValue)
    : 0;
  const currentMesaCouvert = useMemo(() => {
    if (!mesaForDetail) {
      return {
        enabled: false,
        value: 0,
      };
    }

    const override = mesaCouvertOverrides[mesaForDetail.id];

    if (override) {
      return override;
    }

    return {
      enabled: isDailyCouvertEnabled,
      value: dailyCouvertAmount,
    };
  }, [
    dailyCouvertAmount,
    isDailyCouvertEnabled,
    mesaForDetail,
    mesaCouvertOverrides,
  ]);
  const mesaCouvertTotal =
    mesaForDetail && currentMesaCouvert.enabled
      ? mesaForDetail.seats * currentMesaCouvert.value
      : 0;
  const currentMesaServiceCharge = useMemo(() => {
    if (!mesaForDetail) {
      return {
        enabled: false,
        value: 0,
      };
    }

    const override = mesaServiceChargeOverrides[mesaForDetail.id];

    if (override) {
      return override;
    }

    return {
      enabled: isDailyServiceChargeEnabled,
      value: parseNonNegativeNumber(dailyServiceChargeValue),
    };
  }, [
    dailyServiceChargeValue,
    isDailyServiceChargeEnabled,
    mesaForDetail,
    mesaServiceChargeOverrides,
  ]);
  const mesaServiceChargeTotal =
    mesaForDetail && currentMesaServiceCharge.enabled
      ? (mesaTotal * currentMesaServiceCharge.value) / 100
      : 0;
  const mesaGrandTotal = mesaTotal + mesaCouvertTotal + mesaServiceChargeTotal;
  const currentMesaPayments = useMemo(
    () => (mesaForDetail ? (mesaPaymentsByMesaId[mesaForDetail.id] ?? []) : []),
    [mesaForDetail, mesaPaymentsByMesaId],
  );
  const paidTotal = currentMesaPayments.reduce(
    (total, payment) => total + payment.amount,
    0,
  );
  const remainingTotal = Math.max(0, mesaGrandTotal - paidTotal);
  const isAwaitingPaymentDetail =
    mesaForDetail?.status === "AGUARDANDO_PAGAMENTO";
  const requestedItemsSummary = useMemo(() => {
    const grouped = new Map<
      string,
      {
        name: string;
        additionalTitles: string[];
        additionalTotal: number;
        quantity: number;
        unitPrice: number;
        originalUnitPrice: number | null;
        total: number;
        originalTotal: number | null;
      }
    >();

    currentMesaItems.forEach((item) => {
      const displayName = formatMesaItemName(item);
      const additionalTitles = item.additionalTitles ?? [];
      const additionalSignature = additionalTitles.join("||");
      const key = `${displayName}::${additionalSignature}::${item.price}::${item.originalPrice ?? "no-original"}`;
      const previous = grouped.get(key);

      if (previous) {
        grouped.set(key, {
          ...previous,
          quantity: previous.quantity + item.quantity,
          additionalTotal:
            previous.additionalTotal +
            item.quantity * Math.max(0, item.additionalTotal ?? 0),
          total: previous.total + item.quantity * item.price,
          originalTotal:
            previous.originalTotal !== null && item.originalPrice !== null
              ? previous.originalTotal + item.quantity * item.originalPrice
              : previous.originalTotal,
        });
        return;
      }

      grouped.set(key, {
        name: displayName,
        additionalTitles,
        additionalTotal: item.quantity * Math.max(0, item.additionalTotal ?? 0),
        quantity: item.quantity,
        unitPrice: item.price,
        originalUnitPrice: item.originalPrice,
        total: item.quantity * item.price,
        originalTotal:
          item.originalPrice !== null
            ? item.quantity * item.originalPrice
            : null,
      });
    });

    return Array.from(grouped.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [currentMesaItems]);
  const selectedCatalogItem =
    itemDraft.catalogItemId.length > 0
      ? (catalogItems.find((item) => item.id === itemDraft.catalogItemId) ??
        null)
      : null;
  const catalogItemOptions = useMemo<CatalogItemSelectOption[]>(
    () => [
      ...catalogItems.map((item) => ({
        value: item.id,
        label: `${item.code} - ${item.name}`,
      })),
      {
        value: CREATE_NEW_CATALOG_ITEM_VALUE,
        label: "+ Criar novo item",
      },
    ],
    [catalogItems],
  );
  const selectedCatalogItemOption =
    itemDraft.catalogItemId.length > 0
      ? (catalogItemOptions.find(
          (option) => option.value === itemDraft.catalogItemId,
        ) ?? null)
      : null;
  const selectedCatalogItemAdditionals = useMemo(() => {
    if (!selectedCatalogItem) {
      return [];
    }

    return catalogItemAdditionals
      .filter(
        (additional) =>
          additional.active &&
          additional.menu_item_id === selectedCatalogItem.id,
      )
      .sort((a, b) => {
        if (a.sort_order === b.sort_order) {
          return a.title.localeCompare(b.title);
        }

        return a.sort_order - b.sort_order;
      });
  }, [catalogItemAdditionals, selectedCatalogItem]);
  const selectedAdditionalItems = useMemo(
    () =>
      selectedCatalogItemAdditionals.filter((additional) =>
        selectedAdditionalIds.includes(additional.id),
      ),
    [selectedCatalogItemAdditionals, selectedAdditionalIds],
  );
  const selectedCatalogItemUnitPrice = useMemo(() => {
    if (!selectedCatalogItem) {
      return 0;
    }

    const hasPromotionalPrice =
      selectedCatalogItem.promotional_price !== null &&
      selectedCatalogItem.promotional_price > 0 &&
      selectedCatalogItem.promotional_price < selectedCatalogItem.price;

    return hasPromotionalPrice
      ? Number(selectedCatalogItem.promotional_price)
      : selectedCatalogItem.price;
  }, [selectedCatalogItem]);
  const selectedAdditionalUnitTotal = useMemo(
    () =>
      selectedAdditionalItems.reduce(
        (total, additional) => total + additional.price,
        0,
      ),
    [selectedAdditionalItems],
  );
  const selectedItemUnitTotal =
    selectedCatalogItemUnitPrice + selectedAdditionalUnitTotal;
  const isSelectedCatalogItemByWeight =
    selectedCatalogItem?.pricing_type === "PESO";
  const selectedItemQuantity = Math.max(1, Number(itemDraft.quantity) || 1);
  const selectedItemWeightKg = Math.max(
    0,
    maskedWeightToNumber(itemDraft.weightKg),
  );
  const selectedBaseTotal = isSelectedCatalogItemByWeight
    ? selectedCatalogItemUnitPrice * selectedItemWeightKg
    : selectedCatalogItemUnitPrice * selectedItemQuantity;
  const selectedAdditionalTotal = isSelectedCatalogItemByWeight
    ? selectedAdditionalUnitTotal
    : selectedAdditionalUnitTotal * selectedItemQuantity;
  const selectedItemTotal = selectedBaseTotal + selectedAdditionalTotal;

  useEffect(() => {
    const storedPayments = window.localStorage.getItem(
      MESA_PAYMENTS_STORAGE_KEY,
    );

    if (!storedPayments) {
      return;
    }

    try {
      const parsed = JSON.parse(storedPayments) as Record<
        string,
        MesaPayment[]
      >;
      setMesaPaymentsByMesaId(parsed);
    } catch {
      window.localStorage.removeItem(MESA_PAYMENTS_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const storedClosedComandas = window.localStorage.getItem(
      CLOSED_COMANDAS_STORAGE_KEY,
    );

    if (!storedClosedComandas) {
      return;
    }

    try {
      const parsed = JSON.parse(storedClosedComandas) as ClosedComanda[];
      setClosedComandas(parsed);
    } catch {
      window.localStorage.removeItem(CLOSED_COMANDAS_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      MESA_PAYMENTS_STORAGE_KEY,
      JSON.stringify(mesaPaymentsByMesaId),
    );
  }, [mesaPaymentsByMesaId]);

  useEffect(() => {
    window.localStorage.setItem(
      CLOSED_COMANDAS_STORAGE_KEY,
      JSON.stringify(closedComandas),
    );
  }, [closedComandas]);

  useEffect(() => {
    const storageKey = `${DAILY_COUVERT_STORAGE_PREFIX}-${todayKey}`;
    const enabledStorageKey = `${DAILY_COUVERT_ENABLED_STORAGE_PREFIX}-${todayKey}`;
    const storedValue = window.localStorage.getItem(storageKey);
    const storedEnabled = window.localStorage.getItem(enabledStorageKey);

    if (storedValue && !Number.isNaN(Number(storedValue))) {
      setDailyCouvertValue(storedValue);
    }

    if (storedEnabled === "true") {
      setIsDailyCouvertEnabled(true);
    }
  }, [todayKey]);

  useEffect(() => {
    const storageKey = `${DAILY_COUVERT_STORAGE_PREFIX}-${todayKey}`;
    const enabledStorageKey = `${DAILY_COUVERT_ENABLED_STORAGE_PREFIX}-${todayKey}`;
    const serviceStorageKey = `${DAILY_SERVICE_CHARGE_STORAGE_PREFIX}-${todayKey}`;
    const serviceEnabledStorageKey = `${DAILY_SERVICE_CHARGE_ENABLED_STORAGE_PREFIX}-${todayKey}`;
    const overridesStorageKey = `${MESA_COUVERT_OVERRIDES_STORAGE_PREFIX}-${todayKey}`;
    const serviceOverridesStorageKey = `${MESA_SERVICE_CHARGE_OVERRIDES_STORAGE_PREFIX}-${todayKey}`;
    const storedValue = window.localStorage.getItem(storageKey);
    const storedEnabled = window.localStorage.getItem(enabledStorageKey);
    const storedServiceValue = window.localStorage.getItem(serviceStorageKey);
    const storedServiceEnabled = window.localStorage.getItem(
      serviceEnabledStorageKey,
    );
    const storedOverrides = window.localStorage.getItem(overridesStorageKey);
    const storedServiceOverrides = window.localStorage.getItem(
      serviceOverridesStorageKey,
    );

    if (storedValue && !Number.isNaN(Number(storedValue))) {
      setDailyCouvertValue(storedValue);
    }

    if (storedEnabled === "true") {
      setIsDailyCouvertEnabled(true);
    }

    if (storedServiceValue && !Number.isNaN(Number(storedServiceValue))) {
      setDailyServiceChargeValue(storedServiceValue);
    }

    if (storedServiceEnabled === "true") {
      setIsDailyServiceChargeEnabled(true);
    }

    if (!storedOverrides) {
    } else {
      try {
        const parsed = JSON.parse(storedOverrides) as Record<
          string,
          MesaCouvertOverride
        >;
        setMesaCouvertOverrides(parsed);
      } catch {
        window.localStorage.removeItem(overridesStorageKey);
      }
    }

    if (!storedServiceOverrides) {
      return;
    }

    try {
      const parsed = JSON.parse(storedServiceOverrides) as Record<
        string,
        MesaServiceChargeOverride
      >;
      setMesaServiceChargeOverrides(parsed);
    } catch {
      window.localStorage.removeItem(serviceOverridesStorageKey);
    }
  }, [todayKey]);

  useEffect(() => {
    const storageKey = `${DAILY_COUVERT_STORAGE_PREFIX}-${todayKey}`;
    const enabledStorageKey = `${DAILY_COUVERT_ENABLED_STORAGE_PREFIX}-${todayKey}`;
    window.localStorage.setItem(storageKey, dailyCouvertValue);
    window.localStorage.setItem(
      enabledStorageKey,
      String(isDailyCouvertEnabled),
    );
  }, [dailyCouvertValue, isDailyCouvertEnabled, todayKey]);

  useEffect(() => {
    const storageKey = `${MESA_COUVERT_OVERRIDES_STORAGE_PREFIX}-${todayKey}`;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify(mesaCouvertOverrides),
    );
  }, [mesaCouvertOverrides, todayKey]);

  useEffect(() => {
    const storageKey = `${DAILY_SERVICE_CHARGE_STORAGE_PREFIX}-${todayKey}`;
    const enabledStorageKey = `${DAILY_SERVICE_CHARGE_ENABLED_STORAGE_PREFIX}-${todayKey}`;
    window.localStorage.setItem(storageKey, dailyServiceChargeValue);
    window.localStorage.setItem(
      enabledStorageKey,
      String(isDailyServiceChargeEnabled),
    );
  }, [dailyServiceChargeValue, isDailyServiceChargeEnabled, todayKey]);

  useEffect(() => {
    const storageKey = `${MESA_SERVICE_CHARGE_OVERRIDES_STORAGE_PREFIX}-${todayKey}`;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify(mesaServiceChargeOverrides),
    );
  }, [mesaServiceChargeOverrides, todayKey]);

  useEffect(() => {
    let isMounted = true;

    const loadCatalogItems = async () => {
      setIsLoadingCatalogItems(true);

      try {
        const data = await fetchCatalogItemsOnce();

        if (!isMounted) {
          return;
        }

        setCatalogItems(data);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof Error) {
          toast.error(error.message);
        } else {
          toast.error("Não foi possível carregar os itens do cardápio.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingCatalogItems(false);
        }
      }
    };

    void loadCatalogItems();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const realtimeLogPrefix = "[MesasRealtime]";
    let mesasFallbackTimeout: number | null = null;
    let itemsFallbackTimeout: number | null = null;
    let isRefreshingMesasFallback = false;
    let isRefreshingItemsFallback = false;

    const refreshMesasFromFallback = async () => {
      if (!isMounted || isRefreshingMesasFallback) {
        return;
      }

      isRefreshingMesasFallback = true;

      try {
        const nextMesas = await fetchMesasSnapshot();

        if (!isMounted) {
          return;
        }

        const previousMesasMap = new Map(
          mesasRef.current.map((mesa) => [mesa.id, mesa]),
        );
        const nextMesasMap = new Map(nextMesas.map((mesa) => [mesa.id, mesa]));
        const changedMesaIds = new Set<string>();

        nextMesas.forEach((mesa) => {
          const previousMesa = previousMesasMap.get(mesa.id);

          if (!previousMesa) {
            changedMesaIds.add(mesa.id);

            if (!isLikelyLocalMesaChange(mesa.id)) {
              notifyRealtimeChange(
                `mesa-insert-fallback-${mesa.id}`,
                `Mesa ${mesa.code} (${mesa.name}) foi criada.`,
                { mesaId: mesa.id },
              );
            }

            return;
          }

          if (
            previousMesa.code !== mesa.code ||
            previousMesa.name !== mesa.name ||
            previousMesa.seats !== mesa.seats ||
            previousMesa.status !== mesa.status ||
            previousMesa.notes !== mesa.notes
          ) {
            changedMesaIds.add(mesa.id);

            if (
              previousMesa.status !== mesa.status &&
              !isLikelyLocalMesaChange(mesa.id)
            ) {
              notifyRealtimeChange(
                `mesa-status-fallback-${mesa.id}-${mesa.status}`,
                `Status da mesa ${mesa.code} (${mesa.name}) mudou para ${statusStyles[mesa.status].label}.`,
                { mesaId: mesa.id },
              );
            }
          }
        });

        previousMesasMap.forEach((mesa, mesaId) => {
          if (!nextMesasMap.has(mesaId)) {
            changedMesaIds.add(mesaId);

            if (!isLikelyLocalMesaChange(mesaId)) {
              notifyRealtimeChange(
                `mesa-delete-fallback-${mesaId}`,
                `Mesa ${mesa.code} (${mesa.name}) foi deletada.`,
                { mesaId, allowNavigateToMesa: false },
              );
            }
          }
        });

        setMesas(nextMesas);
        setMesaForDetail((previousMesa) => {
          if (!previousMesa) {
            return previousMesa;
          }

          return nextMesas.find((mesa) => mesa.id === previousMesa.id) ?? null;
        });

        changedMesaIds.forEach((mesaId) => {
          markMesaAsExternallyChanged(mesaId);
        });
      } catch (error) {
        console.error(
          `${realtimeLogPrefix} mesas fallback refresh failed`,
          error,
        );
      } finally {
        isRefreshingMesasFallback = false;
      }
    };

    const refreshItemsFromFallback = async () => {
      if (!isMounted || isRefreshingItemsFallback) {
        return;
      }

      isRefreshingItemsFallback = true;

      try {
        const nextItems = await fetchMesaItemsSnapshot();

        if (!isMounted) {
          return;
        }

        const groupedItems = nextItems.reduce<Record<string, MesaItem[]>>(
          (accumulator, item) => {
            if (!item.mesaId) {
              return accumulator;
            }

            if (!accumulator[item.mesaId]) {
              accumulator[item.mesaId] = [];
            }

            accumulator[item.mesaId].push(item);
            return accumulator;
          },
          {},
        );

        const snapshotItemSignature = (item: MesaItem) =>
          [
            item.id,
            item.quantity,
            item.price,
            item.originalPrice ?? "",
            item.delivered ? 1 : 0,
            item.pricingType ?? "",
            item.weightKg ?? "",
            (item.additionalTitles ?? []).join("|"),
            item.additionalTotal ?? "",
          ].join("::");

        const signatureForList = (items: MesaItem[]) =>
          items.map(snapshotItemSignature).join("##");

        const previousMap = mesaItemsByMesaIdRef.current;
        const changedMesaIds = new Set<string>();
        const allMesaIds = new Set([
          ...Object.keys(previousMap),
          ...Object.keys(groupedItems),
        ]);

        allMesaIds.forEach((mesaId) => {
          const previousItems = previousMap[mesaId] ?? [];
          const nextMesaItems = groupedItems[mesaId] ?? [];

          const previousIds = new Set(previousItems.map((item) => item.id));
          const nextIds = new Set(nextMesaItems.map((item) => item.id));
          const previousItemsById = new Map(
            previousItems.map((item) => [item.id, item]),
          );

          const addedCount = nextMesaItems.reduce((count, item) => {
            if (previousIds.has(item.id)) {
              return count;
            }

            return count + 1;
          }, 0);

          const removedCount = previousItems.reduce((count, item) => {
            if (nextIds.has(item.id)) {
              return count;
            }

            return count + 1;
          }, 0);

          const editedCount = nextMesaItems.reduce((count, item) => {
            const previousItem = previousItemsById.get(item.id);

            if (!previousItem) {
              return count;
            }

            if (
              previousItem.quantity !== item.quantity ||
              previousItem.price !== item.price
            ) {
              return count + 1;
            }

            return count;
          }, 0);

          if (addedCount > 0 && !isLikelyLocalMesaChange(mesaId)) {
            const mesaLabel = getMesaLabelById(mesaId);
            const itemsLabel = addedCount === 1 ? "item" : "itens";

            notifyRealtimeChange(
              `mesa-item-insert-fallback-${mesaId}-${addedCount}`,
              `${addedCount} ${itemsLabel} ${addedCount === 1 ? "foi adicionado" : "foram adicionados"} na mesa ${mesaLabel}.`,
              { mesaId },
            );
          }

          if (removedCount > 0 && !isLikelyLocalMesaChange(mesaId)) {
            const mesaLabel = getMesaLabelById(mesaId);
            const itemsLabel = removedCount === 1 ? "item" : "itens";

            notifyRealtimeChange(
              `mesa-item-delete-fallback-${mesaId}-${removedCount}`,
              `${removedCount} ${itemsLabel} ${removedCount === 1 ? "foi removido" : "foram removidos"} da mesa ${mesaLabel}.`,
              { mesaId },
            );
          }

          if (editedCount > 0 && !isLikelyLocalMesaChange(mesaId)) {
            const mesaLabel = getMesaLabelById(mesaId);
            const itemsLabel = editedCount === 1 ? "item" : "itens";

            notifyRealtimeChange(
              `mesa-item-update-fallback-${mesaId}-${editedCount}`,
              `${editedCount} ${itemsLabel} ${editedCount === 1 ? "teve quantidade/preco alterado" : "tiveram quantidade/preco alterados"} na mesa ${mesaLabel}.`,
              { mesaId },
            );
          }

          if (
            signatureForList(previousItems) !== signatureForList(nextMesaItems)
          ) {
            changedMesaIds.add(mesaId);
          }
        });

        setMesaItemsByMesaId(groupedItems);

        changedMesaIds.forEach((mesaId) => {
          markMesaAsExternallyChanged(mesaId);
        });
      } catch (error) {
        console.error(
          `${realtimeLogPrefix} items fallback refresh failed`,
          error,
        );
      } finally {
        isRefreshingItemsFallback = false;
      }
    };

    const scheduleMesasFallbackRefresh = (reason: string) => {
      console.warn(`${realtimeLogPrefix} scheduling mesas fallback`, {
        reason,
      });

      if (mesasFallbackTimeout !== null) {
        window.clearTimeout(mesasFallbackTimeout);
      }

      mesasFallbackTimeout = window.setTimeout(() => {
        mesasFallbackTimeout = null;
        void refreshMesasFromFallback();
      }, 120);
    };

    const scheduleItemsFallbackRefresh = (reason: string) => {
      console.warn(`${realtimeLogPrefix} scheduling items fallback`, {
        reason,
      });

      if (itemsFallbackTimeout !== null) {
        window.clearTimeout(itemsFallbackTimeout);
      }

      itemsFallbackTimeout = window.setTimeout(() => {
        itemsFallbackTimeout = null;
        void refreshItemsFromFallback();
      }, 120);
    };

    const safeOldTableItemRow = (
      rawOld: RealtimePostgresChangesPayload<RestaurantTableItemRealtimeRow>["old"],
    ): Partial<RestaurantTableItemRealtimeRow> => {
      if (!rawOld || typeof rawOld !== "object") {
        return {};
      }

      return rawOld as Partial<RestaurantTableItemRealtimeRow>;
    };

    const loadInitialItemsSnapshot = async () => {
      try {
        const nextItems = await fetchMesaItemsSnapshot();

        if (!isMounted) {
          return;
        }

        const groupedItems = nextItems.reduce<Record<string, MesaItem[]>>(
          (accumulator, item) => {
            if (!item.mesaId) {
              return accumulator;
            }

            if (!accumulator[item.mesaId]) {
              accumulator[item.mesaId] = [];
            }

            accumulator[item.mesaId].push(item);
            return accumulator;
          },
          {},
        );

        setMesaItemsByMesaId(groupedItems);
      } catch {
        console.error(`${realtimeLogPrefix} initial items snapshot failed`);
        return;
      }
    };

    const handleRestaurantTablesChange = (
      payload: RealtimePostgresChangesPayload<RestaurantTableRealtimeRow>,
    ) => {
      try {
        console.debug(`${realtimeLogPrefix} restaurant_tables event`, {
          eventType: payload.eventType,
          old: payload.old,
          new: payload.new,
        });
        if (!isMounted) {
          return;
        }

        if (payload.eventType === "DELETE") {
          const oldRow = payload.old as Partial<RestaurantTableRealtimeRow>;
          const deletedId = oldRow.id;

          if (oldRow.tenant_id && oldRow.tenant_id !== tenantId) {
            return;
          }

          if (!deletedId) {
            scheduleMesasFallbackRefresh(
              "restaurant_tables delete payload without id",
            );
            return;
          }

          if (!isLikelyLocalMesaChange(deletedId)) {
            const mesaLabel = oldRow.name
              ? oldRow.code
                ? `${oldRow.code} (${oldRow.name})`
                : oldRow.name
              : getMesaLabelById(deletedId);

            notifyRealtimeChange(
              `mesa-delete-${deletedId}`,
              `Mesa ${mesaLabel} foi deletada.`,
              { mesaId: deletedId, allowNavigateToMesa: false },
            );
          }

          setMesas((previousMesas) =>
            previousMesas.filter((mesa) => mesa.id !== deletedId),
          );
          setMesaForDetail((previousMesa) =>
            previousMesa?.id === deletedId ? null : previousMesa,
          );
          setMesaForEdit((previousMesa) =>
            previousMesa?.id === deletedId ? null : previousMesa,
          );
          setMenuMesaId((previousMesaId) =>
            previousMesaId === deletedId ? null : previousMesaId,
          );
          clearMesaExternalChange(deletedId);

          return;
        }

        const row = payload.new;

        if (!row?.id) {
          scheduleMesasFallbackRefresh(
            "restaurant_tables payload without row id",
          );
          return;
        }

        if (row.tenant_id && row.tenant_id !== tenantId) {
          return;
        }

        if (
          payload.eventType === "INSERT" &&
          !isLikelyLocalMesaChange(row.id)
        ) {
          const mesaLabel = row.code ? `${row.code} (${row.name})` : row.name;

          notifyRealtimeChange(
            `mesa-insert-${row.id}`,
            `Mesa ${mesaLabel} foi criada.`,
            { mesaId: row.id },
          );
          markMesaAsExternallyChanged(row.id);
        }

        if (!row.active) {
          setMesas((previousMesas) =>
            previousMesas.filter((mesa) => mesa.id !== row.id),
          );
          setMesaForDetail((previousMesa) =>
            previousMesa?.id === row.id ? null : previousMesa,
          );
          setMesaForEdit((previousMesa) =>
            previousMesa?.id === row.id ? null : previousMesa,
          );
          clearMesaExternalChange(row.id);
          return;
        }

        const nextMesa = mapRealtimeTableToMesa(row);

        if (payload.eventType === "UPDATE") {
          const previousMesa = mesasRef.current.find(
            (mesa) => mesa.id === nextMesa.id,
          );

          if (
            previousMesa &&
            previousMesa.status !== nextMesa.status &&
            !isLikelyLocalMesaChange(nextMesa.id)
          ) {
            notifyRealtimeChange(
              `mesa-status-${nextMesa.id}-${nextMesa.status}`,
              `Status da mesa ${nextMesa.code} (${nextMesa.name}) mudou para ${statusStyles[nextMesa.status].label}.`,
              { mesaId: nextMesa.id },
            );
          }

          markMesaAsExternallyChanged(nextMesa.id);
        }

        setMesas((previousMesas) => {
          const existingIndex = previousMesas.findIndex(
            (mesa) => mesa.id === nextMesa.id,
          );

          if (existingIndex === -1) {
            return [...previousMesas, nextMesa].sort((a, b) => a.code - b.code);
          }

          const nextMesas = [...previousMesas];
          nextMesas[existingIndex] = nextMesa;
          return nextMesas.sort((a, b) => a.code - b.code);
        });

        setMesaForDetail((previousMesa) =>
          previousMesa?.id === nextMesa.id ? nextMesa : previousMesa,
        );
        setMesaForEdit((previousMesa) =>
          previousMesa?.id === nextMesa.id ? nextMesa : previousMesa,
        );
      } catch (error) {
        console.error(
          `${realtimeLogPrefix} restaurant_tables handler error`,
          error,
        );
        return;
      }
    };

    const handleRestaurantTableItemsChange = (
      payload: RealtimePostgresChangesPayload<RestaurantTableItemRealtimeRow>,
    ) => {
      try {
        console.debug(`${realtimeLogPrefix} restaurant_table_items event`, {
          eventType: payload.eventType,
          old: payload.old,
          new: payload.new,
        });
        if (!isMounted) {
          return;
        }

        if (payload.eventType === "DELETE") {
          const oldRow = safeOldTableItemRow(payload.old);
          const deletedItemId = oldRow.id;
          const oldMesaId = oldRow.table_id;

          if (oldRow.tenant_id && oldRow.tenant_id !== tenantId) {
            return;
          }

          if (!deletedItemId) {
            scheduleItemsFallbackRefresh(
              "restaurant_table_items delete payload without item id",
            );
            return;
          }

          const impactedMesaIds = oldMesaId
            ? [oldMesaId]
            : Object.entries(mesaItemsByMesaIdRef.current)
                .filter(([, items]) =>
                  items.some((item) => item.id === deletedItemId),
                )
                .map(([mesaId]) => mesaId);

          impactedMesaIds.forEach((mesaId) => {
            markMesaAsExternallyChanged(mesaId);
          });

          setMesaItemsByMesaId((previousMap) => {
            if (!oldMesaId) {
              const nextMap: Record<string, MesaItem[]> = {};
              let changed = false;

              Object.entries(previousMap).forEach(([mesaId, items]) => {
                const filtered = items.filter(
                  (item) => item.id !== deletedItemId,
                );

                if (filtered.length !== items.length) {
                  changed = true;
                }

                nextMap[mesaId] = filtered;
              });

              return changed ? nextMap : previousMap;
            }

            const previousItems = previousMap[oldMesaId] ?? [];
            const nextItems = previousItems.filter(
              (item) => item.id !== deletedItemId,
            );

            if (nextItems.length === previousItems.length) {
              return previousMap;
            }

            return {
              ...previousMap,
              [oldMesaId]: nextItems,
            };
          });

          return;
        }

        const row = payload.new;

        if (!row?.id || !row.table_id) {
          scheduleItemsFallbackRefresh(
            "restaurant_table_items payload without row id/table_id",
          );
          return;
        }

        if (row.tenant_id && row.tenant_id !== tenantId) {
          return;
        }

        const nextItem = mapRealtimeTableItemToMesaItem(row);
        const oldRow = safeOldTableItemRow(payload.old);
        const previousMesaId = oldRow.table_id;

        if (
          payload.eventType === "INSERT" &&
          !isLikelyLocalMesaChange(row.table_id)
        ) {
          notifyRealtimeChange(
            `mesa-item-insert-${row.id}`,
            `Item ${nextItem.name} foi adicionado na mesa ${getMesaLabelById(row.table_id)}.`,
            { mesaId: row.table_id },
          );
        }

        markMesaAsExternallyChanged(row.table_id);

        if (previousMesaId && previousMesaId !== row.table_id) {
          markMesaAsExternallyChanged(previousMesaId);
        }

        setMesaItemsByMesaId((previousMap) => {
          const nextMap = { ...previousMap };

          if (!previousMesaId) {
            Object.keys(nextMap).forEach((mesaId) => {
              nextMap[mesaId] = nextMap[mesaId].filter(
                (item) => item.id !== nextItem.id,
              );
            });
          }

          if (
            payload.eventType === "UPDATE" &&
            previousMesaId &&
            previousMesaId !== row.table_id
          ) {
            const previousMesaItems = nextMap[previousMesaId] ?? [];
            nextMap[previousMesaId] = previousMesaItems.filter(
              (item) => item.id !== nextItem.id,
            );
          }

          const currentMesaItems = nextMap[row.table_id] ?? [];
          const itemIndex = currentMesaItems.findIndex(
            (item) => item.id === nextItem.id,
          );

          if (itemIndex === -1) {
            nextMap[row.table_id] = [...currentMesaItems, nextItem];
            return nextMap;
          }

          const updatedMesaItems = [...currentMesaItems];
          updatedMesaItems[itemIndex] = nextItem;
          nextMap[row.table_id] = updatedMesaItems;
          return nextMap;
        });
      } catch (error) {
        console.error(
          `${realtimeLogPrefix} restaurant_table_items handler error`,
          error,
        );
        return;
      }
    };

    const supabase = getSupabaseBrowserClient();
    console.info(`${realtimeLogPrefix} creating channel`, {
      tenantId,
    });
    const channel = supabase
      .channel(`mesas-board-realtime-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "restaurant_tables",
        },
        handleRestaurantTablesChange,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "restaurant_table_items",
        },
        handleRestaurantTableItemsChange,
      )
      .subscribe((status) => {
        if (!isMounted) {
          return;
        }

        console.info(`${realtimeLogPrefix} channel status`, {
          status,
          tenantId,
        });

        if (status === "CHANNEL_ERROR") {
          toast.error("Tempo real das mesas desconectado.");
        }
      });

    void loadInitialItemsSnapshot();

    return () => {
      isMounted = false;
      console.info(`${realtimeLogPrefix} removing channel`, {
        tenantId,
      });

      if (mesasFallbackTimeout !== null) {
        window.clearTimeout(mesasFallbackTimeout);
      }

      if (itemsFallbackTimeout !== null) {
        window.clearTimeout(itemsFallbackTimeout);
      }

      void supabase.removeChannel(channel);
    };
  }, [tenantId]);

  useEffect(() => {
    let isMounted = true;

    const loadCatalogItemAdditionals = async () => {
      setIsLoadingCatalogItemAdditionals(true);

      try {
        const data = await fetchCatalogItemAdditionalsOnce();

        if (!isMounted) {
          return;
        }

        setCatalogItemAdditionals(data);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof Error) {
          toast.error(error.message);
        } else {
          toast.error("Não foi possível carregar os adicionais.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingCatalogItemAdditionals(false);
        }
      }
    };

    void loadCatalogItemAdditionals();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenMesaDetail = (mesa: Mesa) => {
    setMenuMesaId(null);
    setIsPaymentModalOpen(false);
    setMesaForDetail(mesa);
    clearMesaExternalChange(mesa.id);

    if (mesaItemsByMesaId[mesa.id] !== undefined) {
      void refreshMesaItemsSilently(mesa.id);
      return;
    }

    startMesaItemsSync(mesa.id);
    void loadMesaItemsMutation.mutateAsync(mesa.id).finally(() => {
      finishMesaItemsSync(mesa.id);
    });
  };

  const handleOpenEditMesa = (mesa: Mesa) => {
    setMenuMesaId(null);
    setMesaForEdit(mesa);
    setFormData({
      code: String(mesa.code),
      name: mesa.name,
      seats: String(mesa.seats),
      notes: mesa.notes ?? "",
    });
  };

  const handleDeleteMesa = async (mesa: Mesa) => {
    if (deleteMesaMutation.isPending || updateMesaMutation.isPending) {
      return;
    }

    setMenuMesaId(null);

    setMesaPendingDelete(mesa);
  };

  const handleConfirmDeleteMesa = async () => {
    if (!mesaPendingDelete) {
      return;
    }

    const deletingMesaId = mesaPendingDelete.id;
    setMesaPendingDelete(null);

    await deleteMesaMutation.mutateAsync(deletingMesaId);
  };

  const handleStatusChange = async (mesa: Mesa, nextStatus: MesaStatus) => {
    if (updateMesaMutation.isPending || deleteMesaMutation.isPending) {
      return;
    }

    setStatusPendingMesaId(mesa.id);
    try {
      await updateMesaMutation.mutateAsync({
        mesaId: mesa.id,
        payload: { status: nextStatus },
      });
    } finally {
      setStatusPendingMesaId(null);
    }
  };

  const getMesaCouvertConfig = (mesaId: string) => {
    const override = mesaCouvertOverrides[mesaId];

    if (override) {
      return override;
    }

    return {
      enabled: isDailyCouvertEnabled,
      value: parseNonNegativeNumber(dailyCouvertValue),
    };
  };

  const getMesaServiceChargeConfig = (mesaId: string) => {
    const override = mesaServiceChargeOverrides[mesaId];

    if (override) {
      return override;
    }

    return {
      enabled: isDailyServiceChargeEnabled,
      value: parseNonNegativeNumber(dailyServiceChargeValue),
    };
  };

  const openCouvertModal = (scope: "global" | "mesa", mesa?: Mesa) => {
    const initialValue =
      scope === "mesa" && mesa
        ? String(getMesaCouvertConfig(mesa.id).value || dailyCouvertValue || 0)
        : String(parseNonNegativeNumber(dailyCouvertValue) || 0);

    setCouvertDraftValue(initialValue);
    setCouvertModalState(
      scope === "mesa" && mesa
        ? {
            scope,
            mesaId: mesa.id,
            mesaName: mesa.name,
          }
        : { scope },
    );
  };

  const requestDisableOptionalConfig = (
    type: "couvert" | "service-charge",
    scope: "global" | "mesa",
    mesa?: Mesa,
  ) => {
    setPendingDisableConfig({ type, scope, mesa });
  };

  const handleToggleGlobalCouvert = (nextEnabled: boolean) => {
    if (!nextEnabled) {
      requestDisableOptionalConfig("couvert", "global");
      return;
    }

    openCouvertModal("global");
  };

  const handleToggleMesaCouvert = (mesa: Mesa) => {
    const currentConfig = getMesaCouvertConfig(mesa.id);

    if (currentConfig.enabled) {
      requestDisableOptionalConfig("couvert", "mesa", mesa);
      setMenuMesaId(null);
      return;
    }

    openCouvertModal("mesa", mesa);
    setMenuMesaId(null);
  };

  const openServiceChargeModal = (scope: "global" | "mesa", mesa?: Mesa) => {
    const initialValue =
      scope === "mesa" && mesa
        ? String(
            getMesaServiceChargeConfig(mesa.id).value ||
              dailyServiceChargeValue ||
              10,
          )
        : String(parseNonNegativeNumber(dailyServiceChargeValue) || 10);

    setServiceChargeDraftValue(initialValue);
    setServiceChargeModalState(
      scope === "mesa" && mesa
        ? {
            scope,
            mesaId: mesa.id,
            mesaName: mesa.name,
          }
        : { scope },
    );
  };

  const handleToggleGlobalServiceCharge = (nextEnabled: boolean) => {
    if (!nextEnabled) {
      requestDisableOptionalConfig("service-charge", "global");
      return;
    }

    openServiceChargeModal("global");
  };

  const handleToggleMesaServiceCharge = (mesa: Mesa) => {
    const currentConfig = getMesaServiceChargeConfig(mesa.id);

    if (currentConfig.enabled) {
      requestDisableOptionalConfig("service-charge", "mesa", mesa);
      setMenuMesaId(null);
      return;
    }

    openServiceChargeModal("mesa", mesa);
    setMenuMesaId(null);
  };

  const handleConfirmDisableOptionalConfig = () => {
    if (!pendingDisableConfig) {
      return;
    }

    const { type, scope, mesa } = pendingDisableConfig;

    if (type === "couvert") {
      if (scope === "global") {
        setIsDailyCouvertEnabled(false);
      } else if (mesa) {
        const currentConfig = getMesaCouvertConfig(mesa.id);

        setMesaCouvertOverrides((prev) => ({
          ...prev,
          [mesa.id]: {
            enabled: false,
            value: currentConfig.value,
          },
        }));
      }
    }

    if (type === "service-charge") {
      if (scope === "global") {
        setIsDailyServiceChargeEnabled(false);
      } else if (mesa) {
        const currentConfig = getMesaServiceChargeConfig(mesa.id);

        setMesaServiceChargeOverrides((prev) => ({
          ...prev,
          [mesa.id]: {
            enabled: false,
            value: currentConfig.value,
          },
        }));
      }
    }

    setPendingDisableConfig(null);
  };

  const handleConfirmCouvertModal = () => {
    if (!couvertModalState) {
      return;
    }

    const parsedValue = Number(couvertDraftValue);

    if (Number.isNaN(parsedValue) || parsedValue <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }

    if (couvertModalState.scope === "global") {
      setDailyCouvertValue(String(parsedValue));
      setIsDailyCouvertEnabled(true);
      setCouvertModalState(null);
      return;
    }

    if (!couvertModalState.mesaId) {
      setCouvertModalState(null);
      return;
    }

    setMesaCouvertOverrides((prev) => ({
      ...prev,
      [couvertModalState.mesaId as string]: {
        enabled: true,
        value: parsedValue,
      },
    }));
    setCouvertModalState(null);
  };

  const handleConfirmServiceChargeModal = () => {
    if (!serviceChargeModalState) {
      return;
    }

    const parsedValue = Number(serviceChargeDraftValue);

    if (Number.isNaN(parsedValue) || parsedValue <= 0) {
      toast.error("Informe um percentual válido.");
      return;
    }

    if (serviceChargeModalState.scope === "global") {
      setDailyServiceChargeValue(String(parsedValue));
      setIsDailyServiceChargeEnabled(true);
      setServiceChargeModalState(null);
      return;
    }

    if (!serviceChargeModalState.mesaId) {
      setServiceChargeModalState(null);
      return;
    }

    setMesaServiceChargeOverrides((prev) => ({
      ...prev,
      [serviceChargeModalState.mesaId as string]: {
        enabled: true,
        value: parsedValue,
      },
    }));
    setServiceChargeModalState(null);
  };

  const handleSaveEditMesa = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!mesaForEdit) {
      return;
    }

    if (updateMesaMutation.isPending) {
      return;
    }

    if (!formData.seats || Number(formData.seats) < 1) {
      toast.error("Informe uma quantidade de lugares valida.");
      return;
    }

    const nextCode = Number(formData.code);

    if (!formData.code || Number.isNaN(nextCode) || nextCode < 1) {
      toast.error("Informe um número de mesa válido.");
      return;
    }

    await updateMesaMutation.mutateAsync({
      mesaId: mesaForEdit.id,
      payload: {
        code: nextCode,
        name: formData.name.trim() || mesaForEdit.name,
        seats: Number(formData.seats),
        notes: formData.notes.trim() || null,
      },
    });
  };

  const handleAddItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!mesaForDetail) {
      return;
    }

    const selectedItem = catalogItems.find(
      (item) => item.id === itemDraft.catalogItemId,
    );
    const isByWeight = selectedItem?.pricing_type === "PESO";
    const quantity = isByWeight ? 1 : Number(itemDraft.quantity);
    const weightKg = isByWeight
      ? maskedWeightToNumber(itemDraft.weightKg)
      : null;

    if (!selectedItem) {
      toast.error(
        "Selecione um item valido e preencha os campos corretamente.",
      );
      return;
    }

    if (!isByWeight && (quantity < 1 || Number.isNaN(quantity))) {
      toast.error("Informe uma quantidade válida.");
      return;
    }

    if (
      isByWeight &&
      (weightKg === null || Number.isNaN(weightKg) || weightKg <= 0)
    ) {
      toast.error("Informe um peso válido em kg.");
      return;
    }

    const hasCatalogPromotionalPrice =
      selectedItem.promotional_price !== null &&
      selectedItem.promotional_price > 0 &&
      selectedItem.promotional_price < selectedItem.price;
    const baseAppliedPrice = hasCatalogPromotionalPrice
      ? Number(selectedItem.promotional_price)
      : selectedItem.price;
    const selectedAdditionals = catalogItemAdditionals.filter(
      (additional) =>
        additional.active &&
        additional.menu_item_id === selectedItem.id &&
        selectedAdditionalIds.includes(additional.id),
    );
    const additionalsUnitTotal = selectedAdditionals.reduce(
      (total, additional) => total + additional.price,
      0,
    );
    const lineAppliedPrice = isByWeight
      ? baseAppliedPrice * Math.max(0, weightKg ?? 0) + additionalsUnitTotal
      : baseAppliedPrice + additionalsUnitTotal;
    const lineOriginalPrice = hasCatalogPromotionalPrice
      ? isByWeight
        ? selectedItem.price * Math.max(0, weightKg ?? 0) + additionalsUnitTotal
        : selectedItem.price
      : null;

    const nextItemPayload: Omit<MesaItem, "id"> = {
      code: selectedItem.code,
      name: selectedItem.name,
      quantity,
      price: lineAppliedPrice,
      originalPrice: lineOriginalPrice,
      delivered: false,
      pricingType: selectedItem.pricing_type,
      weightKg: isByWeight ? Math.max(0, weightKg ?? 0) : undefined,
      additionalTitles: selectedAdditionals.map(
        (additional) => additional.title,
      ),
      additionalTotal: additionalsUnitTotal,
    };

    try {
      await createMesaItemMutation.mutateAsync({
        mesaId: mesaForDetail.id,
        payload: nextItemPayload,
      });
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
        return;
      }

      toast.error("Não foi possível adicionar item na mesa.");
      return;
    }

    toast.success("Item adicionado com sucesso.");

    setItemDraft({ catalogItemId: "", quantity: "1", weightKg: "" });
    setSelectedAdditionalIds([]);
    setIsAddItemModalOpen(false);
  };

  const handleOpenAddItemModal = () => {
    if (!mesaForDetail) {
      return;
    }

    setItemDraft({ catalogItemId: "", quantity: "1", weightKg: "" });
    setSelectedAdditionalIds([]);
    setIsAddItemModalOpen(true);
  };

  const handleOpenQuickCreateItemModal = () => {
    setQuickCatalogItemForm({
      name: "",
      category: "Sem Categoria",
      price: "",
      promotionalPrice: "",
      pricingType: "UNIDADE",
    });
    setIsQuickCreateItemModalOpen(true);
  };

  const handleCreateCatalogItemFromMesa = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const name = quickCatalogItemForm.name.trim();
    const category = quickCatalogItemForm.category.trim();
    const price = Number(quickCatalogItemForm.price);
    const promotionalPriceRaw = quickCatalogItemForm.promotionalPrice.trim();
    const promotionalPriceCandidate =
      promotionalPriceRaw.length > 0 ? Number(promotionalPriceRaw) : null;
    const promotionalPrice =
      promotionalPriceCandidate !== null && promotionalPriceCandidate > 0
        ? promotionalPriceCandidate
        : null;

    if (!name || name.length < 2) {
      toast.error("Informe um nome válido para o item.");
      return;
    }

    if (!category || category.length < 2) {
      toast.error("Informe uma categoria válida.");
      return;
    }

    if (Number.isNaN(price) || price <= 0) {
      toast.error("Informe um preço válido.");
      return;
    }

    if (
      promotionalPriceCandidate !== null &&
      Number.isNaN(promotionalPriceCandidate)
    ) {
      toast.error("Informe um preço promocional válido.");
      return;
    }

    if (promotionalPrice !== null && promotionalPrice >= price) {
      toast.error("O preço promocional deve ser menor que o preço base.");
      return;
    }

    try {
      const createdItem =
        await createCatalogItemMutation.mutateAsync(quickCatalogItemForm);

      setCatalogItems((prev) =>
        [...prev, createdItem].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setItemDraft((prev) => ({
        ...prev,
        catalogItemId: createdItem.id,
      }));
      setIsQuickCreateItemModalOpen(false);
      toast.success("Item criado e selecionado no lançamento.");
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Não foi possível criar item.");
      }
    }
  };

  const handleToggleDelivered = async (itemId: string, delivered: boolean) => {
    if (!mesaForDetail) {
      return;
    }

    try {
      await updateMesaItemMutation.mutateAsync({
        mesaId: mesaForDetail.id,
        itemId,
        delivered,
      });
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
        return;
      }

      toast.error("Não foi possível atualizar o item da mesa.");
    }
  };

  const handleRequestDeleteMesaItem = (item: MesaItem) => {
    setMesaItemPendingDelete(item);
  };

  const handleConfirmDeleteMesaItem = async () => {
    if (!mesaForDetail || !mesaItemPendingDelete) {
      return;
    }

    const itemToDelete = mesaItemPendingDelete;
    setMesaItemPendingDelete(null);

    try {
      await deleteMesaItemMutation.mutateAsync({
        mesaId: mesaForDetail.id,
        itemId: itemToDelete.id,
      });
    } catch {
      return;
    }
  };

  const handleOpenPartialPayment = () => {
    if (!mesaForDetail) {
      return;
    }

    setDeleteMesaAfterClose(false);
    setPaymentDraft({ method: "CREDITO", amount: "" });
    setIsPaymentModalOpen(true);
  };

  const handleCloseMesaForPayment = async () => {
    if (!mesaForDetail) {
      return;
    }

    if (mesaForDetail.status !== "AGUARDANDO_PAGAMENTO") {
      try {
        await handleStatusChange(mesaForDetail, "AGUARDANDO_PAGAMENTO");
      } catch {
        toast.error("Não foi possível enviar mesa para aguardando pagamento.");
        return;
      }
    }

    setDeleteMesaAfterClose(false);
    setPaymentDraft({ method: "CREDITO", amount: "" });
    setIsPaymentModalOpen(true);
  };

  const handleRegisterPayment = () => {
    if (!mesaForDetail) {
      return;
    }

    const amount = Number(paymentDraft.amount);

    if (Number.isNaN(amount) || amount <= 0) {
      toast.error("Informe um valor de pagamento valido.");
      return;
    }

    if (amount > remainingTotal) {
      toast.error("Valor maior que o restante da mesa.");
      return;
    }

    const newPayment: MesaPayment = {
      id: crypto.randomUUID(),
      method: paymentDraft.method,
      amount,
      createdAt: new Date().toISOString(),
    };

    setMesaPaymentsByMesaId((prev) => ({
      ...prev,
      [mesaForDetail.id]: [...(prev[mesaForDetail.id] ?? []), newPayment],
    }));

    setPaymentDraft((prev) => ({ ...prev, amount: "" }));
    toast.success("Pagamento lançado com sucesso.");
  };

  const persistClosedComanda = (payload: ClosedComanda) => {
    setClosedComandas((prev) => [payload, ...prev].slice(0, 200));
  };

  const resetMesaComandaState = (mesaId: string) => {
    setMesaItemsByMesaId((prev) => {
      const next = { ...prev };
      delete next[mesaId];
      return next;
    });
    setMesaPaymentsByMesaId((prev) => {
      const next = { ...prev };
      delete next[mesaId];
      return next;
    });
  };

  const finalizeMesaClosure = async (
    observation: string | null,
    options?: { deleteMesaAfterClose?: boolean },
  ) => {
    if (!mesaForDetail) {
      return;
    }

    const mesaId = mesaForDetail.id;
    const mesaItems = mesaItemsByMesaId[mesaId] ?? [];
    const mesaPayments = mesaPaymentsByMesaId[mesaId] ?? [];
    const subtotal = mesaItems.reduce(
      (total, item) => total + item.quantity * item.price,
      0,
    );
    const couvertTotal = currentMesaCouvert.enabled
      ? mesaForDetail.seats * currentMesaCouvert.value
      : 0;
    const serviceChargeTotal = currentMesaServiceCharge.enabled
      ? (subtotal * currentMesaServiceCharge.value) / 100
      : 0;
    const grandTotal = subtotal + couvertTotal + serviceChargeTotal;
    const paid = mesaPayments.reduce(
      (total, payment) => total + payment.amount,
      0,
    );
    const remaining = Math.max(0, grandTotal - paid);

    setIsClosingComanda(true);

    try {
      await updateMesaMutation.mutateAsync({
        mesaId,
        payload: { status: "VAZIA" },
      });
      await clearMesaItemsMutation.mutateAsync(mesaId);

      persistClosedComanda({
        id: crypto.randomUUID(),
        mesaId,
        mesaCode: mesaForDetail.code,
        mesaName: mesaForDetail.name,
        closedAt: new Date().toISOString(),
        subtotal,
        couvertTotal,
        serviceChargeTotal,
        grandTotal,
        paidTotal: paid,
        remainingTotal: remaining,
        observation,
        items: mesaItems,
        payments: mesaPayments,
      });

      resetMesaComandaState(mesaId);
      setPaymentDraft({ method: "CREDITO", amount: "" });
      setOpenCloseComandaConfirm(false);
      setCloseComandaObservation("");
      setIsPaymentModalOpen(false);

      if (options?.deleteMesaAfterClose) {
        await deleteMesaMutation.mutateAsync(mesaId);
        setDeleteMesaAfterClose(false);
      } else {
        toast.success("Comanda encerrada e mesa liberada.");
      }
    } catch {
      toast.error("Não foi possível encerrar a comanda.");
    } finally {
      setIsClosingComanda(false);
    }
  };

  const handleRequestCloseComanda = () => {
    if (!mesaForDetail || updateMesaMutation.isPending || isClosingComanda) {
      return;
    }

    if (remainingTotal > 0) {
      setCloseComandaObservation("");
      setOpenCloseComandaConfirm(true);
      return;
    }

    void finalizeMesaClosure(null, {
      deleteMesaAfterClose,
    });
  };

  const handleConfirmCloseComandaWithDebt = () => {
    const observation = closeComandaObservation.trim();

    if (!observation) {
      toast.error("Informe uma observação para fechar com débito pendente.");
      return;
    }

    void finalizeMesaClosure(observation, {
      deleteMesaAfterClose,
    });
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="block max-w-xs space-y-2">
          <label className="inline-flex items-center mr-2 gap-2 text-xs font-medium text-[var(--app-text)]">
            <input
              type="checkbox"
              checked={isDailyCouvertEnabled}
              onChange={(event) =>
                handleToggleGlobalCouvert(event.target.checked)
              }
            />
            Habilitar couvert
          </label>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-[var(--app-text)]">
            <input
              type="checkbox"
              checked={isDailyServiceChargeEnabled}
              onChange={(event) =>
                handleToggleGlobalServiceCharge(event.target.checked)
              }
            />
            Habilitar taxa de serviço
          </label>
        </div>

        <button
          type="button"
          onClick={() => setOpenLegendModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs font-medium text-[var(--app-text)] transition hover:opacity-85"
        >
          <Info className="h-4 w-4" /> Ver legenda de status
        </button>
      </div>

      {openLegendModal ? (
        <div className="fixed inset-0 z-40 flex items-end overflow-y-auto bg-black/45 p-3 sm:items-center sm:justify-center">
          <div className="max-h-[calc(100dvh-1.5rem)] w-full overflow-y-auto rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--app-text)]">
                Legenda de status
              </h2>
              <button
                type="button"
                onClick={() => setOpenLegendModal(false)}
                className="rounded-full p-1 text-[var(--app-muted)] hover:opacity-80"
                aria-label="Fechar legenda"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {statusLegend.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1.5"
                >
                  <span className={`h-3.5 w-3.5 rounded-full ${item.color}`} />
                  <span className="text-sm font-medium text-[var(--app-text)]">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {mesas.map((mesa) => {
          const itemResume = mesaItemsResumeByMesaId[mesa.id] ?? {
            waiting: 0,
            delivered: 0,
          };

          return (
            <MesaCard
              key={mesa.id}
              mesa={mesa}
              menuOpen={menuMesaId === mesa.id}
              isBusy={isAnyMesaMutationPending}
              isStatusUpdating={
                statusPendingMesaId === mesa.id && updateMesaMutation.isPending
              }
              hasExternalChange={Boolean(mesaExternalChangeById[mesa.id])}
              waitingItemsCount={itemResume.waiting}
              deliveredItemsCount={itemResume.delivered}
              onOpen={handleOpenMesaDetail}
              onToggleMenu={(mesaId) =>
                setMenuMesaId((current) => (current === mesaId ? null : mesaId))
              }
              onOpenStatus={handleOpenMesaDetail}
              onOpenEdit={handleOpenEditMesa}
              couvertActionLabel={
                getMesaCouvertConfig(mesa.id).enabled
                  ? "Desabilitar couvert nesta mesa"
                  : "Habilitar couvert nesta mesa"
              }
              onToggleCouvert={handleToggleMesaCouvert}
              serviceChargeActionLabel={
                getMesaServiceChargeConfig(mesa.id).enabled
                  ? "Desabilitar taxa de serviço nesta mesa"
                  : "Habilitar taxa de serviço nesta mesa"
              }
              onToggleServiceCharge={handleToggleMesaServiceCharge}
              onDelete={handleDeleteMesa}
            />
          );
        })}
      </div>

      {openCreateModal ? (
        <div className="fixed inset-0 z-40 flex items-end overflow-y-auto bg-black/45 p-3 sm:items-center sm:justify-center">
          <div className="max-h-[calc(100dvh-1.5rem)] w-full overflow-y-auto rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[var(--app-text)]">
                Nova mesa
              </h2>
              <button
                type="button"
                disabled={isCreateModalBusy}
                onClick={() => setOpenCreateModal(false)}
                className="rounded-full p-1 text-[var(--app-muted)] hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Fechar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="space-y-3" onSubmit={handleCreateMesa}>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-[var(--app-text)]">
                  Nome da mesa (opcional)
                </span>
                <input
                  value={formData.name}
                  disabled={isCreateModalBusy}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Ex: Mesa varanda"
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-primary)]"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-[var(--app-text)]">
                  Lugares
                </span>
                <input
                  value={formData.seats}
                  disabled={isCreateModalBusy}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      seats: event.target.value,
                    }))
                  }
                  type="number"
                  min={1}
                  max={30}
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-primary)]"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-[var(--app-text)]">
                  Observações
                </span>
                <textarea
                  value={formData.notes}
                  disabled={isCreateModalBusy}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      notes: event.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Ex: Mesa com acesso facilitado"
                  className="w-full resize-none rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-primary)]"
                />
              </label>

              <button
                type="submit"
                disabled={isCreateModalBusy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--app-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--app-primary-contrast)] transition hover:opacity-90 disabled:opacity-70"
              >
                {isCreateModalBusy ? "Salvando..." : "Adicionar mesa"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {mesaForEdit ? (
        <div className="fixed inset-0 z-40 flex items-end overflow-y-auto bg-black/45 p-3 sm:items-center sm:justify-center">
          <div className="max-h-[calc(100dvh-1.5rem)] w-full overflow-y-auto rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[var(--app-text)]">
                Editar mesa
              </h2>
              <button
                type="button"
                disabled={isEditModalBusy}
                onClick={() => setMesaForEdit(null)}
                className="rounded-full p-1 text-[var(--app-muted)] hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Fechar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="space-y-3" onSubmit={handleSaveEditMesa}>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-[var(--app-text)]">
                  Número da mesa
                </span>
                <input
                  value={formData.code}
                  disabled={isEditModalBusy}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      code: event.target.value,
                    }))
                  }
                  type="number"
                  min={1}
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-primary)]"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-[var(--app-text)]">
                  Nome da mesa
                </span>
                <input
                  value={formData.name}
                  disabled={isEditModalBusy}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-primary)]"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-[var(--app-text)]">
                  Lugares
                </span>
                <input
                  value={formData.seats}
                  disabled={isEditModalBusy}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      seats: event.target.value,
                    }))
                  }
                  type="number"
                  min={1}
                  max={30}
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-primary)]"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-[var(--app-text)]">
                  Observações
                </span>
                <textarea
                  value={formData.notes}
                  disabled={isEditModalBusy}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      notes: event.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full resize-none rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-primary)]"
                />
              </label>

              <button
                type="submit"
                disabled={isEditModalBusy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--app-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--app-primary-contrast)] transition hover:opacity-90 disabled:opacity-70"
              >
                {isEditModalBusy ? "Salvando..." : "Salvar alterações"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {mesaForDetail ? (
        <div className="fixed inset-0 z-40 flex items-end overflow-y-auto bg-black/45 p-3 sm:items-center sm:justify-center">
          <div className="relative max-h-[85vh] w-full overflow-y-auto rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] pb-4 pr-4 pl-4 pt-0 shadow-2xl sm:max-w-xl sm:pt-2">
            {(() => {
              const detailStyle = statusStyles[mesaForDetail.status];
              const DetailIcon = detailStyle.icon;

              return (
                <>
                  <div className="sticky top-0 z-30 mb-2 -mx-4 flex items-center justify-between gap-3 border-b border-[var(--app-border)] bg-[var(--app-surface)]/95 px-4 py-1.5 backdrop-blur-sm">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium leading-none text-[var(--app-muted)]">
                        Mesa {mesaForDetail.code}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isDetailStatusBusy}
                      onClick={() => {
                        setIsPaymentModalOpen(false);
                        setIsPagamentoMenuOpen(false);
                        setMesaForDetail(null);
                      }}
                      className="shrink-0 rounded-full p-1 text-[var(--app-muted)] hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Fechar modal"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="mb-3">
                    <div className="mt-0.5 flex items-center gap-2">
                      <h2 className="text-2xl font-semibold leading-tight text-[var(--app-text)]">
                        {mesaForDetail.name}
                      </h2>
                      {isMesaDetailSyncing ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--app-muted)]">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Sincronizando
                        </span>
                      ) : null}
                    </div>
                    <p
                      className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium ${detailStyle.statusChip}`}
                    >
                      <DetailIcon className="h-3.5 w-3.5" />
                      {detailStyle.label}
                    </p>
                  </div>

                  <div className="mb-4 flex items-center gap-2">
                    <label className="text-[12px] font-medium text-[var(--app-muted)]">
                      Status
                    </label>
                    <select
                      value={mesaForDetail.status}
                      onChange={(event) =>
                        void handleStatusChange(
                          mesaForDetail,
                          event.target.value as MesaStatus,
                        )
                      }
                      disabled={statusPendingMesaId === mesaForDetail.id}
                      className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-sm text-[var(--app-text)] outline-none"
                    >
                      <option value="VAZIA">Vazia</option>
                      <option value="OCUPADA">Ocupada</option>
                      <option value="EM_PREPARO">Em preparo</option>
                      <option value="AGUARDANDO_PAGAMENTO">
                        Aguardando pagamento
                      </option>
                    </select>

                    {isDetailStatusBusy ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--app-muted)]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                        Atualizando status...
                      </span>
                    ) : null}
                  </div>

                  {isAwaitingPaymentDetail ? (
                    <>
                      <div className="mb-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
                        <p className="text-xs font-semibold text-[var(--app-text)]">
                          Detalhamento do pedido
                        </p>

                        {requestedItemsSummary.length === 0 ? (
                          <p className="mt-1 text-xs text-[var(--app-muted)]">
                            Nenhum item lançado na mesa.
                          </p>
                        ) : (
                          <ul className="mt-2 space-y-1.5">
                            {requestedItemsSummary.map((item) => (
                              <li
                                key={`${item.name}-${item.additionalTitles.join("||")}-${item.unitPrice}-${item.originalUnitPrice ?? "no-original"}`}
                                className="text-xs"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-[var(--app-text)]">
                                    {item.quantity}x {item.name}
                                  </span>
                                  <span className="text-right font-semibold text-[var(--app-text)]">
                                    {formatCurrency(item.total)}
                                  </span>
                                </div>
                                {item.additionalTitles.length > 0 ||
                                item.additionalTotal > 0 ? (
                                  <div className="ml-4 mt-0.5 flex items-start justify-between gap-2">
                                    <span className="text-[11px] text-[var(--app-muted)]">
                                      +{" "}
                                      {item.additionalTitles.length > 0
                                        ? item.additionalTitles.join(", ")
                                        : "Adicionais"}
                                    </span>
                                    <span className="text-[11px] font-medium text-[var(--app-muted)]">
                                      {formatCurrency(item.additionalTotal)}
                                    </span>
                                  </div>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="mb-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2">
                        <div className="flex items-center justify-between gap-2 text-sm text-[var(--app-text)]">
                          <span>Subtotal itens</span>
                          <span>{formatCurrency(mesaTotal)}</span>
                        </div>
                        {currentMesaCouvert.enabled ? (
                          <div className="mt-1 flex items-center justify-between gap-2 text-sm text-[var(--app-text)]">
                            <span>
                              Couvert artístico ({mesaForDetail.seats} x{" "}
                              {formatCurrency(currentMesaCouvert.value)})
                            </span>
                            <span>{formatCurrency(mesaCouvertTotal)}</span>
                          </div>
                        ) : null}
                        {currentMesaServiceCharge.enabled ? (
                          <div className="mt-1 flex items-center justify-between gap-2 text-sm text-[var(--app-text)]">
                            <span>
                              Taxa de serviço ({currentMesaServiceCharge.value}
                              %)
                            </span>
                            <span>
                              {formatCurrency(mesaServiceChargeTotal)}
                            </span>
                          </div>
                        ) : null}
                        <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--app-border)] pt-2 text-base font-semibold text-[var(--app-text)]">
                          <span>Total da mesa</span>
                          <span>{formatCurrency(mesaGrandTotal)}</span>
                        </div>
                      </div>

                      <div className="mb-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2">
                        <div className="mt-1 flex items-center justify-between gap-2 text-sm text-[var(--app-text)]">
                          <span>Pago</span>
                          <span>{formatCurrency(paidTotal)}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--app-border)] pt-2 text-base font-semibold text-[var(--app-text)]">
                          <span>Restante</span>
                          <span>{formatCurrency(remainingTotal)}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isDetailStatusBusy || isClosingComanda}
                        onClick={handleOpenPartialPayment}
                        className="mb-3 inline-flex w-full items-center justify-center rounded-lg bg-[var(--app-primary)] px-3 py-2 text-sm font-semibold text-[var(--app-primary-contrast)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Detalhar pagamento
                      </button>

                      <button
                        type="button"
                        disabled={isDetailStatusBusy || isClosingComanda}
                        onClick={handleRequestCloseComanda}
                        className="mb-3 inline-flex w-full items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm font-semibold text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isClosingComanda
                          ? "Encerrando..."
                          : "Encerrar comanda"}
                      </button>

                      <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-2">
                        <p className="text-xs font-semibold text-[var(--app-text)]">
                          Lançamentos
                        </p>
                        {currentMesaPayments.length === 0 ? (
                          <p className="mt-1 text-xs text-[var(--app-muted)]">
                            Nenhum pagamento lançado.
                          </p>
                        ) : (
                          <ul className="mt-1 space-y-1">
                            {currentMesaPayments.map((payment) => (
                              <li
                                key={payment.id}
                                className="flex items-center justify-between gap-2 text-xs"
                              >
                                <span className="text-[var(--app-text)]">
                                  {paymentMethodLabels[payment.method]}
                                </span>
                                <span className="font-semibold text-[var(--app-text)]">
                                  {formatCurrency(payment.amount)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <MesaPrintActions
                          mesaCode={mesaForDetail.code}
                          mesaName={mesaForDetail.name}
                          waitingItems={waitingItems}
                          deliveredItems={deliveredItems}
                          allItems={currentMesaItems}
                          peopleCount={mesaForDetail.seats}
                          couvertUnitValue={currentMesaCouvert.value}
                          isCouvertEnabled={currentMesaCouvert.enabled}
                          serviceChargePercent={currentMesaServiceCharge.value}
                          isServiceChargeEnabled={
                            currentMesaServiceCharge.enabled
                          }
                          payments={currentMesaPayments}
                          disabled={isDetailStatusBusy}
                        />

                        <div ref={pagamentoMenuRef} className="relative">
                          <button
                            type="button"
                            disabled={isDetailStatusBusy}
                            onClick={() =>
                              setIsPagamentoMenuOpen((current) => !current)
                            }
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm font-semibold text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            PAGAMENTO
                            <ChevronDown className="h-4 w-4" />
                          </button>

                          {isPagamentoMenuOpen ? (
                            <div
                              className={[
                                "absolute top-full z-30 mt-1 w-max min-w-[220px] max-w-[calc(100vw-1rem)] rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-lg",
                                pagamentoMenuAlign === "open-right"
                                  ? "left-0"
                                  : "right-0",
                              ].join(" ")}
                            >
                              <button
                                type="button"
                                disabled={isDetailStatusBusy}
                                onClick={() => {
                                  setIsPagamentoMenuOpen(false);
                                  handleOpenPartialPayment();
                                }}
                                className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-[var(--app-text)] hover:bg-[var(--app-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Pagamento parcial
                              </button>
                              <button
                                type="button"
                                disabled={isDetailStatusBusy}
                                onClick={() => {
                                  setIsPagamentoMenuOpen(false);
                                  void handleCloseMesaForPayment();
                                }}
                                className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-[var(--app-text)] hover:bg-[var(--app-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Fechar mesa e pagar
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <section className="mb-3 rounded-lg border border-[var(--app-border)]">
                        <header className="border-b border-[var(--app-border)] px-3 py-2">
                          <p className="text-base font-semibold text-[var(--app-text)] leading-tight">
                            Já entregues na mesa
                          </p>
                        </header>

                        <div className="relative px-3 py-2">
                          {deliveredItems.length === 0 ? (
                            <p className="text-sm text-[var(--app-muted)] leading-tight">
                              Nenhum item entregue.
                            </p>
                          ) : (
                            deliveredItems.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between gap-2 text-sm"
                              >
                                <label className="flex items-center gap-2 text-[var(--app-text)]">
                                  <input
                                    type="checkbox"
                                    checked={item.delivered}
                                    disabled={isDetailStatusBusy}
                                    onChange={(event) =>
                                      handleToggleDelivered(
                                        item.id,
                                        event.target.checked,
                                      )
                                    }
                                  />
                                  <span>
                                    <span className="block">
                                      {item.quantity}x{" "}
                                      {formatMesaItemName(item)}
                                    </span>
                                    {item.additionalTitles &&
                                    item.additionalTitles.length > 0 ? (
                                      <span className="ml-4 block text-xs text-[var(--app-muted)]">
                                        + {item.additionalTitles.join(", ")}
                                      </span>
                                    ) : null}
                                  </span>
                                </label>
                                <div className="flex items-center gap-2">
                                  <span className="text-right text-[var(--app-muted)]">
                                    {item.originalPrice !== null ? (
                                      <span className="mr-1 text-[11px] line-through opacity-70">
                                        {formatCurrency(
                                          item.originalPrice * item.quantity,
                                        )}
                                      </span>
                                    ) : null}
                                    <span>
                                      {formatCurrency(
                                        item.price * item.quantity,
                                      )}
                                    </span>
                                  </span>
                                  <button
                                    type="button"
                                    disabled={
                                      isDetailStatusBusy ||
                                      deleteMesaItemMutation.isPending
                                    }
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      handleRequestDeleteMesaItem(item);
                                    }}
                                    aria-label={`Remover item ${formatMesaItemName(item)}`}
                                    title={`Remover item ${formatMesaItemName(item)}`}
                                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {mesaItemPendingDelete?.id === item.id &&
                                    deleteMesaItemMutation.isPending ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </section>

                      <section className="mb-3 rounded-lg border border-[var(--app-border)]">
                        <header className="border-b border-[var(--app-border)] px-3 py-2">
                          <p className="text-base font-semibold text-[var(--app-text)] leading-tight">
                            Aguardando envio
                          </p>
                        </header>

                        <div className="relative px-3 py-2">
                          {waitingItems.length === 0 ? (
                            <p className="text-sm text-[var(--app-muted)] leading-tight">
                              Nenhum item aguardando envio.
                            </p>
                          ) : (
                            waitingItems.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between gap-2 text-sm"
                              >
                                <label className="flex items-center gap-2 text-[var(--app-text)]">
                                  <input
                                    type="checkbox"
                                    checked={item.delivered}
                                    disabled={isDetailStatusBusy}
                                    onChange={(event) =>
                                      handleToggleDelivered(
                                        item.id,
                                        event.target.checked,
                                      )
                                    }
                                  />
                                  <span>
                                    <span className="block">
                                      {item.quantity}x{" "}
                                      {formatMesaItemName(item)}
                                    </span>
                                    {item.additionalTitles &&
                                    item.additionalTitles.length > 0 ? (
                                      <span className="ml-4 block text-xs text-[var(--app-muted)]">
                                        + {item.additionalTitles.join(", ")}
                                      </span>
                                    ) : null}
                                  </span>
                                </label>
                                <div className="flex items-center gap-2">
                                  <span className="text-right text-[var(--app-muted)]">
                                    {item.originalPrice !== null ? (
                                      <span className="mr-1 text-[11px] line-through opacity-70">
                                        {formatCurrency(
                                          item.originalPrice * item.quantity,
                                        )}
                                      </span>
                                    ) : null}
                                    <span>
                                      {formatCurrency(
                                        item.price * item.quantity,
                                      )}
                                    </span>
                                  </span>
                                  <button
                                    type="button"
                                    disabled={
                                      isDetailStatusBusy ||
                                      deleteMesaItemMutation.isPending
                                    }
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      handleRequestDeleteMesaItem(item);
                                    }}
                                    aria-label={`Remover item ${formatMesaItemName(item)}`}
                                    title={`Remover item ${formatMesaItemName(item)}`}
                                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {mesaItemPendingDelete?.id === item.id &&
                                    deleteMesaItemMutation.isPending ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </section>

                      <div className="mb-3">
                        <button
                          type="button"
                          onClick={handleOpenAddItemModal}
                          disabled={isDetailStatusBusy}
                          className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          ADICIONAR ITEM
                        </button>
                      </div>

                      <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2">
                        <div className="flex items-center justify-between gap-2 text-sm text-[var(--app-text)]">
                          <span>Subtotal itens</span>
                          <span>{formatCurrency(mesaTotal)}</span>
                        </div>
                        {currentMesaCouvert.enabled ? (
                          <div className="mt-1 flex items-center justify-between gap-2 text-sm text-[var(--app-text)]">
                            <span>
                              Couvert artístico ({mesaForDetail.seats} x{" "}
                              {formatCurrency(currentMesaCouvert.value)})
                            </span>
                            <span>{formatCurrency(mesaCouvertTotal)}</span>
                          </div>
                        ) : null}
                        {currentMesaServiceCharge.enabled ? (
                          <div className="mt-1 flex items-center justify-between gap-2 text-sm text-[var(--app-text)]">
                            <span>
                              Taxa de serviço ({currentMesaServiceCharge.value}
                              %)
                            </span>
                            <span>
                              {formatCurrency(mesaServiceChargeTotal)}
                            </span>
                          </div>
                        ) : null}
                        <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--app-border)] pt-2 text-base font-semibold text-[var(--app-text)]">
                          <span>Total da mesa</span>
                          <span>{formatCurrency(mesaGrandTotal)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      ) : null}

      {couvertModalState ? (
        <AppModal
          isOpen={Boolean(couvertModalState)}
          onClose={() => setCouvertModalState(null)}
          panelClassName="w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-2xl sm:max-w-md sm:p-5"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium text-[var(--app-muted)]">
                Couvert
              </p>
              <h2 className="text-xl font-semibold text-[var(--app-text)]">
                {couvertModalState.scope === "global"
                  ? "Configurar couvert do dia"
                  : `Mesa ${couvertModalState.mesaName ?? ""}`}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setCouvertModalState(null)}
              className="rounded-full p-1 text-[var(--app-muted)] hover:opacity-80"
              aria-label="Fechar modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-[var(--app-text)]">
              Valor do couvert
            </span>
            <input
              value={couvertDraftValue}
              onChange={(event) => setCouvertDraftValue(event.target.value)}
              type="number"
              min={0}
              step="0.01"
              className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-primary)]"
              placeholder="0,00"
            />
          </label>

          <p className="mt-2 text-xs text-[var(--app-muted)]">
            O valor será aplicado por pessoa na mesa.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCouvertModalState(null)}
              className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--app-text)]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmCouvertModal}
              className="rounded-lg bg-[var(--app-primary)] px-3 py-2 text-sm font-semibold text-[var(--app-primary-contrast)]"
            >
              Aplicar
            </button>
          </div>
        </AppModal>
      ) : null}

      {serviceChargeModalState ? (
        <AppModal
          isOpen={Boolean(serviceChargeModalState)}
          onClose={() => setServiceChargeModalState(null)}
          panelClassName="w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-2xl sm:max-w-md sm:p-5"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium text-[var(--app-muted)]">
                Taxa de serviço
              </p>
              <h2 className="text-xl font-semibold text-[var(--app-text)]">
                {serviceChargeModalState.scope === "global"
                  ? "Configurar taxa de serviço do dia"
                  : `Mesa ${serviceChargeModalState.mesaName ?? ""}`}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setServiceChargeModalState(null)}
              className="rounded-full p-1 text-[var(--app-muted)] hover:opacity-80"
              aria-label="Fechar modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-[var(--app-text)]">
              Percentual (%)
            </span>
            <input
              value={serviceChargeDraftValue}
              onChange={(event) =>
                setServiceChargeDraftValue(event.target.value)
              }
              type="number"
              min={0}
              step="0.1"
              className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-primary)]"
              placeholder="10"
            />
          </label>

          <p className="mt-2 text-xs text-[var(--app-muted)]">
            O valor será aplicado sobre o subtotal dos itens.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setServiceChargeModalState(null)}
              className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--app-text)]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmServiceChargeModal}
              className="rounded-lg bg-[var(--app-primary)] px-3 py-2 text-sm font-semibold text-[var(--app-primary-contrast)]"
            >
              Aplicar
            </button>
          </div>
        </AppModal>
      ) : null}

      <ConfirmationModal
        isOpen={Boolean(pendingDisableConfig)}
        title={
          pendingDisableConfig?.type === "couvert"
            ? "Desativar couvert artístico"
            : "Desativar taxa de serviço"
        }
        description={
          pendingDisableConfig?.scope === "global"
            ? `Tem certeza que deseja desativar ${pendingDisableConfig?.type === "couvert" ? "o couvert artístico" : "a taxa de serviço"} para o valor geral?`
            : `Tem certeza que deseja desativar ${pendingDisableConfig?.type === "couvert" ? "o couvert artístico" : "a taxa de serviço"} para a mesa ${pendingDisableConfig?.mesa?.name ?? "selecionada"}?`
        }
        helperText="Você pode reativar depois sem perder o valor configurado."
        confirmLabel="Desativar"
        confirmTone="primary"
        onClose={() => setPendingDisableConfig(null)}
        onConfirm={() => {
          handleConfirmDisableOptionalConfig();
        }}
      />

      <ConfirmationModal
        isOpen={Boolean(mesaPendingDelete)}
        title="Confirmar exclusão"
        description={`Deseja remover a mesa ${mesaPendingDelete?.code ?? ""}?`}
        confirmLabel="Remover"
        isConfirming={deleteMesaMutation.isPending}
        onClose={() => setMesaPendingDelete(null)}
        onConfirm={() => {
          void handleConfirmDeleteMesa();
        }}
      />

      <ConfirmationModal
        isOpen={Boolean(mesaItemPendingDelete)}
        title="Remover item da mesa"
        description={`Deseja remover ${mesaItemPendingDelete ? `${mesaItemPendingDelete.quantity}x ${formatMesaItemName(mesaItemPendingDelete)}` : "este item"} da mesa?`}
        confirmLabel="Remover"
        isConfirming={deleteMesaItemMutation.isPending}
        onClose={() => setMesaItemPendingDelete(null)}
        onConfirm={() => {
          void handleConfirmDeleteMesaItem();
        }}
      />

      {isPaymentModalOpen && mesaForDetail ? (
        <div className="fixed inset-0 z-50 flex items-end overflow-y-auto bg-black/45 p-3 sm:items-center sm:justify-center">
          <div className="max-h-[calc(100dvh-1.5rem)] w-full overflow-y-auto rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-[var(--app-muted)]">
                  Mesa {mesaForDetail.code}
                </p>
                <h2 className="text-2xl font-semibold leading-tight text-[var(--app-text)]">
                  Pagamento
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="rounded-full p-1 text-[var(--app-muted)] hover:opacity-80"
                aria-label="Fechar modal de pagamento"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-1 text-sm text-[var(--app-muted)]">
              Total da mesa: {formatCurrency(mesaGrandTotal)}
            </p>
            <p className="text-sm text-[var(--app-muted)]">
              Pago: {formatCurrency(paidTotal)}
            </p>
            <p className="text-base font-semibold text-[var(--app-text)]">
              Restante: {formatCurrency(remainingTotal)}
            </p>

            <div className="mt-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
              <p className="text-xs font-semibold text-[var(--app-text)]">
                Detalhamento do pedido
              </p>

              {requestedItemsSummary.length === 0 ? (
                <p className="mt-1 text-xs text-[var(--app-muted)]">
                  Nenhum item lançado na mesa.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {requestedItemsSummary.map((item) => (
                    <li
                      key={`${item.name}-${item.additionalTitles.join("||")}-${item.unitPrice}-${item.originalUnitPrice ?? "no-original"}`}
                      className="text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[var(--app-text)]">
                          {item.quantity}x {item.name}
                        </span>
                        <span className="text-right font-semibold text-[var(--app-text)]">
                          {formatCurrency(item.total)}
                        </span>
                      </div>
                      {item.additionalTitles.length > 0 ||
                      item.additionalTotal > 0 ? (
                        <div className="ml-4 mt-0.5 flex items-start justify-between gap-2">
                          <span className="text-[11px] text-[var(--app-muted)]">
                            +{" "}
                            {item.additionalTitles.length > 0
                              ? item.additionalTitles.join(", ")
                              : "Adicionais"}
                          </span>
                          <span className="text-[11px] font-medium text-[var(--app-muted)]">
                            {formatCurrency(item.additionalTotal)}
                          </span>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              {currentMesaCouvert.enabled ? (
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--app-border)] pt-2 text-xs text-[var(--app-text)]">
                  <span>
                    Couvert ({mesaForDetail.seats} x{" "}
                    {formatCurrency(currentMesaCouvert.value)})
                  </span>
                  <span className="font-semibold">
                    {formatCurrency(mesaCouvertTotal)}
                  </span>
                </div>
              ) : null}
              {currentMesaServiceCharge.enabled ? (
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--app-border)] pt-2 text-xs text-[var(--app-text)]">
                  <span>
                    Taxa de serviço ({currentMesaServiceCharge.value}%)
                  </span>
                  <span className="font-semibold">
                    {formatCurrency(mesaServiceChargeTotal)}
                  </span>
                </div>
              ) : null}
            </div>

            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
              Forma de pagamento
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {(Object.keys(paymentMethodLabels) as PaymentMethod[]).map(
                (method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() =>
                      setPaymentDraft((prev) => ({ ...prev, method }))
                    }
                    className={[
                      "rounded-lg border px-3 py-2 text-sm font-semibold transition",
                      paymentDraft.method === method
                        ? "border-emerald-700 bg-emerald-800 text-white"
                        : "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] hover:bg-[var(--app-surface-muted)]",
                    ].join(" ")}
                  >
                    {paymentMethodLabels[method]}
                  </button>
                ),
              )}
            </div>

            <div className="mt-3 flex items-end gap-2">
              <label className="block flex-1 space-y-1">
                <span className="text-[12px] font-medium text-[var(--app-muted)]">
                  Valor
                </span>
                <input
                  value={paymentDraft.amount}
                  onChange={(event) =>
                    setPaymentDraft((prev) => ({
                      ...prev,
                      amount: event.target.value,
                    }))
                  }
                  type="number"
                  min={0}
                  max={remainingTotal}
                  step="0.01"
                  placeholder="0.00"
                  className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-2 text-sm text-[var(--app-text)] outline-none"
                />
              </label>
              <button
                type="button"
                disabled={remainingTotal <= 0}
                onClick={handleRegisterPayment}
                className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Lançar
              </button>
            </div>

            <button
              type="button"
              disabled={isClosingComanda}
              onClick={handleRequestCloseComanda}
              className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm font-semibold text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isClosingComanda ? "Encerrando..." : "Encerrar comanda"}
            </button>

            <label className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-[var(--app-text)]">
              <input
                type="checkbox"
                checked={deleteMesaAfterClose}
                disabled={isClosingComanda}
                onChange={(event) =>
                  setDeleteMesaAfterClose(event.target.checked)
                }
              />
              Excluir mesa após encerrar comanda
            </label>

            <div className="mt-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-2">
              <p className="text-xs font-semibold text-[var(--app-text)]">
                Lançamentos
              </p>
              {currentMesaPayments.length === 0 ? (
                <p className="mt-1 text-xs text-[var(--app-muted)]">
                  Nenhum pagamento lançado.
                </p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {currentMesaPayments.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="text-[var(--app-text)]">
                        {paymentMethodLabels[payment.method]}
                      </span>
                      <span className="font-semibold text-[var(--app-text)]">
                        {formatCurrency(payment.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {openCloseComandaConfirm && mesaForDetail ? (
        <div className="fixed inset-0 z-50 flex items-end overflow-y-auto bg-black/45 p-3 sm:items-center sm:justify-center">
          <div className="max-h-[calc(100dvh-1.5rem)] w-full overflow-y-auto rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-[var(--app-muted)]">
                  Mesa {mesaForDetail.code}
                </p>
                <h2 className="text-xl font-semibold leading-tight text-[var(--app-text)]">
                  Fechar mesa com débito
                </h2>
              </div>

              <button
                type="button"
                disabled={isClosingComanda}
                onClick={() => {
                  setOpenCloseComandaConfirm(false);
                  setCloseComandaObservation("");
                }}
                className="rounded-full p-1 text-[var(--app-muted)] hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Fechar confirmação de débito"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-[var(--app-muted)]">
              Restante pendente: {formatCurrency(remainingTotal)}
            </p>

            <label className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-[var(--app-text)]">
              <input
                type="checkbox"
                checked={deleteMesaAfterClose}
                disabled={isClosingComanda}
                onChange={(event) =>
                  setDeleteMesaAfterClose(event.target.checked)
                }
              />
              Excluir mesa após encerrar comanda
            </label>

            <label className="mt-3 block space-y-1">
              <span className="text-sm font-medium text-[var(--app-text)]">
                Observação obrigatória
              </span>
              <textarea
                value={closeComandaObservation}
                disabled={isClosingComanda}
                onChange={(event) =>
                  setCloseComandaObservation(event.target.value)
                }
                rows={3}
                placeholder="Ex: Cliente ficou devendo, combinado pagamento amanhã"
                className="w-full resize-none rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-primary)]"
              />
            </label>

            <button
              type="button"
              disabled={isClosingComanda}
              onClick={handleConfirmCloseComandaWithDebt}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--app-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--app-primary-contrast)] transition hover:opacity-90 disabled:opacity-70"
            >
              {isClosingComanda ? "Encerrando..." : "Confirmar fechamento"}
            </button>
          </div>
        </div>
      ) : null}

      {isAddItemModalOpen && mesaForDetail ? (
        <div className="fixed inset-0 z-50 flex items-end overflow-y-auto bg-black/45 p-3 sm:items-center sm:justify-center">
          <div className="max-h-[calc(100dvh-1.5rem)] w-full overflow-y-auto rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-[var(--app-muted)]">
                  Mesa {mesaForDetail.code}
                </p>
                <h2 className="text-xl font-semibold leading-tight text-[var(--app-text)]">
                  Adicionar item
                </h2>
              </div>

              <button
                type="button"
                disabled={createMesaItemMutation.isPending}
                onClick={() => setIsAddItemModalOpen(false)}
                className="rounded-full p-1 text-[var(--app-muted)] hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Fechar modal de adicionar item"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-3">
              <label className="block min-w-0 space-y-1">
                <span className="block truncate whitespace-nowrap text-[12px] font-medium text-[var(--app-muted)]">
                  Item do catalogo
                </span>
                <Select<CatalogItemSelectOption, false>
                  options={catalogItemOptions}
                  value={selectedCatalogItemOption}
                  isDisabled={isDetailStatusBusy || isLoadingCatalogItems}
                  isLoading={isLoadingCatalogItems}
                  isSearchable
                  menuPosition="fixed"
                  menuPortalTarget={
                    typeof document !== "undefined" ? document.body : null
                  }
                  placeholder={
                    isLoadingCatalogItems
                      ? "Carregando itens..."
                      : "Selecione ou pesquise o item"
                  }
                  noOptionsMessage={() => "Nenhum item encontrado"}
                  components={{
                    DropdownIndicator: ItemDropdownIndicator,
                    IndicatorSeparator: () => null,
                  }}
                  styles={itemSelectStyles}
                  onChange={(nextOption) => {
                    const selectedOption =
                      nextOption as SingleValue<CatalogItemSelectOption>;

                    setSelectedAdditionalIds([]);

                    if (!selectedOption) {
                      setItemDraft((prev) => ({
                        ...prev,
                        catalogItemId: "",
                        quantity: "1",
                        weightKg: "",
                      }));
                      return;
                    }

                    if (
                      selectedOption.value === CREATE_NEW_CATALOG_ITEM_VALUE
                    ) {
                      setItemDraft((prev) => ({
                        ...prev,
                        catalogItemId: "",
                        quantity: "1",
                        weightKg: "",
                      }));
                      handleOpenQuickCreateItemModal();
                      return;
                    }

                    setItemDraft((prev) => ({
                      ...prev,
                      catalogItemId: selectedOption.value,
                      quantity: "1",
                      weightKg: "",
                    }));
                  }}
                />
              </label>

              {itemDraft.catalogItemId ? (
                <>
                  {isSelectedCatalogItemByWeight ? (
                    <label className="block min-w-0 space-y-1">
                      <span className="block truncate whitespace-nowrap text-[12px] font-medium text-[var(--app-muted)]">
                        Peso (kg)
                      </span>
                      <input
                        value={itemDraft.weightKg}
                        disabled={isDetailStatusBusy}
                        onChange={(event) =>
                          setItemDraft((prev) => ({
                            ...prev,
                            weightKg: formatWeightMaskInput(event.target.value),
                          }))
                        }
                        type="text"
                        inputMode="numeric"
                        placeholder="0,000"
                        className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                  ) : (
                    <label className="block min-w-0 space-y-1">
                      <span className="block truncate whitespace-nowrap text-[12px] font-medium text-[var(--app-muted)]">
                        Quantidade
                      </span>
                      <input
                        value={itemDraft.quantity}
                        disabled={isDetailStatusBusy}
                        onChange={(event) =>
                          setItemDraft((prev) => ({
                            ...prev,
                            quantity: event.target.value,
                          }))
                        }
                        type="number"
                        min={1}
                        placeholder="Qtd"
                        className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-2 text-sm text-[var(--app-text)] outline-none"
                      />
                    </label>
                  )}

                  <section className="rounded-lg border border-[var(--app-border)] px-3 py-2">
                    <p className="text-sm font-medium text-[var(--app-text)]">
                      Adicionais disponíveis
                    </p>

                    {isLoadingCatalogItemAdditionals ? (
                      <p className="mt-2 text-sm text-[var(--app-muted)]">
                        Carregando adicionais...
                      </p>
                    ) : selectedCatalogItemAdditionals.length === 0 ? (
                      <p className="mt-2 text-sm text-[var(--app-muted)]">
                        Este item não possui adicionais.
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {selectedCatalogItemAdditionals.map((additional) => (
                          <label
                            key={additional.id}
                            className="flex items-start justify-between gap-2 text-sm"
                          >
                            <span className="flex items-start gap-2 text-[var(--app-text)]">
                              <input
                                type="checkbox"
                                checked={selectedAdditionalIds.includes(
                                  additional.id,
                                )}
                                onChange={(event) => {
                                  const checked = event.target.checked;

                                  setSelectedAdditionalIds((prev) => {
                                    if (checked) {
                                      return [...prev, additional.id];
                                    }

                                    return prev.filter(
                                      (id) => id !== additional.id,
                                    );
                                  });
                                }}
                              />
                              <span>
                                <span className="block font-medium leading-tight">
                                  {additional.title}
                                </span>
                                {additional.description ? (
                                  <span className="block text-xs text-[var(--app-muted)] leading-tight">
                                    {additional.description}
                                  </span>
                                ) : null}
                              </span>
                            </span>
                            <span className="text-[var(--app-muted)]">
                              + {formatCurrency(additional.price)}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2">
                    <div className="flex items-center justify-between gap-2 text-sm text-[var(--app-text)]">
                      <span>
                        {isSelectedCatalogItemByWeight
                          ? "Preço base por kg"
                          : "Preço base"}
                      </span>
                      <span>
                        {formatCurrency(selectedCatalogItemUnitPrice)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-sm text-[var(--app-text)]">
                      <span>
                        {isSelectedCatalogItemByWeight
                          ? "Adicionais"
                          : "Adicionais por unidade"}
                      </span>
                      <span>{formatCurrency(selectedAdditionalUnitTotal)}</span>
                    </div>
                    {!isSelectedCatalogItemByWeight ? (
                      <div className="mt-1 flex items-center justify-between gap-2 text-sm text-[var(--app-text)]">
                        <span>Valor por unidade</span>
                        <span>{formatCurrency(selectedItemUnitTotal)}</span>
                      </div>
                    ) : null}
                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--app-border)] pt-2 text-base font-semibold text-[var(--app-text)]">
                      <span>
                        {isSelectedCatalogItemByWeight
                          ? `Total (${selectedItemWeightKg.toLocaleString(
                              "pt-BR",
                              {
                                minimumFractionDigits: 3,
                                maximumFractionDigits: 3,
                              },
                            )} kg)`
                          : `Total (${selectedItemQuantity}x)`}
                      </span>
                      <span>{formatCurrency(selectedItemTotal)}</span>
                    </div>
                  </section>
                </>
              ) : null}

              <button
                type="submit"
                disabled={
                  isDetailStatusBusy ||
                  !itemDraft.catalogItemId ||
                  createMesaItemMutation.isPending
                }
                className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createMesaItemMutation.isPending
                  ? "Salvando item..."
                  : "Confirmar item"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {isQuickCreateItemModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end overflow-y-auto bg-black/45 p-3 sm:items-center sm:justify-center">
          <div className="max-h-[calc(100dvh-1.5rem)] w-full overflow-y-auto rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--app-text)]">
                Criar novo item
              </h2>
              <button
                type="button"
                disabled={createCatalogItemMutation.isPending}
                onClick={() => setIsQuickCreateItemModalOpen(false)}
                className="rounded-full p-1 text-[var(--app-muted)] hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Fechar modal de novo item"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              className="space-y-3"
              onSubmit={handleCreateCatalogItemFromMesa}
            >
              <label className="block space-y-1">
                <span className="text-sm font-medium text-[var(--app-text)]">
                  Nome
                </span>
                <input
                  value={quickCatalogItemForm.name}
                  disabled={createCatalogItemMutation.isPending}
                  onChange={(event) =>
                    setQuickCatalogItemForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-primary)]"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-[var(--app-text)]">
                  Categoria
                </span>
                <input
                  value={quickCatalogItemForm.category}
                  disabled={createCatalogItemMutation.isPending}
                  onChange={(event) =>
                    setQuickCatalogItemForm((prev) => ({
                      ...prev,
                      category: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-primary)]"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-[var(--app-text)]">
                  Tipo de cobrança
                </span>
                <select
                  value={quickCatalogItemForm.pricingType}
                  disabled={createCatalogItemMutation.isPending}
                  onChange={(event) =>
                    setQuickCatalogItemForm((prev) => ({
                      ...prev,
                      pricingType: event.target.value as "UNIDADE" | "PESO",
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-primary)]"
                >
                  <option value="UNIDADE">Unidade</option>
                  <option value="PESO">Peso (kg)</option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-[var(--app-text)]">
                  Preço
                </span>
                <input
                  value={quickCatalogItemForm.price}
                  disabled={createCatalogItemMutation.isPending}
                  onChange={(event) =>
                    setQuickCatalogItemForm((prev) => ({
                      ...prev,
                      price: event.target.value,
                    }))
                  }
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder={
                    quickCatalogItemForm.pricingType === "PESO"
                      ? "Ex: 69.90 por kg"
                      : "Ex: 19.90"
                  }
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-primary)]"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-[var(--app-text)]">
                  Preço promocional (opcional)
                </span>
                <input
                  value={quickCatalogItemForm.promotionalPrice}
                  disabled={createCatalogItemMutation.isPending}
                  onChange={(event) =>
                    setQuickCatalogItemForm((prev) => ({
                      ...prev,
                      promotionalPrice: event.target.value,
                    }))
                  }
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Ex: 15.90"
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-primary)]"
                />
              </label>

              <button
                type="submit"
                disabled={createCatalogItemMutation.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--app-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--app-primary-contrast)] transition hover:opacity-90 disabled:opacity-70"
              >
                {createCatalogItemMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {createCatalogItemMutation.isPending
                  ? "Salvando..."
                  : "Criar item"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {isAnyMesaItemsSyncing ? (
        <div className="pointer-events-none fixed bottom-20 left-3 z-30 md:bottom-4 md:left-4">
          <div className="inline-flex items-center gap-1 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)]/95 px-2.5 py-1 text-[11px] font-medium text-[var(--app-muted)] shadow-sm backdrop-blur">
            <Loader2 className="h-3 w-3 animate-spin" />
            Sincronizando
          </div>
        </div>
      ) : null}

      <button
        type="button"
        disabled={isAnyMesaMutationPending}
        onClick={() => setOpenCreateModal(true)}
        className="fixed bottom-15 right-5 z-30 flex h-12 w-12 flex-col items-center justify-center rounded-full bg-[var(--app-primary)] text-[var(--app-primary-contrast)] shadow-2xl transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Plus className="h-6 w-6" />
      </button>
    </>
  );
}
