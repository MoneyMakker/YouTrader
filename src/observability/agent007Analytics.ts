import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import { AppState, Platform, type NativeEventSubscription } from "react-native";
import { supabase } from "../config/appConfig";

const QUEUE_KEY = "youtrader.agent007.analytics.queue.v1";
const INSTALLATION_KEY = "youtrader.agent007.analytics.installation.v1";
const MAX_QUEUE_SIZE = 200;
const MAX_BATCH_SIZE = 25;
const MAX_RETRIES = 3;
const FLUSH_DELAY_MS = 1_500;

const PROHIBITED_PROPERTY = /(email|phone|full.?name|name$|password|passcode|token|secret|authorization|cookie|api.?key|brokerage|account.?number|private.?note|note.?body|screenshot|image|voice|audio|order.?id|payment|card|user.?id|customer.?id|subscriber.?id|device.?id)/i;

export type Agent007AnalyticsValue = string | number | boolean | null;
export type Agent007AnalyticsProperties = Record<string, Agent007AnalyticsValue>;

type PendingEvent = {
  externalEventId: string;
  eventName: string;
  anonymousSubjectId: string;
  occurredAt: string;
  properties: Agent007AnalyticsProperties;
};

type PendingBatch = {
  idempotencyKey: string;
  retries: number;
  events: PendingEvent[];
};

const ALLOWED_EVENT_NAMES = new Set([
  "app_opened",
  "signup_started",
  "signup_completed",
  "login_completed",
  "journal_entry_created",
  "first_trade_created",
  "first_journal_entry_created",
  "first_value_moment",
  "csv_import_started",
  "csv_import_completed",
  "csv_import_failed",
  "paywall_viewed",
  "product_selected",
  "purchase_started",
  "purchase_completed",
  "purchase_failed",
  "restore_started",
  "restore_completed",
  "ai_analysis_started",
  "ai_analysis_completed",
  "ai_analysis_failed",
  "first_insight_viewed",
  "news_viewed",
  "weekly_report_viewed",
  "sync_failed",
]);

const EVENT_ALIASES: Record<string, string> = {
  trade_added: "journal_entry_created",
  subscribe_pressed: "purchase_started",
  purchase_success: "purchase_completed",
  pro_purchased: "purchase_completed",
  pro_restored: "restore_completed",
  ai_trade_analysis_opened: "ai_analysis_started",
  ai_analysis_opened: "ai_analysis_started",
  ai_trade_analysis_generated: "ai_analysis_completed",
  ai_pattern_detective_generated: "ai_analysis_completed",
  ai_trade_analysis_failed: "ai_analysis_failed",
  ai_pattern_detective_failed: "ai_analysis_failed",
  first_insight_seen: "first_insight_viewed",
  weekly_report_opened: "weekly_report_viewed",
  news_opened: "news_viewed",
};

function randomId() {
  try {
    return Crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  }
}

function locale() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || "unknown";
  } catch {
    return "unknown";
  }
}

function sanitizeProperties(properties?: Record<string, unknown>): Agent007AnalyticsProperties {
  const result: Agent007AnalyticsProperties = {};
  for (const [key, value] of Object.entries(properties ?? {})) {
    if (PROHIBITED_PROPERTY.test(key)) continue;
    if (value === null) {
      result[key] = null;
    } else if (typeof value === "boolean" || typeof value === "number") {
      result[key] = value;
    } else if (typeof value === "string") {
      result[key] = value.slice(0, 120);
    }
  }
  return result;
}

class Agent007AnalyticsClient {
  private queue: PendingBatch[] = [];
  private initialized = false;
  private enabled = false;
  private installationId = "";
  private sessionId = randomId();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private flushing = false;
  private appStateSubscription: NativeEventSubscription | undefined;

  async configure(enabled: boolean) {
    this.enabled = enabled && Boolean(supabase);
    if (!this.enabled) return;
    await this.initialize();
    if (!this.appStateSubscription) {
      this.appStateSubscription = AppState.addEventListener("change", (state) => {
        if (state === "active") this.scheduleFlush();
      });
    }
    this.scheduleFlush();
  }

  async reset() {
    this.enabled = false;
    this.queue = [];
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.appStateSubscription?.remove();
    this.appStateSubscription = undefined;
    this.initialized = false;
    this.installationId = "";
    this.sessionId = randomId();
    await AsyncStorage.multiRemove([QUEUE_KEY, INSTALLATION_KEY]);
  }

  capture(name: string, properties?: Record<string, unknown>) {
    if (!this.enabled) return;
    const eventName = EVENT_ALIASES[name] ?? name;
    if (!ALLOWED_EVENT_NAMES.has(eventName)) return;
    void this.enqueue(eventName, properties).catch(() => {
      // Analytics must never surface storage or transport failures to the UI.
    });
  }

  private async initialize() {
    if (this.initialized) return;
    this.initialized = true;
    const [storedQueue, storedInstallationId] = await Promise.all([
      AsyncStorage.getItem(QUEUE_KEY),
      AsyncStorage.getItem(INSTALLATION_KEY),
    ]);
    this.installationId = storedInstallationId || randomId();
    if (!storedInstallationId) await AsyncStorage.setItem(INSTALLATION_KEY, this.installationId);
    if (storedQueue) {
      try {
        const parsed = JSON.parse(storedQueue) as PendingBatch[];
        this.queue = Array.isArray(parsed) ? parsed.slice(-MAX_QUEUE_SIZE) : [];
      } catch {
        this.queue = [];
      }
    }
  }

  private async enqueue(eventName: string, properties?: Record<string, unknown>) {
    await this.initialize();
    const config = Constants.expoConfig;
    const event: PendingEvent = {
      externalEventId: randomId(),
      eventName,
      anonymousSubjectId: this.installationId,
      occurredAt: new Date().toISOString(),
      properties: {
        ...sanitizeProperties(properties),
        app_version: config?.version || "unknown",
        build_number: String(config?.ios?.buildNumber || config?.android?.versionCode || "unknown"),
        platform: Platform.OS,
        locale: locale(),
        session_id: this.sessionId,
        taxonomy_version: "1",
      },
    };
    const last = this.queue.at(-1);
    if (last && last.events.length < MAX_BATCH_SIZE && last.retries === 0) {
      last.events.push(event);
    } else {
      this.queue.push({ idempotencyKey: `ios-${randomId()}`, retries: 0, events: [event] });
    }
    this.queue = this.queue.slice(-MAX_QUEUE_SIZE);
    await this.persist();
    this.scheduleFlush();
  }

  private scheduleFlush() {
    if (!this.enabled || this.timer || AppState.currentState !== "active") return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, FLUSH_DELAY_MS);
  }

  private async flush() {
    if (!this.enabled || this.flushing || !supabase || AppState.currentState !== "active") return;
    this.flushing = true;
    try {
      await this.initialize();
      const next = this.queue[0];
      if (!next) return;
      const { error } = await supabase.functions.invoke("agent-analytics-proxy", {
        body: { sourceName: "youtrader-ios", idempotencyKey: next.idempotencyKey, events: next.events },
      });
      if (error) throw error;
      this.queue.shift();
      await this.persist();
    } catch {
      const next = this.queue[0];
      if (next) next.retries += 1;
      if (next?.retries && next.retries > MAX_RETRIES) this.queue.shift();
      await this.persist();
    } finally {
      this.flushing = false;
      if (this.queue.length) this.scheduleFlush();
    }
  }

  private async persist() {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
  }
}

const client = new Agent007AnalyticsClient();

export function configureAgent007Analytics(enabled: boolean) {
  return client.configure(enabled);
}

export function resetAgent007Analytics() {
  return client.reset();
}

export function trackAgent007Event(name: string, properties?: Record<string, unknown>) {
  client.capture(name, properties);
}

export function sanitizeAgent007Properties(properties?: Record<string, unknown>) {
  return sanitizeProperties(properties);
}
