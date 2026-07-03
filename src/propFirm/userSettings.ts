import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PropFirmPhase, PropFirmUserOverrides } from "./types";

const OVERRIDES_KEY = "prop-firm-user-overrides-v1";
const PHASE_KEY = "prop-risk-mode-v2";
const TEMPLATE_KEY = "prop-risk-template-v1";

export async function loadLocalPropSettings(): Promise<{
  templateSlug: string | null;
  phase: PropFirmPhase;
  overrides: PropFirmUserOverrides;
}> {
  const [templateSlug, phaseRaw, legacyModeRaw, overridesRaw] = await Promise.all([
    AsyncStorage.getItem(TEMPLATE_KEY),
    AsyncStorage.getItem(PHASE_KEY),
    AsyncStorage.getItem("prop-risk-mode-v1"),
    AsyncStorage.getItem(OVERRIDES_KEY),
  ]);
  const legacyPhase =
    legacyModeRaw === "funded" ? "funded" : legacyModeRaw === "evaluation" ? "evaluation" : null;
  const phase: PropFirmPhase =
    phaseRaw === "evaluation" || phaseRaw === "challenge" || phaseRaw === "funded" || phaseRaw === "live"
      ? phaseRaw
      : legacyPhase || "evaluation";
  let overrides: PropFirmUserOverrides = {};
  if (overridesRaw) {
    try {
      overrides = JSON.parse(overridesRaw) as PropFirmUserOverrides;
    } catch {
      overrides = {};
    }
  }
  return { templateSlug, phase, overrides };
}

export async function persistPropTemplateSlug(slug: string) {
  await AsyncStorage.setItem(TEMPLATE_KEY, slug);
}

export async function persistPropPhase(phase: PropFirmPhase) {
  await AsyncStorage.setItem(PHASE_KEY, phase);
}

export async function persistPropOverrides(overrides: PropFirmUserOverrides) {
  await AsyncStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
}

export function mapLegacyFirmMode(mode: "evaluation" | "funded"): PropFirmPhase {
  return mode === "funded" ? "funded" : "evaluation";
}

export function mapPhaseToLegacyMode(phase: PropFirmPhase): "evaluation" | "funded" {
  return phase === "funded" || phase === "live" ? "funded" : "evaluation";
}

export function mergeRemoteUserSettings(
  local: PropFirmUserOverrides,
  remote: Record<string, unknown> | null | undefined,
): PropFirmUserOverrides {
  if (!remote) return local;
  const remoteOverrides = typeof remote.overrides === "object" && remote.overrides ? (remote.overrides as PropFirmUserOverrides) : {};
  return {
    ...local,
    ...remoteOverrides,
    templateSlug: String(remote.template_slug || local.templateSlug || ""),
    accountPhase:
      remote.account_phase === "evaluation" ||
      remote.account_phase === "challenge" ||
      remote.account_phase === "funded" ||
      remote.account_phase === "live"
        ? (remote.account_phase as PropFirmPhase)
        : local.accountPhase,
    currentBalance: Number.isFinite(Number(remote.current_balance))
      ? Number(remote.current_balance)
      : local.currentBalance,
    customCompany: typeof remote.custom_company === "string" ? remote.custom_company : local.customCompany,
  };
}
