export interface ExtractedSessionFields {
  clientMac: string | null;
  apMac: string | null;
  ssid: string | null;
  wlan: string | null;
  vlan: string | null;
  site: string | null;
  controller: string | null;
  nasId: string | null;
  sessionToken: string | null;
  controllerSessionId: string | null;
  userIp: string | null;
  redirectUrl: string | null;
  successUrl: string | null;
  hwcIp: string | null;
  hwcPort: string | null;
  dest: string | null;
  ap: string | null;
  aploc: string | null;
  role: string | null;
  sn: string | null;
}

function first(
  params: Record<string, string>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const val = params[key];
    if (val && val.trim() !== "") return val;
  }
  return null;
}

export function extractSessionFields(
  query: Record<string, string>
): ExtractedSessionFields {
  return {
    clientMac: first(
      query,
      "client_mac",
      "clientMac",
      "mac",
      "station_mac",
      "calling_station_id",
      "callingStationId"
    ),
    apMac: first(
      query,
      "ap_mac",
      "apMac",
      "bssid",
      "called_station_id",
      "calledStationId"
    ),
    ssid: first(query, "ssid"),
    wlan: first(query, "wlan"),
    vlan: first(query, "vlan"),
    site: first(query, "site"),
    controller: first(query, "controller"),
    nasId: first(query, "nas_id", "nasId"),
    sessionToken: first(query, "token"),
    controllerSessionId: first(query, "session_id", "sessionId"),
    userIp: first(query, "user_ip", "userIp", "ip"),
    redirectUrl: first(
      query,
      "redirect_url",
      "redirectUrl",
      "url",
      "target",
      "destination"
    ),
    successUrl: first(query, "success_url", "successUrl"),
    hwcIp: first(query, "hwc_ip", "hwcIp"),
    hwcPort: first(query, "hwc_port", "hwcPort"),
    dest: first(query, "dest"),
    ap: first(query, "ap"),
    aploc: first(query, "aploc"),
    role: first(query, "role"),
    sn: first(query, "sn"),
  };
}
