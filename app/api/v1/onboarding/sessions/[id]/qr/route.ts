import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/log";
import { methodAllowed, planFor } from "@/lib/onboarding/methods";
import { networkCapabilities } from "@/lib/onboarding/providers/skynet";
import { credentialProviderById } from "@/lib/onboarding/providers";
import { CredentialUnavailableError } from "@/lib/onboarding/credentialProvider";
import { markFailed, recordArtifact } from "@/lib/onboarding/service";
import { NO_STORE_HEADERS, guardOnboarding, jsonError } from "@/lib/onboarding/routeGuards";
import { QR_CONTENT_TYPE, buildWifiQrSvg } from "@/lib/onboarding/wifiQr";
import type { Platform } from "@/lib/onboarding/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Wi-Fi QR code, rendered server-side as SVG.
 *
 * The passphrase is encoded into the image and never into the page, so the
 * credential does not appear in the HTML, in the JavaScript bundle, or in
 * anything a `view-source` shows. `no-store` keeps it out of the browser cache
 * the same way the profile and credential responses do.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await guardOnboarding(request, id, { limit: 20 });
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
  if (!methodAllowed(plan, "WIFI_QR")) {
    return jsonError(
      422,
      "method_not_supported",
      "A Wi-Fi QR code cannot be used for this network. Use manual setup instead."
    );
  }

  const provider = credentialProviderById(record.credentialProvider);
  if (!provider) {
    await markFailed(record, "unknown_credential_provider");
    return jsonError(503, "provider_unavailable", "Secure Wi-Fi setup is unavailable.");
  }

  let svg: string;
  try {
    const credential = await provider.issue({
      onboardingSessionId: record.id,
      clientMac: record.clientMac,
      platform: record.platform,
    });
    svg = await buildWifiQrSvg(credential);
  } catch (err) {
    const reason =
      err instanceof CredentialUnavailableError ? "credential_unavailable" : "qr_generation_failed";
    log.error("onboarding_qr_failed", { onboardingSessionId: record.id, reason });
    await markFailed(record, reason);
    return jsonError(503, reason, "The QR code could not be prepared. Try manual setup instead.");
  }

  await recordArtifact(record, "QR_DISPLAYED", "WIFI_QR").catch((err) =>
    log.error("onboarding_artifact_record_failed", { err })
  );

  return new NextResponse(svg, {
    status: 200,
    headers: { ...NO_STORE_HEADERS, "content-type": QR_CONTENT_TYPE },
  });
}
