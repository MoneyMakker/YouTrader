/**
 * Minimal Node typings for isolated Prop OS fixture QA.
 * Avoids adding @types/node as a project dependency.
 */
declare module "node:assert/strict" {
  interface AssertStrict {
    ok(value: unknown, message?: string | Error): asserts value;
    equal(actual: unknown, expected: unknown, message?: string | Error): void;
    notEqual(actual: unknown, expected: unknown, message?: string | Error): void;
    deepEqual(actual: unknown, expected: unknown, message?: string | Error): void;
  }
  const assert: AssertStrict;
  export default assert;
}

declare module "node:child_process" {
  export function execSync(
    command: string,
    options?: { encoding?: string; cwd?: string },
  ): string;
  export function execFileSync(
    file: string,
    args: string[],
    options?: {
      encoding?: string;
      env?: Record<string, string | undefined>;
      stdio?: Array<"pipe" | "ignore" | "inherit">;
      maxBuffer?: number;
    },
  ): string;
}

declare module "node:crypto" {
  export function createHash(algorithm: string): {
    update(data: string): { digest(encoding: string): string };
  };
}

declare module "node:fs" {
  export function readdirSync(path: string): string[];
  export function readFileSync(path: string, encoding: string): string;
  export function writeFileSync(path: string, data: string, encoding: string): void;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function statSync(path: string): { isDirectory(): boolean };
}

declare module "node:path" {
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
  export function relative(from: string, to: string): string;
}

declare module "node:url" {
  export function fileURLToPath(url: string | URL): string;
}

declare var console: {
  log(...args: unknown[]): void;
  error(...args: unknown[]): void;
};

declare var process: {
  env: Record<string, string | undefined>;
  exit(code?: number): never;
};

interface ImportMeta {
  url: string;
}
