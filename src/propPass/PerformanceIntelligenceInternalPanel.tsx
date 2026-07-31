/**
 * Internal-only Performance Intelligence panel (Phase 3A).
 * Consumes readStore contracts only — no direct metric formulas or DB.
 * Staging demo: runTrustedMemoryCalculation after requestCalculation;
 * production uses the trusted processor pipeline.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { YdlButton } from "../ydl/components/YdlButton";
import { YdlCard } from "../ydl/components/YdlCard";
import { YdlText } from "../ydl/components/YdlText";
import { useYdlTheme } from "../ydl/tokens";
import {
  METRIC_CATALOGUE,
  PI_MIN_SEGMENT_SAMPLE,
  createMemoryIntelligenceReadStore,
  runTrustedMemoryCalculation,
  type DeterministicFinding,
  type IntelligenceCalcState,
  type IntelligenceScope,
  type MemoryIntelligenceStore,
  type PerformanceIntelligenceSnapshot,
  type RatioOrUndefined,
  type SegmentMetric,
} from "../propOs/intelligence";
import { trackPropPassEvent } from "./analytics";

type Props = {
  userId: string;
  accountId: string;
  challengeId?: string | null;
  store: MemoryIntelligenceStore;
  assignmentRevision: number;
  onClose: () => void;
};

type ScopeChip = {
  id: string;
  scope: IntelligenceScope;
  labelKey: string;
  scopeKind: string;
};

type DrilldownTarget = {
  metricKey: string;
  label: string;
  snapshot: PerformanceIntelligenceSnapshot;
};

function formatRatio(
  ratio: RatioOrUndefined | undefined,
  t: (key: string) => string,
  asPercent = false,
): string {
  if (!ratio) return t("propPass.intelligence.valueUnavailable");
  switch (ratio.kind) {
    case "value": {
      const raw = ratio.valueScaled / 1_000_000;
      const v = asPercent ? raw * 100 : raw;
      return asPercent
        ? `${v.toFixed(1)}${t("propPass.intelligence.unit.percent")}`
        : `${v.toFixed(2)}${t("propPass.intelligence.unit.ratio")}`;
    }
    case "undefined_zero_loss":
    case "undefined_zero_profit":
    case "undefined_zero_denominator":
    case "unavailable":
      return t("propPass.intelligence.valueUnavailable");
    default:
      return t("propPass.intelligence.valueUnavailable");
  }
}

function formatMinor(minor: number | null | undefined, t: (key: string) => string): string {
  if (minor == null) return t("propPass.intelligence.valueUnavailable");
  return `${minor}${t("propPass.intelligence.unit.minor")}`;
}

function formatMinorRatio(
  ratio: RatioOrUndefined | undefined,
  t: (key: string) => string,
): string {
  if (!ratio) return t("propPass.intelligence.valueUnavailable");
  if (ratio.kind === "value") {
    return formatMinor(Math.round(ratio.valueScaled / 1_000_000), t);
  }
  return t("propPass.intelligence.valueUnavailable");
}

function ratioA11y(
  ratio: RatioOrUndefined | undefined,
  label: string,
  t: (key: string) => string,
  asPercent = false,
): string {
  const value = formatRatio(ratio, t, asPercent);
  return `${label}: ${value}`;
}

function buildScopeChips(
  accountId: string,
  challengeId: string | null | undefined,
): ScopeChip[] {
  const chips: ScopeChip[] = [
    {
      id: "account",
      scope: { kind: "account", accountId, includeArchivedChallenges: false },
      labelKey: "propPass.intelligence.scope.account",
      scopeKind: "account",
    },
  ];
  if (challengeId) {
    chips.push({
      id: "challenge",
      scope: { kind: "challenge", challengeId, accountId },
      labelKey: "propPass.intelligence.scope.challenge",
      scopeKind: "challenge",
    });
  }
  for (const count of [20, 50] as const) {
    chips.push({
      id: `recent_${count}`,
      scope: { kind: "recent_trades", accountId, count },
      labelKey:
        count === 20
          ? "propPass.intelligence.scope.recent20"
          : "propPass.intelligence.scope.recent50",
      scopeKind: `recent_${count}`,
    });
  }
  return chips;
}

function resolveDisplayState(
  calc: IntelligenceCalcState,
  snapshot: PerformanceIntelligenceSnapshot | null,
): string {
  if (calc.kind === "queued" || calc.kind === "running") {
    return "calculating";
  }
  if (calc.kind === "failed") return "failed";
  if (!snapshot) return "none";
  switch (snapshot.status) {
    case "current":
      return "current";
    case "outdated":
      return "outdated";
    case "insufficient_data":
      return "insufficient";
    case "incomplete_data":
      return "incomplete";
    case "unsupported":
      return "unsupported";
    case "integrity_error":
      return "failed";
    default:
      return "none";
  }
}

function stateLabelKey(displayState: string): string {
  const map: Record<string, string> = {
    none: "propPass.intelligence.state.none",
    calculating: "propPass.intelligence.state.calculating",
    current: "propPass.intelligence.state.current",
    outdated: "propPass.intelligence.state.outdated",
    insufficient: "propPass.intelligence.state.insufficient",
    incomplete: "propPass.intelligence.state.incomplete",
    unsupported: "propPass.intelligence.state.unsupported",
    failed: "propPass.intelligence.state.failed",
  };
  return map[displayState] ?? "propPass.intelligence.state.none";
}

function segmentTypeLabel(type: string): string {
  const map: Record<string, string> = {
    instrument: "propPass.intelligence.segment.instrument",
    direction: "propPass.intelligence.segment.direction",
    weekday_utc: "propPass.intelligence.segment.weekdayUtc",
    session_utc: "propPass.intelligence.segment.sessionUtc",
  };
  return map[type] ?? "propPass.intelligence.segment.other";
}

function metricFormulaDescription(metricKey: string): string | null {
  if (!(metricKey in METRIC_CATALOGUE.formulas)) return null;
  const entry =
    METRIC_CATALOGUE.formulas[metricKey as keyof typeof METRIC_CATALOGUE.formulas];
  return entry.formula;
}

const SEGMENT_TYPES = ["instrument", "direction", "weekday_utc", "session_utc"];

export function PerformanceIntelligenceInternalPanel({
  userId,
  accountId,
  challengeId,
  store,
  assignmentRevision,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme();
  const readStore = useMemo(() => createMemoryIntelligenceReadStore(store), [store]);
  const scopeChips = useMemo(
    () => buildScopeChips(accountId, challengeId),
    [accountId, challengeId],
  );
  const [selectedChipId, setSelectedChipId] = useState(scopeChips[0]?.id ?? "account");
  const [snapshot, setSnapshot] = useState<PerformanceIntelligenceSnapshot | null>(null);
  const [calcState, setCalcState] = useState<IntelligenceCalcState>({ kind: "not_required" });
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<DrilldownTarget | null>(null);

  const selectedChip = scopeChips.find((c) => c.id === selectedChipId) ?? scopeChips[0]!;
  const displayState = resolveDisplayState(calcState, snapshot);

  const refresh = useCallback(async () => {
    const scope = selectedChip.scope;
    const [snap, calc] = await Promise.all([
      readStore.getCurrentSnapshot(scope),
      readStore.getCalculationState(scope),
    ]);
    setSnapshot(snap);
    setCalcState(calc);
    if (snap?.status === "outdated") {
      trackPropPassEvent("prop_pass_intelligence_snapshot_outdated", {
        userId,
        scopeKind: selectedChip.scopeKind,
      });
    }
    if (snap?.status === "insufficient_data") {
      trackPropPassEvent("prop_pass_intelligence_insufficient_data", {
        userId,
        scopeKind: selectedChip.scopeKind,
      });
    }
  }, [readStore, selectedChip.scope, selectedChip.scopeKind, userId]);

  useEffect(() => {
    trackPropPassEvent("prop_pass_intelligence_opened", { userId, scopeKind: selectedChip.scopeKind });
  }, [userId, selectedChip.scopeKind]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleScopeSelect = (chip: ScopeChip) => {
    setSelectedChipId(chip.id);
    trackPropPassEvent("prop_pass_intelligence_scope_selected", {
      userId,
      scopeKind: chip.scopeKind,
    });
  };

  const handleRequestCalculation = async (recalculate: boolean) => {
    setBusy(true);
    setErrorMessage(null);
    const started = Date.now();
    const scope = selectedChip.scope;
    try {
      trackPropPassEvent("prop_pass_intelligence_calc_requested", {
        userId,
        scopeKind: selectedChip.scopeKind,
      });
      const queued = await readStore.requestCalculation(scope, assignmentRevision);
      if (queued.kind === "queued") {
        trackPropPassEvent("prop_pass_intelligence_calc_queued", {
          userId,
          scopeKind: selectedChip.scopeKind,
        });
      }
      if (queued.kind === "running") {
        trackPropPassEvent("prop_pass_intelligence_calc_started", {
          userId,
          scopeKind: selectedChip.scopeKind,
        });
      }
      if (queued.kind !== "completed" || recalculate) {
        trackPropPassEvent("prop_pass_intelligence_calc_started", {
          userId,
          scopeKind: selectedChip.scopeKind,
        });
        const result = runTrustedMemoryCalculation(store, scope, assignmentRevision);
        if (result.kind === "success") {
          trackPropPassEvent("prop_pass_intelligence_calc_completed", {
            userId,
            scopeKind: selectedChip.scopeKind,
            durationMs: Date.now() - started,
          });
          trackPropPassEvent("prop_pass_intelligence_calc_latency", {
            userId,
            scopeKind: selectedChip.scopeKind,
            durationMs: Date.now() - started,
          });
        } else if (result.kind === "conflict") {
          trackPropPassEvent("prop_pass_intelligence_calc_conflict", {
            userId,
            scopeKind: selectedChip.scopeKind,
            reasonCode: result.reasonCode,
          });
          setErrorMessage(result.reasonCode);
        } else {
          trackPropPassEvent("prop_pass_intelligence_calc_failed", {
            userId,
            scopeKind: selectedChip.scopeKind,
            reasonCode: result.reasonCode,
          });
          setErrorMessage(result.reasonCode);
        }
      }
      await refresh();
    } catch {
      trackPropPassEvent("prop_pass_intelligence_calc_failed", {
        userId,
        scopeKind: selectedChip.scopeKind,
        reasonCode: "unexpected",
      });
      setErrorMessage("unexpected");
    } finally {
      setBusy(false);
    }
  };

  const filteredSegments = (snapshot?.segments ?? []).filter((s) =>
    SEGMENT_TYPES.includes(s.segmentType),
  );

  return (
    <View
      style={styles.root}
      testID="performance-intelligence-internal-panel"
      accessibilityLabel={t("propPass.intelligence.title")}
    >
      <View style={styles.header}>
        <YdlText role="title">{t("propPass.intelligence.title")}</YdlText>
        <YdlButton
          label={t("propPass.intelligence.close")}
          variant="tertiary"
          onPress={onClose}
        />
      </View>

      <YdlText role="caption" color="text.secondary">
        {t("propPass.intelligence.banner")}
      </YdlText>

      <View accessibilityLiveRegion="polite" accessibilityRole="text">
        <YdlText role="caption" color="text.secondary">
          {t(stateLabelKey(displayState))}
        </YdlText>
        {errorMessage ? (
          <YdlText role="caption" color="text.secondary">
            {errorMessage}
          </YdlText>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {scopeChips.map((chip) => (
          <YdlButton
            key={chip.id}
            label={t(chip.labelKey)}
            variant={chip.id === selectedChipId ? "primary" : "secondary"}
            size="small"
            onPress={() => handleScopeSelect(chip)}
            style={styles.chip}
          />
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.body} accessibilityRole="scrollbar">
        <YdlCard>
          <YdlText role="label">{t("propPass.intelligence.overview.title")}</YdlText>
          <YdlText role="caption" color="text.tertiary">
            {t("propPass.intelligence.overview.historicalPrefix")}
          </YdlText>
          {snapshot ? (
            <OverviewSection snapshot={snapshot} t={t} onDrilldown={setDrilldown} />
          ) : (
            <YdlText role="body" color="text.secondary">
              {t("propPass.intelligence.state.none")}
            </YdlText>
          )}
        </YdlCard>

        {snapshot ? (
          <YdlCard>
            <YdlText role="label">{t("propPass.intelligence.consistency.title")}</YdlText>
            <ConsistencySection snapshot={snapshot} t={t} onDrilldown={setDrilldown} />
          </YdlCard>
        ) : null}

        <YdlCard>
          <YdlText role="label">{t("propPass.intelligence.segments.title")}</YdlText>
          {filteredSegments.length === 0 ? (
            <YdlText role="body" color="text.secondary">
              {t("propPass.intelligence.state.none")}
            </YdlText>
          ) : (
            filteredSegments.map((seg) => (
              <SegmentRow key={`${seg.segmentType}:${seg.segmentKey}`} segment={seg} t={t} />
            ))
          )}
        </YdlCard>

        <YdlCard>
          <YdlText role="label">{t("propPass.intelligence.findings.title")}</YdlText>
          {snapshot && snapshot.findings.length > 0 ? (
            snapshot.findings.map((f) => (
              <FindingCard
                key={f.id}
                finding={f}
                t={t}
                onOpen={() => {
                  trackPropPassEvent("prop_pass_intelligence_finding_opened", {
                    userId,
                    scopeKind: selectedChip.scopeKind,
                    kind: f.metricKey,
                  });
                }}
              />
            ))
          ) : (
            <YdlText role="body" color="text.secondary">
              {t("propPass.intelligence.findings.empty")}
            </YdlText>
          )}
        </YdlCard>

        <YdlButton
          label={t("propPass.intelligence.requestCalc")}
          onPress={() => void handleRequestCalculation(false)}
          loading={busy}
          disabled={busy}
        />
        {snapshot ? (
          <YdlButton
            label={t("propPass.intelligence.recalculate")}
            variant="secondary"
            onPress={() => void handleRequestCalculation(true)}
            loading={busy}
            disabled={busy}
          />
        ) : null}
      </ScrollView>

      <MetricDrilldownModal
        target={drilldown}
        t={t}
        themeBackground={theme.colors.background.primary}
        onClose={() => {
          const metricKey = drilldown?.metricKey;
          setDrilldown(null);
          trackPropPassEvent("prop_pass_intelligence_metric_drilldown", {
            userId,
            kind: metricKey,
            scopeKind: selectedChip.scopeKind,
          });
        }}
      />
    </View>
  );
}

function OverviewSection({
  snapshot,
  t,
  onDrilldown,
}: {
  snapshot: PerformanceIntelligenceSnapshot;
  t: (key: string, opts?: Record<string, unknown>) => string;
  onDrilldown: (target: DrilldownTarget) => void;
}) {
  const perf = snapshot.performance;
  const rows: { key: string; labelKey: string; value: string; a11y: string; metricKey?: string }[] = [
    {
      key: "trades",
      labelKey: "propPass.intelligence.overview.totalTrades",
      value: String(perf.totalClosedTrades),
      a11y: `${t("propPass.intelligence.overview.totalTrades")}: ${perf.totalClosedTrades}`,
    },
    {
      key: "pnl",
      labelKey: "propPass.intelligence.overview.netPnl",
      value: formatMinor(perf.netRealizedPnlMinor, t),
      a11y: `${t("propPass.intelligence.overview.netPnl")}: ${formatMinor(perf.netRealizedPnlMinor, t)}`,
    },
    {
      key: "winRate",
      labelKey: "propPass.intelligence.overview.winRate",
      value: formatRatio(perf.winRate, t, true),
      a11y: ratioA11y(perf.winRate, t("propPass.intelligence.overview.winRate"), t, true),
      metricKey: "winRate",
    },
    {
      key: "pf",
      labelKey: "propPass.intelligence.overview.profitFactor",
      value: formatRatio(perf.profitFactor, t),
      a11y: ratioA11y(perf.profitFactor, t("propPass.intelligence.overview.profitFactor"), t),
      metricKey: "profitFactor",
    },
    {
      key: "exp",
      labelKey: "propPass.intelligence.overview.expectancy",
      value: formatMinorRatio(perf.expectancyPerTradeMinor, t),
      a11y: `${t("propPass.intelligence.overview.expectancy")}: ${formatMinorRatio(perf.expectancyPerTradeMinor, t)}`,
      metricKey: "expectancyPerTrade",
    },
    {
      key: "avgWin",
      labelKey: "propPass.intelligence.overview.avgWin",
      value: formatMinorRatio(perf.averageWinMinor, t),
      a11y: `${t("propPass.intelligence.overview.avgWin")}: ${formatMinorRatio(perf.averageWinMinor, t)}`,
    },
    {
      key: "avgLoss",
      labelKey: "propPass.intelligence.overview.avgLoss",
      value: formatMinorRatio(perf.averageLossMinor, t),
      a11y: `${t("propPass.intelligence.overview.avgLoss")}: ${formatMinorRatio(perf.averageLossMinor, t)}`,
    },
  ];

  return (
    <View style={styles.metricGrid}>
      {rows.map((row) => (
        <Pressable
          key={row.key}
          onPress={
            row.metricKey
              ? () =>
                  onDrilldown({
                    metricKey: row.metricKey!,
                    label: t(row.labelKey),
                    snapshot,
                  })
              : undefined
          }
          accessibilityRole={row.metricKey ? "button" : "text"}
          accessibilityLabel={row.a11y}
        >
          <YdlText role="caption" color="text.secondary">
            {t(row.labelKey)}
          </YdlText>
          <YdlText role="bodyEmphasized">{row.value}</YdlText>
        </Pressable>
      ))}
    </View>
  );
}

function ConsistencySection({
  snapshot,
  t,
  onDrilldown,
}: {
  snapshot: PerformanceIntelligenceSnapshot;
  t: (key: string, opts?: Record<string, unknown>) => string;
  onDrilldown: (target: DrilldownTarget) => void;
}) {
  const risk = snapshot.risk;
  const seq = snapshot.sequences;
  return (
    <View style={styles.metricGrid}>
      <MetricRow
        label={t("propPass.intelligence.consistency.sizeDispersion")}
        value={formatRatio(risk.positionSizeDispersion, t)}
        a11y={ratioA11y(
          risk.positionSizeDispersion,
          t("propPass.intelligence.consistency.sizeDispersion"),
          t,
        )}
        onPress={() =>
          onDrilldown({
            metricKey: "positionSizeDispersion",
            label: t("propPass.intelligence.consistency.sizeDispersion"),
            snapshot,
          })
        }
      />
      <MetricRow
        label={t("propPass.intelligence.consistency.risk")}
        value={formatRatio(risk.riskDispersion, t)}
        a11y={ratioA11y(risk.riskDispersion, t("propPass.intelligence.consistency.risk"), t)}
        onPress={() =>
          onDrilldown({
            metricKey: "riskDispersion",
            label: t("propPass.intelligence.consistency.risk"),
            snapshot,
          })
        }
      />
      <MetricRow
        label={t("propPass.intelligence.consistency.concentration")}
        value={formatRatio(risk.topInstrumentConcentration, t, true)}
        a11y={ratioA11y(
          risk.topInstrumentConcentration,
          t("propPass.intelligence.consistency.concentration"),
          t,
          true,
        )}
        onPress={() =>
          onDrilldown({
            metricKey: "topInstrumentConcentration",
            label: t("propPass.intelligence.consistency.concentration"),
            snapshot,
          })
        }
      />
      <MetricRow
        label={t("propPass.intelligence.consistency.sequences")}
        value={`${seq.maximumWinSequence} / ${seq.maximumLossSequence}`}
        a11y={`${t("propPass.intelligence.consistency.sequences")}: ${seq.maximumWinSequence}, ${seq.maximumLossSequence}`}
      />
    </View>
  );
}

function MetricRow({
  label,
  value,
  a11y,
  onPress,
}: {
  label: string;
  value: string;
  a11y: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={a11y}
    >
      <YdlText role="caption" color="text.secondary">
        {label}
      </YdlText>
      <YdlText role="body">{value}</YdlText>
    </Pressable>
  );
}

function SegmentRow({
  segment,
  t,
}: {
  segment: SegmentMetric;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const insufficient = segment.sampleSize < PI_MIN_SEGMENT_SAMPLE;
  return (
    <View style={styles.segmentRow}>
      <YdlText role="caption" color="text.secondary">
        {t(segmentTypeLabel(segment.segmentType))} · {segment.segmentKey}
      </YdlText>
      <YdlText role="body">
        {t("propPass.intelligence.sampleSize", { count: segment.sampleSize })}
        {insufficient ? ` · ${t("propPass.intelligence.segments.insufficient")}` : ""}
      </YdlText>
      {!insufficient ? (
        <YdlText role="caption" color="text.tertiary">
          {formatMinor(segment.metrics.netPnlMinor, t)} ·{" "}
          {formatRatio(segment.metrics.winRate, t, true)}
        </YdlText>
      ) : null}
    </View>
  );
}

function FindingCard({
  finding,
  t,
  onOpen,
}: {
  finding: DeterministicFinding;
  t: (key: string, opts?: Record<string, unknown>) => string;
  onOpen: () => void;
}) {
  const evidenceParts: string[] = [];
  if (finding.evidence.baselineValue != null) {
    evidenceParts.push(String(finding.evidence.baselineValue));
  }
  if (finding.evidence.segmentValue != null) {
    evidenceParts.push(String(finding.evidence.segmentValue));
  }
  if (finding.evidence.difference != null) {
    evidenceParts.push(String(finding.evidence.difference));
  }

  return (
    <Pressable
      onPress={onOpen}
      style={styles.findingCard}
      accessibilityRole="button"
      accessibilityLabel={`${finding.category} ${finding.metricKey}`}
    >
      <YdlText role="bodyEmphasized">{finding.metricKey}</YdlText>
      <YdlText role="caption" color="text.secondary">
        {t("propPass.intelligence.findings.historicalPrefix", {
          detail: finding.reasonCode,
        })}
      </YdlText>
      <YdlText role="caption" color="text.tertiary">
        {t("propPass.intelligence.sampleSize", { count: finding.sampleSize })}
        {evidenceParts.length ? ` · ${evidenceParts.join(" / ")}` : ""}
      </YdlText>
    </Pressable>
  );
}

function MetricDrilldownModal({
  target,
  t,
  themeBackground,
  onClose,
}: {
  target: DrilldownTarget | null;
  t: (key: string, opts?: Record<string, unknown>) => string;
  themeBackground: string;
  onClose: () => void;
}) {
  if (!target) return null;
  const summary = target.snapshot.datasetSummary;
  const formula = metricFormulaDescription(target.metricKey);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { backgroundColor: themeBackground }]}>
          <YdlText role="title">{t("propPass.intelligence.drilldown.title")}</YdlText>
          <YdlText role="bodyEmphasized">{target.label}</YdlText>
          <YdlText role="caption" color="text.secondary">
            {t("propPass.intelligence.sampleSize", {
              count: summary.tradeCount,
            })}
          </YdlText>
          <YdlText role="caption" color="text.secondary">
            {t("propPass.intelligence.drilldown.exclusions", {
              excluded: summary.excludedCount,
              reasons: Object.entries(summary.exclusionReasons)
                .map(([k, v]) => `${k}:${v}`)
                .join(", ") || "—",
            })}
          </YdlText>
          {formula ? (
            <YdlText role="body" color="text.secondary">
              {t("propPass.intelligence.drilldown.formula", { formula })}
            </YdlText>
          ) : (
            <YdlText role="body" color="text.secondary">
              {t("propPass.intelligence.valueUnavailable")}
            </YdlText>
          )}
          <YdlButton label={t("propPass.intelligence.drilldown.close")} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 8 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chipRow: { flexGrow: 0 },
  chip: { marginRight: 8 },
  body: { gap: 12, paddingBottom: 24 },
  metricGrid: { gap: 10, marginTop: 8 },
  segmentRow: { marginTop: 8, gap: 2 },
  findingCard: {
    marginTop: 8,
    paddingVertical: 6,
    gap: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: 10,
  },
});
