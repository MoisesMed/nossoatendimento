"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BriefcaseBusiness,
  CircleDollarSign,
  ShoppingBag,
} from "lucide-react";
import { Text, Title } from "@/components/ui/Typography";

type SaleRecord = {
  id: string;
  mesa_id: string;
  mesa_code: number | null;
  mesa_name: string;
  closed_at: string;
  subtotal: number;
  couvert_total: number;
  service_charge_total: number;
  grand_total: number;
  paid_total: number;
  remaining_total: number;
  observation: string | null;
  items: Array<{
    id?: string;
    name: string;
    quantity: number;
    price?: number;
  }>;
  payments: Array<{
    method?: string;
    amount?: number;
  }>;
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getMetricLabel(value: number, fallback: string) {
  return Number.isFinite(value) && value > 0 ? formatCurrency(value) : fallback;
}

export default function FinancialDashboard() {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadSales() {
      try {
        const response = await fetch("/api/mesas/financeiro/sales", {
          method: "GET",
        });

        if (!response.ok) {
          if (isActive) {
            setSales([]);
            setIsLoaded(true);
          }
          return;
        }

        const result = (await response.json()) as { data?: SaleRecord[] };

        if (isActive) {
          setSales(Array.isArray(result.data) ? result.data : []);
          setIsLoaded(true);
        }
      } catch {
        if (isActive) {
          setSales([]);
          setIsLoaded(true);
        }
      }
    }

    void loadSales();

    return () => {
      isActive = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const monthly = sales.filter(
      (sale) => new Date(sale.closed_at) >= startOfMonth,
    );
    const daily = sales.filter(
      (sale) => new Date(sale.closed_at) >= startOfDay,
    );

    const monthSales = monthly.reduce(
      (sum, sale) => sum + Number(sale.grand_total ?? 0),
      0,
    );
    const daySales = daily.reduce(
      (sum, sale) => sum + Number(sale.grand_total ?? 0),
      0,
    );
    const avgTicket = monthly.length > 0 ? monthSales / monthly.length : 0;
    const totalItemsSold = monthly.reduce(
      (sum, sale) =>
        sum +
        sale.items.reduce(
          (itemSum, item) => itemSum + Number(item.quantity ?? 0),
          0,
        ),
      0,
    );

    const productAggregation = monthly.reduce<Record<string, number>>(
      (acc, sale) => {
        sale.items.forEach((item) => {
          acc[item.name] = (acc[item.name] ?? 0) + Number(item.quantity ?? 0);
        });
        return acc;
      },
      {},
    );

    const ranking = Object.entries(productAggregation).sort(
      (left, right) => right[1] - left[1],
    );
    const topProduct = ranking[0]?.[0] ?? "Sem vendas";
    const bottomProduct = ranking[ranking.length - 1]?.[0] ?? "Sem vendas";

    return {
      monthSales,
      daySales,
      avgTicket,
      closedTables: monthly.length,
      totalItemsSold,
      topProduct,
      bottomProduct,
    };
  }, [sales]);

  const summaryCards = [
    {
      label: "Vendas do mês",
      value: getMetricLabel(metrics.monthSales, "R$ 0,00"),
      icon: CircleDollarSign,
    },
    {
      label: "Vendas de hoje",
      value: getMetricLabel(metrics.daySales, "R$ 0,00"),
      icon: BriefcaseBusiness,
    },
    {
      label: "Ticket médio",
      value: getMetricLabel(metrics.avgTicket, "R$ 0,00"),
      icon: BarChart3,
    },
    {
      label: "Mesas finalizadas",
      value: metrics.closedTables.toString(),
      icon: ShoppingBag,
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--app-bg)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        {!isLoaded ? (
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-sm text-[var(--app-muted)]">
            Carregando resumo...
          </div>
        ) : null}

        {isLoaded && sales.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] p-8 text-center text-[var(--app-muted)]">
            Ainda não há comandas encerradas para exibir no dashboard.
          </div>
        ) : null}

        {isLoaded && sales.length > 0 ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => {
                const Icon = card.icon;

                return (
                  <div
                    key={card.label}
                    className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <Text tone="muted" size="sm">
                        {card.label}
                      </Text>
                      <div className="rounded-full bg-[var(--app-surface-muted)] p-2 text-[var(--app-text)]">
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3 text-2xl font-semibold text-[var(--app-text)]">
                      {card.value}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
                <Title as="h2" size="card">
                  Itens vendidos
                </Title>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between rounded-xl bg-[var(--app-surface-muted)] px-3 py-3">
                    <Text tone="muted" size="sm">
                      Total de itens vendidos no mês
                    </Text>
                    <span className="font-semibold text-[var(--app-text)]">
                      {metrics.totalItemsSold}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-[var(--app-surface-muted)] px-3 py-3">
                    <Text tone="muted" size="sm">
                      Produto mais vendido
                    </Text>
                    <span className="font-semibold text-[var(--app-text)]">
                      {metrics.topProduct}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-[var(--app-surface-muted)] px-3 py-3">
                    <Text tone="muted" size="sm">
                      Produto menos vendido
                    </Text>
                    <span className="font-semibold text-[var(--app-text)]">
                      {metrics.bottomProduct}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
                <Title as="h2" size="card">
                  Resumo do mês
                </Title>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-xl border border-[var(--app-border)] px-3 py-3">
                    <Text tone="muted" size="sm">
                      Total de vendas
                    </Text>
                    <span className="font-semibold text-[var(--app-text)]">
                      {getMetricLabel(metrics.monthSales, "R$ 0,00")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-[var(--app-border)] px-3 py-3">
                    <Text tone="muted" size="sm">
                      Ticket médio por mesa
                    </Text>
                    <span className="font-semibold text-[var(--app-text)]">
                      {getMetricLabel(metrics.avgTicket, "R$ 0,00")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-[var(--app-border)] px-3 py-3">
                    <Text tone="muted" size="sm">
                      Mesas fechadas
                    </Text>
                    <span className="font-semibold text-[var(--app-text)]">
                      {metrics.closedTables}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
