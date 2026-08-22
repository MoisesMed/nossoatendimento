import { redirect } from "next/navigation";
import AuditoriaFilters from "@/components/auditoria/AuditoriaFilters";
import { requireTenantContext } from "@/lib/tenantContext";

type AuditLogRow = {
  id: string;
  table_name: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  record_id: string | null;
  actor_user_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

type UserProfileRow = {
  user_id: string;
  full_name: string;
  email: string | null;
};

type TableRow = {
  id: string;
  code: number;
  name: string;
};

type ParsedLog = {
  id: string;
  title: string;
  operation: AuditLogRow["operation"];
  tableName: string;
  when: string;
  actor: string;
  details: string[];
  actionKind: "mesa_closure" | "mesa_change" | "mesa_item_change" | "sales";
  removedItems?: Array<{ code: string; title: string }>;
};

type ActionFilter = "todas" | "fechamento" | "mesas" | "itens" | "vendas";

type AuditoriaPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type DateRangeFilter = {
  startDate: string;
  endDate: string;
  startIso: string;
  endExclusiveIso: string;
};

type MesaClosureSummary = {
  removedItemCount: number;
  removedItems: Array<{ code: string; title: string }>;
};

const operationLabel: Record<AuditLogRow["operation"], string> = {
  INSERT: "Criação",
  UPDATE: "Edição",
  DELETE: "Remoção",
};

const operationBadgeClass: Record<AuditLogRow["operation"], string> = {
  INSERT: "border-emerald-200 bg-emerald-50 text-emerald-800",
  UPDATE: "border-amber-200 bg-amber-50 text-amber-800",
  DELETE: "border-rose-200 bg-rose-50 text-rose-800",
};

const statusLabel: Record<string, string> = {
  VAZIA: "Vazia",
  OCUPADA: "Ocupada",
  EM_PREPARO: "Em preparo",
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
};

const DEFAULT_AUDIT_RANGE_DAYS = 3;

function formatDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateInput(value: string | string[] | undefined) {
  const normalized = Array.isArray(value) ? value[0] : value;

  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function resolveAuditDateRange(
  searchParams: Record<string, string | string[] | undefined> | undefined,
): DateRangeFilter {
  const now = new Date();
  const defaultEndDate = formatDateInputValue(now);
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - (DEFAULT_AUDIT_RANGE_DAYS - 1));
  const defaultStartDate = formatDateInputValue(defaultStart);

  const startDate = parseDateInput(searchParams?.de) ?? defaultStartDate;
  const endDate = parseDateInput(searchParams?.ate) ?? defaultEndDate;

  const normalizedStart = startDate <= endDate ? startDate : endDate;
  const normalizedEnd = endDate >= startDate ? endDate : startDate;

  const endExclusiveDate = new Date(`${normalizedEnd}T00:00:00.000Z`);
  endExclusiveDate.setUTCDate(endExclusiveDate.getUTCDate() + 1);

  return {
    startDate: normalizedStart,
    endDate: normalizedEnd,
    startIso: `${normalizedStart}T00:00:00.000Z`,
    endExclusiveIso: endExclusiveDate.toISOString(),
  };
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function formatCurrency(value: number | null) {
  if (value === null) {
    return "-";
  }

  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatText(value: string | null) {
  if (!value || value.trim().length === 0) {
    return "-";
  }

  return value;
}

function formatStatus(value: string | null) {
  if (!value) {
    return "-";
  }

  return statusLabel[value] ?? value;
}

function formatMesaLabel(
  row: Record<string, unknown> | null,
  tableLabelById: Map<string, string>,
) {
  if (!row) {
    return "Mesa";
  }

  const code = asNumber(row.code);
  const name = asString(row.name);
  const id = asString(row.id);

  if (code !== null && name) {
    return `Mesa ${code} (${name})`;
  }

  if (code !== null) {
    return `Mesa ${code}`;
  }

  if (name) {
    return `Mesa ${name}`;
  }

  if (id) {
    return tableLabelById.get(id) ?? "Mesa";
  }

  return "Mesa";
}

function formatMesaByTableId(
  tableId: string | null,
  tableLabelById: Map<string, string>,
) {
  if (!tableId) {
    return "Mesa";
  }

  return tableLabelById.get(tableId) ?? "Mesa";
}

function buildMesaDetails(
  oldRow: Record<string, unknown> | null,
  newRow: Record<string, unknown> | null,
) {
  const details: string[] = [];

  const oldCode = asNumber(oldRow?.code);
  const newCode = asNumber(newRow?.code);
  if (oldCode !== newCode) {
    details.push(`Número: ${oldCode ?? "-"} -> ${newCode ?? "-"}`);
  }

  const oldName = asString(oldRow?.name);
  const newName = asString(newRow?.name);
  if (formatText(oldName) !== formatText(newName)) {
    details.push(`Nome: ${formatText(oldName)} -> ${formatText(newName)}`);
  }

  const oldSeats = asNumber(oldRow?.seats);
  const newSeats = asNumber(newRow?.seats);
  if (oldSeats !== newSeats) {
    details.push(`Lugares: ${oldSeats ?? "-"} -> ${newSeats ?? "-"}`);
  }

  const oldStatus = asString(oldRow?.status);
  const newStatus = asString(newRow?.status);
  if (oldStatus !== newStatus) {
    details.push(
      `Status: ${formatStatus(oldStatus)} -> ${formatStatus(newStatus)}`,
    );
  }

  const oldNotes = asString(oldRow?.notes);
  const newNotes = asString(newRow?.notes);
  if (formatText(oldNotes) !== formatText(newNotes)) {
    details.push(
      `Observação: ${formatText(oldNotes)} -> ${formatText(newNotes)}`,
    );
  }

  const oldActive = asBoolean(oldRow?.active);
  const newActive = asBoolean(newRow?.active);
  if (oldActive !== null && newActive !== null && oldActive !== newActive) {
    details.push(
      `Ativa: ${oldActive ? "Sim" : "Não"} -> ${newActive ? "Sim" : "Não"}`,
    );
  }

  return details;
}

function buildItemDetails(
  oldRow: Record<string, unknown> | null,
  newRow: Record<string, unknown> | null,
  tableLabelById: Map<string, string>,
) {
  const details: string[] = [];

  const oldTableId = asString(oldRow?.table_id);
  const newTableId = asString(newRow?.table_id);
  if (oldTableId !== newTableId) {
    details.push(
      `Mesa: ${formatMesaByTableId(oldTableId, tableLabelById)} -> ${formatMesaByTableId(newTableId, tableLabelById)}`,
    );
  }

  const oldQuantity = asNumber(oldRow?.quantity);
  const newQuantity = asNumber(newRow?.quantity);
  if (oldQuantity !== newQuantity) {
    details.push(`Quantidade: ${oldQuantity ?? "-"} -> ${newQuantity ?? "-"}`);
  }

  const oldPrice = asNumber(oldRow?.price);
  const newPrice = asNumber(newRow?.price);
  if (oldPrice !== newPrice) {
    details.push(
      `Preço: ${formatCurrency(oldPrice)} -> ${formatCurrency(newPrice)}`,
    );
  }

  const oldDelivered = asBoolean(oldRow?.delivered);
  const newDelivered = asBoolean(newRow?.delivered);
  if (
    oldDelivered !== null &&
    newDelivered !== null &&
    oldDelivered !== newDelivered
  ) {
    details.push(
      `Entregue: ${oldDelivered ? "Sim" : "Não"} -> ${newDelivered ? "Sim" : "Não"}`,
    );
  }

  const oldWeight = asNumber(oldRow?.weight_kg);
  const newWeight = asNumber(newRow?.weight_kg);
  if (oldWeight !== newWeight) {
    details.push(
      `Peso (kg): ${oldWeight?.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) ?? "-"} -> ${newWeight?.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) ?? "-"}`,
    );
  }

  const oldAdditional = asNumber(oldRow?.additional_total);
  const newAdditional = asNumber(newRow?.additional_total);
  if (oldAdditional !== newAdditional) {
    details.push(
      `Total adicionais: ${formatCurrency(oldAdditional)} -> ${formatCurrency(newAdditional)}`,
    );
  }

  return details;
}

function parseLog(
  log: AuditLogRow,
  actorLabelById: Map<string, string>,
  tableLabelById: Map<string, string>,
) {
  const oldRow = asRecord(log.old_data);
  const newRow = asRecord(log.new_data);
  const actor =
    (log.actor_user_id ? actorLabelById.get(log.actor_user_id) : null) ??
    "Sistema";

  if (log.table_name === "restaurant_tables") {
    const mesaLabel =
      formatMesaLabel(newRow, tableLabelById) !== "Mesa"
        ? formatMesaLabel(newRow, tableLabelById)
        : formatMesaLabel(oldRow, tableLabelById);

    const titleByOperation: Record<AuditLogRow["operation"], string> = {
      INSERT: `${mesaLabel} foi criada`,
      UPDATE: `${mesaLabel} foi atualizada`,
      DELETE: `${mesaLabel} foi removida`,
    };

    const details =
      log.operation === "INSERT"
        ? buildMesaDetails(null, newRow)
        : log.operation === "DELETE"
          ? buildMesaDetails(oldRow, null)
          : buildMesaDetails(oldRow, newRow);

    return {
      id: log.id,
      title: titleByOperation[log.operation],
      operation: log.operation,
      tableName: "Mesas",
      when: formatDateTime(log.created_at),
      actor,
      details,
      actionKind: "mesa_change",
    } satisfies ParsedLog;
  }

  if (log.table_name === "restaurant_sales") {
    const rowWithName = newRow ?? oldRow;
    const customerName = formatText(asString(rowWithName?.customer_name));
    const saleLabel = customerName !== "-" ? customerName : "Venda avulsa";
    const saleType = asString(rowWithName?.sale_type) === "MESA" ? "Mesa" : "Avulsa";
    const titleByOperation: Record<AuditLogRow["operation"], string> = {
      INSERT: `${saleLabel} registrada como venda ${saleType.toLowerCase()}`,
      UPDATE: `${saleLabel} atualizada como venda ${saleType.toLowerCase()}`,
      DELETE: `${saleLabel} removida como venda ${saleType.toLowerCase()}`,
    };

    const details = [
      `Tipo: ${saleType}`,
      `Valor total: ${formatCurrency(asNumber(rowWithName?.grand_total) ?? 0)}`,
    ];

    if (rowWithName?.mesa_name) {
      details.push(`Mesa: ${formatText(asString(rowWithName?.mesa_name))}`);
    }

    return {
      id: log.id,
      title: titleByOperation[log.operation],
      operation: log.operation,
      tableName: "Vendas",
      when: formatDateTime(log.created_at),
      actor,
      details,
      actionKind: "sales",
    } satisfies ParsedLog;
  }

  if (log.table_name === "restaurant_table_items") {
    const rowWithName = newRow ?? oldRow;
    const itemName = formatText(asString(rowWithName?.name));
    const tableId =
      asString(rowWithName?.table_id) ??
      asString(newRow?.table_id) ??
      asString(oldRow?.table_id);
    const mesaLabel = formatMesaByTableId(tableId, tableLabelById);

    const titleByOperation: Record<AuditLogRow["operation"], string> = {
      INSERT: `Item ${itemName} adicionado na ${mesaLabel}`,
      UPDATE: `Item ${itemName} alterado na ${mesaLabel}`,
      DELETE: `Item ${itemName} removido da ${mesaLabel}`,
    };

    const details =
      log.operation === "INSERT"
        ? buildItemDetails(null, newRow, tableLabelById)
        : log.operation === "DELETE"
          ? buildItemDetails(oldRow, null, tableLabelById)
          : buildItemDetails(oldRow, newRow, tableLabelById);

    return {
      id: log.id,
      title: titleByOperation[log.operation],
      operation: log.operation,
      tableName: "Itens das mesas",
      when: formatDateTime(log.created_at),
      actor,
      details,
      actionKind: "mesa_item_change",
    } satisfies ParsedLog;
  }

  return null;
}

function isMesaClosureUpdate(log: AuditLogRow) {
  if (log.table_name !== "restaurant_tables" || log.operation !== "UPDATE") {
    return false;
  }

  const oldRow = asRecord(log.old_data);
  const newRow = asRecord(log.new_data);
  const oldStatus = asString(oldRow?.status);
  const newStatus = asString(newRow?.status);

  return Boolean(oldStatus && oldStatus !== "VAZIA" && newStatus === "VAZIA");
}

function resolveMesaIdFromTableLog(log: AuditLogRow) {
  const oldRow = asRecord(log.old_data);
  const newRow = asRecord(log.new_data);

  return asString(newRow?.id) ?? asString(oldRow?.id) ?? log.record_id;
}

function resolveMesaIdFromItemLog(log: AuditLogRow) {
  const oldRow = asRecord(log.old_data);
  const newRow = asRecord(log.new_data);

  return asString(oldRow?.table_id) ?? asString(newRow?.table_id);
}

function buildMesaClosureAuditGrouping(logs: AuditLogRow[]) {
  const itemDeleteWindowMs = 1000 * 120;
  const consumedDeleteIds = new Set<string>();
  const closureByUpdateId = new Map<string, MesaClosureSummary>();

  const itemDeleteCandidates = logs.filter(
    (log) =>
      log.table_name === "restaurant_table_items" && log.operation === "DELETE",
  );

  logs.forEach((log) => {
    if (!isMesaClosureUpdate(log)) {
      return;
    }

    const mesaId = resolveMesaIdFromTableLog(log);
    const updateTime = Date.parse(log.created_at);

    if (!mesaId || Number.isNaN(updateTime)) {
      return;
    }

    const matchingDeletes = itemDeleteCandidates.filter((deleteLog) => {
      if (consumedDeleteIds.has(deleteLog.id)) {
        return false;
      }

      if (deleteLog.actor_user_id !== log.actor_user_id) {
        return false;
      }

      const deleteMesaId = resolveMesaIdFromItemLog(deleteLog);
      if (!deleteMesaId || deleteMesaId !== mesaId) {
        return false;
      }

      const deleteTime = Date.parse(deleteLog.created_at);
      if (Number.isNaN(deleteTime) || deleteTime < updateTime) {
        return false;
      }

      return deleteTime - updateTime <= itemDeleteWindowMs;
    });

    if (matchingDeletes.length === 0) {
      return;
    }

    matchingDeletes.forEach((deleteLog) => {
      consumedDeleteIds.add(deleteLog.id);
    });

    const removedItems = matchingDeletes
      .map((deleteLog) => {
        const oldRow = asRecord(deleteLog.old_data);
        const title = asString(oldRow?.name)?.trim() ?? "Item sem título";
        const numericCode = asNumber(oldRow?.code);
        const stringCode = asString(oldRow?.code)?.trim() ?? null;
        const code =
          numericCode !== null
            ? String(numericCode)
            : stringCode && stringCode.length > 0
              ? stringCode
              : "-";

        return {
          code,
          title,
        };
      })
      .filter(
        (item, index, arr) =>
          arr.findIndex(
            (current) =>
              current.code === item.code && current.title === item.title,
          ) === index,
      );

    closureByUpdateId.set(log.id, {
      removedItemCount: matchingDeletes.length,
      removedItems,
    });
  });

  return { closureByUpdateId, consumedDeleteIds };
}

function parseMesaClosureLog(
  log: AuditLogRow,
  actorLabelById: Map<string, string>,
  tableLabelById: Map<string, string>,
  summary: MesaClosureSummary,
) {
  const oldRow = asRecord(log.old_data);
  const newRow = asRecord(log.new_data);

  const actor =
    (log.actor_user_id ? actorLabelById.get(log.actor_user_id) : null) ??
    "Sistema";

  const mesaLabel =
    formatMesaLabel(newRow, tableLabelById) !== "Mesa"
      ? formatMesaLabel(newRow, tableLabelById)
      : formatMesaLabel(oldRow, tableLabelById);

  const oldStatus = asString(oldRow?.status);
  const newStatus = asString(newRow?.status);

  const details = [
    `Status: ${formatStatus(oldStatus)} -> ${formatStatus(newStatus)}`,
    `${summary.removedItemCount} ${summary.removedItemCount === 1 ? "item foi removido" : "itens foram removidos"} da mesa.`,
  ];

  details.push("Itens removidos detalhados abaixo.");

  return {
    id: log.id,
    title: `${mesaLabel} foi fechada`,
    operation: "UPDATE",
    tableName: "Mesas",
    when: formatDateTime(log.created_at),
    actor,
    details,
    actionKind: "mesa_closure",
    removedItems: summary.removedItems,
  } satisfies ParsedLog;
}

function parseActionFilter(value: string | string[] | undefined): ActionFilter {
  const normalized = Array.isArray(value) ? value[0] : value;

  if (normalized === "fechamento") {
    return "fechamento";
  }

  if (normalized === "mesas") {
    return "mesas";
  }

  if (normalized === "itens") {
    return "itens";
  }

  if (normalized === "vendas") {
    return "vendas";
  }

  return "todas";
}

export default async function AuditoriaPage({
  searchParams,
}: AuditoriaPageProps) {
  const { supabase, tenant, userRole } = await requireTenantContext();

  if (userRole !== "DONO") {
    redirect("/mesas");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedAction = parseActionFilter(resolvedSearchParams?.acao);
  const dateRange = resolveAuditDateRange(resolvedSearchParams);

  const { data, error } = await supabase
    .from("audit_logs")
    .select(
      "id, table_name, operation, record_id, actor_user_id, old_data, new_data, created_at",
    )
    .eq("tenant_id", tenant.id)
    .in("table_name", ["restaurant_tables", "restaurant_table_items", "restaurant_sales"])
    .gte("created_at", dateRange.startIso)
    .lt("created_at", dateRange.endExclusiveIso)
    .order("created_at", { ascending: false })
    .limit(500);

  const logs = (data ?? []) as AuditLogRow[];

  const actorIds = Array.from(
    new Set(
      logs
        .map((log) => log.actor_user_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const { data: profilesData } = actorIds.length
    ? await supabase
        .from("tenant_user_profiles")
        .select("user_id, full_name, email")
        .eq("tenant_id", tenant.id)
        .in("user_id", actorIds)
    : { data: [] as UserProfileRow[] };

  const actorLabelById = new Map(
    ((profilesData ?? []) as UserProfileRow[]).map((profile) => {
      const fullName = profile.full_name?.trim();
      const label =
        fullName && fullName.length > 0
          ? fullName
          : (profile.email ?? profile.user_id);

      return [profile.user_id, label];
    }),
  );

  const { data: tablesData } = await supabase
    .from("restaurant_tables")
    .select("id, code, name")
    .eq("tenant_id", tenant.id);

  const tableLabelById = new Map(
    ((tablesData ?? []) as TableRow[]).map((table) => [
      table.id,
      `Mesa ${table.code} (${table.name})`,
    ]),
  );

  logs.forEach((log) => {
    const oldRow = asRecord(log.old_data);
    const newRow = asRecord(log.new_data);

    [oldRow, newRow].forEach((row) => {
      if (!row) {
        return;
      }

      const id = asString(row.id);
      const code = asNumber(row.code);
      const name = asString(row.name);

      if (!id) {
        return;
      }

      if (code !== null && name) {
        tableLabelById.set(id, `Mesa ${code} (${name})`);
      }
    });
  });

  const { closureByUpdateId, consumedDeleteIds } =
    buildMesaClosureAuditGrouping(logs);

  const parsedLogs: ParsedLog[] = [];

  logs.forEach((log) => {
    if (consumedDeleteIds.has(log.id)) {
      return;
    }

    const closureSummary = closureByUpdateId.get(log.id);
    if (closureSummary) {
      parsedLogs.push(
        parseMesaClosureLog(
          log,
          actorLabelById,
          tableLabelById,
          closureSummary,
        ),
      );
      return;
    }

    const parsed = parseLog(log, actorLabelById, tableLabelById);
    if (parsed) {
      parsedLogs.push(parsed);
    }
  });

  const filteredLogs = parsedLogs.filter((log) => {
    if (selectedAction === "todas") {
      return true;
    }

    if (selectedAction === "fechamento") {
      return log.actionKind === "mesa_closure";
    }

    if (selectedAction === "mesas") {
      return (
        log.actionKind === "mesa_change" || log.actionKind === "mesa_closure"
      );
    }

    if (selectedAction === "vendas") {
      return log.actionKind === "sales";
    }

    return log.actionKind === "mesa_item_change";
  });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1280px] flex-col pb-28">
      <section className="w-full px-4 pb-5 pt-4 sm:px-6">
        <div className="mb-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
          <h1 className="text-lg font-semibold text-[var(--app-text)]">
            Auditoria de mesas
          </h1>
          <p className="mt-1 text-sm text-[var(--app-muted)]">
            Histórico de ações com foco operacional para o dono.
          </p>

          <AuditoriaFilters
            initialAction={selectedAction}
            initialStartDate={dateRange.startDate}
            initialEndDate={dateRange.endDate}
          />
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">
            Não foi possível carregar os logs de auditoria.
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 text-sm text-[var(--app-muted)]">
            Nenhum log encontrado.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <article
                key={log.id}
                className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${operationBadgeClass[log.operation]}`}
                  >
                    {operationLabel[log.operation]}
                  </span>
                  <span className="text-[11px] text-[var(--app-muted)]">
                    {log.when}
                  </span>
                </div>

                <h2 className="mt-2 text-sm font-semibold text-[var(--app-text)]">
                  {log.title}
                </h2>

                <p className="mt-1 text-xs text-[var(--app-muted)]">
                  {log.tableName}
                </p>

                <p className="mt-1 text-xs text-[var(--app-muted)]">
                  Responsável: {log.actor}
                </p>

                {log.details.length > 0 ? (
                  <div className="mt-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3">
                    <p className="text-xs font-semibold text-[var(--app-text)]">
                      Mudanças
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-[var(--app-text)]">
                      {log.details.map((detail, index) => (
                        <li key={`${log.id}-${index}`}>{detail}</li>
                      ))}
                    </ul>

                    {log.actionKind === "mesa_closure" &&
                    log.removedItems &&
                    log.removedItems.length > 0 ? (
                      <div className="mt-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-2">
                        <div className="grid grid-cols-[90px_1fr] gap-2 border-b border-[var(--app-border)] pb-1 text-[11px] font-semibold text-[var(--app-muted)]">
                          <span>Código</span>
                          <span>Título</span>
                        </div>
                        <ul className="mt-1 space-y-1">
                          {log.removedItems.map((item, index) => (
                            <li
                              key={`${log.id}-removed-${item.code}-${item.title}-${index}`}
                              className="grid grid-cols-[90px_1fr] gap-2 text-xs text-[var(--app-text)]"
                            >
                              <span>{item.code}</span>
                              <span>{item.title}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[var(--app-muted)]">
                    Sem campos relevantes alterados para exibição.
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
