import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { EmptyStateCard, StatusSpinner } from "../ui/premium";
import {
  applyUserOverrides,
  buildPropRiskEngine,
  loadLocalPropSettings,
  mapLegacyFirmMode,
  mapPhaseToLegacyMode,
  persistPropPhase,
  persistPropTemplateSlug,
  resolvePropTemplateKey,
  type PropFirmPhase,
  type PropFirmTemplate,
} from "../../propFirm";
import { PropFirmRiskDashboard } from "./PropFirmRiskDashboard";

type TradeLike = {
  id: string;
  date: string;
  pnl: number;
  contracts?: number;
  symbol?: string;
  mood?: string | null;
  tags?: string[];
  notes?: string;
  mistake?: string;
};

export function PropFirmRiskCoachScreen({
  trades,
  selectedDate,
  templates,
  isPremium,
  onUpgrade,
}: {
  trades: TradeLike[];
  selectedDate: string;
  templates: PropFirmTemplate[];
  isPremium: boolean;
  onUpgrade?: () => void;
}) {
  const [templateKey, setTemplateKey] = useState("");
  const [phase, setPhase] = useState<PropFirmPhase>("evaluation");
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    loadLocalPropSettings().then((settings) => {
      const nextKey = resolvePropTemplateKey(settings.templateSlug || "", templates);
      if (nextKey) setTemplateKey(nextKey);
      setPhase(settings.overrides.accountPhase || settings.phase || "evaluation");
      setOverrides(settings.overrides || {});
      setHydrated(true);
    });
  }, [templates]);

  const activeTemplate = useMemo(() => {
    const base = templateKey ? templates.find((t) => t.key === templateKey) : undefined;
    return base ? applyUserOverrides(base, overrides) : null;
  }, [templateKey, templates, overrides]);

  const engine = useMemo(() => {
    if (!activeTemplate) return null;
    return buildPropRiskEngine({
      trades,
      selectedDate,
      template: activeTemplate,
      phase,
    });
  }, [activeTemplate, phase, selectedDate, trades]);

  if (!hydrated) {
    return (
      <View style={{ paddingVertical: 40, alignItems: "center" }}>
        <StatusSpinner accessibilityLabel="Loading prop firm assistant" />
      </View>
    );
  }

  if (!templates.length || !activeTemplate || !engine) {
    return (
      <View style={{ padding: 20 }}>
        <EmptyStateCard
          tone="purple"
          title="Prop Firm Risk Assistant"
          message="Firm rules load from Supabase. Connect to the internet and reopen the assistant to sync Topstep, Apex, Take Profit Trader, Lucid, and Custom templates."
        />
      </View>
    );
  }

  return (
    <PropFirmRiskDashboard
      result={engine}
      templates={templates}
      templateKey={activeTemplate.key}
      phase={phase}
      isPremium={isPremium}
      onTemplateChange={(key) => {
        setTemplateKey(key);
        persistPropTemplateSlug(key).catch(() => {});
      }}
      onPhaseChange={(next) => {
        setPhase(next);
        persistPropPhase(next).catch(() => {});
      }}
    />
  );
}

export { mapPhaseToLegacyMode };
