import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/log";
import { methodAllowed, planFor } from "@/lib/onboarding/methods";
import { networkCapabilities } from "@/lib/onboarding/providers/skynet";
import { credentialProviderById } from "@/lib/onboarding/providers";
import { CredentialUnavailableError } from "@/lib/onboarding/credentialProvider";
import { markFailed, recordArtifact } from "@/lib/onboarding/service";
import { NO_STORE_HEADERS, guardOnboarding, jsonError } from "@/lib/onboarding/routeGuards";
import {
  WINDOWS_PROFILE_CONTENT_TYPE,
  WINDOWS_PROFILE_FILENAME,
  buildWindowsWlanProfile,
} from "@/lib/onboarding/windowsProfile";
import type { Platform } from "@/lib/onboarding/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Windows WLAN profile, for `netsh wlan add profile`.
 *
 * Windows cannot install this from the browser by itself, so unlike the Apple
 * profile it is a secondary option and the page says what to do with the file.
 * The response is credential-bearing and is treated exactly like the Apple one.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await guardOnboarding(request, id, { limit: 12 });
  if (guard instanceof NextResponse) return guard;
  const { record } = guard;

  let capabilities;
  try {
    capabilities = await networkCapabilities();
  } catch (err) {
    log.warn("onboarding_network_unavailable", { name: (err as Error)?.name });
    return jsonError(503, "secure_network_unavailable", "The secure network is unavailable.");
  }

  const plan = planFor(record.platform as Platform, capabilities.network);
  if (!methodAllowed(plan, "WINDOWS_PROFILE")) {
    return jsonError(
      422,
      "method_not_supported",
      "This device cannot use a Windows Wi-Fi profile. Use manual setup instead."
    );
  }

  const provider = credentialProviderById(record.credentialProvider);
  if (!provider) {
    await markFailed(record, "unknown_credential_provider");
    return jsonError(503, "provider_unavailable", "Secure Wi-Fi setup is unavailable.");
  }

  let xml: string;
  try {
    const credential = await provider.issue({
      onboardingSessionId: record.id,
      clientMac: record.clientMac,
      platform: record.platform,
    });
    xml = buildWindowsWlanProfile(credential);
  } catch (err) {
    const reason =
      err instanceof CredentialUnavailableError ? "credential_unavailable" : "profile_generation_failed";
    log.error("onboarding_windows_profile_failed", { onboardingSessionId: record.id, reason });
    await markFailed(record, reason);
    return jsonError(503, reason, "The Wi-Fi profile could not be prepared. Try manual setup instead.");
  }

  await recordArtifact(record, "PROFILE_DOWNLOADED", "WINDOWS_PROFILE").catch((err) =>
    log.error("onboarding_artifact_record_failed", { err })
  );

  return new NextResponse(xml, {
    status: 200,
    headers: {
      ...NO_STORE_HEADERS,
      "content-type": WINDOWS_PROFILE_CONTENT_TYPE,
      "content-disposition": `attachment; filename="${WINDOWS_PROFILE_FILENAME}"`,
    },
  });
}
