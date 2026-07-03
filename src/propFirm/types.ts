export type PropFirmPhase = "evaluation" | "challenge" | "funded" | "live";

export type PropRiskStatus = "CLEAR" | "CAUTION" | "STOP";

export type PropFirmTemplate = {
  key: string;
  label: string;
  firm: string;
  company: string;
  accountName: string;
  accountSize: number;
  evaluationTarget: number;
  dailyLossLimit: number;
  maxLossLimit: number;
  staticDrawdown: number | null;
  trailingDrawdown: boolean;
  trailingDrawdownAmount: number | null;
  evaluationContracts: number;
  liveContracts: number;
  evaluationRiskPct: number;
  liveRiskPct: number;
  minTradingDays: number;
  consistencyRule: Record<string, unknown>;
  scalingRules: Record<string, unknown>;
  newsRestrictions: Record<string, unknown>;
  weekendHoldingAllowed: boolean;
  payoutRules: Record<string, unknown>;
  supportedPhases: PropFirmPhase[];
  isCustom: boolean;
  isActive: boolean;
  sourceUrl?: string;
  lastVerified?: string;
};

export type PropFirmUserOverrides = {
  templateSlug?: string;
  accountPhase?: PropFirmPhase;
  currentBalance?: number;
  customCompany?: string;
  dailyLossLimit?: number;
  maxLossLimit?: number;
  profitTarget?: number;
  evaluationContracts?: number;
  liveContracts?: number;
  minTradingDays?: number;
  weekendHoldingAllowed?: boolean;
};

export type PropRiskTrade = {
  id: string;
  date: string;
  pnl: number;
  contracts?: number;
  symbol?: string;
  mood?: string | null;
  tags?: string[];
  notes?: string;
  mistake?: string;
};

export type PropRiskWarning = {
  id: string;
  severity: "emergency" | "high" | "medium" | "low";
  title: string;
  body: string;
  category: "daily_loss" | "drawdown" | "contracts" | "behavior" | "payout" | "rules" | "news";
};

export type PropRiskEngineInput = {
  trades: PropRiskTrade[];
  selectedDate: string;
  template: PropFirmTemplate;
  phase: PropFirmPhase;
  currentBalance?: number;
  avgContracts?: number;
  createdAt?: string;
};

export type PropRiskEngineResult = {
  template: PropFirmTemplate;
  phase: PropFirmPhase;
  status: PropRiskStatus;
  statusColor: string;
  accountHealthScore: number;
  accountHealthGrade: "A" | "B" | "C" | "D";
  todayRisk: {
    level: "LOW" | "MEDIUM" | "HIGH" | "STOP";
    dayPnl: number;
    remainingDailyLoss: number;
    dailyLimit: number;
    pctRemaining: number;
    pctUsed: number;
  };
  remainingDrawdown: {
    amount: number;
    limit: number;
    drawdownType: "trailing" | "static";
    tightening: boolean;
    pctRemaining: number;
  };
  challengeProgress: {
    target: number;
    current: number;
    remaining: number;
    pct: number;
    tradingDays: number;
    minTradingDays: number;
    minDaysMet: boolean;
  };
  payoutReadiness: {
    ready: boolean;
    pct: number;
    message: string;
  };
  ruleWarnings: PropRiskWarning[];
  contractRecommendation: {
    currentAvg: number;
    recommended: number;
    maxAllowed: number;
    reduceFrom?: number;
    reason: string;
  };
  riskForecast: {
    survivalProbability: number;
    topRisk: string;
    daysToPass?: string;
    trend: "improving" | "stable" | "declining";
  };
  emergencyAlerts: PropRiskWarning[];
  primaryAction: string;
  coachMessage: string;
  dayPnl: number;
  totalPnl: number;
  dailyRemaining: number;
  accountRemaining: number;
  remainingToPass: number;
  bufferPct: number;
  lossStreak: number;
  avgLosingTrade: number;
};

/** @deprecated Use PropFirmTemplate — kept for gradual App.tsx migration */
export type RiskTemplate = PropFirmTemplate;
