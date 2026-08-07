/**
 * Parameters the XCC External Captive Portal appends to the ECP redirect.
 *
 * Captured verbatim from a live redirect on 2026-08-07 (AP5020 / XCC
 * 192.168.100.12, WLAN AURA-CWP):
 *
 *   ap=AP5020-PVT-03MESHROOT  aploc=PrimarySite  apmac=1849f86c1c00
 *   bssid=1849f86c1c24  dest=example.com/  hwc_ip=apcp.ezcloudx.com
 *   hwc_port=80  mac=66dffd68ba25  role=Unregistered role for AURA-CWP
 *   sn=CV012408S-C0078  ssid=AURA-CWP  token=gUM7bD7k0bWu4IvfH0Pq4w!!
 *   vlan=0  vns=AURA-CWP  wlan=8
 *
 * Which of these appear is controlled by the cpAdd* flags on the pre-auth role.
 */

export interface ExtractedSessionFields {
  clientMac: string | null;
  apMac: string | null;
  bssid: string | null;
  apName: string | null;
  apSerial: string | null;
  apLocation: string | null;
  ssid: string | null;
  vns: string | null;
  wlan: string | null;
  vlan: string | null;
  role: string | null;
  gatewayToken: string | null;
  gatewayHost: string | null;
  gatewayPort: string | null;
  originalDest: string | null;
}

/** Required for the flow to be completable at all. */
export const REQUIRED_FIELDS = [
  "clientMac",
  "wlan",
  "gatewayToken",
  "gatewayHost",
] as const satisfies readonly (keyof ExtractedSessionFields)[];

const MAC_RE = /^[0-9a-fA-F]{12}$/;
const MAC_COLON_RE = /^([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}$/;
/** Hostnames and bare IPv4 literals only — no scheme, path, port or userinfo. */
const HOST_RE = /^(?=.{1,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

function pick(
  params: URLSearchParams,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const val = params.get(key);
    if (val !== null && val.trim() !== "") return val.trim();
  }
  return null;
}

export function extractSessionFields(
  params: URLSearchParams
): ExtractedSessionFields {
  return {
    clientMac: pick(params, "mac", "client_mac", "clientMac"),
    apMac: pick(params, "apmac", "ap_mac", "apMac"),
    bssid: pick(params, "bssid"),
    apName: pick(params, "ap"),
    apSerial: pick(params, "sn"),
    apLocation: pick(params, "aploc"),
    ssid: pick(params, "ssid"),
    vns: pick(params, "vns"),
    wlan: pick(params, "wlan"),
    vlan: pick(params, "vlan"),
    role: pick(params, "role"),
    gatewayToken: pick(params, "token"),
    gatewayHost: pick(params, "hwc_ip", "hwcIp"),
    gatewayPort: pick(params, "hwc_port", "hwcPort"),
    originalDest: pick(params, "dest"),
  };
}

export type FieldValidationError =
  | { field: string; problem: "MISSING" }
  | { field: string; problem: "MALFORMED" };

/**
 * Structural validation of the extracted fields. Signature verification is a
 * separate concern (see ecpSigV4) — this catches shapes the gateway would
 * never produce, so a tampered link fails before it reaches the database.
 */
export function validateSessionFields(
  f: ExtractedSessionFields
): FieldValidationError[] {
  const errors: FieldValidationError[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (!f[field]) errors.push({ field, problem: "MISSING" });
  }

  if (f.clientMac && !MAC_RE.test(f.clientMac) && !MAC_COLON_RE.test(f.clientMac)) {
    errors.push({ field: "clientMac", problem: "MALFORMED" });
  }
  if (f.apMac && !MAC_RE.test(f.apMac) && !MAC_COLON_RE.test(f.apMac)) {
    errors.push({ field: "apMac", problem: "MALFORMED" });
  }
  if (f.wlan && !/^\d{1,4}$/.test(f.wlan)) {
    errors.push({ field: "wlan", problem: "MALFORMED" });
  }
  if (f.gatewayPort && !/^\d{1,5}$/.test(f.gatewayPort)) {
    errors.push({ field: "gatewayPort", problem: "MALFORMED" });
  }
  if (f.gatewayHost && !HOST_RE.test(f.gatewayHost)) {
    errors.push({ field: "gatewayHost", problem: "MALFORMED" });
  }
  // The token is opaque; bound its length and reject anything that could break
  // out of a query parameter.
  if (f.gatewayToken && (f.gatewayToken.length > 256 || /[\s&#?]/.test(f.gatewayToken))) {
    errors.push({ field: "gatewayToken", problem: "MALFORMED" });
  }

  return errors;
}

/** `66dffd68ba25` -> `66:df:fd:68:ba:25`; already-delimited input is normalised. */
export function normalizeMac(mac: string): string {
  const hex = mac.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
  if (hex.length !== 12) return mac.toLowerCase();
  return hex.match(/.{2}/g)!.join(":");
}
