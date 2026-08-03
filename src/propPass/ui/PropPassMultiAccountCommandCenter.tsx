import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { YdlButton } from "../../ydl/components/YdlButton";
import { YdlCard } from "../../ydl/components/YdlCard";
import { YdlChip } from "../../ydl/components/YdlChip";
import { YdlSkeletonCard } from "../../ydl/components/YdlSkeleton";
import { YdlText } from "../../ydl/components/YdlText";
import { useYdlTheme } from "../../ydl/tokens";
import { supabase } from "../../config/appConfig";
import {
  COMMAND_CENTER_FILTERS,
  loadMultiAccountCommandCenter,
  matchesCommandCenterFilter,
  type CommandCenterFilter,
  type CommandCenterSupabaseClient,
  type MultiAccountCommandItem,
} from "../multiAccountCommandCenter";
import { PropPassPersistenceError } from "../persistence/index";

type Props = {
  userId: string;
  selectedAccountId: string;
};

type LoadState =
  | { kind: "loading"; accounts: MultiAccountCommandItem[] }
  | { kind: "ready"; accounts: MultiAccountCommandItem[] }
  | { kind: "error"; accounts: MultiAccountCommandItem[]; invalid: boolean };

const FILTER_LABEL_KEYS: Record<CommandCenterFilter, string> = {
  all: "propPass.commandCenter.filter.all",
  needs_attention: "propPass.commandCenter.filter.needsAttention",
  healthy: "propPass.commandCenter.filter.healthy",
  watch: "propPass.commandCenter.filter.watch",
  danger: "propPass.commandCenter.filter.danger",
  stop_trading: "propPass.commandCenter.filter.stopTrading",
  payout_ready: "propPass.commandCenter.filter.payoutReady",
  recovery: "propPass.commandCenter.filter.recovery",
  challenge: "propPass.commandCenter.filter.challenge",
  funded: "propPass.commandCenter.filter.funded",
  live: "propPass.commandCenter.filter.live",
};

export function PropPassMultiAccountCommandCenter({ userId, selectedAccountId }: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme("dark");
  const [filter, setFilter] = useState<CommandCenterFilter>("all");
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<LoadState>({ kind: "loading", accounts: [] });
  const requestId = useRef(0);

  useEffect(() => {
    const request = ++requestId.current;
    if (!supabase) {
      setState({ kind: "error", accounts: [], invalid: false });
      return;
    }
    setState((prior) => ({ kind: "loading", accounts: prior.accounts }));
    void loadMultiAccountCommandCenter(
      supabase as unknown as CommandCenterSupabaseClient,
      userId,
    )
      .then((accounts) => {
        if (request === requestId.current) setState({ kind: "ready", accounts });
      })
      .catch((error: unknown) => {
        if (request !== requestId.current) return;
        const invalid = error instanceof PropPassPersistenceError && error.code === "invalid_row";
        setState((prior) => ({
          kind: "error",
          accounts: invalid ? [] : prior.accounts,
          invalid,
        }));
      });
    return () => {
      if (request === requestId.current) requestId.current += 1;
    };
  }, [reloadKey, userId]);

  const retry = useCallback(() => setReloadKey((value) => value + 1), []);
  const visibleAccounts = useMemo(
    () => state.accounts.filter((account) => matchesCommandCenterFilter(account, filter)),
    [filter, state.accounts],
  );

  if (state.kind === "loading" && state.accounts.length === 0) {
    return (
      <View style={styles.stack} testID="prop-pass-command-center-loading">
        <YdlText role="label" color="text.secondary">
          {t("propPass.commandCenter.title")}
        </YdlText>
        <YdlSkeletonCard animated />
      </View>
    );
  }

  return (
    <View style={styles.stack} testID="prop-pass-multi-account-command-center">
      <View style={styles.heading}>
        <View style={styles.flex}>
          <YdlText role="title">{t("propPass.commandCenter.title")}</YdlText>
          <YdlText role="caption" color="text.secondary">
            {t("propPass.commandCenter.subtitle", { count: state.accounts.length })}
          </YdlText>
        </View>
        {state.kind === "loading" ? (
          <View accessibilityLiveRegion="polite">
            <YdlText role="caption" color="text.secondary">
              {t("propPass.commandCenter.refreshing")}
            </YdlText>
          </View>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        accessibilityRole="toolbar"
      >
        {COMMAND_CENTER_FILTERS.map((value) => (
          <YdlChip
            key={value}
            label={t(FILTER_LABEL_KEYS[value])}
            selected={filter === value}
            onPress={() => setFilter(value)}
            haptic="selection"
            testID={`prop-pass-command-filter-${value}`}
          />
        ))}
      </ScrollView>

      {state.kind === "error" ? (
        <YdlCard testID="prop-pass-command-center-error">
          <View accessibilityLiveRegion="polite">
            <YdlText role="bodyEmphasized">
              {t(
                state.invalid
                  ? "propPass.commandCenter.errorInvalid"
                  : "propPass.commandCenter.errorUnavailable",
              )}
            </YdlText>
            <YdlText role="body" color="text.secondary">
              {t("propPass.commandCenter.errorBody")}
            </YdlText>
          </View>
          <YdlButton label={t("propPass.commandCenter.retry")} variant="secondary" onPress={retry} />
        </YdlCard>
      ) : null}

      {state.accounts.length === 0 && state.kind !== "error" ? (
        <YdlCard testID="prop-pass-command-center-empty">
          <YdlText role="bodyEmphasized">{t("propPass.commandCenter.empty")}</YdlText>
          <YdlText role="body" color="text.secondary">
            {t("propPass.commandCenter.emptyBody")}
          </YdlText>
          <YdlButton label={t("propPass.commandCenter.retry")} variant="secondary" onPress={retry} />
        </YdlCard>
      ) : visibleAccounts.length === 0 ? (
        <YdlCard testID="prop-pass-command-center-filter-empty">
          <YdlText role="bodyEmphasized">{t("propPass.commandCenter.filterEmpty")}</YdlText>
          <YdlButton
            label={t("propPass.commandCenter.clearFilter")}
            variant="tertiary"
            onPress={() => setFilter("all")}
          />
        </YdlCard>
      ) : (
        visibleAccounts.map((account) => (
          <AccountCommandCard
            key={account.accountId}
            account={account}
            selected={account.accountId === selectedAccountId}
          />
        ))
      )}

      {state.accounts.length > 1 ? (
        <View
          style={[styles.isolationNote, { borderColor: theme.colors.border.subtle }]}
          accessibilityRole="text"
        >
          <YdlText role="caption" color="text.secondary">
            {t("propPass.commandCenter.isolation")}
          </YdlText>
        </View>
      ) : null}
    </View>
  );
}

function AccountCommandCard({
  account,
  selected,
}: {
  account: MultiAccountCommandItem;
  selected: boolean;
}) {
  const { t } = useTranslation();
  const contextLabel = t(`propPass.commandCenter.context.${account.context}`);
  const statusLabel = title(account.health ?? account.lifecycleStatus);
  const accessibilityLabel = `${account.name}. ${contextLabel}. ${statusLabel}.`;
  return (
    <YdlCard
      variant={selected ? "selected" : "outlined"}
      testID={`prop-pass-command-account-${account.accountId}`}
      accessibilityLabel={accessibilityLabel}
      style={styles.accountCard}
    >
      <View style={styles.heading}>
        <View style={styles.flex}>
          <YdlText role="bodyEmphasized" numberOfLines={1}>{account.name}</YdlText>
          <YdlText role="caption" color="text.secondary" numberOfLines={1}>
            {[account.firmName, contextLabel, title(account.lifecycleStatus)].filter(Boolean).join(" · ")}
          </YdlText>
        </View>
        <YdlChip
          label={statusLabel}
          leadingSymbol={
            account.health === "danger" || account.health === "stop_trading"
              ? "warning"
              : account.health === "healthy"
                ? "success"
                : "info"
          }
        />
      </View>

      <View style={styles.metrics}>
        <Metric label={t("propPass.commandCenter.equity")} value={money(account.equityMinor, account.currency, t)} />
        <Metric label={t("propPass.commandCenter.dailyRoom")} value={money(account.dailyRoomMinor, account.currency, t)} />
        <Metric label={t("propPass.commandCenter.weeklyRoom")} value={money(account.weeklyRoomMinor, account.currency, t)} />
        <Metric label={t("propPass.commandCenter.drawdownRoom")} value={money(account.drawdownRoomMinor, account.currency, t)} />
        <Metric label={t("propPass.commandCenter.mode")} value={account.mode ? title(account.mode) : t("propPass.commandCenter.unavailable")} />
        <Metric label={t("propPass.commandCenter.readiness")} value={account.readinessStatus ? title(account.readinessStatus) : t("propPass.commandCenter.unavailable")} />
      </View>

      {account.recoveryActive || account.killSwitchActive ? (
        <View style={styles.flags}>
          {account.recoveryActive ? <YdlChip label={t("propPass.commandCenter.recoveryActive")} leadingSymbol="info" /> : null}
          {account.killSwitchActive ? <YdlChip label={t("propPass.commandCenter.killSwitchActive")} leadingSymbol="warning" /> : null}
        </View>
      ) : null}

      {account.latestIntervention || account.nextAction ? (
        <View accessibilityLiveRegion={account.killSwitchActive ? "assertive" : "polite"}>
          {account.latestIntervention ? (
            <>
              <YdlText role="label" color="text.secondary">{t("propPass.commandCenter.latestIntervention")}</YdlText>
              <YdlText role="bodyEmphasized">{account.latestIntervention}</YdlText>
            </>
          ) : null}
          {account.nextAction ? (
            <YdlText role="body" color="text.secondary">
              {t("propPass.commandCenter.nextAction", { action: account.nextAction })}
            </YdlText>
          ) : null}
        </View>
      ) : null}
    </YdlCard>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <YdlText role="caption" color="text.secondary">{label}</YdlText>
      <YdlText role="bodyEmphasized" numberOfLines={1}>{value}</YdlText>
    </View>
  );
}

function money(
  value: number | null,
  currency: string,
  t: (key: string) => string,
): string {
  if (value == null) return t("propPass.commandCenter.unavailable");
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value / 100);
}

function title(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  heading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  flex: { flex: 1, gap: 2 },
  filters: { gap: 8, paddingRight: 16 },
  accountCard: { gap: 12 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metric: { width: "47%", gap: 3 },
  flags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  isolationNote: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
});
