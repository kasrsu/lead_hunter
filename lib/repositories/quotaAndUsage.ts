import { getDb } from "../db";

export interface QuotaSettings {
  sessionId: string;
  dailyLimit: number;
  monthlyLimit: number;
  currentDailyCount: number;
  currentMonthlyCount: number;
  lastResetDate: string;
}

export interface ApiUsageLog {
  id: string;
  sessionId: string;
  endpoint: string;
  requestsCount: number;
  skuType: string;
  estimatedCostUsd: number;
  fieldMask: string;
  createdAt: string;
}

const COST_PER_TEXT_SEARCH_PRO_REQ = 0.032; // Google Places API (New) Text Search (Pro) published pricing

export function getQuotaSettings(sessionId = "sess_default"): QuotaSettings {
  const db = getDb();
  const todayStr = new Date().toISOString().slice(0, 10);

  let row = db
    .prepare(`SELECT * FROM quota_settings WHERE session_id = ?`)
    .get(sessionId) as any;

  if (!row) {
    db.prepare(
      `INSERT INTO quota_settings (session_id, daily_limit, monthly_limit, current_daily_count, current_monthly_count, last_reset_date)
       VALUES (?, 1000, 20000, 0, 0, ?)`
    ).run(sessionId, todayStr);

    return {
      sessionId,
      dailyLimit: 1000,
      monthlyLimit: 20000,
      currentDailyCount: 0,
      currentMonthlyCount: 0,
      lastResetDate: todayStr,
    };
  }

  // Check if daily reset is needed
  if (row.last_reset_date !== todayStr) {
    db.prepare(
      `UPDATE quota_settings 
       SET current_daily_count = 0, last_reset_date = ? 
       WHERE session_id = ?`
    ).run(todayStr, sessionId);
    row.current_daily_count = 0;
    row.last_reset_date = todayStr;
  }

  return {
    sessionId: row.session_id,
    dailyLimit: row.daily_limit,
    monthlyLimit: row.monthly_limit,
    currentDailyCount: row.current_daily_count,
    currentMonthlyCount: row.current_monthly_count,
    lastResetDate: row.last_reset_date,
  };
}

export function checkQuotaAvailable(sessionId = "sess_default", requestedCalls = 1): { allowed: boolean; reason?: string } {
  const quota = getQuotaSettings(sessionId);

  if (quota.currentDailyCount + requestedCalls > quota.dailyLimit) {
    return {
      allowed: false,
      reason: `Daily quota limit reached (${quota.currentDailyCount}/${quota.dailyLimit} requests).`,
    };
  }

  if (quota.currentMonthlyCount + requestedCalls > quota.monthlyLimit) {
    return {
      allowed: false,
      reason: `Monthly quota limit reached (${quota.currentMonthlyCount}/${quota.monthlyLimit} requests).`,
    };
  }

  return { allowed: true };
}

export function recordApiUsage(options: {
  sessionId?: string;
  endpoint?: string;
  requestsCount?: number;
  skuType?: string;
  fieldMask?: string;
}): { logId: string; estimatedCostUsd: number } {
  const {
    sessionId = "sess_default",
    endpoint = "v1/places:searchText",
    requestsCount = 1,
    skuType = "Text Search (Pro)",
    fieldMask = "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount",
  } = options;

  const db = getDb();
  const estimatedCostUsd = Number((requestsCount * COST_PER_TEXT_SEARCH_PRO_REQ).toFixed(4));
  const logId = `usg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // Log detailed usage entry
  db.prepare(
    `INSERT INTO api_usage_logs (id, session_id, endpoint, requests_count, sku_type, estimated_cost_usd, field_mask)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(logId, sessionId, endpoint, requestsCount, skuType, estimatedCostUsd, fieldMask);

  // Increment usage counters
  getQuotaSettings(sessionId); // Ensure row & reset state
  db.prepare(
    `UPDATE quota_settings 
     SET current_daily_count = current_daily_count + ?,
         current_monthly_count = current_monthly_count + ?
     WHERE session_id = ?`
  ).run(requestsCount, requestsCount, sessionId);

  return { logId, estimatedCostUsd };
}

export function getUsageSummary(sessionId = "sess_default"): {
  quota: QuotaSettings;
  totalCostUsd: number;
  totalCalls: number;
  logs: ApiUsageLog[];
} {
  const db = getDb();
  const quota = getQuotaSettings(sessionId);

  const logsRows = db
    .prepare(
      `SELECT * FROM api_usage_logs 
       WHERE session_id = ? 
       ORDER BY created_at DESC 
       LIMIT 100`
    )
    .all(sessionId) as any[];

  const totals = db
    .prepare(
      `SELECT SUM(requests_count) as total_calls, SUM(estimated_cost_usd) as total_cost 
       FROM api_usage_logs 
       WHERE session_id = ?`
    )
    .get(sessionId) as { total_calls: number | null; total_cost: number | null };

  const logs: ApiUsageLog[] = logsRows.map((r) => ({
    id: r.id,
    sessionId: r.session_id,
    endpoint: r.endpoint,
    requestsCount: r.requests_count,
    skuType: r.sku_type,
    estimatedCostUsd: r.estimated_cost_usd,
    fieldMask: r.field_mask,
    createdAt: r.created_at,
  }));

  return {
    quota,
    totalCalls: totals?.total_calls ?? 0,
    totalCostUsd: Number((totals?.total_cost ?? 0).toFixed(4)),
    logs,
  };
}
