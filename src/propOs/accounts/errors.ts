export type AccountMgmtFailure =
  | "not_found"
  | "ownership_mismatch"
  | "invalid_input"
  | "conflict"
  | "forbidden_transition"
  | "archived"
  | "cross_user"
  | "duplicate_assignment"
  | "inferred_forbidden";

export class AccountMgmtError extends Error {
  readonly failure: AccountMgmtFailure;
  constructor(failure: AccountMgmtFailure, message: string) {
    super(message);
    this.name = "AccountMgmtError";
    this.failure = failure;
  }
}
