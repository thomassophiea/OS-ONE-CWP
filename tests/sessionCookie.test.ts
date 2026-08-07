import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  signSessionCookie,
  readSessionCookie,
  newCsrfToken,
  csrfTokenMatches,
  sessionCookieOptions,
} from "@/lib/session/cookie";
import { redact } from "@/lib/log";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.SESSION_SECRET = "test-session-secret-not-used-anywhere-else";
});
afterEach(() => {
  vi.unstubAllEnvs();
  process.env = { ...ORIGINAL_ENV };
});

describe("session cookie", () => {
  it("round-trips a session id", () => {
    const value = signSessionCookie("cksession123");
    expect(readSessionCookie(value)).toBe("cksession123");
  });

  it("rejects a forged session id", () => {
    const value = signSessionCookie("cksession123");
    const forged = value.replace("cksession123", "cksomeoneelse");
    expect(readSessionCookie(forged)).toBeNull();
  });

  it("rejects a truncated or unsigned value", () => {
    expect(readSessionCookie("cksession123")).toBeNull();
    expect(readSessionCookie("cksession123.")).toBeNull();
    expect(readSessionCookie(undefined)).toBeNull();
    expect(readSessionCookie("")).toBeNull();
  });

  it("rejects a value signed with a different secret", () => {
    const value = signSessionCookie("cksession123");
    process.env.SESSION_SECRET = "a-completely-different-secret";
    expect(readSessionCookie(value)).toBeNull();
  });

  it("marks the cookie Secure and HttpOnly in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const opts = sessionCookieOptions(900);
    expect(opts).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax" });
  });

  it("drops Secure outside production so local http works", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(sessionCookieOptions(900).secure).toBe(false);
  });
});

describe("csrf token", () => {
  it("accepts the token it issued", () => {
    const { token, hash } = newCsrfToken();
    expect(csrfTokenMatches(token, hash)).toBe(true);
  });

  it("rejects a different token", () => {
    const { hash } = newCsrfToken();
    const other = newCsrfToken();
    expect(csrfTokenMatches(other.token, hash)).toBe(false);
  });

  it("rejects a missing token or a burnt hash", () => {
    const { token, hash } = newCsrfToken();
    expect(csrfTokenMatches(null, hash)).toBe(false);
    expect(csrfTokenMatches(token, null)).toBe(false);
  });

  it("issues a distinct token every time", () => {
    const seen = new Set(Array.from({ length: 50 }, () => newCsrfToken().token));
    expect(seen.size).toBe(50);
  });
});

describe("log redaction", () => {
  it("removes values under secret-looking keys", () => {
    expect(
      redact({ XCC_SHARED_SECRET: "hunter2", password: "x", token: "y", ssid: "AURA-CWP" })
    ).toEqual({
      XCC_SHARED_SECRET: "[redacted]",
      password: "[redacted]",
      token: "[redacted]",
      ssid: "AURA-CWP",
    });
  });

  it("scrubs credentials out of connection strings wherever they appear", () => {
    expect(redact({ msg: "connect postgresql://user:pa55@host:5432/db failed" })).toEqual(
      { msg: "connect postgresql://[redacted]@host:5432/db failed" }
    );
  });

  it("scrubs nested structures", () => {
    expect(redact({ a: { b: [{ apiKey: "k" }] } })).toEqual({
      a: { b: [{ apiKey: "[redacted]" }] },
    });
  });

  it("omits stack traces in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const out = redact(new Error("boom")) as Record<string, unknown>;
    expect(out.message).toBe("boom");
    expect(out.stack).toBeUndefined();
  });
});
