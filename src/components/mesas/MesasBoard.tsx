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
  Trash2,
  Users,
  Wallet,
  type LucideIcon,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import MesaPrintActions from "@/components/mesas/MesaPrintActions";
import ConfirmationModal from "@/components/ui/ConfirmationModal";

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
  grandTotal: number;
  paidTotal: number;
  remainingTotal: number;
  observation: string | null;
  items: MesaItem[];
  payments: MesaPayment[];
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
const MESA_ITEMS_STORAGE_KEY = "nossoatendimento-mesa-items";
const MESA_PAYMENTS_STORAGE_KEY = "nossoatendimento-mesa-payments";
const CLOSED_COMANDAS_STORAGE_KEY = "nossoatendimento-closed-comandas";

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
              className={`absolute left-0 top-1/2 h-5 w-1.5 -translate-x-3 -translate-y-1/2 rounded ${style.chairStroke}`}
            />
          ) : null}

          {sideChairs >= 2 ? (
            <span
              className={`absolute right-0 top-1/2 h-5 w-1.5 translate-x-3 -translate-y-1/2 rounded ${style.chairStroke}`}
            />
          ) : null}

          {topChairPositions.map((leftPercent, index) => (
            <span
              key={`${code}-top-${index}`}
              className={`absolute -top-3 h-1.5 w-5 -translate-x-1/2 rounded ${style.chairStroke}`}
              style={{ left: `${leftPercent}%` }}
            />
          ))}

          {bottomChairPositions.map((leftPercent, index) => (
            <span
              key={`${code}-bottom-${index}`}
              className={`absolute -bottom-3 h-1.5 w-5 -translate-x-1/2 rounded ${style.chairStroke}`}
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
  onOpen,
  onToggleMenu,
  onOpenStatus,
  onOpenEdit,
  onDelete,
}: {
  mesa: Mesa;
  menuOpen: boolean;
  isBusy: boolean;
  isStatusUpdating: boolean;
  onOpen: (mesa: Mesa) => void;
  onToggleMenu: (mesaId: string) => void;
  onOpenStatus: (mesa: Mesa) => void;
  onOpenEdit: (mesa: Mesa) => void;
  onDelete: (mesa: Mesa) => void;
}) {
  const style = statusStyles[mesa.status];
  const StatusIcon = style.icon;

  return (
    <div
      className={`relative min-h-32 rounded-xl border p-2 shadow-sm ${style.card}`}
    >
      <div className="absolute right-2 top-2">
        <button
          type="button"
          aria-label="Abrir opções da mesa"
          disabled={isBusy}
          onClick={() => onToggleMenu(mesa.id)}
          className="rounded-md p-1 text-[var(--app-muted)] transition hover:bg-[var(--app-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {menuOpen ? (
          <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-lg">
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
        className="block w-full pt-3 text-center transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-80"
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
      </button>
    </div>
  );
}

export default function MesasBoard({ initialMesas }: { initialMesas: Mesa[] }) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const [mesas, setMesas] = useState<Mesa[]>(initialMesas);
  const [openLegendModal, setOpenLegendModal] = useState(false);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [isDailyCouvertEnabled, setIsDailyCouvertEnabled] = useState(false);
  const [dailyCouvertValue, setDailyCouvertValue] = useState("0");
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isQuickCreateItemModalOpen, setIsQuickCreateItemModalOpen] =
    useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isPagamentoMenuOpen, setIsPagamentoMenuOpen] = useState(false);
  const pagamentoMenuRef = useRef<HTMLDivElement | null>(null);
  const [openCloseComandaConfirm, setOpenCloseComandaConfirm] = useState(false);
  const [closeComandaObservation, setCloseComandaObservation] = useState("");
  const [isClosingComanda, setIsClosingComanda] = useState(false);
  const [mesaForDetail, setMesaForDetail] = useState<Mesa | null>(null);
  const [mesaForEdit, setMesaForEdit] = useState<Mesa | null>(null);
  const [mesaPendingDelete, setMesaPendingDelete] = useState<Mesa | null>(null);
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
      setMesas((prev) => [...prev, newMesa].sort((a, b) => a.code - b.code));
      setFormData({ code: "", name: "", seats: "4", notes: "" });
      setOpenCreateModal(false);
      toast.success("Mesa criada com sucesso.");
    },
    onError: () => {
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

  const updateMesaMutation = useMutation({
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
  const isAnyMesaMutationPending =
    createMesaMutation.isPending ||
    updateMesaMutation.isPending ||
    deleteMesaMutation.isPending;
  const isCreateModalBusy = createMesaMutation.isPending;
  const isEditModalBusy = updateMesaMutation.isPending;
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
    ? Math.max(0, Number(dailyCouvertValue) || 0)
    : 0;
  const mesaCouvertTotal = mesaForDetail
    ? mesaForDetail.seats * dailyCouvertAmount
    : 0;
  const mesaGrandTotal = mesaTotal + mesaCouvertTotal;
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
  const selectedItemWeightKg = Math.max(0, maskedWeightToNumber(itemDraft.weightKg));
  const selectedBaseTotal = isSelectedCatalogItemByWeight
    ? selectedCatalogItemUnitPrice * selectedItemWeightKg
    : selectedCatalogItemUnitPrice * selectedItemQuantity;
  const selectedAdditionalTotal = isSelectedCatalogItemByWeight
    ? selectedAdditionalUnitTotal
    : selectedAdditionalUnitTotal * selectedItemQuantity;
  const selectedItemTotal = selectedBaseTotal + selectedAdditionalTotal;

  useEffect(() => {
    const storedMesaItems = window.localStorage.getItem(MESA_ITEMS_STORAGE_KEY);

    if (!storedMesaItems) {
      return;
    }

    try {
      const parsed = JSON.parse(storedMesaItems) as Record<string, MesaItem[]>;
      setMesaItemsByMesaId(parsed);
    } catch {
      window.localStorage.removeItem(MESA_ITEMS_STORAGE_KEY);
    }
  }, []);

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
      MESA_ITEMS_STORAGE_KEY,
      JSON.stringify(mesaItemsByMesaId),
    );
  }, [mesaItemsByMesaId]);

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
    window.localStorage.setItem(storageKey, dailyCouvertValue);
    window.localStorage.setItem(
      enabledStorageKey,
      String(isDailyCouvertEnabled),
    );
  }, [dailyCouvertValue, isDailyCouvertEnabled, todayKey]);

  useEffect(() => {
    let isMounted = true;

    const loadCatalogItems = async () => {
      setIsLoadingCatalogItems(true);

      try {
        const response = await fetch("/api/items", { method: "GET" });
        const result = (await response.json().catch(() => ({}))) as {
          data?: CatalogItem[];
          error?: string;
        };

        if (!response.ok || !result.data) {
          throw new Error(
            result.error ?? "Falha ao carregar itens do cardápio.",
          );
        }

        if (!isMounted) {
          return;
        }

        setCatalogItems(
          result.data
            .filter((item) => item.active)
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
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

    const loadCatalogItemAdditionals = async () => {
      setIsLoadingCatalogItemAdditionals(true);

      try {
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

        if (!isMounted) {
          return;
        }

        setCatalogItemAdditionals(
          result.data.filter((additional) => additional.active),
        );
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

  const handleAddItem = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!mesaForDetail) {
      return;
    }

    const selectedItem = catalogItems.find(
      (item) => item.id === itemDraft.catalogItemId,
    );
    const isByWeight = selectedItem?.pricing_type === "PESO";
    const quantity = isByWeight ? 1 : Number(itemDraft.quantity);
    const weightKg = isByWeight ? maskedWeightToNumber(itemDraft.weightKg) : null;

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

    const nextItem: MesaItem = {
      id: crypto.randomUUID(),
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

    setMesaItemsByMesaId((prev) => ({
      ...prev,
      [mesaForDetail.id]: [...(prev[mesaForDetail.id] ?? []), nextItem],
    }));

    toast.success("Item adicionado em aguardando envio.");

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

  const handleToggleDelivered = (itemId: string, delivered: boolean) => {
    if (!mesaForDetail) {
      return;
    }

    setMesaItemsByMesaId((prev) => ({
      ...prev,
      [mesaForDetail.id]: (prev[mesaForDetail.id] ?? []).map((item) =>
        item.id === itemId ? { ...item, delivered } : item,
      ),
    }));
  };

  const handleOpenPartialPayment = () => {
    if (!mesaForDetail) {
      return;
    }

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

  const finalizeMesaClosure = async (observation: string | null) => {
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
    const couvertTotal = isDailyCouvertEnabled
      ? mesaForDetail.seats * Math.max(0, Number(dailyCouvertValue) || 0)
      : 0;
    const grandTotal = subtotal + couvertTotal;
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

      persistClosedComanda({
        id: crypto.randomUUID(),
        mesaId,
        mesaCode: mesaForDetail.code,
        mesaName: mesaForDetail.name,
        closedAt: new Date().toISOString(),
        subtotal,
        couvertTotal,
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
      toast.success("Comanda encerrada e mesa liberada.");
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

    void finalizeMesaClosure(null);
  };

  const handleConfirmCloseComandaWithDebt = () => {
    const observation = closeComandaObservation.trim();

    if (!observation) {
      toast.error("Informe uma observação para fechar com débito pendente.");
      return;
    }

    void finalizeMesaClosure(observation);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="block max-w-xs space-y-2">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-[var(--app-text)]">
            <input
              type="checkbox"
              checked={isDailyCouvertEnabled}
              onChange={(event) =>
                setIsDailyCouvertEnabled(event.target.checked)
              }
            />
            Habilitar couvert do dia
          </label>

          {isDailyCouvertEnabled ? (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-[var(--app-muted)]">
                Valor do couvert
              </span>
              <input
                value={dailyCouvertValue}
                onChange={(event) => setDailyCouvertValue(event.target.value)}
                type="number"
                min={0}
                step="0.01"
                className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none transition focus:border-[var(--app-primary)]"
                placeholder="0.00"
              />
              <span className="text-[11px] text-[var(--app-muted)]">
                Calculado por mesa: pessoas x couvert
              </span>
            </label>
          ) : null}
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
        {mesas.map((mesa) => (
          <MesaCard
            key={mesa.id}
            mesa={mesa}
            menuOpen={menuMesaId === mesa.id}
            isBusy={isAnyMesaMutationPending}
            isStatusUpdating={
              statusPendingMesaId === mesa.id && updateMesaMutation.isPending
            }
            onOpen={handleOpenMesaDetail}
            onToggleMenu={(mesaId) =>
              setMenuMesaId((current) => (current === mesaId ? null : mesaId))
            }
            onOpenStatus={handleOpenMesaDetail}
            onOpenEdit={handleOpenEditMesa}
            onDelete={handleDeleteMesa}
          />
        ))}
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
          <div className="max-h-[calc(100dvh-1.5rem)] w-full overflow-y-auto rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-xl sm:p-5">
            {(() => {
              const detailStyle = statusStyles[mesaForDetail.status];
              const DetailIcon = detailStyle.icon;

              return (
                <>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-medium text-[var(--app-muted)]">
                        Mesa {mesaForDetail.code}
                      </p>
                      <h2 className="text-2xl font-semibold leading-tight text-[var(--app-text)]">
                        {mesaForDetail.name}
                      </h2>
                      <p
                        className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium ${detailStyle.statusChip}`}
                      >
                        <DetailIcon className="h-3.5 w-3.5" />
                        {detailStyle.label}
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
                      className="rounded-full p-1 text-[var(--app-muted)] hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Fechar modal"
                    >
                      <X className="h-5 w-5" />
                    </button>
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
                          <span>Total da mesa</span>
                          <span>{formatCurrency(mesaGrandTotal)}</span>
                        </div>
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
                          couvertUnitValue={dailyCouvertAmount}
                          isCouvertEnabled={isDailyCouvertEnabled}
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
                            <div className="absolute left-0 top-full z-30 mt-1 w-full min-w-[220px] rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-lg">
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
                                Ir para pagamento
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

                        <div className="space-y-1 px-3 py-2">
                          {deliveredItems.length === 0 ? (
                            <p className="text-sm text-[var(--app-muted)] leading-tight">
                              Nenhum item entregue.
                            </p>
                          ) : (
                            deliveredItems.map((item) => (
                              <label
                                key={item.id}
                                className="flex items-center justify-between gap-2 text-sm"
                              >
                                <span className="flex items-center gap-2 text-[var(--app-text)]">
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
                                </span>
                                <span className="text-right text-[var(--app-muted)]">
                                  {item.originalPrice !== null ? (
                                    <span className="mr-1 text-[11px] line-through opacity-70">
                                      {formatCurrency(
                                        item.originalPrice * item.quantity,
                                      )}
                                    </span>
                                  ) : null}
                                  <span>
                                    {formatCurrency(item.price * item.quantity)}
                                  </span>
                                </span>
                              </label>
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

                        <div className="space-y-1 px-3 py-2">
                          {waitingItems.length === 0 ? (
                            <p className="text-sm text-[var(--app-muted)] leading-tight">
                              Nenhum item aguardando envio.
                            </p>
                          ) : (
                            waitingItems.map((item) => (
                              <label
                                key={item.id}
                                className="flex items-center justify-between gap-2 text-sm"
                              >
                                <span className="flex items-center gap-2 text-[var(--app-text)]">
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
                                </span>
                                <span className="text-right text-[var(--app-muted)]">
                                  {item.originalPrice !== null ? (
                                    <span className="mr-1 text-[11px] line-through opacity-70">
                                      {formatCurrency(
                                        item.originalPrice * item.quantity,
                                      )}
                                    </span>
                                  ) : null}
                                  <span>
                                    {formatCurrency(item.price * item.quantity)}
                                  </span>
                                </span>
                              </label>
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
                        {isDailyCouvertEnabled ? (
                          <div className="mt-1 flex items-center justify-between gap-2 text-sm text-[var(--app-text)]">
                            <span>
                              Couvert ({mesaForDetail.seats} x{" "}
                              {formatCurrency(dailyCouvertAmount)})
                            </span>
                            <span>{formatCurrency(mesaCouvertTotal)}</span>
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

              {isDailyCouvertEnabled ? (
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--app-border)] pt-2 text-xs text-[var(--app-text)]">
                  <span>Couvert ({mesaForDetail.seats} pessoas)</span>
                  <span className="font-semibold">
                    {formatCurrency(mesaCouvertTotal)}
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
                onClick={() => setIsAddItemModalOpen(false)}
                className="rounded-full p-1 text-[var(--app-muted)] hover:opacity-80"
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
                disabled={isDetailStatusBusy || !itemDraft.catalogItemId}
                className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Confirmar item
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

      <button
        type="button"
        disabled={isAnyMesaMutationPending}
        onClick={() => setOpenCreateModal(true)}
        className="fixed bottom-5 right-5 z-30 flex h-20 w-20 flex-col items-center justify-center rounded-full bg-[var(--app-primary)] text-[var(--app-primary-contrast)] shadow-2xl transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Plus className="h-6 w-6" />
        <span className="mt-1 text-[12px] font-medium">Nova mesa</span>
      </button>
    </>
  );
}
