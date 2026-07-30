/**
 * Minimal Node typings for isolated Prop OS fixture QA.
 * Avoids adding @types/node as a project dependency.
 */
declare module "node:assert/strict" {
  interface AssertStrict {
    ok(value: unknown, message?: string | Error): asserts value;
    equal(actual: unknown, expected: unknown, message?: string | Error): void;
    deepEqual(actual: unknown, expected: unknown, message?: string | Error): void;
  }
  const assert: AssertStrict;
  export default assert;
}

declare var console: {
  log(...args: unknown[]): void;
};
