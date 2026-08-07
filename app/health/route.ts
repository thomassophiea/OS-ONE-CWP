import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness + readiness in one endpoint (Railway's health check has a single
 * probe). It reports degraded rather than throwing, so a transient database
 * blip produces a 503 with a reason instead of a stack trace.
 */
export async function GET() {
  const startedAt = Date.now();
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> =
    {};

  const configured = ["DATABASE_URL", "XCC_IDENTITY", "XCC_SHARED_SECRET", "SESSION_SECRET", "APP_BASE_URL"];
  const missing = configured.filter((k) => !process.env[k]?.trim());
  checks.configuration = missing.length
    ? { ok: false, error: `missing: ${missing.join(", ")}` }
    : { ok: true };

  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { ok: true, latencyMs: Date.now() - dbStart };
  } catch (err) {
    checks.database = {
      ok: false,
      latencyMs: Date.now() - dbStart,
      error: err instanceof Error ? err.name : "unknown",
    };
    log.error("health_database_failed", { err });
  }

  const ok = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      service: "os-one-cwp",
      commit: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
      checks,
      durationMs: Date.now() - startedAt,
    },
    {
      status: ok ? 200 : 503,
      headers: { "cache-control": "no-store" },
    }
  );
}
