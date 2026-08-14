/**
 * Wi-Fi QR payloads.
 *
 * The `WIFI:` grammar is the de-facto standard implemented by the iOS Camera
 * app and by Android 10+. Its escaping rules are easy to get subtly wrong and
 * the failure mode is silent — a phone scans the code, says nothing, and joins
 * nothing — so they are implemented explicitly here and tested.
 *
 * Grammar: `WIFI:T:<auth>;S:<ssid>;P:<password>;H:<true|false>;;`
 * Within a field, `\ ; , : "` must be backslash-escaped.
 *
 * The QR image is generated server-side. The credential is therefore only ever
 * present in an image response with `Cache-Control: no-store`, never in a URL,
 * never in the HTML, and never in the JavaScript bundle.
 */

import QRCode from "qrcode";
import type { SecureNetworkCredential } from "@/lib/onboarding/credentialProvider";

/** Escapes the five characters the grammar reserves. */
export function escapeWifiField(value: string): string {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

export function buildWifiUri(credential: SecureNetworkCredential): string {
  const { network, passphrase } = credential;
  // `nopass` is the grammar's value for an open network; omitting T entirely is
  // handled inconsistently across scanners.
  const auth = network.security === "open" ? "nopass" : "WPA";
  const parts = [`T:${auth}`, `S:${escapeWifiField(network.ssid)}`];
  if (passphrase && network.security !== "open") {
    parts.push(`P:${escapeWifiField(passphrase)}`);
  }
  if (network.hidden) parts.push("H:true");
  return `WIFI:${parts.join(";")};;`;
}

/**
 * QR as SVG.
 *
 * SVG rather than PNG so it stays sharp on any phone without shipping a
 * device-pixel-ratio negotiation, and so the response is text that can be
 * asserted on in a test. Error correction is deliberately `M`: `H` inflates the
 * module count for a payload this short and makes the code harder to scan on a
 * small screen, not easier.
 */
export async function buildWifiQrSvg(credential: SecureNetworkCredential): Promise<string> {
  return QRCode.toString(buildWifiUri(credential), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}

export const QR_CONTENT_TYPE = "image/svg+xml";
