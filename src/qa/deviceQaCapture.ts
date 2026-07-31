/**
 * Staging-only physical QA capture via full-screen snapshots.
 * Pull results with:
 *   xcrun devicectl device copy from \
 *     --device <UDID> \
 *     --domain-type appDataContainer \
 *     --domain-identifier com.youtrader.pro \
 *     --source Documents/qa-captures \
 *     --destination <local-dir>
 */

import { useEffect, useRef } from "react";
import * as FileSystem from "expo-file-system/legacy";

export const DEVICE_QA_CAPTURE_DIR = "qa-captures";

export function isDeviceQaCaptureEnabled(): boolean {
  return (process.env.EXPO_PUBLIC_DEVICE_QA_CAPTURE || "").trim() === "true";
}

function qaDir(): string {
  return `${FileSystem.documentDirectory || ""}${DEVICE_QA_CAPTURE_DIR}/`;
}

async function ensureDir(): Promise<string> {
  const dir = qaDir();
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  return dir;
}

async function appendStatus(line: string): Promise<void> {
  const dir = await ensureDir();
  const path = `${dir}STATUS.txt`;
  const prev = (await FileSystem.getInfoAsync(path)).exists
    ? await FileSystem.readAsStringAsync(path)
    : "";
  await FileSystem.writeAsStringAsync(
    path,
    `${prev}${new Date().toISOString()} ${line}\n`,
    { encoding: FileSystem.EncodingType.UTF8 },
  );
}

export async function captureDeviceQaScreen(basename: string): Promise<string | null> {
  if (!isDeviceQaCaptureEnabled()) return null;
  try {
    const { captureScreen } = await import("react-native-view-shot");
    const dir = await ensureDir();
    const safe = basename.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80);
    const tmp = await captureScreen({
      format: "png",
      quality: 0.92,
      result: "tmpfile",
    });
    const dest = `${dir}${safe}.png`;
    if ((await FileSystem.getInfoAsync(dest)).exists) {
      await FileSystem.deleteAsync(dest, { idempotent: true });
    }
    await FileSystem.copyAsync({ from: tmp, to: dest });
    await appendStatus(`captured ${safe}`);
    return dest;
  } catch (error) {
    await appendStatus(`capture_failed ${basename}: ${String(error)}`);
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Capture each acquisition phase once, then (on main) walk provided tab ids once.
 * Staging QA may auto-advance onboarding/paywall via callbacks after each capture.
 */
export function useDeviceQaCaptureWalk(input: {
  phase: string;
  tab: string;
  tabIds: string[];
  setTab: (id: string) => void;
  ready: boolean;
  onAdvanceFromOnboarding?: () => void;
  onAdvanceFromPaywall?: () => void;
}): void {
  const capturedPhases = useRef(new Set<string>());
  const tabWalkDone = useRef(false);
  const { phase, tabIds, setTab, ready, onAdvanceFromOnboarding, onAdvanceFromPaywall } = input;

  useEffect(() => {
    if (!isDeviceQaCaptureEnabled() || !ready) return;
    if (capturedPhases.current.has(phase)) return;
    let cancelled = false;
    capturedPhases.current.add(phase);

    void (async () => {
      await appendStatus(`phase_start phase=${phase}`);
      await delay(1400);
      if (cancelled) return;
      await captureDeviceQaScreen(`phase_${phase}`);

      if (phase === "onboarding") {
        await appendStatus("auto_advance onboarding");
        onAdvanceFromOnboarding?.();
        return;
      }
      if (phase === "paywall") {
        await appendStatus("auto_advance paywall");
        onAdvanceFromPaywall?.();
        return;
      }

      if (phase !== "main" || tabWalkDone.current) {
        await appendStatus(`phase_done phase=${phase}`);
        return;
      }

      tabWalkDone.current = true;
      for (const id of tabIds) {
        if (cancelled) return;
        setTab(id);
        // Prop Pass and other lazy screens need bundle + network settle time.
        await delay(id === "propPass" ? 3500 : 1600);
        await captureDeviceQaScreen(`tab_${id}`);
      }
      await appendStatus("walk_done");
    })();

    return () => {
      cancelled = true;
    };
    // Capture each phase transition; tabIds frozen at first main entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, phase]);
}
