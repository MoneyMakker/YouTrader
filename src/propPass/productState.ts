import type { PropPassUiState } from "./types";

export type PropPassProductState =
  | { kind: "locked" }
  | { kind: "setup" }
  | { kind: "dashboard" }
  | { kind: "recoverable_error" }
  | { kind: "unsupported" };

/**
 * Product access is intentionally independent from the dormant Prop OS
 * activation gate. That gate only controls whether its remote read model can
 * be used. A paying production customer without a configured account must be
 * guided into setup, never told that the product is unavailable.
 */
export function resolvePropPassProductState(input: {
  entitled: boolean;
  appEnvironment: string | null | undefined;
  uiState: PropPassUiState;
}): PropPassProductState {
  if (!input.entitled) return { kind: "locked" };

  switch (input.uiState.kind) {
    case "available":
      return { kind: "dashboard" };
    case "no_account":
    case "no_active_challenge":
      return { kind: "setup" };
    case "repository_unavailable":
      return { kind: "recoverable_error" };
    case "unsupported":
    case "integrity_error":
      return { kind: "unsupported" };
    case "disabled": {
      const environment = String(input.appEnvironment ?? "").trim().toLowerCase();
      // Build 116 embeds `production`; an off staging-only read gate is not a
      // production product state. Keep staging diagnostics explicit instead.
      return environment === "production" ? { kind: "setup" } : { kind: "unsupported" };
    }
    default:
      return { kind: "unsupported" };
  }
}

/** Convert the product decision back into the existing renderer contract. */
export function resolveEntitledPropPassUiState(input: {
  appEnvironment: string | null | undefined;
  uiState: PropPassUiState;
}): PropPassUiState {
  const product = resolvePropPassProductState({
    entitled: true,
    appEnvironment: input.appEnvironment,
    uiState: input.uiState,
  });

  if (product.kind === "setup" && input.uiState.kind === "disabled") {
    return { kind: "no_account" };
  }
  if (product.kind === "recoverable_error") return input.uiState;
  if (product.kind === "unsupported") return input.uiState;
  return input.uiState;
}
