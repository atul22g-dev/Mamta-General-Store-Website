import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Cheap database reachability probe. Pages call this to distinguish
 * "database not connected" (show a setup hint) from "query failed"
 * (show a generic error) — the same graceful states as before.
 */
export async function dbHealth(): Promise<boolean> {
  try {
    const { error } = await getSupabaseAdminClient().rpc("db_health");
    return !error;
  } catch {
    return false;
  }
}
