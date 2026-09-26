import "server-only";

import { getSupabasePublicClient } from "@/lib/supabase/public";

export interface DbHealthDetailed {
  connected: boolean;
  /** Round-trip time of the health query in ms; null when it failed. */
  latencyMs: number | null;
}

/**
 * Cheap database reachability probe with a measured round-trip time. Pages
 * call this to distinguish "database not connected" (show a setup hint) from
 * "query failed" (show a generic error) — the same graceful states as before.
 */
export async function dbHealthDetailed(): Promise<DbHealthDetailed> {
  const startedAt = Date.now();
  try {
    const { error } = await getSupabasePublicClient().rpc("db_health");
    return { connected: !error, latencyMs: error ? null : Date.now() - startedAt };
  } catch {
    return { connected: false, latencyMs: null };
  }
}

/** Boolean-only probe for callers that don't need the timing. */
export async function dbHealth(): Promise<boolean> {
  return (await dbHealthDetailed()).connected;
}
