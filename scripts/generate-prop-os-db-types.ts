/**
 * Generate TypeScript Database types for Prop OS tables from Prop OS migrations.
 * Sources:
 * - supabase/migrations/20260730190000_prop_os_database_foundation.sql
 * - supabase/migrations/20260730210000_prop_os_controlled_activation_read.sql
 * Do not hand-edit the output file — re-run this script after schema changes.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const migrationPaths = [
  path.join(root, "supabase/migrations/20260730190000_prop_os_database_foundation.sql"),
  path.join(
    root,
    "supabase/migrations/20260730210000_prop_os_controlled_activation_read.sql",
  ),
];
const outPath = path.join(root, "src/types/propOsDatabase.ts");
type Col = { name: string; ts: string; nullable: boolean };

function mapType(sqlType: string, nullable: boolean): string {
  const t = sqlType.toLowerCase().trim();
  let base = "string";
  if (t.startsWith("uuid") || t.startsWith("text") || t.startsWith("timestamptz")) base = "string";
  else if (t.startsWith("bigint") || t.startsWith("integer") || t.startsWith("numeric")) base = "number";
  else if (t.startsWith("boolean")) base = "boolean";
  else if (t.startsWith("jsonb") || t.startsWith("json")) base = "Json";
  return nullable ? `${base} | null` : base;
}

function parseTables(sql: string): Record<string, Col[]> {
  const tables: Record<string, Col[]> = {};
  const re =
    /create table if not exists public\.(\w+)\s*\(([\s\S]*?)\n\);/gi;
  let m: RegExpExecArray | null;
  const typeStart =
    /^(uuid|text|bigint|integer|numeric|boolean|timestamptz|jsonb|json)\b/i;
  while ((m = re.exec(sql))) {
    const name = m[1]!;
    const body = m[2]!;
    const cols: Col[] = [];
    const seen = new Set<string>();
    const lines = body.split("\n");
    for (let li = 0; li < lines.length; li++) {
      let line = lines[li]!.trim().replace(/,$/, "");
      if (!line) continue;
      if (/^(constraint|check\b|unique\b|primary\s+key)\b/i.test(line)) {
        // Skip table-level constraint; consume until parentheses balanced if any.
        let depth = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
        while (depth > 0 && li + 1 < lines.length) {
          li += 1;
          const next = lines[li]!;
          depth += (next.match(/\(/g) || []).length - (next.match(/\)/g) || []).length;
        }
        continue;
      }
      const colMatch = line.match(/^([a-z][a-z0-9_]*)\s+(.+)$/i);
      if (!colMatch) continue;
      const colName = colMatch[1]!;
      let remainder = colMatch[2]!;
      if (!typeStart.test(remainder)) continue;
      // Consume multi-line column CHECK / default expressions
      let depth =
        (remainder.match(/\(/g) || []).length - (remainder.match(/\)/g) || []).length;
      while (depth > 0 && li + 1 < lines.length) {
        li += 1;
        const next = lines[li]!.trim().replace(/,$/, "");
        remainder += ` ${next}`;
        depth += (next.match(/\(/g) || []).length - (next.match(/\)/g) || []).length;
      }
      if (seen.has(colName)) continue;
      const withoutCheck = remainder.replace(/\bcheck\s*\([\s\S]*$/i, "");
      const sqlType = remainder.match(typeStart)![0]!;
      const nullable = !/\bnot null\b/i.test(withoutCheck);
      seen.add(colName);
      cols.push({ name: colName, ts: mapType(sqlType, nullable), nullable });
    }
    tables[name] = cols;
  }
  return tables;
}

const sql = migrationPaths.map((p) => fs.readFileSync(p, "utf8")).join("\n\n");
const tables = parseTables(sql);
const names = Object.keys(tables).sort();
if (names.length < 13) {
  throw new Error(`Expected >=13 prop tables (incl. preferences), parsed ${names.length}`);
}

function rowInterface(cols: Col[], mode: "Row" | "Insert" | "Update"): string {
  return cols
    .map((c) => {
      if (mode === "Row") return `      ${c.name}: ${c.ts};`;
      if (mode === "Insert") {
        const opt =
          c.nullable ||
          c.name === "id" ||
          c.name.endsWith("_at") ||
          c.name === "schema_version" ||
          c.name === "voided" ||
          c.name === "breach_locked" ||
          c.name === "currency" ||
          c.name === "provenance" ||
          c.name === "payload" ||
          c.name === "evidence" ||
          c.name === "details" ||
          c.name === "limitations";
        // Keep required business fields required on Insert when NOT NULL without default in SQL is hard to detect;
        // mark nullable or defaulted-looking fields optional.
        const optional = opt || c.name === "created_at" || c.name === "updated_at";
        return `      ${c.name}${optional ? "?" : ""}: ${c.ts};`;
      }
      return `      ${c.name}?: ${c.ts};`;
    })
    .join("\n");
}

let body = `/**
 * AUTO-GENERATED from Prop OS migrations (1A foundation + 1E activation read).
 * Re-run: npm run gen:prop-os-db-types
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

for (const name of names) {
  const cols = tables[name]!;
  body += `      ${name}: {
        Row: {
${rowInterface(cols, "Row")}
        };
        Insert: {
${rowInterface(cols, "Insert")}
        };
        Update: {
${rowInterface(cols, "Update")}
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
      prop_os_enforce_pref_default_owner: { Args: Record<string, never>; Returns: unknown };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type PropOsTableName = keyof PropOsDatabase["public"]["Tables"];
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, body);
console.log(`Wrote ${outPath} (${names.length} tables)`);
