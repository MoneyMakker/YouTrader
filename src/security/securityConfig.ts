import { t } from "../i18n";

export const SECURITY_LIMITS = {
  tradeCreatePerMinute: 20,
  tradeUpdatePerMinute: 30,
  tradeDeletePerMinute: 20,
  uploadsPerHour: 20,
  csvImportsPerDay: 5,
  csvMaxBytes: 10 * 1024 * 1024,
  csvMaxRows: 1000,
  exportsPerDay: 20,
  restorePurchasePerHour: 5,
  purchaseAttemptsPerHour: 8,
  authActionsPerHour: 12,
  analyticsExportsPerHour: 12,
  noteMaxLength: 2000,
  moodMaxLength: 40,
  symbolMaxLength: 12,
  tagMaxLength: 32,
  maxTags: 12,
  screenshotMaxBytes: 10 * 1024 * 1024,
  voiceNoteMaxBytes: 25 * 1024 * 1024,
  requestTimeoutMs: 12000,
} as const;

export const SECURITY_MESSAGES = {
  get rateLimited() {
    return t("securityRateLimited");
  },
  get invalidTrade() {
    return t("securityInvalidTrade");
  },
  get invalidUpload() {
    return t("securityInvalidUpload");
  },
  get csvTooLarge() {
    return t("securityCsvTooLarge");
  },
  get csvTooManyRows() {
    return t("securityCsvTooManyRows");
  },
  get duplicateRequest() {
    return t("securityDuplicateRequest");
  },
  get safeFailure() {
    return t("securitySafeFailure");
  },
} as const;

export const ALLOWED_TRADE_SYMBOLS = [
  "MES",
  "MNQ",
  "MGC",
  "MCL",
  "ES",
  "NQ",
  "GC",
  "CL",
  "GOLD",
  "OIL",
  "BTC",
  "ETH",
] as const;
