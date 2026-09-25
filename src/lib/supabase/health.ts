import "server-only";

import { getSupabasePublicClient } from "@/lib/supabase/public";

/**
 * Cheap database reachability probe. Pages call this to distinguish
 * "database not connected" (show a setup hint) from "query failed"
 * (show a generic error) — the same graceful states as before.
 */
export async function dbHealth(): Promise<boolean> {
  try {
    const { error } = await getSupabasePublicClient().rpc("db_health");
    return !error;
  } catch {
    return false;
  }
}
