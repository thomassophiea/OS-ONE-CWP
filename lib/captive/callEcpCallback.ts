import https from "https";
import http from "http";
import { isIP } from "net";

// Only RFC1918 / loopback literal IPv4 — never hostnames, to prevent regex bypass.
function isPrivateLiteralIp(hostname: string): boolean {
  if (!isIP(hostname)) return false; // must be a bare IP, not a hostname
  return (
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

export async function callEcpCallback(
  url: string
): Promise<{ ok: boolean; status: number; location: string | null }> {
  return new Promise((resolve) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      resolve({ ok: false, status: 0, location: null });
      return;
    }

    const allowInsecure =
      process.env.XCC_ALLOW_INSECURE_CALLBACK === "true" &&
      isPrivateLiteralIp(parsed.hostname);

    const useHttps = parsed.protocol === "https:";
    const defaultPort = useHttps ? 443 : 80;
    const port = parsed.port ? parseInt(parsed.port, 10) : defaultPort;

    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      port,
      path: parsed.pathname + parsed.search,
      method: "GET",
      rejectUnauthorized: !allowInsecure,
      timeout: 5000,
      headers: { host: parsed.host },
    };

    const proto = useHttps ? https : http;

    const req = proto.request(options, (res) => {
      res.resume();
      const status = res.statusCode ?? 0;
      const location = res.headers.location ?? null;
      resolve({ ok: status < 400, status, location });
    });

    req.on("error", (err) => {
      console.error("[ECP] callback error:", err.message);
      resolve({ ok: false, status: 0, location: null });
    });

    req.on("timeout", () => {
      req.destroy();
      console.error("[ECP] callback timeout");
      resolve({ ok: false, status: 0, location: null });
    });

    req.end();
  });
}
