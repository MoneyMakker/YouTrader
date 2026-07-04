import AsyncStorage from "@react-native-async-storage/async-storage";

const OFFLINE_QUEUE_KEY = "sync-offline-queue-v1";

export type OfflineSyncJob =
  | { type: "trade_upsert"; userId: string; tradeId: string; queuedAt: number }
  | { type: "trade_delete"; userId: string; tradeId: string; queuedAt: number };

export async function readOfflineQueue() {
  const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
  if (!raw) return [] as OfflineSyncJob[];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflineSyncJob[]) : [];
  } catch {
    return [];
  }
}

export async function enqueueOfflineJob(job: OfflineSyncJob) {
  const queue = await readOfflineQueue();
  const filtered = queue.filter(
    (item) => !(item.userId === job.userId && item.tradeId === job.tradeId && item.type === job.type),
  );
  filtered.push(job);
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered.slice(-500)));
}

export async function dequeueOfflineJobsForUser(userId: string) {
  const queue = await readOfflineQueue();
  const keep = queue.filter((item) => item.userId !== userId);
  const removed = queue.filter((item) => item.userId === userId);
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(keep));
  return removed;
}

export async function clearOfflineQueue() {
  await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
}

/** Drop queued jobs for a user after a successful cloud sync. */
export async function clearOfflineJobsForUser(userId: string) {
  await dequeueOfflineJobsForUser(userId);
}

export async function hasPendingOfflineJobs(userId: string) {
  const queue = await readOfflineQueue();
  return queue.some((item) => item.userId === userId);
}
