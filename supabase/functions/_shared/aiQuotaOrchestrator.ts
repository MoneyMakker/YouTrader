export type QuotaReservation =
  | { kind: "failure" }
  | { kind: "denied" }
  | { kind: "reserved"; status: "reserved" | "completed" | "provider_failed" | "released"; replay: boolean };

export type QuotaLifecycleOutcome<T> =
  | { kind: "success"; value: T; consumed: boolean }
  | { kind: "denied" }
  | { kind: "unavailable"; reason: "quota" | "provider" | "duplicate" };

export type QuotaLifecycleDependencies<T> = {
  reserve: () => Promise<QuotaReservation>;
  transition: (target: "completed" | "provider_failed" | "released", reason?: string) => Promise<boolean>;
  invokeProvider: () => Promise<T>;
  isUsable: (value: T) => boolean;
  timeoutMs: number;
};

async function withTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timer: number | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("provider_timeout")), timeoutMs) as unknown as number;
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Runs a single quota-backed provider request. A successful provider result is
 * completed once; exceptions/timeouts are provider_failed (and do not consume
 * quota), while unusable responses are released.
 * Existing request IDs are deliberately not re-invoked because the provider
 * result is not persisted in this lifecycle table.
 */
export async function runQuotaLifecycle<T>(
  dependencies: QuotaLifecycleDependencies<T>,
): Promise<QuotaLifecycleOutcome<T>> {
  let reservation: QuotaReservation;
  try {
    reservation = await dependencies.reserve();
  } catch {
    return { kind: "unavailable", reason: "quota" };
  }
  if (reservation.kind === "failure") return { kind: "unavailable", reason: "quota" };
  if (reservation.kind === "denied") return { kind: "denied" };
  if (reservation.replay || reservation.status !== "reserved") return { kind: "unavailable", reason: "duplicate" };

  const transition = async (target: "completed" | "provider_failed" | "released", reason?: string) => {
    try {
      return await dependencies.transition(target, reason);
    } catch {
      return false;
    }
  };

  try {
    const value = await withTimeout(dependencies.invokeProvider, dependencies.timeoutMs);
    if (!dependencies.isUsable(value)) {
      return (await transition("released", "unusable_result"))
        ? { kind: "success", value, consumed: false }
        : { kind: "unavailable", reason: "quota" };
    }

    return (await transition("completed"))
      ? { kind: "success", value, consumed: true }
      : { kind: "unavailable", reason: "quota" };
  } catch {
    return (await transition("provider_failed", "provider_failure"))
      ? { kind: "unavailable", reason: "provider" }
      : { kind: "unavailable", reason: "quota" };
  }
}
