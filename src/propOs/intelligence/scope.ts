import type { IntelligenceScope } from "./types";
import { createHash, stableStringify } from "./hash";

export function scopeKey(scope: IntelligenceScope): string {
  return createHash(stableStringify(scope));
}

export function scopeAccountId(scope: IntelligenceScope): string {
  return scope.accountId;
}

export function buildInputRevision(input: {
  assignmentRevision: number;
  scope: IntelligenceScope;
  identityHash: string;
  metricSpecVersion: string;
  engineVersion: string;
}): string {
  return `pi-rev-${input.assignmentRevision}:${scopeKey(input.scope).slice(0, 8)}:${input.identityHash.slice(0, 8)}:${input.metricSpecVersion}:${input.engineVersion}`;
}
