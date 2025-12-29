// Debug log storage for showing in popup
const DEBUG_KEY = 'ytf_debug_logs';
const MAX_LOGS = 50;

export interface DebugLog {
  timestamp: number;
  source: string;
  message: string;
}

export async function addDebugLog(source: string, message: string): Promise<void> {
  const logs = await getDebugLogs();
  logs.unshift({
    timestamp: Date.now(),
    source,
    message,
  });

  // Keep only last N logs
  const trimmed = logs.slice(0, MAX_LOGS);
  await browser.storage.local.set({ [DEBUG_KEY]: trimmed });
}

export async function getDebugLogs(): Promise<DebugLog[]> {
  const result = await browser.storage.local.get(DEBUG_KEY) as Record<string, unknown>;
  return (result[DEBUG_KEY] as DebugLog[]) ?? [];
}

export async function clearDebugLogs(): Promise<void> {
  await browser.storage.local.remove(DEBUG_KEY);
}
