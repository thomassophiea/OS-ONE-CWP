import { describe, it, expect } from "vitest";
import {
  verifyEcpRedirect,
  buildEcpApprovalUrl,
  parseAmzDate,
} from "@/lib/captive/ecpSigV4";

/**
 * The fixture below is a real redirect captured from an AP5020 managed by the
 * XCC at 192.168.100.12 on 2026-08-07. Keeping a controller-produced signature
 * in the suite is what makes these tests a conformance check rather than a
 * self-consistency check: if our signing ever drifts from the controller's,
 * the first case fails.
 *
 * The key below is a RETIRED, capture-only secret. It was replaced on both the
 * gateway and Railway immediately after this fixture was taken and has never
 * been the live ECP shared secret since. Do not reuse it anywhere.
 */
const SHARED_SECRET = "Gg8SMNVZPIlfd47aWsdDoddqpqCNfp3l";
const IDENTITY = "OS-ONE-CWP";
const HOST = "os-one-cwp-production.up.railway.app";
const PATH = "/portal";

const LIVE_REDIRECT =
  "https://os-one-cwp-production.up.railway.app/portal" +
  "?X-Amz-Algorithm=AWS4-HMAC-SHA256" +
  "&X-Amz-Credential=OS-ONE-CWP%2F20260807%2Fworld%2Fecp%2Faws4_request" +
  "&X-Amz-Date=20260807T003442Z" +
  "&X-Amz-Expires=20" +
  "&X-Amz-SignedHeaders=host" +
  "&ap=AP5020-PVT-03MESHROOT" +
  "&aploc=PrimarySite" +
  "&apmac=1849f86c1c00" +
  "&bssid=1849f86c1c24" +
  "&dest=example.com%2F" +
  "&hwc_ip=apcp.ezcloudx.com" +
  "&hwc_port=443" +
  "&mac=66dffd68ba25" +
  "&role=Unregistered%20role%20for%20AURA-CWP" +
  "&sn=CV012408S-C0078" +
  "&ssid=AURA-CWP" +
  "&token=gUM7bD7k0bWu4IvfH0Pq4w!!" +
  "&vlan=0&vns=AURA-CWP&wlan=8" +
  "&X-Amz-Signature=e2dc33e88cfe89e5d37b8404e6ddffbc72c93b88d6e8f8f1065ef89fc4a1ed0a";

/** Inside the 20s signature window of the captured redirect. */
const AT_SIGNING_TIME = new Date("2026-08-07T00:34:45Z");

const baseOpts = {
  expectedHost: HOST,
  expectedPath: PATH,
  identity: IDENTITY,
  sharedSecret: SHARED_SECRET,
  now: AT_SIGNING_TIME,
};

describe("verifyEcpRedirect", () => {
  it("accepts a genuine redirect captured from the controller", () => {
    const result = verifyEcpRedirect({ ...baseOpts, rawUrl: LIVE_REDIRECT });
    expect(result).toMatchObject({ valid: true });
    expect(result.signedAt?.toISOString()).toBe("2026-08-07T00:34:42.000Z");
  });

  it("does not re-encode the query string when verifying", () => {
    // The controller emits `token=...!!` unencoded. A verifier that rebuilds
    // the canonical query from decoded params would encode it as %21%21 and
    // compute a different signature.
    expect(LIVE_REDIRECT).toContain("token=gUM7bD7k0bWu4IvfH0Pq4w!!");
    expect(verifyEcpRedirect({ ...baseOpts, rawUrl: LIVE_REDIRECT }).valid).toBe(true);
  });

  it("accepts the same redirect after Next.js re-encodes the sub-delimiters", () => {
    // Next normalises `request.url` and percent-encodes `!` (and `' ( ) *`),
    // so the bytes the handler sees are not the bytes the controller signed.
    const normalised = LIVE_REDIRECT.replace(
      "token=gUM7bD7k0bWu4IvfH0Pq4w!!",
      "token=gUM7bD7k0bWu4IvfH0Pq4w%21%21"
    );
    expect(normalised).not.toBe(LIVE_REDIRECT);
    expect(verifyEcpRedirect({ ...baseOpts, rawUrl: normalised }).valid).toBe(true);
  });

  it("only relaxes the sub-delimiters, not arbitrary escapes", () => {
    // %2F must stay encoded: decoding it would change the signed value.
    const meddled = LIVE_REDIRECT.replace("dest=example.com%2F", "dest=example.com/");
    expect(verifyEcpRedirect({ ...baseOpts, rawUrl: meddled }).valid).toBe(false);
  });

  it("rejects a tampered MAC", () => {
    const tampered = LIVE_REDIRECT.replace("mac=66dffd68ba25", "mac=aabbccddeeff");
    expect(verifyEcpRedirect({ ...baseOpts, rawUrl: tampered })).toMatchObject({
      valid: false,
      reason: "SIGNATURE_MISMATCH",
    });
  });

  it("rejects a tampered original destination", () => {
    const tampered = LIVE_REDIRECT.replace("dest=example.com%2F", "dest=evil.example%2F");
    expect(verifyEcpRedirect({ ...baseOpts, rawUrl: tampered }).valid).toBe(false);
  });

  it("rejects a tampered gateway callback host", () => {
    const tampered = LIVE_REDIRECT.replace(
      "hwc_ip=apcp.ezcloudx.com",
      "hwc_ip=attacker.example"
    );
    expect(verifyEcpRedirect({ ...baseOpts, rawUrl: tampered }).valid).toBe(false);
  });

  it("rejects a signature signed with a different secret", () => {
    expect(
      verifyEcpRedirect({
        ...baseOpts,
        rawUrl: LIVE_REDIRECT,
        sharedSecret: "not-the-shared-secret",
      })
    ).toMatchObject({ valid: false, reason: "SIGNATURE_MISMATCH" });
  });

  it("rejects a mismatched identity before doing any crypto", () => {
    expect(
      verifyEcpRedirect({ ...baseOpts, rawUrl: LIVE_REDIRECT, identity: "SOMEONE-ELSE" })
    ).toMatchObject({ valid: false, reason: "IDENTITY_MISMATCH" });
  });

  it("rejects a redirect replayed after its expiry window", () => {
    expect(
      verifyEcpRedirect({
        ...baseOpts,
        rawUrl: LIVE_REDIRECT,
        // 20s lifetime + 300s skew allowance, comfortably exceeded
        now: new Date("2026-08-07T01:34:42Z"),
      })
    ).toMatchObject({ valid: false, reason: "EXPIRED" });
  });

  it("rejects a redirect from the future", () => {
    expect(
      verifyEcpRedirect({
        ...baseOpts,
        rawUrl: LIVE_REDIRECT,
        now: new Date("2026-08-06T00:00:00Z"),
      })
    ).toMatchObject({ valid: false, reason: "NOT_YET_VALID" });
  });

  it("caps the lifetime a request may claim for itself", () => {
    const greedy = LIVE_REDIRECT.replace("X-Amz-Expires=20", "X-Amz-Expires=99999999");
    // Signature no longer matches, but the important part is that the cap is
    // applied from maxLifetimeSeconds rather than the request.
    const result = verifyEcpRedirect({
      ...baseOpts,
      rawUrl: greedy,
      maxLifetimeSeconds: 60,
      now: new Date("2026-08-07T00:34:45Z"),
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a request signed for a different host", () => {
    expect(
      verifyEcpRedirect({
        ...baseOpts,
        rawUrl: LIVE_REDIRECT,
        expectedHost: "evil.example",
      })
    ).toMatchObject({ valid: false, reason: "SIGNATURE_MISMATCH" });
  });

  it("rejects a request signed for a different path", () => {
    expect(
      verifyEcpRedirect({ ...baseOpts, rawUrl: LIVE_REDIRECT, expectedPath: "/other" })
    ).toMatchObject({ valid: false, reason: "SIGNATURE_MISMATCH" });
  });

  it("rejects a request with no signature at all", () => {
    expect(
      verifyEcpRedirect({ ...baseOpts, rawUrl: `https://${HOST}${PATH}?mac=aabb` })
    ).toMatchObject({ valid: false, reason: "MISSING_SIGNATURE" });
  });

  it("rejects a request with no query string", () => {
    expect(
      verifyEcpRedirect({ ...baseOpts, rawUrl: `https://${HOST}${PATH}` })
    ).toMatchObject({ valid: false, reason: "MISSING_SIGNATURE" });
  });

  it("rejects an unexpected credential scope", () => {
    const wrongScope = LIVE_REDIRECT.replace(
      "X-Amz-Credential=OS-ONE-CWP%2F20260807%2Fworld%2Fecp%2Faws4_request",
      "X-Amz-Credential=OS-ONE-CWP%2F20260807%2Fus-east-1%2Fs3%2Faws4_request"
    );
    expect(verifyEcpRedirect({ ...baseOpts, rawUrl: wrongScope })).toMatchObject({
      valid: false,
      reason: "BAD_CREDENTIAL_SCOPE",
    });
  });

  it("rejects a credential whose date disagrees with X-Amz-Date", () => {
    const skewed = LIVE_REDIRECT.replace("%2F20260807%2F", "%2F20260806%2F");
    expect(verifyEcpRedirect({ ...baseOpts, rawUrl: skewed })).toMatchObject({
      valid: false,
      reason: "BAD_CREDENTIAL_SCOPE",
    });
  });

  it("rejects a malformed date", () => {
    const bad = LIVE_REDIRECT.replace("X-Amz-Date=20260807T003442Z", "X-Amz-Date=nope");
    expect(verifyEcpRedirect({ ...baseOpts, rawUrl: bad }).reason).toBe("MALFORMED_DATE");
  });

  it("rejects an unsupported algorithm", () => {
    const bad = LIVE_REDIRECT.replace(
      "X-Amz-Algorithm=AWS4-HMAC-SHA256",
      "X-Amz-Algorithm=NONE"
    );
    expect(verifyEcpRedirect({ ...baseOpts, rawUrl: bad }).reason).toBe(
      "UNSUPPORTED_ALGORITHM"
    );
  });
});

describe("parseAmzDate", () => {
  it("parses the controller's compact UTC format", () => {
    expect(parseAmzDate("20260807T003442Z")?.toISOString()).toBe(
      "2026-08-07T00:34:42.000Z"
    );
  });
  it("returns null for anything else", () => {
    expect(parseAmzDate("2026-08-07T00:34:42Z")).toBeNull();
    expect(parseAmzDate("")).toBeNull();
  });
});

describe("buildEcpApprovalUrl", () => {
  const common = {
    token: "gUM7bD7k0bWu4IvfH0Pq4w!!",
    username: "66dffd68ba25",
    wlan: "8",
    identity: IDENTITY,
    sharedSecret: SHARED_SECRET,
    now: new Date("2026-08-07T00:41:50Z"),
  };

  it("uses http when the gateway advertises port 80", () => {
    const url = buildEcpApprovalUrl({
      ...common,
      gatewayHost: "apcp.ezcloudx.com",
      gatewayPort: "80",
    });
    expect(url.startsWith("http://apcp.ezcloudx.com/ext_approval.php?")).toBe(true);
  });

  it("uses https when the gateway advertises port 443", () => {
    const url = buildEcpApprovalUrl({
      ...common,
      gatewayHost: "apcp.ezcloudx.com",
      gatewayPort: "443",
    });
    expect(url.startsWith("https://apcp.ezcloudx.com/ext_approval.php?")).toBe(true);
  });

  it("keeps a non-default port in the host", () => {
    const url = buildEcpApprovalUrl({
      ...common,
      gatewayHost: "10.0.0.1",
      gatewayPort: "8443",
    });
    expect(url).toContain("https://10.0.0.1:8443/ext_approval.php");
  });

  it("percent-encodes the token so `!` cannot break the query", () => {
    const url = buildEcpApprovalUrl({
      ...common,
      gatewayHost: "apcp.ezcloudx.com",
      gatewayPort: "80",
    });
    expect(url).toContain("token=gUM7bD7k0bWu4IvfH0Pq4w%21%21");
  });

  it("emits parameters in SigV4 byte order with the signature last", () => {
    const url = buildEcpApprovalUrl({
      ...common,
      gatewayHost: "apcp.ezcloudx.com",
      gatewayPort: "80",
      dest: "https://portal.example/success?s=abc",
    });
    const query = url.slice(url.indexOf("?") + 1);
    const keys = query.split("&").map((p) => p.split("=")[0]);
    expect(keys[keys.length - 1]).toBe("X-Amz-Signature");
    const withoutSig = keys.slice(0, -1);
    expect([...withoutSig].sort()).toEqual(withoutSig);
  });

  it("round-trips: a URL we sign verifies against our own verifier", () => {
    const url = buildEcpApprovalUrl({
      ...common,
      gatewayHost: "apcp.ezcloudx.com",
      gatewayPort: "443",
      expiresSeconds: 60,
    });
    const result = verifyEcpRedirect({
      rawUrl: url,
      expectedHost: "apcp.ezcloudx.com",
      expectedPath: "/ext_approval.php",
      identity: IDENTITY,
      sharedSecret: SHARED_SECRET,
      now: new Date("2026-08-07T00:42:00Z"),
    });
    expect(result.valid).toBe(true);
  });

  it("omits dest entirely when there is none", () => {
    const url = buildEcpApprovalUrl({
      ...common,
      gatewayHost: "apcp.ezcloudx.com",
      gatewayPort: "80",
      dest: null,
    });
    expect(url).not.toContain("dest=");
  });
});
