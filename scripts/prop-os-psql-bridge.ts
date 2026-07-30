/**
 * Minimal psql bridge for Prop OS shadow PG QA.
 * No permanent `pg` dependency — shells to local psql only.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const PGHOST = process.env.PGHOST ?? "localhost";
const PGPORT = process.env.PGPORT ?? "55432";
const PGUSER = process.env.PGUSER ?? "postgres";

export function fixtureUuid(seed: string): string {
  const h = createHash("sha256").update(`prop-os-shadow:${seed}`).digest("hex");
  const variant = ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(18, 20)}-${h.slice(20, 32)}`;
}

export function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function sqlJson(value: unknown): string {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

export function sqlNullableLiteral(value: string | null | undefined): string {
  if (value == null) return "null";
  return sqlLiteral(value);
}

export function sqlNullableNumber(value: number | null | undefined): string {
  if (value == null) return "null";
  return String(value);
}

export function psql(db: string, sql: string, opts?: { quiet?: boolean }): string {
  const args = [
    "-d",
    db,
    "-v",
    "ON_ERROR_STOP=1",
    "-At",
    "-F",
    ",",
    "-c",
    sql,
  ];
  try {
    return execFileSync("psql", args, {
      encoding: "utf8",
      env: { ...process.env, PGHOST, PGPORT, PGUSER, PATH: process.env.PATH },
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["pipe", "pipe", opts?.quiet ? "pipe" : "pipe"],
    }).trim();
  } catch (err) {
    const e = err as { stderr?: string | { toString(): string }; message?: string; status?: number };
    const detail = (typeof e.stderr === "string" ? e.stderr : e.stderr?.toString?.() ?? e.message ?? String(err)).toString();
    throw Object.assign(new Error(detail || "psql failed"), {
      failure: "database_read_failure",
      status: e.status,
    });
  }
}

export function psqlJsonToFile<T>(db: string, sql: string, outPath: string): T {
  mkdirSync(dirname(outPath), { recursive: true });
  try {
    execFileSync(
      "psql",
      ["-d", db, "-v", "ON_ERROR_STOP=1", "-At", "-o", outPath, "-c", sql],
      {
        encoding: "utf8",
        env: { ...process.env, PGHOST, PGPORT, PGUSER, PATH: process.env.PATH },
        maxBuffer: 64 * 1024 * 1024,
      },
    );
  } catch (err) {
    const e = err as { stderr?: string | { toString(): string }; message?: string; status?: number };
    const detail = (typeof e.stderr === "string" ? e.stderr : e.stderr?.toString?.() ?? e.message ?? String(err)).toString();
    throw Object.assign(new Error(detail || "psql file query failed"), {
      failure: "database_read_failure",
      status: e.status,
    });
  }
  const raw = readFileSync(outPath, "utf8").trim();
  if (!raw) return null as T;
  return JSON.parse(raw) as T;
}

export function psqlJson<T>(db: string, sql: string): T {
  const raw = psql(db, sql);
  if (!raw) return null as T;
  return JSON.parse(raw) as T;
}

export function writeTmpJson(dir: string, name: string, value: unknown): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(value, null, 2), "utf8");
  return path;
}
