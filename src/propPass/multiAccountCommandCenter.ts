import {
  PropPassPersistenceError,
  createSupabasePropPassPersistenceAdapter,
  type PersistedRuntimeState,
  type PropPassPersistenceSupabaseClient,
} from "./persistence/index";
import { resolveKillSwitchValues } from "./tradingOs/killSwitch";

export const COMMAND_CENTER_FILTERS = [
  "all",
  "needs_attention",
  "healthy",
  "watch",
  "danger",
  "stop_trading",
  "payout_ready",
  "recovery",
  "challenge",
  "funded",
  "live",
] as const;

export type CommandCenterFilter = (typeof COMMAND_CENTER_FILTERS)[number];
export type CommandCenterContext = "challenge" | "funded" | "live";
export type CommandCenterHealth = "healthy" | "watch" | "danger" | "stop_trading" | null;

export type MultiAccountCommandItem = Readonly<{
  accountId: string;
  name: string;
  firmName: string | null;
  currency: string;
  context: CommandCenterContext;
  lifecycleStatus: string;
  equityMinor: number | null;
  dailyRoomMinor: number | null;
  weeklyRoomMinor: number | null;
  drawdownRoomMinor: number | null;
  mode: "calm" | "balanced" | "gambler" | null;
  health: CommandCenterHealth;
  readinessStatus: string | null;
  payoutReady: boolean;
  recoveryActive: boolean;
  killSwitchActive: boolean;
  latestIntervention: string | null;
  nextAction: string | null;
  calculatedAt: string | null;
  needsAttention: boolean;
}>;

type QueryResult = { data: unknown; error: { message: string; code?: string } | null };
type OwnerQuery = PromiseLike<QueryResult> & { eq(column: string, value: string): OwnerQuery };
type ReadTable = { select(columns: string): OwnerQuery };
export type CommandCenterSupabaseClient = PropPassPersistenceSupabaseClient & {
  from(table: string): ReadTable & ReturnType<PropPassPersistenceSupabaseClient["from"]>;
};

type AccountFact = Readonly<{
  id: string;
  name: string;
  firmName: string | null;
  currency: string;
  status: "active" | "archived" | "closed";
}>;

type ChallengeFact = Readonly<{
  id: string;
  accountId: string;
  phase: "evaluation" | "funded";
  status: "active" | "at_risk" | "breached" | "passed" | "funded" | "reset" | "abandoned";
  updatedAt: string;
}>;

export async function loadMultiAccountCommandCenter(
  client: CommandCenterSupabaseClient,
  authenticatedUserId: string,
): Promise<MultiAccountCommandItem[]> {
  const ownerId = requiredText(authenticatedUserId, "authenticated user");
  const persistence = createSupabasePropPassPersistenceAdapter({
    client,
    authenticatedUserId: ownerId,
  });
  const [accountRows, challengeRows, runtimes] = await Promise.all([
    selectOwnedRows(
      client,
      "prop_accounts",
      "id,user_id,firm_key,label,currency,status",
      ownerId,
    ),
    selectOwnedRows(
      client,
      "prop_challenges",
      "id,user_id,account_id,phase,status,updated_at",
      ownerId,
    ),
    persistence.listRuntimeStates(),
  ]);

  const accounts = accountRows.map((row) => parseAccount(row, ownerId));
  const challenges = challengeRows.map((row) => parseChallenge(row, ownerId));
  const activeAccounts = accounts.filter((account) => account.status === "active");
  const activeIds = new Set(activeAccounts.map((account) => account.id));
  const runtimeByAccount = uniqueRuntimeMap(runtimes, activeIds);

  for (const challenge of challenges) {
    if (!accounts.some((account) => account.id === challenge.accountId)) {
      throw invalidRow("challenge references an unavailable account");
    }
  }

  return activeAccounts
    .map((account) =>
      buildCommandItem(
        account,
        resolveChallenge(challenges.filter((challenge) => challenge.accountId === account.id), runtimeByAccount.get(account.id) ?? null),
        runtimeByAccount.get(account.id) ?? null,
      ),
    )
    .sort((left, right) => {
      if (left.needsAttention !== right.needsAttention) return left.needsAttention ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
}

export function matchesCommandCenterFilter(
  account: MultiAccountCommandItem,
  filter: CommandCenterFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "needs_attention") return account.needsAttention;
  if (filter === "payout_ready") return account.payoutReady;
  if (filter === "recovery") return account.recoveryActive;
  if (filter === "challenge" || filter === "funded" || filter === "live") return account.context === filter;
  return account.health === filter;
}

async function selectOwnedRows(
  client: CommandCenterSupabaseClient,
  table: string,
  columns: string,
  ownerId: string,
): Promise<Record<string, unknown>[]> {
  const result = await client.from(table).select(columns).eq("user_id", ownerId);
  if (result.error) throw repositoryError(result.error);
  if (!Array.isArray(result.data)) throw invalidRow(`${table}: rows expected`);
  return result.data.map((value) => {
    const row = record(value, table);
    if (row.user_id !== ownerId) throw new PropPassPersistenceError("forbidden", `${table}: owner mismatch`);
    return row;
  });
}

function parseAccount(row: Record<string, unknown>, ownerId: string): AccountFact {
  if (row.user_id !== ownerId) throw new PropPassPersistenceError("forbidden", "account owner mismatch");
  const currency = requiredText(row.currency, "account currency").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw invalidRow("account currency is invalid");
  return {
    id: requiredText(row.id, "account id"),
    name: boundedLabel(row.label, "account label"),
    firmName: optionalBoundedLabel(row.firm_key, "firm name"),
    currency,
    status: enumValue(row.status, ["active", "archived", "closed"], "account status"),
  };
}

function parseChallenge(row: Record<string, unknown>, ownerId: string): ChallengeFact {
  if (row.user_id !== ownerId) throw new PropPassPersistenceError("forbidden", "challenge owner mismatch");
  return {
    id: requiredText(row.id, "challenge id"),
    accountId: requiredText(row.account_id, "challenge account id"),
    phase: enumValue(row.phase, ["evaluation", "funded"], "challenge phase"),
    status: enumValue(
      row.status,
      ["active", "at_risk", "breached", "passed", "funded", "reset", "abandoned"],
      "challenge status",
    ),
    updatedAt: iso(row.updated_at, "challenge updatedAt"),
  };
}

function uniqueRuntimeMap(
  runtimes: PersistedRuntimeState[],
  activeAccountIds: Set<string>,
): Map<string, PersistedRuntimeState> {
  const result = new Map<string, PersistedRuntimeState>();
  for (const runtime of runtimes) {
    if (!activeAccountIds.has(runtime.accountId)) continue;
    if (result.has(runtime.accountId)) throw invalidRow("multiple runtime states for account");
    result.set(runtime.accountId, runtime);
  }
  return result;
}

function resolveChallenge(
  challenges: ChallengeFact[],
  runtime: PersistedRuntimeState | null,
): ChallengeFact | null {
  if (runtime?.challengeId) {
    const match = challenges.find((challenge) => challenge.id === runtime.challengeId);
    if (!match) throw invalidRow("runtime challenge is unavailable");
    return match;
  }
  const current = challenges
    .filter((challenge) => ["active", "at_risk", "funded"].includes(challenge.status))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return current.length === 1 ? current[0] : null;
}

function buildCommandItem(
  account: AccountFact,
  challenge: ChallengeFact | null,
  runtime: PersistedRuntimeState | null,
): MultiAccountCommandItem {
  const output = runtime?.payload ?? null;
  const plan = output?.dailyPlan.values ?? null;
  const live = output?.liveLifecycle?.values ?? null;
  const rooms = output?.hardRiskRooms ?? null;
  const health = output ? requiredNullableEnum(output.riskMeter.values.status, ["healthy", "watch", "danger", "stop_trading"], "risk health") : null;
  const context: CommandCenterContext =
    plan?.context === "live" || output?.liveLifecycle
      ? "live"
      : challenge?.phase === "funded" || challenge?.status === "funded"
        ? "funded"
        : "challenge";
  const readinessStatus = context === "live"
    ? output?.withdrawalReadiness?.status ?? null
    : output?.payoutReadiness?.status ?? null;
  const payoutMaximum = output?.payoutReadiness
    ? requiredNullableMinor(output.payoutReadiness.values.recommendedMaximumPayoutMinor, "payout readiness")
    : null;
  const recoveryActive = live?.recovery
    ? requiredBoolean(live.recovery.active, "recovery active")
    : false;
  const killSwitchActive = (() => {
    const killSwitch = resolveKillSwitchValues(output ?? {});
    return killSwitch ? requiredBoolean(killSwitch.active, "kill switch active") : false;
  })();
  const intervention = output?.interventions[0] ?? null;
  const latestIntervention = intervention ? boundedLabel(intervention.title, "intervention title", 160) : null;
  const nextAction = intervention
    ? boundedLabel(intervention.recommendedAction, "intervention action", 240)
    : output
      ? boundedLabel(output.decisionReplay.nextAction, "next action", 240)
      : null;
  const missingInputs = output?.missingInputs ?? [];
  if (!missingInputs.every((value) => typeof value === "string")) throw invalidRow("runtime missing inputs are invalid");
  const needsAttention =
    !runtime ||
    health === "watch" ||
    health === "danger" ||
    health === "stop_trading" ||
    recoveryActive ||
    killSwitchActive ||
    missingInputs.length > 0;

  return {
    accountId: account.id,
    name: account.name,
    firmName: account.firmName,
    currency: account.currency,
    context,
    lifecycleStatus: runtime?.lifecycleStatus ?? challenge?.status ?? account.status,
    equityMinor: live ? requiredNullableMinor(live.currentEquityMinor, "current equity") : null,
    dailyRoomMinor: rooms ? requiredNullableMinor(rooms.dailyLossRemainingMinor, "daily room") : null,
    weeklyRoomMinor: live
      ? requiredNullableMinor(live.weeklyLossRoomMinor, "weekly room")
      : optionalMinor(rooms?.weeklyLossRemainingMinor, "weekly room"),
    drawdownRoomMinor: rooms ? requiredNullableMinor(rooms.drawdownRemainingMinor, "drawdown room") : null,
    mode: plan ? enumValue(plan.mode, ["calm", "balanced", "gambler"], "risk mode") : null,
    health,
    readinessStatus,
    payoutReady: output?.payoutReadiness?.status === "safe_to_take" && payoutMaximum != null && payoutMaximum > 0,
    recoveryActive,
    killSwitchActive,
    latestIntervention,
    nextAction,
    calculatedAt: runtime?.calculatedAt ?? null,
    needsAttention,
  };
}

function optionalMinor(value: unknown, label: string): number | null {
  if (value == null) return null;
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw invalidRow(`${label} is invalid`);
  return Number(value);
}

function requiredNullableMinor(value: unknown, label: string): number | null {
  if (value === null) return null;
  if (value === undefined) throw invalidRow(`${label} is missing`);
  return optionalMinor(value, label);
}

function requiredBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw invalidRow(`${label} is invalid`);
  return value;
}

function boundedLabel(value: unknown, label: string, maximum = 80): string {
  const text = requiredText(value, label).replace(/\s+/g, " ").trim();
  if (text.length > maximum) throw invalidRow(`${label} is too long`);
  return text;
}

function optionalBoundedLabel(value: unknown, label: string): string | null {
  return value == null ? null : boundedLabel(value, label);
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw invalidRow(`${label} is required`);
  return value.trim();
}

function iso(value: unknown, label: string): string {
  const text = requiredText(value, label);
  if (Number.isNaN(Date.parse(text))) throw invalidRow(`${label} is invalid`);
  return text;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalidRow(`${label}: object expected`);
  return value as Record<string, unknown>;
}

function enumValue<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw invalidRow(`${label} is invalid`);
  return value as T;
}

function requiredNullableEnum<T extends string>(value: unknown, values: readonly T[], label: string): T | null {
  if (value === null) return null;
  if (value === undefined) throw invalidRow(`${label} is missing`);
  return enumValue(value, values, label);
}

function invalidRow(message: string): PropPassPersistenceError {
  return new PropPassPersistenceError("invalid_row", message);
}

function repositoryError(error: { message: string; code?: string }): PropPassPersistenceError {
  if (error.code === "42501" || /permission|row-level security/i.test(error.message)) {
    return new PropPassPersistenceError("forbidden", "Prop Pass command center request denied");
  }
  return new PropPassPersistenceError("repository_unavailable", "Prop Pass command center unavailable");
}
