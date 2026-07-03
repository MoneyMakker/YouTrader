import React, { useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { C } from "../../theme/colors";
import type { PropFirmPhase, PropFirmTemplate, PropRiskEngineResult, PropRiskWarning } from "../../propFirm/types";

function RiskBar({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: "green" | "purple" | "red" | "yellow";
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const color = tone === "green" ? C.green : tone === "red" ? C.red : tone === "yellow" ? C.yellow : C.purple;
  return (
    <View style={styles.barWrap}>
      <View style={styles.barHeader}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={[styles.barValue, { color }]}>{Math.round(pct)}%</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function ScoreRing({ label, value, display, color }: { label: string; value: number; display: string; color: string }) {
  const size = 96;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(100, value)) / 100) * circumference;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={[styles.ringDisplay, { color }]}>{display}</Text>
        <Text style={styles.ringLabel}>{label}</Text>
      </View>
    </View>
  );
}

function WarningCard({ warning }: { warning: PropRiskWarning }) {
  const color =
    warning.severity === "emergency" ? C.red : warning.severity === "high" ? C.yellow : warning.severity === "medium" ? C.purple : C.sub;
  return (
    <View style={[styles.warningCard, { borderColor: `${color}44` }]}>
      <Text style={[styles.warningTitle, { color }]}>{warning.title}</Text>
      <Text style={styles.warningBody}>{warning.body}</Text>
    </View>
  );
}

function TrendMiniChart({ values }: { values: number[] }) {
  const width = 260;
  const height = 56;
  const data = values.length ? values : [0, 0];
  const min = Math.min(0, ...data);
  const max = Math.max(0, ...data);
  const range = Math.max(1, max - min);
  const coords = data.map((value, index) => ({
    x: data.length === 1 ? width / 2 : (index / (data.length - 1)) * width,
    y: height - ((value - min) / range) * height,
  }));
  const path = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const positive = (data[data.length - 1] || 0) >= (data[0] || 0);
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <Line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <Path d={path} stroke={positive ? C.green : C.red} strokeWidth="3" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function Section({
  title,
  subtitle,
  children,
  locked,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  locked?: boolean;
}) {
  return (
    <View style={[styles.section, locked && styles.sectionLocked]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      {locked ? <Text style={styles.lockedHint}>Upgrade to YouTrader Pro for full Prop Firm Risk Assistant.</Text> : children}
    </View>
  );
}

export function PropFirmRiskDashboard({
  result,
  templates,
  templateKey,
  phase,
  isPremium,
  onTemplateChange,
  onPhaseChange,
}: {
  result: PropRiskEngineResult;
  templates: PropFirmTemplate[];
  templateKey: string;
  phase: PropFirmPhase;
  isPremium: boolean;
  onTemplateChange: (key: string) => void;
  onPhaseChange: (phase: PropFirmPhase) => void;
}) {
  const [showOverridesHint, setShowOverridesHint] = useState(false);
  const forecastTrend = useMemo(
    () => [result.riskForecast.survivalProbability - 12, result.riskForecast.survivalProbability - 4, result.riskForecast.survivalProbability],
    [result.riskForecast.survivalProbability],
  );

  const phases: PropFirmPhase[] = result.template.supportedPhases.length
    ? result.template.supportedPhases
    : ["evaluation", "funded"];

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>Prop Firm Risk Assistant</Text>
          <Text style={styles.heroSub}>
            {result.template.company} • {result.template.accountName}
            {!isPremium ? " • Preview" : ""}
          </Text>
        </View>
        <ScoreRing
          label="HEALTH"
          value={result.accountHealthScore}
          display={`${result.accountHealthScore}`}
          color={result.statusColor}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
        {templates.map((template) => {
          const active = template.key === templateKey;
          return (
            <Pressable
              key={template.key}
              onPress={() => onTemplateChange(template.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && { color: C.green }]}>{template.company}</Text>
              <Text style={styles.chipSub}>{Math.round(template.accountSize / 1000)}K</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.phaseRow}>
        {phases.map((item) => {
          const active = item === phase;
          return (
            <Pressable key={item} onPress={() => onPhaseChange(item)} style={[styles.phaseChip, active && styles.phaseChipActive]}>
              <Text style={[styles.phaseText, active && { color: C.bg }]}>
                {item === "evaluation" ? "Eval" : item === "challenge" ? "Challenge" : item === "funded" ? "Funded" : "Live"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Section title="Account Health Score" subtitle={`Grade ${result.accountHealthGrade} • ${result.primaryAction}`}>
        <View style={styles.metricGrid}>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Status</Text>
            <Text style={[styles.metricValue, { color: result.statusColor }]}>{result.status}</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Survival</Text>
            <Text style={styles.metricValue}>{result.riskForecast.survivalProbability}%</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Trend</Text>
            <Text style={[styles.metricValue, { color: result.riskForecast.trend === "declining" ? C.red : result.riskForecast.trend === "improving" ? C.green : C.sub }]}>
              {result.riskForecast.trend.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.coachLine}>{result.coachMessage}</Text>
      </Section>

      <Section title="Today's Risk" subtitle={`Day P&L ${result.todayRisk.dayPnl >= 0 ? "+" : ""}$${Math.abs(result.todayRisk.dayPnl).toFixed(0)}`}>
        <RiskBar
          label="Daily loss buffer remaining"
          value={result.todayRisk.remainingDailyLoss}
          max={result.todayRisk.dailyLimit}
          tone={result.todayRisk.level === "STOP" ? "red" : result.todayRisk.level === "HIGH" ? "yellow" : "green"}
        />
        <Text style={styles.smallMeta}>
          {result.todayRisk.pctUsed}% of today's limit used • Level {result.todayRisk.level}
        </Text>
      </Section>

      <Section
        title="Remaining Drawdown"
        subtitle={result.remainingDrawdown.drawdownType === "trailing" ? "Trailing drawdown" : "Static drawdown"}
        locked={!isPremium}
      >
        {!isPremium ? null : (
          <>
            <RiskBar
              label="Account buffer remaining"
              value={result.remainingDrawdown.amount}
              max={result.remainingDrawdown.limit}
              tone={result.remainingDrawdown.pctRemaining < 35 ? "red" : result.remainingDrawdown.pctRemaining < 55 ? "yellow" : "purple"}
            />
            {result.remainingDrawdown.tightening ? (
              <WarningCard
                warning={{
                  id: "trail",
                  severity: "high",
                  title: "Trailing drawdown is tightening",
                  body: "Losses reduce remaining room immediately on trailing accounts.",
                  category: "drawdown",
                }}
              />
            ) : null}
          </>
        )}
      </Section>

      <Section title="Challenge Progress" locked={!isPremium}>
        {!isPremium ? null : (
          <>
            <RiskBar label="Profit target progress" value={result.challengeProgress.current} max={result.challengeProgress.target} tone="green" />
            <View style={styles.metricGrid}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Remaining</Text>
                <Text style={styles.metricValue}>${Math.round(result.challengeProgress.remaining)}</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Trading days</Text>
                <Text style={styles.metricValue}>
                  {result.challengeProgress.tradingDays}/{result.challengeProgress.minTradingDays || "—"}
                </Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Min days</Text>
                <Text style={[styles.metricValue, { color: result.challengeProgress.minDaysMet ? C.green : C.yellow }]}>
                  {result.challengeProgress.minDaysMet ? "MET" : "NEED"}
                </Text>
              </View>
            </View>
          </>
        )}
      </Section>

      <Section title="Payout Readiness" locked={!isPremium}>
        {!isPremium ? null : (
          <>
            <RiskBar label="Payout readiness" value={result.payoutReadiness.pct} max={100} tone={result.payoutReadiness.ready ? "green" : "purple"} />
            <Text style={styles.coachLine}>{result.payoutReadiness.message}</Text>
          </>
        )}
      </Section>

      <Section title="Rule Warnings" locked={!isPremium}>
        {!isPremium ? null : (
          <View style={{ gap: 10 }}>
            {result.ruleWarnings.length ? result.ruleWarnings.map((warning) => <WarningCard key={warning.id} warning={warning} />) : (
              <Text style={styles.sectionSub}>No active rule warnings. Keep discipline steady.</Text>
            )}
          </View>
        )}
      </Section>

      <Section title="Contract Recommendation" locked={!isPremium}>
        {!isPremium ? null : (
          <View style={styles.metricGrid}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Current avg</Text>
              <Text style={styles.metricValue}>{result.contractRecommendation.currentAvg}</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Recommended</Text>
              <Text style={[styles.metricValue, { color: C.green }]}>{result.contractRecommendation.recommended}</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Firm max</Text>
              <Text style={styles.metricValue}>{result.contractRecommendation.maxAllowed}</Text>
            </View>
          </View>
        )}
        {!isPremium ? null : <Text style={styles.coachLine}>{result.contractRecommendation.reason}</Text>}
      </Section>

      <Section title="Risk Forecast" locked={!isPremium}>
        {!isPremium ? null : (
          <>
            <TrendMiniChart values={forecastTrend} />
            <Text style={styles.coachLine}>
              Top risk: {result.riskForecast.topRisk}
              {result.riskForecast.daysToPass ? ` • Est. pass window ${result.riskForecast.daysToPass} days` : ""}
            </Text>
          </>
        )}
      </Section>

      {isPremium && result.emergencyAlerts.length ? (
        <Section title="Emergency Alerts">
          {result.emergencyAlerts.map((warning) => (
            <WarningCard key={warning.id} warning={warning} />
          ))}
        </Section>
      ) : null}

      <Pressable onPress={() => setShowOverridesHint((v) => !v)} style={styles.metaBtn}>
        <Text style={styles.metaBtnText}>{showOverridesHint ? "Hide firm metadata" : "Firm rule source"}</Text>
      </Pressable>
      {showOverridesHint ? (
        <View style={styles.metaBox}>
          <Text style={styles.sectionSub}>
            Last verified: {result.template.lastVerified || "Pending"} • Drawdown: {result.remainingDrawdown.drawdownType}
          </Text>
          {result.template.sourceUrl ? (
            <Pressable onPress={() => Linking.openURL(result.template.sourceUrl!)}>
              <Text style={[styles.metaLink, { color: C.purple }]}>{result.template.sourceUrl}</Text>
            </Pressable>
          ) : (
            <Text style={styles.sectionSub}>Custom firm — user overrides apply in Settings.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroTitle: { color: C.text, fontSize: 24, fontWeight: "800" },
  heroSub: { color: C.sub, marginTop: 4, fontSize: 13 },
  chipRail: { gap: 8, paddingVertical: 4 },
  chip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.035)",
    minWidth: 92,
  },
  chipActive: { borderColor: "rgba(163,255,18,0.35)", backgroundColor: "rgba(163,255,18,0.06)" },
  chipText: { color: C.text, fontWeight: "700", fontSize: 13 },
  chipSub: { color: C.sub, fontSize: 11, marginTop: 2 },
  phaseRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  phaseChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  phaseChipActive: { backgroundColor: C.green, borderColor: C.green },
  phaseText: { color: C.sub, fontWeight: "700", fontSize: 12 },
  section: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 14,
    gap: 10,
  },
  sectionLocked: { opacity: 0.72 },
  sectionTitle: { color: C.text, fontSize: 16, fontWeight: "800" },
  sectionSub: { color: C.sub, fontSize: 12, lineHeight: 18 },
  lockedHint: { color: C.purple, fontSize: 12, lineHeight: 18 },
  barWrap: { gap: 6 },
  barHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  barLabel: { color: C.sub, fontSize: 12 },
  barValue: { fontSize: 12, fontWeight: "700" },
  barTrack: { height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  barFill: { height: 8, borderRadius: 999 },
  smallMeta: { color: C.muted, fontSize: 11 },
  metricGrid: { flexDirection: "row", gap: 8 },
  metricBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.025)",
  },
  metricLabel: { color: C.sub, fontSize: 10, textTransform: "uppercase" },
  metricValue: { color: C.text, fontSize: 16, fontWeight: "800", marginTop: 4 },
  coachLine: { color: C.text, fontSize: 13, lineHeight: 20 },
  warningCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    gap: 4,
  },
  warningTitle: { fontSize: 13, fontWeight: "800" },
  warningBody: { color: C.sub, fontSize: 12, lineHeight: 18 },
  ringCenter: { position: "absolute", alignItems: "center" },
  ringDisplay: { fontSize: 22, fontWeight: "900" },
  ringLabel: { color: C.sub, fontSize: 10, marginTop: 2 },
  metaBtn: { alignSelf: "flex-start", paddingVertical: 8 },
  metaBtnText: { color: C.purple, fontSize: 12, fontWeight: "700" },
  metaBox: { gap: 6, paddingBottom: 8 },
  metaLink: { fontSize: 12 },
});
