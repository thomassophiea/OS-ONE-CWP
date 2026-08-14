import { describe, expect, it } from "vitest";
import type { GuestSession } from "@prisma/client";
import { capportTokenForMac } from "@/lib/capport/resolve";
import {
  CAPPORT_CACHE_CONTROL,
  CAPPORT_CONTENT_TYPE,
  serializeCapportState,
  stateForSession,
  unidentifiedState,
} from "@/lib/capport/state";

/**
 * Conformance to RFC 8908, plus the two judgement calls the RFC leaves open:
 * what to answer when the client cannot be identified, and whether an
 * unfinished secure setup counts as captivity. Both are asserted here because
 * both are easy to "fix" later in a way that strands a guest.
 */

const BASE = "https://portal.example.net";
const context = { baseUrl: BASE, secureSetupPath: "/portal/secure" };

const session = (overrides: Partial<GuestSession> = {}): GuestSession =>
  ({
    id: "s1",
    status: "AUTHORIZED",
    expiresAt: null,
    ...overrides,
  }) as GuestSession;

describe("RFC 8908 wire format", () => {
  it("uses the registered media type", () => {
    expect(CAPPORT_CONTENT_TYPE).toBe("application/captive+json");
  });

  it("declares responses uncacheable, per §5", () => {
    expect(CAPPORT_CACHE_CONTROL).toContain("private");
    expect(CAPPORT_CACHE_CONTROL).toContain("no-store");
  });

  it("always emits the required `captive` member", () => {
    // Even from a malformed state — a document without `captive` is not a
    // Captive Portal API response at all.
    const doc = serializeCapportState({} as never);
    expect(doc.captive).toBe(true);
  });

  it("emits only registered keys", () => {
    const doc = serializeCapportState({
      captive: false,
      "venue-info-url": `${BASE}/portal/secure`,
      // A key that is not in the IANA registry must not reach the wire.
      "x-internal-note": "leaked",
    } as never);
    expect(Object.keys(doc).sort()).toEqual(["captive", "venue-info-url"]);
  });

  it("omits undefined members rather than emitting null", () => {
    const doc = serializeCapportState({ captive: true, "venue-info-url": undefined });
    expect("venue-info-url" in doc).toBe(false);
  });
});

describe("an identified client", () => {
  it("is captive before the gateway has authorized it", () => {
    const doc = stateForSession(session({ status: "STARTED" }), context);
    expect(doc.captive).toBe(true);
    expect(doc["user-portal-url"]).toBe(`${BASE}/portal/entry`);
  });

  it("is still captive at ACCEPTED, because the gateway has not confirmed", () => {
    // The approval URL has been issued but the role change is not confirmed.
    // Announcing free access here claims something the network has not granted.
    expect(stateForSession(session({ status: "ACCEPTED" }), context).captive).toBe(true);
  });

  it("is not captive once the gateway has authorized it", () => {
    expect(stateForSession(session({ status: "AUTHORIZED" }), context).captive).toBe(false);
  });

  it("points a free client at secure setup through venue-info-url, not the portal", () => {
    const doc = stateForSession(session(), context);
    expect(doc["venue-info-url"]).toBe(`${BASE}/portal/secure`);
    // Crucially NOT user-portal-url: an online guest must not be sent back to
    // a sign-in page, which is what would re-open the captive sheet.
    expect(doc["user-portal-url"]).toBeUndefined();
  });

  it("does not advertise a venue URL when secure onboarding is unconfigured", () => {
    const doc = stateForSession(session(), { baseUrl: BASE, secureSetupPath: null });
    expect(doc["venue-info-url"]).toBeUndefined();
  });

  it("reports seconds remaining from the session's own expiry", () => {
    const now = new Date("2026-08-14T12:00:00Z");
    const doc = stateForSession(
      session({ expiresAt: new Date("2026-08-14T12:10:00Z") }),
      { ...context, now }
    );
    expect(doc["seconds-remaining"]).toBe(600);
  });

  it("omits seconds-remaining rather than reporting zero or negative", () => {
    const now = new Date("2026-08-14T12:00:00Z");
    const doc = stateForSession(
      session({ expiresAt: new Date("2026-08-14T11:59:00Z") }),
      { ...context, now }
    );
    expect(doc["seconds-remaining"]).toBeUndefined();
  });

  it("never advertises a non-https URL", () => {
    const doc = stateForSession(session({ status: "STARTED" }), context);
    for (const key of ["user-portal-url", "venue-info-url"] as const) {
      const value = doc[key];
      if (value) expect(value.startsWith("https://")).toBe(true);
    }
  });
});

describe("an unidentified client", () => {
  it("is told it is captive, with somewhere to go", () => {
    // The safer of two wrong answers. Wrongly captive costs one redundant
    // sign-in sheet that resolves itself; wrongly free leaves a captive guest
    // with no route to the portal at all.
    const doc = unidentifiedState(context);
    expect(doc.captive).toBe(true);
    expect(doc["user-portal-url"]).toBe(`${BASE}/portal/entry`);
  });

  it("never claims a session it cannot see", () => {
    const doc = unidentifiedState(context);
    expect(doc["seconds-remaining"]).toBeUndefined();
    expect(doc["venue-info-url"]).toBeUndefined();
  });
});

describe("the per-client token across visits", () => {
  it("is derived from the MAC, so it is the same on every visit", () => {
    // This is the property that makes DHCP provisioning possible: the network
    // computes the URI without ever talking to the portal. It also means the
    // value cannot be treated as unique per session — a returning guest would
    // collide on insert and be told the portal is unavailable, which is exactly
    // what happened before `capportTokenHash` stopped being a unique index.
    process.env.CAPPORT_TOKEN_SECRET = "test-secret-for-derivation";
    const first = capportTokenForMac("aa:bb:cc:dd:ee:ff");
    const second = capportTokenForMac("aa:bb:cc:dd:ee:ff");
    expect(first).toBe(second);
    expect(first).not.toBeNull();
  });

  it("normalises case, so the same device is one token", () => {
    process.env.CAPPORT_TOKEN_SECRET = "test-secret-for-derivation";
    expect(capportTokenForMac("AA:BB:CC:DD:EE:FF")).toBe(capportTokenForMac("aa:bb:cc:dd:ee:ff"));
  });

  it("differs between devices", () => {
    process.env.CAPPORT_TOKEN_SECRET = "test-secret-for-derivation";
    expect(capportTokenForMac("aa:bb:cc:dd:ee:ff")).not.toBe(
      capportTokenForMac("aa:bb:cc:dd:ee:01")
    );
  });

  it("is unavailable rather than guessable when no secret is configured", () => {
    delete process.env.CAPPORT_TOKEN_SECRET;
    expect(capportTokenForMac("aa:bb:cc:dd:ee:ff")).toBeNull();
  });
});
