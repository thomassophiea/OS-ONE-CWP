/**
 * The access durations a sponsor may grant.
 *
 * A closed set, not a number field: the submitted value is an authorization
 * parameter, and parsing "whatever integer arrived" would let a tampered form
 * mint a year of access. Anything not exactly in this list — absent, garbage,
 * or a number we never offered — resolves to the network default (null), which
 * is the behaviour that existed before durations did.
 */
export const SPONSOR_ACCESS_DURATIONS = [
  { seconds: 3_600, label: "1 hour" },
  { seconds: 28_800, label: "8 hours" },
  { seconds: 86_400, label: "24 hours" },
  { seconds: 604_800, label: "1 week" },
] as const;

const ALLOWED = new Set<number>(SPONSOR_ACCESS_DURATIONS.map((d) => d.seconds));

/** null = network default (no ledger expiry beyond the WLAN's own timers). */
export function parseAccessDuration(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const value = Number(raw);
  return ALLOWED.has(value) ? value : null;
}

export function describeAccessDuration(seconds: number | null): string {
  if (seconds === null) return "Network default";
  return SPONSOR_ACCESS_DURATIONS.find((d) => d.seconds === seconds)?.label ?? `${seconds}s`;
}
