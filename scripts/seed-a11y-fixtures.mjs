// Seeds the guest-session rows the accessibility E2E suite (tests/a11y/) needs
// to reach pages that require a real, non-expired session — /portal/consent
// and /portal/secure. Plain Node/ESM, not TypeScript: it only needs the
// generated Prisma client and Node's own crypto, so it can run in CI without
// pulling in a TS runner for one script.
//
// Deliberately reimplements `signSessionCookie` (lib/session/cookie.ts)
// rather than importing it, for the same reason: importing a TS module with
// path aliases from a plain .mjs script needs its own loader configuration,
// which is more moving parts than duplicating twelve lines of HMAC signing
// that `tests/ecpSigV4.test.ts`-style unit coverage already protects against
// drifting from the real implementation.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createHmac } from "node:crypto";

function signSessionCookie(sessionId, secret) {
  const mac = createHmac("sha256", secret).update(sessionId, "utf8").digest("base64url");
  return `${sessionId}.${mac}`;
}

async function main() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET must be set to seed a signed session cookie");
  const ttlSeconds = Number(process.env.PORTAL_SESSION_TTL_SECONDS ?? 900);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL must be set");
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const consent = await prisma.guestSession.create({
      data: { status: "STARTED", ssid: "A11y-Suite-Guest", expiresAt },
    });
    const secure = await prisma.guestSession.create({
      data: {
        status: "AUTHORIZED",
        ssid: "A11y-Suite-Guest",
        onboardingRequested: true,
        expiresAt,
      },
    });

    // One line of JSON on stdout — the workflow step captures it and exports
    // each cookie as an env var for the Playwright run that follows.
    process.stdout.write(
      JSON.stringify({
        consentCookie: signSessionCookie(consent.id, secret),
        secureCookie: signSessionCookie(secure.id, secret),
      }) + "\n"
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
