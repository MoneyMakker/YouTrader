export type RevenueCatIdentityStatus =
  | "synced"
  | "already_synced"
  | "skipped_not_configured"
  | "skipped_no_user"
  | "failed";

export type RevenueCatIdentityResult<TCustomerInfo> = {
  status: RevenueCatIdentityStatus;
  customerInfo?: TCustomerInfo;
};

/** Minimal RevenueCat surface used by the mobile identity lifecycle. */
export type RevenueCatIdentityClient<TCustomerInfo> = {
  getAppUserID?: () => Promise<string>;
  getCustomerInfo?: () => Promise<TCustomerInfo>;
  logIn: (appUserID: string) => Promise<{ customerInfo: TCustomerInfo }>;
};

type Options = {
  isConfigured: () => boolean;
};

function normalizeUserId(userId: string | null | undefined): string | null {
  const normalized = userId?.trim() || "";
  // RevenueCat app user IDs are always Supabase UUIDs in YouTrader. This prevents
  // accidental future use of an email address or another unrelated identifier.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    return null;
  }
  return normalized;
}

/**
 * Coordinates the RevenueCat identity for one app process. RevenueCat manages
 * aliases created by logIn; this helper only supplies the Supabase user UUID.
 */
export class RevenueCatIdentitySynchronizer<TCustomerInfo> {
  private lastResolvedUserId: string | null = null;
  private inFlightUserId: string | null = null;
  private inFlight: Promise<RevenueCatIdentityResult<TCustomerInfo>> | null = null;

  constructor(
    private readonly client: RevenueCatIdentityClient<TCustomerInfo>,
    private readonly options: Options,
  ) {}

  synchronize(userId: string | null | undefined): Promise<RevenueCatIdentityResult<TCustomerInfo>> {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) return Promise.resolve({ status: "skipped_no_user" });
    if (!this.options.isConfigured()) return Promise.resolve({ status: "skipped_not_configured" });

    if (this.inFlight && this.inFlightUserId === normalizedUserId) return this.inFlight;

    const task = this.run(normalizedUserId);
    this.inFlightUserId = normalizedUserId;
    this.inFlight = task;
    return task.finally(() => {
      if (this.inFlight === task) {
        this.inFlight = null;
        this.inFlightUserId = null;
      }
    });
  }

  reset(): void {
    this.lastResolvedUserId = null;
  }

  private async run(userId: string): Promise<RevenueCatIdentityResult<TCustomerInfo>> {
    try {
      let currentUserId: string | null = null;
      if (this.client.getAppUserID) {
        try {
          currentUserId = await this.client.getAppUserID();
        } catch {
          // A failed identity read is not authoritative. logIn can still reconcile it.
        }
      }

      if (currentUserId === userId || this.lastResolvedUserId === userId) {
        const customerInfo = this.client.getCustomerInfo
          ? await this.client.getCustomerInfo()
          : undefined;
        this.lastResolvedUserId = userId;
        return { status: "already_synced", customerInfo };
      }

      const { customerInfo } = await this.client.logIn(userId);
      this.lastResolvedUserId = userId;
      return { status: "synced", customerInfo };
    } catch {
      // Callers show a generic retry state. Do not retain a failed identity as cached.
      return { status: "failed" };
    }
  }
}
