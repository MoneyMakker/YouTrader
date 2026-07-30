/**
 * Client-safe authenticated read transport for Prop OS.
 * Domain remains transport-unaware. No service-role. No mutations.
 */

export type PropOsReadSelectOptions = {
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
};

/**
 * Minimal SELECT-only transport. Implementations:
 * - Supabase JS authenticated client (App)
 * - Local JWT+RLS psql adapter (integration QA)
 */
export type PropOsReadTransport = {
  selectRows(
    table: string,
    filters: Record<string, string>,
    opts?: PropOsReadSelectOptions,
  ): Promise<Record<string, unknown>[]>;
};

/** Narrow Supabase-like surface used by the App factory. */
export type SupabasePropOsReadClient = {
  from: (table: string) => {
    select: (columns: string) => SupabasePropOsFilterBuilder;
  };
};

type SupabasePropOsFilterBuilder = {
  eq: (column: string, value: string) => SupabasePropOsFilterBuilder;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => SupabasePropOsFilterBuilder;
  limit: (count: number) => SupabasePropOsFilterBuilder;
  then: (
    onfulfilled?: (value: { data: Record<string, unknown>[] | null; error: { message: string } | null }) => unknown,
  ) => Promise<unknown>;
};

export function createSupabasePropOsReadTransport(
  client: SupabasePropOsReadClient,
): PropOsReadTransport {
  return {
    async selectRows(table, filters, opts) {
      let q = client.from(table).select("*") as SupabasePropOsFilterBuilder;
      for (const [col, value] of Object.entries(filters)) {
        q = q.eq(col, value);
      }
      if (opts?.orderBy) {
        q = q.order(opts.orderBy, { ascending: opts.ascending ?? false });
      }
      if (opts?.limit != null) {
        q = q.limit(opts.limit);
      }
      const result = (await q) as {
        data: Record<string, unknown>[] | null;
        error: { message: string } | null;
      };
      if (result.error) {
        throw new Error(`prop_os_read_transport: ${result.error.message}`);
      }
      return result.data ?? [];
    },
  };
}
