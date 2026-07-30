import React from "react";
import type { ColorValue } from "react-native";
import {
  Bell,
  BookOpen,
  Calendar,
  ChartColumnIncreasing,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Info,
  Lock,
  Pencil,
  Plus,
  Search,
  Settings,
  Share2,
  Trash2,
  TriangleAlert,
  TrendingDown,
  TrendingUp,
  Unlock,
  X,
  type LucideIcon,
} from "lucide-react-native";
import type { YdlSemanticSymbol } from "./symbol.types";

/** Lucide vector fallback — Android / web. Never emoji. */
export const YDL_SYMBOL_ANDROID_FALLBACK: Record<YdlSemanticSymbol, LucideIcon> = {
  back: ChevronLeft,
  close: X,
  add: Plus,
  edit: Pencil,
  delete: Trash2,
  search: Search,
  settings: Settings,
  calendar: Calendar,
  chart: ChartColumnIncreasing,
  journal: BookOpen,
  trade: TrendingUp,
  profit: TrendingUp,
  loss: TrendingDown,
  warning: TriangleAlert,
  success: CircleCheck,
  lock: Lock,
  unlock: Unlock,
  share: Share2,
  info: Info,
  notification: Bell,
  chevronRight: ChevronRight,
};

export function resolveAndroidFallbackIcon(semantic: YdlSemanticSymbol): LucideIcon {
  return YDL_SYMBOL_ANDROID_FALLBACK[semantic] ?? YDL_SYMBOL_ANDROID_FALLBACK.info;
}

export function AndroidSymbolFallback({
  semantic,
  size,
  tintColor,
}: {
  semantic: YdlSemanticSymbol;
  size: number;
  tintColor?: ColorValue;
}) {
  const Icon = resolveAndroidFallbackIcon(semantic);
  return <Icon size={size} color={tintColor ?? "#FFFFFF"} strokeWidth={2} />;
}
