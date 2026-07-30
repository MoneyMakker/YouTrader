import type { DbAssignmentState, TradeAssignmentState } from "./types";

export function toDbAssignmentState(state: TradeAssignmentState): DbAssignmentState {
  switch (state) {
    case "assigned_manual":
      return "manual";
    case "assigned_verified_import":
      return "verified_import";
    default:
      return state;
  }
}

export function fromDbAssignmentState(state: string): TradeAssignmentState {
  switch (state) {
    case "manual":
      return "assigned_manual";
    case "verified_import":
      return "assigned_verified_import";
    case "unassigned":
    case "excluded":
    case "invalid":
      return state;
    default:
      throw new Error(`unsupported assignment_state: ${state}`);
  }
}

export function isAssignedState(state: TradeAssignmentState): boolean {
  return state === "assigned_manual" || state === "assigned_verified_import";
}
