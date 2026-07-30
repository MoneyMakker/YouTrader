/**
 * Local JWT + RLS authenticated SELECT transport (psql).
 * Mirrors what Supabase PostgREST does for an authenticated session.
 * Not used by React Native — integration QA only.
 */
import { execFileSync } from "node:child_process";
import type {
  PropOsReadSelectOptions,
  PropOsReadTransport,
} from "../src/propOs/accounts/authenticatedReadTransport";

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function createPsqlAuthenticatedPropOsReadTransport(input: {
  db: string;
  userId: string;
  pgHost?: string;
  pgPort?: string;
  pgUser?: string;
}): PropOsReadTransport {
  const env = {
    ...process.env,
    PATH: `/opt/homebrew/opt/postgresql@17/bin:${process.env.PATH ?? ""}`,
    PGHOST: input.pgHost ?? process.env.PGHOST ?? "localhost",
    PGPORT: input.pgPort ?? process.env.PGPORT ?? "55432",
    PGUSER: input.pgUser ?? process.env.PGUSER ?? "postgres",
  };

  function run(sql: string): string {
    return execFileSync(
      "psql",
      ["-d", input.db, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql],
      { encoding: "utf8", env },
    ).trim();
  }

  return {
    async selectRows(table, filters, opts?: PropOsReadSelectOptions) {
      const allowed = new Set([
        "prop_accounts",
        "prop_challenges",
        "prop_challenge_rule_snapshots",
        "prop_trade_assignments",
        "prop_engine_snapshots",
        "prop_score_snapshots",
        "prop_os_user_preferences",
      ]);
      if (!allowed.has(table)) {
        throw new Error(`psql authenticated transport: table not allowlisted: ${table}`);
      }
      const where = Object.entries(filters)
        .map(([col, val]) => {
          if (!/^[a-z_][a-z0-9_]*$/i.test(col)) {
            throw new Error(`invalid filter column: ${col}`);
          }
          return `${col} = ${sqlLiteral(val)}`;
        })
        .join(" and ");
      const order =
        opts?.orderBy && /^[a-z_][a-z0-9_]*$/i.test(opts.orderBy)
          ? ` order by ${opts.orderBy} ${opts.ascending ? "asc" : "desc"}`
          : "";
      const limit = opts?.limit != null ? ` limit ${Number(opts.limit)}` : "";
      const sql = `
        begin;
        select set_config('request.jwt.claim.sub', ${sqlLiteral(input.userId)}, true);
        set local role authenticated;
        select coalesce(json_agg(t), '[]'::json)::text
        from (
          select * from public.${table}
          ${where ? `where ${where}` : ""}
          ${order}${limit}
        ) t;
        commit;
      `;
      const out = run(sql);
      const lines = out.split("\n").map((l) => l.trim()).filter(Boolean);
      const skip = new Set(["BEGIN", "COMMIT", "SET", "RESET"]);
      const payload = lines.filter((l) => !skip.has(l) && !/^[0-9a-f-]{36}$/i.test(l)).join("");
      const start = payload.indexOf("[");
      const end = payload.lastIndexOf("]");
      const candidate =
        start >= 0 && end >= start ? payload.slice(start, end + 1) : "[]";
      try {
        const parsed = JSON.parse(candidate) as
          | Record<string, unknown>[]
          | Record<string, unknown>;
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    },
  };
}
