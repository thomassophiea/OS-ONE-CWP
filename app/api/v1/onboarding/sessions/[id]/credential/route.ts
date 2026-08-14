import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/log";
import { networkCapabilities } from "@/lib/onboarding/providers/skynet";
import { credentialProviderById } from "@/lib/onboarding/providers";
import { CredentialUnavailableError } from "@/lib/onboarding/credentialProvider";
import { markFailed, recordArtifact } from "@/lib/onboarding/service";
import { NO_STORE_HEADERS, guardOnboarding, jsonError } from "@/lib/onboarding/routeGuards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reveal the passphrase for manual setup.
 *
 * A POST, and deliberately so. This is the one endpoint whose response body is
 * the credential in plain text, and making it a POST means it cannot be
 * bookmarked, prefetched, linked, restored by a back-navigation, or turned into
 * a URL that ends up in someone's history — all of which a GET would allow.
 * It fires only when the guest taps "Show password".
 *
 * The manual view is the universal fallback, so this is never gated on the
 * platform's method plan: if provisioning fails everywhere else, typing the
 * password in still has to work.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await guardOnboarding(request, id, { limit: 10 });
  if (guard instanceof NextResponse) return guard;
  const { record } = guard;

  const provider = credentialProviderById(record.credentialProvider);
  if (!provider) {
    await markFailed(record, "unknown_credential_provider");
    return jsonError(503, "provider_unavailable", "Secure Wi-Fi setup is unavailable.");
  }

  let credential;
  let network;
  try {
    network = (await networkCapabilities()).network;
    credential = await provider.issue({
      onboardingSessionId: record.id,
      clientMac: record.clientMac,
      platform: record.platform,
    });
  } catch (err) {
    const reason =
      err instanceof CredentialUnavailableError ? "credential_unavailable" : "credential_failed";
    log.error("onboarding_credential_failed", { onboardingSessionId: record.id, reason });
    await markFailed(record, reason);
    return jsonError(
      503,
      reason,
      "The network details could not be retrieved. Please contact the network administrator."
    );
  }

  await recordArtifact(record, "MANUAL_SETUP_VIEWED", "MANUAL").catch((err) =>
    log.error("onboarding_artifact_record_failed", { err })
  );

  return NextResponse.json(
    {
      network: {
        ssid: network.ssid,
        security: network.security,
        securityLabel: network.securityLabel,
        hidden: network.hidden,
      },
      // Named `passphrase`, not `password`, and paired with `perDevice` so the
      // page can say "shared network password" today and "your personal
      // password" once a per-device provider exists — without either wording
      // being a lie in the other case.
      passphrase: credential.passphrase,
      perDevice: credential.perDevice,
      expiresAt: credential.expiresAt?.toISOString() ?? null,
    },
    { headers: NO_STORE_HEADERS }
  );
}
