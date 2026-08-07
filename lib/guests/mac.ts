/**
 * MAC address parsing for operator-entered values.
 *
 * The gateway always spells a MAC one way; a human does not. Everything is
 * reduced to the single canonical form `aa:bb:cc:dd:ee:ff` before it reaches
 * the database, so the unique index on `macAddress` actually means one device.
 */

/** Multicast/broadcast bit — never a station address. */
function isGroupAddress(hex: string): boolean {
  return (parseInt(hex.slice(0, 2), 16) & 0x01) === 1;
}

export type MacParseResult =
  | { ok: true; value: string }
  | { ok: false; reason: "EMPTY" | "MALFORMED" | "NOT_A_STATION" };

/**
 * Accept the formats people actually type and return the canonical form.
 *
 *   AA:BB:CC:DD:EE:FF   aa-bb-cc-dd-ee-ff   aabb.ccdd.eeff   AABBCCDDEEFF
 *
 * Separators are not required to be consistent, because rejecting
 * `aa:bb-cc:dd-ee:ff` teaches the operator nothing. What is rejected is
 * anything that is not twelve hex digits, and anything that is not a station
 * address: all-zeroes, broadcast, and any multicast address can never be a
 * guest device, so accepting one would create a row that can never match.
 */
export function parseMacAddress(input: string | null | undefined): MacParseResult {
  const raw = (input ?? "").trim();
  if (raw === "") return { ok: false, reason: "EMPTY" };

  // Only these separators — stripping *every* non-hex character would silently
  // accept "not a mac: aabbccddeeff" and other pasted noise.
  const stripped = raw.replace(/[\s:.-]/g, "").toLowerCase();
  if (!/^[0-9a-f]{12}$/.test(stripped)) return { ok: false, reason: "MALFORMED" };

  if (stripped === "000000000000" || stripped === "ffffffffffff") {
    return { ok: false, reason: "NOT_A_STATION" };
  }
  if (isGroupAddress(stripped)) return { ok: false, reason: "NOT_A_STATION" };

  return { ok: true, value: stripped.match(/.{2}/g)!.join(":") };
}

/** Canonical form, or null when the input is not a usable station MAC. */
export function canonicalMac(input: string | null | undefined): string | null {
  const parsed = parseMacAddress(input);
  return parsed.ok ? parsed.value : null;
}

export const MAC_PARSE_MESSAGES: Record<
  Exclude<MacParseResult, { ok: true }>["reason"],
  string
> = {
  EMPTY: "A MAC address is required.",
  MALFORMED:
    "That is not a MAC address. Use AA:BB:CC:DD:EE:FF, aa-bb-cc-dd-ee-ff, or aabb.ccdd.eeff.",
  NOT_A_STATION:
    "That is a broadcast or multicast address, which no device can use as its own.",
};
