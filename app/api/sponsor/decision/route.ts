import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/log";
import { appBaseUrl, allowedHosts } from "@/lib/env";
import { hostIsAllowed, getRequestMetadata } from "@/lib/request/getRequestMetadata";
import { isWellFormedToken } from "@/lib/sponsorship/token";
import {
  decideSponsorship,
  persistExpiryIfDue,
  sponsorshipByToken,
} from "@/lib/sponsorship/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where a sponsor's decision is committed. POST only — the emailed links are
 * GETs onto the review page, so a mail scanner that follows every URL in the
 * message can never land here.
 *
 * The token is the credential: 256 bits, single-decision, compared by hash.
 * There is no session to bind because the sponsor deliberately never needs an
 * account — but the state transition is atomic (`status = PENDING` in the
 * UPDATE's WHERE), so a replayed or double-clicked POST finds the question
 * already answered and is simply shown the answer.
 *
 * Responses are deliberately uniform: malformed tokens, unknown tokens and
 * decided requests all end up rendering the review page's own state, so this
 * endpoint confirms nothing about what exists.
 */
export async function POST(request: NextRequest) {
  let base: string;
  try {
    base = appBaseUrl();
  } catch {
    base = new URL(request.url).origin;
  }

  if (!hostIsAllowed(request.headers.get("host"), allowedHosts())) {
    return new NextResponse("Not found", { status: 404 });
  }

  // The decision form is served from this origin only.
  const origin = request.headers.get("origin");
  if (origin && origin !== base) {
    log.warn("sponsor_decision_cross_origin", { origin });
    return NextResponse.redirect(new URL("/sponsor/invalid", base), 303);
  }

  let token: string | null = null;
  let action: string | null = null;
  try {
    const form = await request.formData();
    token = form.get("token")?.toString() ?? null;
    action = form.get("action")?.toString() ?? null;
  } catch {
    return NextResponse.redirect(new URL("/sponsor/invalid", base), 303);
  }

  if (!isWellFormedToken(token) || (action !== "approve" && action !== "deny")) {
    return NextResponse.redirect(new URL("/sponsor/invalid", base), 303);
  }

  const found = await sponsorshipByToken(token).catch(() => null);
  if (!found) {
    // Same shape as a malformed token: no oracle for which tokens exist.
    return NextResponse.redirect(new URL("/sponsor/invalid", base), 303);
  }

  const current = await persistExpiryIfDue(found);
  if (current.status === "PENDING") {
    const meta = getRequestMetadata(request.headers);
    await decideSponsorship(current, action, {
      sourceIp: meta.sourceIp,
      userAgent: meta.userAgent,
    });
  }
  // Whatever happened — applied, raced, already decided, expired — the review
  // page renders the row's truth.
  return NextResponse.redirect(new URL(`/sponsor/${token}`, base), 303);
}
