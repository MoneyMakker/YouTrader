/**
 * Internal/staging Prop Pass trade assignment flow.
 * Does not calculate pass/drawdown/readiness — preview is informational only.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Trade } from "../app/types";
import { supabase } from "../config/appConfig";
import { YdlButton } from "../ydl/components/YdlButton";
import { YdlCard } from "../ydl/components/YdlCard";
import { YdlText } from "../ydl/components/YdlText";
import { useYdlTheme } from "../ydl/tokens";
import { createAuthenticatedPropOsReadStore } from "../propOs/accounts/authenticatedReadStore";
import { createSupabasePropOsReadTransport } from "../propOs/accounts/authenticatedReadTransport";
import { isAssignedState } from "../propOs/accounts/assignmentState";
import {
  ASSIGNMENT_BULK_MAX,
  buildAssignmentImpactPreview,
  buildTradeIdentity,
  createMemoryAssignmentReadStore,
  createMemoryAssignmentStore,
  evaluateAssignability,
  resolveOccurredAtUtc,
  type AssignableTradeRow,
  type AssignmentImpactPreview,
  type PropTradeAssignmentEvent,
} from "../propOs/assignments/index";
import { newPropOsClientRequestId } from "../propOs/commands/hash";
import { createRpcAssignmentWriteService } from "../propOs/assignments/rpcWriteService";
import { trackPropPassEvent } from "./analytics";
import { getPropPassRpcClientForTests } from "./commandGateway";

type Step =
  | "list"
  | "preview"
  | "reassign_confirm"
  | "remove_confirm"
  | "pending"
  | "failed"
  | "success"
  | "history";

type Props = {
  userId: string;
  accountId: string;
  challengeId: string;
  challengeStatus: string;
  accountStatus?: string;
  challengeStartedAt: string;
  challengeEndedAt?: string | null;
  trades: Trade[];
  onClose: () => void;
  onCompleted: () => void;
  /** Inject write service for QA. */
  writeServiceOverride?: ReturnType<typeof createRpcAssignmentWriteService> | null;
};

function tradeToFact(userId: string, trade: Trade) {
  const occurredAtUtc = resolveOccurredAtUtc({
    exitTime: trade.exitTime,
    entryTime: trade.entryTime,
    tradeDate: trade.date,
  });
  return {
    identity: buildTradeIdentity({ userId, tradeClientId: trade.id }),
    symbol: trade.symbol,
    direction: trade.direction,
    pnlMajor: trade.pnl,
    occurredAtUtc,
    tradeDate: trade.date,
    contracts: trade.contracts,
    open: !trade.exitTime && trade.pnl === 0 && !trade.exit,
  };
}

function toAssignmentEvent(row: {
  id: string;
  userId: string;
  tradeClientId: string;
  accountId: string | null;
  challengeId: string | null;
  state: string;
  assignedAt: string | null;
  createdAt: string;
}): PropTradeAssignmentEvent | null {
  if (
    !isAssignedState(
      row.state as
        | "assigned_manual"
        | "assigned_verified_import"
        | "unassigned"
        | "excluded"
        | "invalid",
    )
  ) {
    return null;
  }
  return {
    id: row.id,
    userId: row.userId,
    tradeClientId: row.tradeClientId,
    accountId: row.accountId,
    challengeId: row.challengeId,
    source: row.state === "assigned_verified_import" ? "verified_import" : "manual",
    state: "assigned",
    effectiveAt: row.assignedAt || row.createdAt,
    actor: "system",
    clientRequestId: `hydrate:${row.id}`,
    reasonCode: null,
    supersededAssignmentId: null,
    assignmentRevision: 0,
    createdAt: row.createdAt,
  };
}

export function PropPassAssignmentFlow({
  userId,
  accountId,
  challengeId,
  challengeStatus,
  accountStatus = "active",
  challengeStartedAt,
  challengeEndedAt = null,
  trades,
  onClose,
  onCompleted,
  writeServiceOverride = null,
}: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme("dark");
  const [step, setStep] = useState<Step>("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterAssigned, setFilterAssigned] = useState<"all" | "unassigned" | "assigned">("unassigned");
  const [preview, setPreview] = useState<AssignmentImpactPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [currentByTradeId, setCurrentByTradeId] = useState<
    Record<string, PropTradeAssignmentEvent>
  >({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!supabase) return;
      try {
        const store = createAuthenticatedPropOsReadStore(
          createSupabasePropOsReadTransport(
            supabase as unknown as import("../propOs/accounts/authenticatedReadTransport").SupabasePropOsReadClient,
          ),
        );
        const list = await store.listAssignmentsForChallenge(challengeId);
        if (cancelled) return;
        const next: Record<string, PropTradeAssignmentEvent> = {};
        for (const row of list) {
          const ev = toAssignmentEvent(row);
          if (ev) next[ev.tradeClientId] = ev;
        }
        setCurrentByTradeId(next);
      } catch {
        // Keep empty map — new assigns still work once RPC is available.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [challengeId, userId]);

  const rows: AssignableTradeRow[] = useMemo(() => {
    return trades
      .map((tr) => {
        const fact = tradeToFact(userId, tr);
        const current = currentByTradeId[tr.id] ?? null;
        const verdict = evaluateAssignability({
          userId,
          trade: fact,
          current,
          challenge: {
            accountId,
            challengeId,
            accountStatus,
            challengeStatus,
            startedAt: challengeStartedAt,
            endedAt: challengeEndedAt,
          },
        });
        const row: AssignableTradeRow = {
          trade: fact,
          currentAssignment: current,
          assignable: verdict.ok,
          rejectReason: verdict.reason,
        };
        return row;
      })
      .filter((r) => {
        if (filterAssigned === "assigned") return !!r.currentAssignment;
        if (filterAssigned === "unassigned") return !r.currentAssignment;
        return true;
      });
  }, [
    trades,
    userId,
    accountId,
    challengeId,
    accountStatus,
    challengeStatus,
    challengeStartedAt,
    challengeEndedAt,
    filterAssigned,
    currentByTradeId,
  ]);

  const visibleIds = rows.map((r) => r.trade.identity.tradeClientId);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < ASSIGNMENT_BULK_MAX) next.add(id);
      return next;
    });
    trackPropPassEvent("prop_pass_assignment_trades_selected", {
      userId,
      kind: String(selected.size),
    });
  }

  function selectVisible() {
    setSelected(new Set(visibleIds.slice(0, ASSIGNMENT_BULK_MAX)));
  }

  function openPreview() {
    const p = buildAssignmentImpactPreview({
      rows,
      selectedIds: [...selected],
      accountId,
      challengeId,
    });
    setPreview(p);
    trackPropPassEvent("prop_pass_assignment_preview_shown", {
      userId,
      kind: String(p.selectedCount),
    });
    if (p.requiresReassignment.length) setStep("reassign_confirm");
    else setStep("preview");
  }

  async function getWriteService() {
    if (writeServiceOverride) return writeServiceOverride;
    const client = getPropPassRpcClientForTests();
    if (!client) return null;
    return createRpcAssignmentWriteService({ client, mutationsAllowed: true });
  }

  async function submitAssign(reassign: boolean) {
    setBusy(true);
    setMessage(null);
    trackPropPassEvent("prop_pass_assignment_submitted", { userId });
    try {
      const svc = await getWriteService();
      if (!svc) {
        setStep("failed");
        setMessage(t("propPass.assignment.rpcUnavailable"));
        return;
      }
      const result = reassign
        ? await svc.reassignTrades({
            clientRequestId: newPropOsClientRequestId(),
            accountId,
            challengeId,
            tradeClientIds: [...selected],
            confirmReassignment: true,
          })
        : await svc.assignTrades({
            clientRequestId: newPropOsClientRequestId(),
            accountId,
            challengeId,
            tradeClientIds: [...selected],
          });
      handleResult(result.kind, result.kind === "conflict" ? result.reasonCode : undefined);
    } finally {
      setBusy(false);
    }
  }

  async function submitRemove() {
    setBusy(true);
    setMessage(null);
    trackPropPassEvent("prop_pass_assignment_removed", { userId });
    try {
      const svc = await getWriteService();
      const ids = [...selected];
      if (!svc) {
        setStep("failed");
        setMessage(t("propPass.assignment.rpcUnavailable"));
        return;
      }
      const result = await svc.removeTradeAssignments({
        clientRequestId: newPropOsClientRequestId(),
        accountId,
        tradeClientIds: ids,
        reasonCode: "user_removed",
      });
      handleResult(result.kind, result.kind === "conflict" ? result.reasonCode : undefined);
    } finally {
      setBusy(false);
    }
  }

  function handleResult(kind: string, reason?: string) {
    if (kind === "success") {
      trackPropPassEvent("prop_pass_assignment_succeeded", { userId });
      trackPropPassEvent("prop_pass_recalculation_queued", { userId });
      setSelected(new Set());
      setStep("pending");
      setMessage(t("propPass.assignment.pendingBody"));
      return;
    }
    if (kind === "forbidden") {
      trackPropPassEvent("prop_pass_command_forbidden", { userId });
      setMessage(t("propPass.command.forbidden"));
      setStep("failed");
      return;
    }
    trackPropPassEvent("prop_pass_assignment_validation_failed", {
      userId,
      kind: reason ?? kind,
    });
    setMessage(t("propPass.assignment.failedBody", { reason: reason ?? kind }));
    setStep("failed");
  }

  return (
    <View style={styles.root} testID="prop-pass-assignment-flow">
      <View style={styles.header}>
        <YdlText role="title">{t("propPass.assignment.title")}</YdlText>
        <YdlButton label={t("propPass.assignment.close")} variant="tertiary" onPress={onClose} />
      </View>
      {message ? (
        <View accessibilityLiveRegion="assertive">
          <YdlText role="caption" color="text.secondary">
            {message}
          </YdlText>
        </View>
      ) : null}

      {step === "list" ? (
        <>
          <View style={styles.filters}>
            {(["unassigned", "assigned", "all"] as const).map((f) => (
              <YdlButton
                key={f}
                label={t(`propPass.assignment.filter.${f}`)}
                variant={filterAssigned === f ? "primary" : "secondary"}
                onPress={() => setFilterAssigned(f)}
              />
            ))}
          </View>
          <YdlText role="caption" color="text.secondary">
            {t("propPass.assignment.selectedCount", { count: selected.size, max: ASSIGNMENT_BULK_MAX })}
          </YdlText>
          <View style={styles.row}>
            <YdlButton
              label={t("propPass.assignment.selectVisible")}
              variant="secondary"
              onPress={selectVisible}
            />
            <YdlButton
              label={t("propPass.assignment.previewCta")}
              onPress={openPreview}
              disabled={selected.size === 0}
            />
            <YdlButton
              label={t("propPass.assignment.removeCta")}
              variant="destructive"
              onPress={() => {
                if (selected.size === 0) return;
                setStep("remove_confirm");
              }}
              disabled={selected.size === 0}
            />
          </View>
          <ScrollView style={styles.list} accessibilityRole="list">
            {rows.length === 0 ? (
              <YdlCard>
                <YdlText role="body">{t("propPass.assignment.empty")}</YdlText>
              </YdlCard>
            ) : (
              rows.map((r) => {
                const id = r.trade.identity.tradeClientId;
                const isSelected = selected.has(id);
                return (
                  <Pressable
                    key={id}
                    onPress={() => toggle(id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected, disabled: !r.assignable && r.rejectReason !== "already_assigned_other_challenge" }}
                    accessibilityLabel={t("propPass.assignment.rowA11y", {
                      symbol: r.trade.symbol,
                      pnl: r.trade.pnlMajor,
                      selected: isSelected ? "selected" : "not selected",
                    })}
                    style={[
                      styles.tradeRow,
                      {
                        borderColor: isSelected
                          ? theme.colors.status.positive
                          : theme.colors.border.subtle,
                        backgroundColor: theme.colors.surface.interactive,
                      },
                    ]}
                  >
                    <YdlText role="bodyEmphasized">
                      {isSelected ? "☑ " : "☐ "}
                      {r.trade.symbol} · {r.trade.pnlMajor}
                    </YdlText>
                    <YdlText role="caption" color="text.secondary">
                      {r.trade.occurredAtUtc ?? t("propPass.assignment.noTimestamp")}
                      {r.rejectReason
                        ? ` · ${t(`propPass.assignment.reject.${r.rejectReason}`)}`
                        : ""}
                    </YdlText>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </>
      ) : null}

      {step === "preview" && preview ? (
        <YdlCard>
          <YdlText role="bodyEmphasized">{t("propPass.assignment.previewTitle")}</YdlText>
          <YdlText role="body" color="text.secondary">
            {t("propPass.assignment.previewBody", {
              count: preview.selectedCount,
              pnl: preview.totalRealizedPnlMajor,
              from: preview.earliestOccurredAt ?? "—",
              to: preview.latestOccurredAt ?? "—",
            })}
          </YdlText>
          <YdlText role="caption" color="text.secondary">
            {t("propPass.assignment.engineDisclaimer")}
          </YdlText>
          <View style={styles.row}>
            <YdlButton label={t("propPass.assignment.back")} variant="secondary" onPress={() => setStep("list")} />
            <YdlButton
              label={t("propPass.assignment.confirm")}
              onPress={() => submitAssign(false)}
              disabled={busy}
            />
          </View>
        </YdlCard>
      ) : null}

      {step === "reassign_confirm" && preview ? (
        <YdlCard>
          <YdlText role="bodyEmphasized">{t("propPass.assignment.reassignTitle")}</YdlText>
          <YdlText role="body" color="text.secondary">
            {t("propPass.assignment.reassignBody", {
              count: preview.requiresReassignment.length,
              challenge: challengeId,
            })}
          </YdlText>
          <View style={styles.row}>
            <YdlButton label={t("propPass.assignment.back")} variant="secondary" onPress={() => setStep("list")} />
            <YdlButton
              label={t("propPass.assignment.reassignConfirm")}
              onPress={() => {
                trackPropPassEvent("prop_pass_reassignment_confirmed", { userId });
                submitAssign(true);
              }}
              disabled={busy}
            />
          </View>
        </YdlCard>
      ) : null}

      {step === "remove_confirm" ? (
        <YdlCard>
          <YdlText role="bodyEmphasized">{t("propPass.assignment.removeTitle")}</YdlText>
          <YdlText role="body" color="text.secondary">
            {t("propPass.assignment.removeBody", { count: selected.size })}
          </YdlText>
          <View style={styles.row}>
            <YdlButton label={t("propPass.assignment.back")} variant="secondary" onPress={() => setStep("list")} />
            <YdlButton
              label={t("propPass.assignment.removeConfirm")}
              variant="destructive"
              disabled={busy}
              onPress={() => {
                void submitRemove();
              }}
            />
          </View>
        </YdlCard>
      ) : null}

      {step === "pending" ? (
        <YdlCard>
          <View accessibilityLiveRegion="polite">
            <YdlText role="bodyEmphasized">
              {t("propPass.assignment.pendingTitle")}
            </YdlText>
          </View>
          <YdlText role="body" color="text.secondary">
            {t("propPass.assignment.pendingBody")}
          </YdlText>
          <YdlButton
            label={t("propPass.assignment.done")}
            onPress={() => {
              setStep("success");
              onCompleted();
            }}
          />
        </YdlCard>
      ) : null}

      {step === "failed" ? (
        <YdlCard>
          <YdlText role="bodyEmphasized">{t("propPass.assignment.failedTitle")}</YdlText>
          <YdlButton label={t("propPass.assignment.back")} onPress={() => setStep("list")} />
        </YdlCard>
      ) : null}

      {step === "success" ? (
        <YdlCard>
          <YdlText role="bodyEmphasized">{t("propPass.assignment.successTitle")}</YdlText>
          <YdlButton label={t("propPass.assignment.close")} onPress={onClose} />
        </YdlCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12, paddingBottom: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  list: { maxHeight: 360 },
  tradeRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
});

/** Exported for tests — builds memory read preview without UI. */
export function buildLocalAssignmentPreviewForTests(
  userId: string,
  accountId: string,
  challengeId: string,
  trades: Trade[],
  selectedIds: string[],
) {
  const store = createMemoryAssignmentStore();
  store.accounts.set(accountId, { userId, status: "active" });
  store.challenges.set(challengeId, {
    userId,
    accountId,
    status: "active",
    startedAt: "2020-01-01T00:00:00.000Z",
    endedAt: null,
  });
  for (const tr of trades) store.trades.push(tradeToFact(userId, tr));
  return createMemoryAssignmentReadStore(store).buildPreview({
    userId,
    accountId,
    challengeId,
    selectedIds,
  });
}
