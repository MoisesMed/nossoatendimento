import { redirect } from "next/navigation";
import { requireTenantContext } from "@/lib/tenantContext";

type AuditLogRow = {
  id: string;
  table_name: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  record_id: string | null;
  actor_user_id: string | null;
  created_at: string;
};

const operationLabel: Record<AuditLogRow["operation"], string> = {
  INSERT: "POST",
  UPDATE: "PATCH",
  DELETE: "DELETE",
};

const operationBadgeClass: Record<AuditLogRow["operation"], string> = {
  INSERT:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-200",
  UPDATE:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-200",
  DELETE:
    "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-200",
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

function formatTableName(tableName: string) {
  return tableName.replaceAll("_", " ");
}

export default async function AuditoriaPage() {
  const { supabase, tenant, userRole } = await requireTenantContext();

  if (userRole === "USUARIO") {
    redirect("/cardapio");
  }

  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, table_name, operation, record_id, actor_user_id, created_at")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const logs = ((data ?? []) as AuditLogRow[]).filter(
    (row) => row.table_name !== "audit_logs",
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1280px] flex-col pb-28">
      <section className="w-full px-4 pb-5 pt-4 sm:px-6">
        <div className="mb-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
          <h1 className="text-lg font-semibold text-[var(--app-text)]">
            Auditoria
          </h1>
          <p className="mt-1 text-sm text-[var(--app-muted)]">
            Registro das alteracoes realizadas no tenant {tenant.name}.
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">
            Nao foi possivel carregar os logs de auditoria.
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 text-sm text-[var(--app-muted)]">
            Nenhum log encontrado.
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <article
                key={log.id}
                className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${operationBadgeClass[log.operation]}`}
                  >
                    {operationLabel[log.operation]}
                  </span>
                  <span className="text-[11px] text-[var(--app-muted)]">
                    {formatDateTime(log.created_at)}
                  </span>
                </div>

                <p className="mt-2 text-sm font-medium text-[var(--app-text)]">
                  {formatTableName(log.table_name)}
                </p>

                <p className="mt-1 text-xs text-[var(--app-muted)]">
                  Registro: {log.record_id ?? "-"}
                </p>

                <p className="mt-1 text-xs text-[var(--app-muted)]">
                  Usuario: {log.actor_user_id ?? "sistema"}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
