"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FormSelect } from "@/components/ui/FormControls";

type ActionFilter = "todas" | "fechamento" | "mesas" | "itens" | "vendas";

type AuditoriaFiltersProps = {
  initialAction: ActionFilter;
  initialStartDate: string;
  initialEndDate: string;
};

function buildAuditoriaQuery(
  action: ActionFilter,
  startDate: string,
  endDate: string,
) {
  const query = new URLSearchParams();

  if (action !== "todas") {
    query.set("acao", action);
  }

  query.set("de", startDate);
  query.set("ate", endDate);

  return query.toString();
}

export default function AuditoriaFilters({
  initialAction,
  initialStartDate,
  initialEndDate,
}: AuditoriaFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [action, setAction] = useState<ActionFilter>(initialAction);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const today = useMemo(() => {
    const now = new Date();
    const timezoneOffsetMs = now.getTimezoneOffset() * 60 * 1000;
    return new Date(now.getTime() - timezoneOffsetMs)
      .toISOString()
      .slice(0, 10);
  }, []);

  const actionOptions = useMemo(
    () => [
      { value: "todas", label: "Todas as ações" },
      { value: "fechamento", label: "Fechamento de mesas" },
      { value: "mesas", label: "Ações de mesas" },
      { value: "itens", label: "Ações de itens" },
      { value: "vendas", label: "Vendas" },
    ],
    [],
  );

  const applyFilters = (
    nextAction: ActionFilter,
    nextStartDate: string,
    nextEndDate: string,
  ) => {
    if (!nextStartDate || !nextEndDate) {
      return;
    }

    const normalizedStart =
      nextStartDate <= nextEndDate ? nextStartDate : nextEndDate;
    const normalizedEnd =
      nextEndDate >= nextStartDate ? nextEndDate : nextStartDate;

    if (normalizedStart !== nextStartDate) {
      setStartDate(normalizedStart);
    }

    if (normalizedEnd !== nextEndDate) {
      setEndDate(normalizedEnd);
    }

    const query = buildAuditoriaQuery(
      nextAction,
      normalizedStart,
      normalizedEnd,
    );
    router.replace(`${pathname}?${query}`, { scroll: false });
  };

  return (
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
      <label className="flex flex-col gap-1 text-xs text-[var(--app-muted)] sm:col-span-2">
        Período
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={startDate}
            max={endDate && endDate < today ? endDate : today}
            onChange={(event) => {
              const nextStartDate = event.target.value;
              setStartDate(nextStartDate);
              applyFilters(action, nextStartDate, endDate);
            }}
            className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1.5 text-xs text-[var(--app-text)]"
          />
          <input
            type="date"
            value={endDate}
            max={today}
            min={startDate || undefined}
            onChange={(event) => {
              const nextEndDate = event.target.value;
              setEndDate(nextEndDate);
              applyFilters(action, startDate, nextEndDate);
            }}
            className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1.5 text-xs text-[var(--app-text)]"
          />
        </div>
      </label>

      <label className="flex flex-col gap-1 text-xs text-[var(--app-muted)]">
        Tipo de ação
        <FormSelect
          value={action}
          onChange={(event) => {
            const nextAction = event.target.value as ActionFilter;
            setAction(nextAction);
            applyFilters(nextAction, startDate, endDate);
          }}
          className="h-[35px] rounded-lg px-2 py-1.5 text-xs"
        >
          {actionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </FormSelect>
      </label>
    </div>
  );
}
