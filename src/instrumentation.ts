/**
 * Next.js instrumentation hook — runs once when each server process starts.
 *
 * Registers the OpenTelemetry SDK that feeds Vercel Observability: traces
 * for server components, route handlers and server actions show up in the
 * project's Observability tab with no further configuration. Locally (and on
 * non-Vercel hosts) there is no OTLP endpoint configured, so spans are
 * simply dropped — the hook is safe to always run.
 */
export async function register() {
  // The Node.js runtime is where server-side traces are collected; the
  // @vercel/otel package resolves its edge entry automatically when this
  // file is compiled for middleware/edge contexts.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerOTel } = await import("@vercel/otel");
    registerOTel({ serviceName: "mamta-general-store" });
  }
}
