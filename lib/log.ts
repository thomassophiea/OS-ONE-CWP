/**
 * Structured JSON logging with defensive redaction.
 *
 * Everything this application logs ends up in Railway's log stream, which is
 * readable by anyone with project access — so secrets must never reach it even
 * by accident (e.g. an error object that stringifies a connection URL).
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function threshold(): number {
  const configured = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  return LEVELS[configured as LogLevel] ?? LEVELS.info;
}

/** Keys whose values are replaced wholesale. */
const SECRET_KEY_RE =
  /(secret|password|passwd|pwd|token|authorization|cookie|apikey|api_key|signature|sharedkey|connection_?string|database_?url)/i;

/**
 * Keys carrying data a guest told us about themselves.
 *
 * Redacted **unconditionally**, not only when a guest has prohibited storage.
 * Making it conditional would mean the logger had to know which session a line
 * belongs to, and the one call site that forgot to pass it would be the one
 * that leaked — a control that depends on being remembered at every call site
 * is not a control. Nothing operational is lost: a session id identifies the
 * visit, and a MAC identifies the device.
 *
 * The list mirrors `GUEST_FIELD_CATALOGUE` and the ledger's personal columns.
 * It is duplicated here rather than imported so that the logger stays free of
 * application imports — a logger that can fail to load is worse than one that
 * repeats five words.
 */
const PERSONAL_KEY_RE =
  /^(fullName|displayName|name|email|emailAddress|phone|phoneNumber|tel|company|organization|roomNumber|notes|guestFields)$/i;

/** Values that look like a Postgres URL leak regardless of the key name. */
const CONNECTION_STRING_RE = /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@/gi;

function scrubString(value: string): string {
  return value.replace(CONNECTION_STRING_RE, (m) => {
    const scheme = m.slice(0, m.indexOf("://") + 3);
    return `${scheme}[redacted]@`;
  });
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth-limit]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return scrubString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubString(value.message),
      // Stack traces are kept out of logs entirely in production; they are the
      // most common way an internal path or a config value leaks.
      ...(process.env.NODE_ENV === "production"
        ? {}
        : { stack: value.stack ? scrubString(value.stack) : undefined }),
    };
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_RE.test(k)) out[k] = "[redacted]";
      else if (PERSONAL_KEY_RE.test(k)) out[k] = "[personal]";
      else out[k] = redact(v, depth + 1);
    }
    return out;
  }
  return "[unserialisable]";
}

function emit(level: LogLevel, event: string, fields?: Record<string, unknown>) {
  if (LEVELS[level] < threshold()) return;
  const record = {
    ts: new Date().toISOString(),
    level,
    service: "os-one-cwp",
    event,
    ...(fields ? (redact(fields) as Record<string, unknown>) : {}),
  };
  const line = JSON.stringify(record);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (event: string, fields?: Record<string, unknown>) =>
    emit("debug", event, fields),
  info: (event: string, fields?: Record<string, unknown>) =>
    emit("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) =>
    emit("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) =>
    emit("error", event, fields),
};
