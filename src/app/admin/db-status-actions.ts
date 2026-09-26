"use server";

import { dbHealthDetailed } from "@/lib/supabase/health";

export type DbStatusSnapshot = Awaited<ReturnType<typeof dbHealthDetailed>>;

/**
 * Re-run the database health probe on demand (the admin status popover's
 * "Check again" button). Exposes nothing new — the same probe already backs
 * the public /health endpoint — and mutates nothing.
 */
export async function recheckDatabaseAction(): Promise<DbStatusSnapshot> {
  return dbHealthDetailed();
}
