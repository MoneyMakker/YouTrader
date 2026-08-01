import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Trade } from "../types";
import { safeDateFromISO } from "./dates";

export function usageDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function usageMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

export function monthlyUsageStorageKey(name: string, userId: string | null = null, date = new Date()) {
  return `usage:${name}:${userId || "local"}:${usageMonthKey(date)}`;
}

export async function getMonthlyUsageCount(name: string, userId: string | null = null) {
  const raw = await AsyncStorage.getItem(monthlyUsageStorageKey(name, userId));
  const count = Number(raw || "0");
  return Number.isFinite(count) ? count : 0;
}

export async function incrementMonthlyUsageCount(name: string, userId: string | null = null) {
  const next = (await getMonthlyUsageCount(name, userId)) + 1;
  await AsyncStorage.setItem(monthlyUsageStorageKey(name, userId), String(next));
  return next;
}

export function tradeLoggedMonthKey(trade: Trade) {
  const source = typeof trade.createdAt === "number" ? new Date(trade.createdAt) : safeDateFromISO(trade.date);
  return usageMonthKey(Number.isFinite(source.getTime()) ? source : new Date());
}

export function monthlyLoggedTradeCount(trades: Trade[], date = new Date()) {
  const month = usageMonthKey(date);
  return trades.filter((trade) => tradeLoggedMonthKey(trade) === month).length;
}
