import type { Prisma, SessionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";

export type AuditSeverity = "info" | "warn" | "error";

/**
 * Record an audit event. Audit writes must never take the guest flow down, so
 * failures are logged and swallowed — the structured log is the backstop.
 */
export async function audit(
  sessionId: string | null,
  action: string,
  severity: AuditSeverity = "info",
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        sessionId,
        action,
        severity,
        details: (details ?? {}) as unknown as Prisma.InputJsonObject,
      },
    });
  } catch (err) {
    log.error("audit_write_failed", { action, sessionId, err });
  }
  const line = { sessionId, action, ...details };
  if (severity === "error") log.error(action, line);
  else if (severity === "warn") log.warn(action, line);
  else log.info(action, line);
}

export async function setStatus(
  sessionId: string,
  status: SessionStatus,
  extra: Prisma.GuestSessionUpdateInput = {}
) {
  return prisma.guestSession.update({
    where: { id: sessionId },
    data: { status, ...extra },
  });
}

/** True when the session has passed its own TTL. */
export function isExpired(
  session: { expiresAt: Date | null },
  now = new Date()
): boolean {
  return session.expiresAt !== null && session.expiresAt.getTime() <= now.getTime();
}

/** Prisma's unique-constraint error, without importing the runtime error class. */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2002"
  );
}
