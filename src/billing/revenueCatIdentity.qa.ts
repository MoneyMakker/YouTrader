import {
  RevenueCatIdentitySynchronizer,
  type RevenueCatIdentityClient,
} from "./revenueCatIdentity";

export type RevenueCatIdentityQaResult = { name: string; pass: boolean; detail?: string };

type CustomerInfo = { source: string };

function createClient(options: {
  currentUserId?: string;
  failLogin?: boolean;
  deferLogin?: boolean;
}) {
  let currentUserId = options.currentUserId || "anonymous";
  let loginCalls = 0;
  let customerInfoCalls = 0;
  let releaseLogin: (() => void) | null = null;

  const client: RevenueCatIdentityClient<CustomerInfo> = {
    getAppUserID: async () => currentUserId,
    getCustomerInfo: async () => {
      customerInfoCalls += 1;
      return { source: "customer_info" };
    },
    logIn: async (appUserID) => {
      loginCalls += 1;
      if (options.deferLogin) {
        await new Promise<void>((resolve) => {
          releaseLogin = resolve;
        });
      }
      if (options.failLogin) throw new Error("provider unavailable");
      currentUserId = appUserID;
      return { customerInfo: { source: "login" } };
    },
  };

  return {
    client,
    get loginCalls() {
      return loginCalls;
    },
    get customerInfoCalls() {
      return customerInfoCalls;
    },
    setCurrentUserId: (nextUserId: string) => {
      currentUserId = nextUserId;
    },
    releaseLogin: () => releaseLogin?.(),
  };
}

export async function runRevenueCatIdentityQa(): Promise<RevenueCatIdentityQaResult[]> {
  const results: RevenueCatIdentityQaResult[] = [];
  const userId = "2fb97295-edc2-4969-9d6a-4ea92a39dfc5";

  let configured = false;
  const startup = createClient({});
  const startupSync = new RevenueCatIdentitySynchronizer(startup.client, { isConfigured: () => configured });
  const beforeConfigure = await startupSync.synchronize(userId);
  configured = true;
  const afterConfigure = await startupSync.synchronize(userId);
  results.push({
    name: "startup_session_waits_for_configuration_then_logs_in_with_uuid",
    pass:
      beforeConfigure.status === "skipped_not_configured" &&
      afterConfigure.status === "synced" &&
      startup.loginCalls === 1 &&
      // logIn CustomerInfo is always followed by an explicit getCustomerInfo refresh.
      startup.customerInfoCalls >= 1,
  });

  const repeated = await startupSync.synchronize(userId);
  results.push({
    name: "repeated_synchronization_is_idempotent",
    pass: repeated.status === "already_synced" && startup.loginCalls === 1 && startup.customerInfoCalls >= 2,
  });

  const concurrentClient = createClient({ deferLogin: true });
  const concurrentSync = new RevenueCatIdentitySynchronizer(concurrentClient.client, { isConfigured: () => true });
  const first = concurrentSync.synchronize(userId);
  const second = concurrentSync.synchronize(userId);
  // Allow the async app-user-id read to reach the deliberately deferred login.
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  concurrentClient.releaseLogin();
  const [firstResult, secondResult] = await Promise.all([first, second]);
  results.push({
    name: "concurrent_identity_synchronization_uses_one_login",
    pass: firstResult.status === "synced" && secondResult.status === "synced" && concurrentClient.loginCalls === 1,
  });

  const currentIdentity = createClient({ currentUserId: userId });
  const currentSync = new RevenueCatIdentitySynchronizer(currentIdentity.client, { isConfigured: () => true });
  const currentResult = await currentSync.synchronize(userId);
  results.push({
    name: "matching_revenuecat_identity_does_not_repeat_login",
    pass: currentResult.status === "already_synced" && currentIdentity.loginCalls === 0 && currentIdentity.customerInfoCalls === 1,
  });

  const failedClient = createClient({ failLogin: true });
  const failedSync = new RevenueCatIdentitySynchronizer(failedClient.client, { isConfigured: () => true });
  const failed = await failedSync.synchronize(userId);
  results.push({
    name: "login_failure_is_generic_and_not_cached_as_identity",
    pass: failed.status === "failed" && failed.customerInfo === undefined && failedClient.loginCalls === 1,
  });

  const emailResult = await startupSync.synchronize("trader@example.com");
  results.push({
    name: "email_is_never_used_as_revenuecat_app_user_id",
    pass: emailResult.status === "skipped_no_user" && startup.loginCalls === 1,
  });

  startupSync.reset();
  startup.setCurrentUserId("anonymous");
  const afterLogout = await startupSync.synchronize(userId);
  results.push({
    name: "logout_reset_allows_the_next_authenticated_identity_to_sync",
    pass: afterLogout.status === "synced" && startup.loginCalls === 2,
  });

  return results;
}

export async function runRevenueCatIdentityQaOrThrow(): Promise<RevenueCatIdentityQaResult[]> {
  const results = await runRevenueCatIdentityQa();
  const failed = results.filter((result) => !result.pass);
  if (failed.length) {
    throw new Error(`RevenueCat identity QA failed: ${failed.map((result) => result.name).join(", ")}`);
  }
  return results;
}
