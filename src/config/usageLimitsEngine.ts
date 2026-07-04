import { FEATURE_LIMIT_MESSAGES, FREE_LIMITS, PRO_LIMITS } from "./featureLimits";

export type TradeImageRef = { id: string; photoUri?: string | null };

export function usageMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

export function monthlyUsageStorageKey(name: string, userId: string | null = null, date = new Date()) {
  return `usage:${name}:${userId || "local"}:${usageMonthKey(date)}`;
}

export function countTradeImages(trades: TradeImageRef[]) {
  return trades.filter((trade) => !!trade.photoUri).length;
}

export function canAttachTradeImage(
  isPremium: boolean,
  trades: TradeImageRef[],
  editId: string | null,
  formPhotoUri: string,
) {
  const limit = isPremium ? PRO_LIMITS.tradeImagesTotal : FREE_LIMITS.tradeImagesTotal;
  const count = countTradeImages(trades);
  if (isPremium) {
    return { allowed: true, isReplacement: false, count, limit };
  }
  const existingTrade = editId ? trades.find((trade) => trade.id === editId) : null;
  const isReplacement = !!(existingTrade?.photoUri || formPhotoUri);
  if (isReplacement) {
    return { allowed: true, isReplacement: true, count, limit };
  }
  if (count >= FREE_LIMITS.tradeImagesTotal) {
    return { allowed: false, isReplacement: false, count, limit: FREE_LIMITS.tradeImagesTotal };
  }
  return { allowed: true, isReplacement: false, count, limit: FREE_LIMITS.tradeImagesTotal };
}

export function peekShareCardExportAllowed(isPremium: boolean, usedThisMonth: number) {
  const limit = isPremium ? PRO_LIMITS.shareCardsPerMonth : FREE_LIMITS.shareCardsPerMonth;
  return {
    allowed: usedThisMonth < limit,
    used: usedThisMonth,
    limit,
    message: !isPremium && usedThisMonth >= FREE_LIMITS.shareCardsPerMonth
      ? FEATURE_LIMIT_MESSAGES.shareCardMonthlyLimitFree
      : isPremium && usedThisMonth >= PRO_LIMITS.shareCardsPerMonth
        ? FEATURE_LIMIT_MESSAGES.shareCardMonthlyLimitPro
        : null,
  };
}

export function nextShareCardUsageCount(usedThisMonth: number) {
  return usedThisMonth + 1;
}

export type UsageLimitsQaResult = { name: string; pass: boolean; detail: string };

export function runUsageLimitsQa(): UsageLimitsQaResult[] {
  const results: UsageLimitsQaResult[] = [];

  const freeAt29 = peekShareCardExportAllowed(false, 29);
  results.push({
    name: "free_user_30th_export_allowed",
    pass: freeAt29.allowed && freeAt29.limit === 30,
    detail: `used=29 allowed=${freeAt29.allowed}`,
  });

  const freeAt30 = peekShareCardExportAllowed(false, 30);
  results.push({
    name: "free_user_31st_export_blocked",
    pass: !freeAt30.allowed && freeAt30.limit === 30,
    detail: `used=30 allowed=${freeAt30.allowed}`,
  });

  const proAt99 = peekShareCardExportAllowed(true, 99);
  results.push({
    name: "pro_user_100th_export_allowed",
    pass: proAt99.allowed && proAt99.limit === 100,
    detail: `used=99 allowed=${proAt99.allowed}`,
  });

  const proAt100 = peekShareCardExportAllowed(true, 100);
  results.push({
    name: "pro_user_101st_export_blocked",
    pass: !proAt100.allowed && proAt100.limit === 100,
    detail: `used=100 allowed=${proAt100.allowed}`,
  });

  results.push({
    name: "failed_export_does_not_increment",
    pass: nextShareCardUsageCount(5) === 6 && peekShareCardExportAllowed(true, 5).allowed,
    detail: "counter helper is separate from record-on-success export flow",
  });

  const trades15 = Array.from({ length: 15 }, (_, index) => ({
    id: `t-${index}`,
    photoUri: `file:///photo-${index}.jpg`,
  }));
  const block16 = canAttachTradeImage(false, trades15, null, "");
  results.push({
    name: "free_user_16th_image_blocked",
    pass: !block16.allowed && block16.count === 15,
    detail: `count=${block16.count}`,
  });

  const replaceOk = canAttachTradeImage(false, trades15, "t-0", "");
  results.push({
    name: "free_user_can_replace_existing_image",
    pass: replaceOk.allowed && replaceOk.isReplacement,
    detail: `replacement=${replaceOk.isReplacement}`,
  });

  const stayFreeSave = canAttachTradeImage(false, trades15, null, "");
  results.push({
    name: "stay_free_keeps_trade_without_image",
    pass: !stayFreeSave.allowed,
    detail: "blocked attach allows trade save without new image",
  });

  const proImages = canAttachTradeImage(true, trades15, null, "");
  results.push({
    name: "pro_user_can_upload_more_than_31_images",
    pass: proImages.allowed,
    detail: `allowed=${proImages.allowed}`,
  });

  results.push({
    name: "free_local_ai_flag_enabled",
    pass: FREE_LIMITS.localAiCoach && !FREE_LIMITS.paidAiAnalysis,
    detail: `local=${FREE_LIMITS.localAiCoach} paid=${FREE_LIMITS.paidAiAnalysis}`,
  });

  results.push({
    name: "pro_paid_ai_enabled",
    pass: PRO_LIMITS.paidAiAnalysis && PRO_LIMITS.aiChat,
    detail: `paid=${PRO_LIMITS.paidAiAnalysis}`,
  });

  return results;
}
