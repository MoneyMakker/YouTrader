/**
 * Generate Prop OS TypeScript types from a live PostgreSQL database (source of truth).
 * Usage:
 *   DATABASE_URL=postgresql://postgres@localhost:55432/prop_os_clean2 npm run gen:prop-os-db-types:live
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const outPath = process.env.OUT_PATH
  ? path.resolve(process.env.OUT_PATH)
  : path.join(root, "src/types/propOsDatabase.ts");
const url = process.env.DATABASE_URL ?? "postgresql://postgres@localhost:55432/prop_os_clean2";
const psql = process.env.PSQL_BIN ?? "/opt/homebrew/opt/postgresql@17/bin/psql";

const TABLES = [
  "prop_accounts",
  "prop_challenges",
  "prop_challenge_rule_snapshots",
  "prop_trade_assignments",
  "prop_executions",
  "prop_account_events",
  "prop_challenge_transitions",
  "prop_engine_snapshots",
  "prop_score_snapshots",
  "prop_violation_records",
  "prop_data_quality_flags",
  "prop_correction_events",
] as const;

function mapPg(udt: string, nullable: boolean): string {
  let base = "string";
  if (["int2", "int4", "int8", "float4", "float8", "numeric"].includes(udt)) base = "number";
  else if (udt === "bool") base = "boolean";
  else if (udt === "json" || udt === "jsonb") base = "Json";
  return nullable ? `${base} | null` : base;
}

const sql = `
select c.table_name, c.column_name, c.is_nullable, c.udt_name, c.column_default
from information_schema.columns c
where c.table_schema='public'
  and c.table_name in (${TABLES.map((t) => `'${t}'`).join(",")})
order by c.table_name, c.ordinal_position;
`;

const res = spawnSync(psql, [url, "-v", "ON_ERROR_STOP=1", "-At", "-F", "\t", "-c", sql], {
  encoding: "utf8",
});
if (res.status !== 0) {
  console.error(res.stderr || res.stdout);
  process.exit(1);
}

type Col = { name: string; ts: string; nullable: boolean; hasDefault: boolean };
const byTable = new Map<string, Col[]>();
for (const line of res.stdout.split("\n").filter(Boolean)) {
  const [table, col, isNullable, udt, def] = line.split("\t");
  if (!table || !col) continue;
  const nullable = isNullable === "YES";
  const list = byTable.get(table) ?? [];
  list.push({
    name: col,
    ts: mapPg(udt ?? "text", nullable),
    nullable,
    hasDefault: Boolean(def && def !== ""),
  });
  byTable.set(table, list);
}

for (const t of TABLES) {
  if (!byTable.has(t)) throw new Error(`Missing table in DB: ${t}`);
}

let body = `/**
 * AUTO-GENERATED from live database via scripts/generate-prop-os-db-types-live.ts
 * Source DB: ${url.replace(/:[^:@/]+@/, ":***@")}
 * Re-run: npm run gen:prop-os-db-types:live
 * Do not hand-edit.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PropOsDatabase = {
  public: {
    Tables: {
`;

for (const name of TABLES) {
  const cols = byTable.get(name)!;
  const row = cols.map((c) => `      ${c.name}: ${c.ts};`).join("\n");
  const insert = cols
    .map((c) => {
      const opt = c.nullable || c.hasDefault;
      return `      ${c.name}${opt ? "?" : ""}: ${c.ts};`;
    })
    .join("\n");
  const update = cols.map((c) => `      ${c.name}?: ${c.ts};`).join("\n");
  body += `      ${name}: {
        Row: {
${row}
        };
        Insert: {
${insert}
        };
        Update: {
${update}
        };
        Relationships: [];
      };
`;
}

body += `    };
    Views: Record<string, never>;
    Functions: {
      prop_os_forbid_mutation: { Args: Record<string, never>; Returns: unknown };
      prop_os_forbid_delete: { Args: Record<string, never>; Returns: unknown };
      prop_os_enforce_challenge_account_owner: { Args: Record<string, never>; Returns: unknown };
      prop_os_enforce_assignment_owner: { Args: Record<string, never>; Returns: unknown };
      prop_os_enforce_challenge_no_silent_overwrite: { Args: Record<string, never>; Returns: unknown };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type PropOsTableName = keyof PropOsDatabase["public"]["Tables"];
`;

fs.writeFileSync(outPath, body);
console.log(`Wrote ${outPath} from live DB (${TABLES.length} tables)`);
