/**
 * RevenueCat CustomerInfo is the only client-side authority for Prop Pass.
 * Server entitlement mirrors may support other server-protected operations,
 * but they must never turn this paid product on or off in the UI.
 */
export type PropPassCustomerInfo = {
  entitlements?: {
    active?: Record<
      string,
      {
        isActive?: boolean;
        productIdentifier?: string | null;
      }
    >;
  };
};

export function hasActivePropPassEntitlement(
  customerInfo: PropPassCustomerInfo | null | undefined,
  entitlementId: string,
  supportedProductIds: readonly string[],
): boolean {
  const entitlement = customerInfo?.entitlements?.active?.[entitlementId];
  if (!entitlement?.isActive) return false;

  // RevenueCat may omit the product identifier for an otherwise active shared
  // entitlement. The active entitlement remains authoritative in that case.
  return (
    !entitlement.productIdentifier ||
    supportedProductIds.includes(entitlement.productIdentifier)
  );
}
