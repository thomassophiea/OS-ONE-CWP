import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/log";
import { planFor, methodAllowed } from "@/lib/onboarding/methods";
import { networkCapabilities } from "@/lib/onboarding/providers/skynet";
import { credentialProviderById } from "@/lib/onboarding/providers";
import { CredentialUnavailableError } from "@/lib/onboarding/credentialProvider";
import { markFailed, recordArtifact } from "@/lib/onboarding/service";
import { NO_STORE_HEADERS, guardOnboarding, jsonError } from "@/lib/onboarding/routeGuards";
import {
  APPLE_PROFILE_CONTENT_TYPE,
  APPLE_PROFILE_FILENAME,
  buildAppleWifiProfile,
} from "@/lib/onboarding/appleProfile";
import type { Platform } from "@/lib/onboarding/platform";
import { routeLocale } from "@/lib/i18n/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Apple configuration profile.
 *
 * A GET rather than a POST because iOS will only hand a `.mobileconfig` to
 * Settings when the browser performs a top-level navigation to it — a fetch()
 * response body cannot be installed. That makes this the one credential-bearing
 * endpoint reachable by navigation, which is why the onboarding token is an
 * HttpOnly cookie (present on a top-level GET) rather than a header, and why
 * the response is `no-store` with an attachment disposition.
 *
 * Nothing identifying goes in the URL: the onboarding id is opaque and the
 * credential is only ever in the body.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { messages } = routeLocale(request);
  const guard = await guardOnboarding(request, id, { limit: 12 });
  if (guard instanceof NextResponse) return guard;
  const { record } = guard;

  let capabilities;
  try {
    capabilities = await networkCapabilities();
  } catch (err) {
    log.warn("onboarding_network_unavailable", { name: (err as Error)?.name });
    return jsonError(503, "secure_network_unavailable", messages.api.secureNetworkUnavailable);
  }

  const plan = planFor(record.platform as Platform, capabilities.network);
  if (!methodAllowed(plan, "APPLE_PROFILE")) {
    return jsonError(
      422,
      "method_not_supported",
      messages.api.methodNotSupportedProfile
    );
  }

  const provider = credentialProviderById(record.credentialProvider);
  if (!provider) {
    await markFailed(record, "unknown_credential_provider");
    return jsonError(503, "provider_unavailable", messages.api.providerUnavailable);
  }

  let profile: string;
  try {
    const credential = await provider.issue({
      onboardingSessionId: record.id,
      clientMac: record.clientMac,
      platform: record.platform,
    });
    profile = buildAppleWifiProfile({
      credential,
      onboardingSessionId: record.id,
      organization: capabilities.network.ssid,
    });
  } catch (err) {
    const reason =
      err instanceof CredentialUnavailableError ? "credential_unavailable" : "profile_generation_failed";
    log.error("onboarding_profile_failed", { onboardingSessionId: record.id, reason });
    await markFailed(record, reason);
    return jsonError(
      503,
      reason,
      messages.api.profileFailed
    );
  }

  await recordArtifact(record, "PROFILE_DOWNLOADED", "APPLE_PROFILE").catch((err) =>
    log.error("onboarding_artifact_record_failed", { err })
  );

  return new NextResponse(profile, {
    status: 200,
    headers: {
      ...NO_STORE_HEADERS,
      "content-type": APPLE_PROFILE_CONTENT_TYPE,
      "content-disposition": `attachment; filename="${APPLE_PROFILE_FILENAME}"`,
    },
  });
}
