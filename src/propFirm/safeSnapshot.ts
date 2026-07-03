import { computePropRiskSnapshot } from "./propRiskEngine";
import type { PropFirmPhase, PropFirmTemplate, PropRiskTrade } from "./types";

export type PropLegacyMode = "evaluation" | "funded";

export function resolvePropTemplateKey(requestedKey: string, templates: PropFirmTemplate[]) {
  if (requestedKey && templates.some((template) => template.key === requestedKey)) {
    return requestedKey;
  }
  return "";
}

export function tryComputePropRiskSnapshot(args: {
  trades: PropRiskTrade[];
  selectedDate: string;
  templateKey: string;
  mode: PropLegacyMode;
  templates: PropFirmTemplate[];
  phase?: PropFirmPhase;
  currentBalance?: number;
}) {
  if (!args.templateKey || !args.templates.length) return null;
  if (!args.templates.some((template) => template.key === args.templateKey)) return null;
  return computePropRiskSnapshot({
    ...args,
    templateKey: args.templateKey,
  });
}

export function propSnapshotShareMeta(snapshot: ReturnType<typeof computePropRiskSnapshot> | null) {
  if (!snapshot) {
    return {
      dailyBuffer: "—",
      propStatus: "Select a prop firm template",
    };
  }
  const sign = snapshot.dailyRemaining >= 0 ? "" : "-";
  return {
    dailyBuffer: `${sign}$${Math.abs(snapshot.dailyRemaining).toFixed(0)}`,
    propStatus: `${snapshot.template.label} • ${snapshot.status}`,
  };
}
