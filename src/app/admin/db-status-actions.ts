"use server";

import { dbHealthDetailed } from "@/lib/supabase/health";

export interface DbStatusSnapshot {
  connected: boolean;
  /** Round-trip time of the health query in ms; null when it failed. */
  latencyMs: number | null;
  /** ISO timestamp of when the probe ran. */
  checkedAt: string;
}

/**
 * Re-run the database health probe on demand (the admin status popover's
 * "Check again" button). Exposes nothing new — the same probe already backs
 * the public /health endpoint — and mutates nothing.
 */
export async function recheckDatabaseAction(): Promise<DbStatusSnapshot> {
  const { connected, latencyMs } = await dbHealthDetailed();
  return { connected, latencyMs, checkedAt: new Date().toISOString() };
}
