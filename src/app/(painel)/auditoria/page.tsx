import { redirect } from "next/navigation";
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
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
    } satisfies ParsedLog;
  }

  return null;
}

export default async function AuditoriaPage() {
  const { supabase, tenant, userRole } = await requireTenantContext();

  if (userRole !== "DONO") {
    redirect("/mesas");
  }

  const { data, error } = await supabase
    .from("audit_logs")
    .select(
      "id, table_name, operation, record_id, actor_user_id, old_data, new_data, created_at",
    )
    .eq("tenant_id", tenant.id)
    .in("table_name", ["restaurant_tables", "restaurant_table_items"])
    .order("created_at", { ascending: false })
    .limit(300);

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

  const parsedLogs = logs
    .map((log) => parseLog(log, actorLabelById, tableLabelById))
    .filter((log): log is ParsedLog => log !== null);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1280px] flex-col pb-28">
      <section className="w-full px-4 pb-5 pt-4 sm:px-6">
        {error ? (
          <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">
            Não foi possível carregar os logs de auditoria.
          </div>
        ) : parsedLogs.length === 0 ? (
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 text-sm text-[var(--app-muted)]">
            Nenhum log encontrado.
          </div>
        ) : (
          <div className="space-y-3">
            {parsedLogs.map((log) => (
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
