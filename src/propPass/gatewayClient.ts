/**
 * Lazy App-facing Prop OS gateway. Must not delay startup.
 * Service-role credentials must never be constructed here.
 */

import {
  createPropOsAppGateway,
  type PropOsAppGateway,
} from "../propOs/activation/appGateway";
import type { PropOsAvailability } from "../propOs/activation/types";

let gateway: PropOsAppGateway | null = null;
let initFailed = false;

export function resetPropPassGatewayForTests(): void {
  gateway = null;
  initFailed = false;
}

/**
 * Sync peek — never touches Prop OS repositories.
 */
export function peekPropPassAvailability(
  userId: string | null | undefined,
): PropOsAvailability {
  const g = getPropPassGateway();
  if (!g) {
    return {
      mode: "off",
      eligible: false,
      gate: "activation_off",
      reasonCodes: ["gateway_unavailable"],
      killSwitch: false,
    };
  }
  return g.peekAvailability(userId);
}

export function getPropPassGateway(): PropOsAppGateway | null {
  if (initFailed) return null;
  if (gateway) return gateway;
  try {
    // accountsFactory intentionally omitted: off → zero calls;
    // activated modes without a wired store surface repository_unavailable.
    gateway = createPropOsAppGateway({
      env: typeof process !== "undefined" ? process.env : {},
    });
    return gateway;
  } catch {
    initFailed = true;
    return null;
  }
}
