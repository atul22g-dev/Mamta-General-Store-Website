import { NextResponse } from "next/server";

import { dbHealth } from "@/lib/supabase/health";

/**
 * Liveness/readiness probe for uptime monitors and manual checks.
 *
 * GET /health →
 *   200 {"status":"ok","checks":{"database":{"status":"up","latencyMs":…}}}
 *   503 {"status":"error","checks":{"database":{"status":"down",…}}}
 *
 * Always dynamic: a statically prerendered health check would report the
 * state from build time, not now. Response bodies never include error
 * details — this endpoint is public, and internals must not leak.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const startedAt = performance.now();
  const databaseUp = await dbHealth();
  const latencyMs = Math.round(performance.now() - startedAt);

  return NextResponse.json(
    {
      status: databaseUp ? "ok" : "error",
      checks: {
        database: {
          status: databaseUp ? "up" : "down",
          latencyMs,
        },
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: databaseUp ? 200 : 503,
      // Monitors must see the current state, never a cached one.
      headers: { "Cache-Control": "no-store" },
    },
  );
}
