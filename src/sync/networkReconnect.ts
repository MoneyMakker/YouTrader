import { useEffect, useRef } from "react";

type NetInfoModule = typeof import("@react-native-community/netinfo");
type NetInfoState = import("@react-native-community/netinfo").NetInfoState;

function loadNetInfo(): NetInfoModule | null {
  try {
    return require("@react-native-community/netinfo") as NetInfoModule;
  } catch (error) {
    if (__DEV__) {
      console.warn("[YouTrader:netinfo] Native module unavailable; reconnect sync disabled", error);
    }
    return null;
  }
}

/** Treat unknown reachability as online; only explicit false means offline. */
export function isNetworkOnline(state: Pick<NetInfoState, "isConnected" | "isInternetReachable">) {
  if (state.isConnected !== true) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

/** Calls `onReconnect` when the device transitions from offline to online. */
export function useNetworkReconnect(onReconnect: () => void, debounceMs = 400) {
  const wasOfflineRef = useRef(false);
  const callbackRef = useRef(onReconnect);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  callbackRef.current = onReconnect;

  useEffect(() => {
    const NetInfo = loadNetInfo();
    if (!NetInfo) return;

    const scheduleReconnect = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        callbackRef.current();
      }, debounceMs);
    };

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = isNetworkOnline(state);
      if (online && wasOfflineRef.current) {
        scheduleReconnect();
      }
      wasOfflineRef.current = !online;
    });
    void NetInfo.fetch().then((state) => {
      wasOfflineRef.current = !isNetworkOnline(state);
    });
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      unsubscribe();
    };
  }, [debounceMs]);
}
