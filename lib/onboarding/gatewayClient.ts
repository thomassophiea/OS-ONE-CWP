/**
 * Read-only client for the Campus Controller's management API.
 *
 * The portal runs on Railway and the controller is not addressable from there
 * by its LAN name, so calls go through AURA's `/api/management` proxy exactly
 * as a browser session does — `X-Controller-URL` names the controller and the
 * bearer token is minted through the same path. A token minted against the LAN
 * address is rejected at the public one, so there is no shortcut here.
 *
 * Nothing in this file writes. It reads two things: the secure WLAN's
 * configuration (for the credential provider) and the live station list (to
 * decide whether a device actually joined it).
 */

import { log } from "@/lib/log";
import {
  gatewayApiBaseUrl,
  gatewayControllerUrl,
  gatewayPassword,
  gatewayUsername,
} from "@/lib/env";

export class GatewayUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GatewayUnavailableError";
  }
}

export interface GatewayStation {
  macAddress: string;
  serviceId: string | null;
  roleId: string | null;
  role: string | null;
  status: string | null;
  accessPointName: string | null;
  lastSeen: number | null;
}

/** Shape of the parts of a WLAN service this application depends on. */
export interface GatewayWlan {
  id: string;
  ssid: string;
  suppressSsid: boolean;
  privacy: Record<string, Record<string, unknown>> | null;
}

const REQUEST_TIMEOUT_MS = 12_000;
/** Tokens are good for far longer; re-minting every 10 minutes is cheap. */
const TOKEN_TTL_MS = 10 * 60 * 1000;

let cachedToken: { value: string; expiresAt: number } | null = null;

export function gatewayConfigured(): boolean {
  return Boolean(
    gatewayApiBaseUrl() && gatewayControllerUrl() && gatewayUsername() && gatewayPassword()
  );
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

async function token(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.value;

  const base = gatewayApiBaseUrl();
  const controller = gatewayControllerUrl();
  const userId = gatewayUsername();
  const password = gatewayPassword();
  if (!base || !controller || !userId || !password) {
    throw new GatewayUnavailableError("gateway access is not configured");
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-controller-url": controller,
      },
      body: JSON.stringify({ grantType: "password", userId, password, scope: "" }),
    });
  } catch (err) {
    // The password is in the request body, so nothing about the request is
    // logged beyond the fact that it failed.
    log.warn("gateway_token_request_failed", { name: (err as Error)?.name });
    throw new GatewayUnavailableError("could not reach the gateway");
  }

  if (!response.ok) {
    log.warn("gateway_token_rejected", { httpStatus: response.status });
    throw new GatewayUnavailableError(`gateway refused authentication (${response.status})`);
  }

  const body = (await response.json().catch(() => null)) as { access_token?: string } | null;
  const value = body?.access_token;
  if (!value) throw new GatewayUnavailableError("gateway returned no access token");

  cachedToken = { value, expiresAt: now + TOKEN_TTL_MS };
  return value;
}

async function get<T>(path: string): Promise<T> {
  const base = gatewayApiBaseUrl();
  const controller = gatewayControllerUrl();
  if (!base || !controller) throw new GatewayUnavailableError("gateway access is not configured");

  const send = async (bearer: string) =>
    fetchWithTimeout(`${base}${path}`, {
      headers: {
        authorization: `Bearer ${bearer}`,
        "x-controller-url": controller,
        accept: "application/json",
      },
    });

  let response: Response;
  try {
    response = await send(await token());
    if (response.status === 401 || response.status === 403) {
      // The cached token outlived its welcome; mint once more before giving up.
      cachedToken = null;
      response = await send(await token());
    }
  } catch (err) {
    if (err instanceof GatewayUnavailableError) throw err;
    log.warn("gateway_request_failed", { path, name: (err as Error)?.name });
    throw new GatewayUnavailableError("could not reach the gateway");
  }

  if (!response.ok) {
    throw new GatewayUnavailableError(`gateway answered ${response.status} for ${path}`);
  }

  // Unmatched paths on the proxy come back as a Jetty HTML 404 with a 200-ish
  // shape in some deployments, so the body is validated, not the status.
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GatewayUnavailableError(`gateway returned a non-JSON body for ${path}`);
  }
}

/** The secure WLAN as the controller currently has it configured. */
export async function readWlan(serviceId: string): Promise<GatewayWlan> {
  const raw = await get<Record<string, unknown>>(`/v1/services/${encodeURIComponent(serviceId)}`);
  if (!raw || typeof raw !== "object" || typeof raw.ssid !== "string") {
    throw new GatewayUnavailableError("gateway returned an unrecognised WLAN record");
  }
  return {
    id: String(raw.id ?? serviceId),
    ssid: raw.ssid,
    suppressSsid: raw.suppressSsid === true,
    privacy: (raw.privacy as GatewayWlan["privacy"]) ?? null,
  };
}

/**
 * Live station list.
 *
 * Deliberately the bulk endpoint: one call answers "where is this MAC?" for
 * every onboarding in flight, so N concurrent guests are N cache hits and one
 * gateway request rather than N requests. See `stationCache` in `verify.ts`.
 */
export async function readStations(): Promise<GatewayStation[]> {
  const raw = await get<unknown>("/v1/stations");
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { stations?: unknown[] })?.stations)
      ? (raw as { stations: unknown[] }).stations
      : null;
  if (!list) throw new GatewayUnavailableError("gateway returned an unrecognised station list");

  return list.map((entry) => {
    const s = entry as Record<string, unknown>;
    return {
      macAddress: String(s.macAddress ?? ""),
      serviceId: typeof s.serviceId === "string" ? s.serviceId : null,
      roleId: typeof s.roleId === "string" ? s.roleId : null,
      role: typeof s.role === "string" ? s.role : null,
      status: typeof s.status === "string" ? s.status : null,
      accessPointName: typeof s.accessPointName === "string" ? s.accessPointName : null,
      lastSeen: typeof s.lastSeen === "number" ? s.lastSeen : null,
    };
  });
}

/** Test seam — drops the memoised bearer token. */
export function resetGatewayToken(): void {
  cachedToken = null;
}
