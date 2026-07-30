import type { ActivationDiagnosticEvent } from "./types";

export type ActivationDiagnosticsSink = {
  emit(event: ActivationDiagnosticEvent): void;
  list(): ActivationDiagnosticEvent[];
  clear(): void;
};

/**
 * In-memory diagnostics. Never logs secrets or full trade payloads.
 */
export function createActivationDiagnostics(): ActivationDiagnosticsSink {
  const events: ActivationDiagnosticEvent[] = [];
  return {
    emit(event) {
      events.push(sanitize(event));
    },
    list() {
      return [...events];
    },
    clear() {
      events.length = 0;
    },
  };
}

function sanitize(event: ActivationDiagnosticEvent): ActivationDiagnosticEvent {
  // Structural copy only — events are already redacted by contract.
  return { ...event };
}

/** Hash-like redaction for correlation without raw ids in logs. */
export function redactId(id: string | null | undefined): string {
  if (!id) return "none";
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `id_${h.toString(16).padStart(8, "0")}`;
}
