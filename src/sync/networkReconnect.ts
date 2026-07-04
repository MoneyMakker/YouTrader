import { useEffect, useRef } from "react";

type NetInfoModule = typeof import("@react-native-community/netinfo");

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

/** Calls `onReconnect` when the device transitions from offline to online. */
export function useNetworkReconnect(onReconnect: () => void) {
  const wasOfflineRef = useRef(false);
  const callbackRef = useRef(onReconnect);
  callbackRef.current = onReconnect;

  useEffect(() => {
    const NetInfo = loadNetInfo();
    if (!NetInfo) return;

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      if (online && wasOfflineRef.current) {
        callbackRef.current();
      }
      wasOfflineRef.current = !online;
    });
    void NetInfo.fetch().then((state) => {
      wasOfflineRef.current = !(state.isConnected === true && state.isInternetReachable !== false);
    });
    return unsubscribe;
  }, []);
}
