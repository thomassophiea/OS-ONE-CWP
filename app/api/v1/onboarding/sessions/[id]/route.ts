import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/log";
import { planFor } from "@/lib/onboarding/methods";
import { networkCapabilities } from "@/lib/onboarding/providers/skynet";
import { toOnboardingView } from "@/lib/onboarding/serialize";
import { NO_STORE_HEADERS, guardOnboarding, jsonError } from "@/lib/onboarding/routeGuards";
import type { Platform } from "@/lib/onboarding/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Current state of one secure-onboarding session. Never returns a credential. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await guardOnboarding(request, id, { limit: 60 });
  if (guard instanceof NextResponse) return guard;

  let capabilities;
  try {
    capabilities = await networkCapabilities();
  } catch (err) {
    log.warn("onboarding_network_unavailable", { name: (err as Error)?.name });
    return jsonError(
      503,
      "secure_network_unavailable",
      "The secure network's details could not be read. Please try again shortly."
    );
  }

  const plan = planFor(guard.record.platform as Platform, capabilities.network);
  return NextResponse.json(
    { onboarding: toOnboardingView(guard.record, capabilities.network, plan) },
    { headers: NO_STORE_HEADERS }
  );
}
