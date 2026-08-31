import { effectiveStatus } from "@/lib/sponsorship/state";
import {
  persistExpiryIfDue,
  recordSponsorViewed,
  sponsorshipByToken,
} from "@/lib/sponsorship/service";
import {
  SPONSOR_ACCESS_DURATIONS,
  describeAccessDuration,
} from "@/lib/sponsorship/duration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The sponsor's review page — the only thing the emailed links open.
 *
 * A GET here changes nothing (a first-view timestamp aside), by design:
 * enterprise mail scanners fetch every URL in a message, and this page is what
 * they get. The decision is the POST below the fold, which no scanner submits.
 *
 * English only. Sponsors are employees of the configured domain; the guest
 * catalogue's eight languages are for guests.
 *
 * States are rendered from the row, not from the query string, so replaying a
 * decision URL or re-opening the email after deciding shows the outcome — it
 * can never re-open the question.
 */
export default async function SponsorReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ intent?: string }>;
}) {
  const { token } = await params;
  const { intent } = await searchParams;

  let request = await sponsorshipByToken(token).catch(() => null);
  if (request) {
    if (request.status === "PENDING" && request.viewedAt === null) {
      await recordSponsorViewed(request.id);
    }
    request = await persistExpiryIfDue(request);
  }

  if (!request) {
    return (
      <Shell>
        <Badge tone="warn" />
        <h1 className="text-xl font-bold text-slate-900 mb-2">This link isn&apos;t valid</h1>
        <p className="text-sm text-slate-500">
          This sponsorship link is not recognised. It may have been mistyped, or the
          request it belonged to no longer exists.
        </p>
      </Shell>
    );
  }

  const status = effectiveStatus(request);
  const guestLine = request.guestName
    ? request.guestName
    : "A guest on the network";

  if (status === "APPROVED" || status === "DENIED") {
    const approved = status === "APPROVED";
    return (
      <Shell>
        <Badge tone={approved ? "ok" : "warn"} />
        <h1 className="text-xl font-bold text-slate-900 mb-2">
          {approved ? "Guest access approved" : "Guest access denied"}
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          {approved
            ? `The visitor is being connected to the guest network (access: ${describeAccessDuration(request.accessDurationSeconds).toLowerCase()}).`
            : "The visitor has been told their request was not approved."}
        </p>
        <Details request={request} guestLine={guestLine} />
        {request.decidedAt && (
          <p className="mt-4 text-xs text-slate-400">
            Decided {request.decidedAt.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC")}
          </p>
        )}
      </Shell>
    );
  }

  if (status === "EXPIRED" || status === "CANCELLED") {
    return (
      <Shell>
        <Badge tone="warn" />
        <h1 className="text-xl font-bold text-slate-900 mb-2">This request has expired</h1>
        <p className="text-sm text-slate-500 mb-6">
          Sponsorship requests are only valid for a short time. The visitor can send a
          new one by reconnecting to the guest Wi-Fi.
        </p>
        <Details request={request} guestLine={guestLine} />
      </Shell>
    );
  }

  // PENDING — the decision form. Two ordinary submit buttons; the emailed
  // Allow/Deny links merely pre-emphasise one of them via `intent`.
  const allowIntent = intent !== "deny";
  return (
    <Shell>
      <h1 className="text-xl font-bold text-slate-900 mb-2">Guest Wi-Fi access request</h1>
      <p className="text-sm text-slate-500 mb-6">
        {guestLine} is asking you to sponsor their access to the guest network. Approve
        only if you recognise this visitor.
      </p>

      <Details request={request} guestLine={guestLine} />

      <form method="POST" action="/api/sponsor/decision" className="mt-6">
        <input type="hidden" name="token" value={token} />

        <div className="mb-4 flex flex-col gap-1">
          <label htmlFor="duration" className="text-xs font-medium text-slate-700">
            Access duration if allowed
          </label>
          <select
            id="duration"
            name="duration"
            defaultValue=""
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="">Network default</option>
            {SPONSOR_ACCESS_DURATIONS.map((d) => (
              <option key={d.seconds} value={String(d.seconds)}>
                {d.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-400">
            How long this device stays authorized on the guest network.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="submit"
            name="action"
            value="approve"
            className={
              allowIntent
                ? "w-full rounded-xl py-3 font-semibold text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                : "w-full rounded-xl py-3 font-semibold text-sm border border-slate-300 bg-white text-slate-900 hover:bg-slate-100 transition-colors"
            }
          >
            Allow guest access
          </button>
          <button
            type="submit"
            name="action"
            value="deny"
            className={
              allowIntent
                ? "w-full rounded-xl py-3 font-semibold text-sm border border-slate-300 bg-white text-slate-900 hover:bg-slate-100 transition-colors"
                : "w-full rounded-xl py-3 font-semibold text-sm bg-amber-600 text-white hover:bg-amber-700 transition-colors"
            }
          >
            Deny
          </button>
        </div>
      </form>

      <p className="mt-4 text-xs text-slate-400 text-center">
        Expires {request.expiresAt.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC")}.
        If you don&apos;t recognise this visitor, deny the request or close this page.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4" lang="en">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8">
        {children}
        <p className="mt-8 text-center text-xs text-slate-400">OS-ONE-CWP · Sponsor review</p>
      </div>
    </main>
  );
}

function Badge({ tone }: { tone: "ok" | "warn" }) {
  return (
    <div className={`mb-4 ${tone === "ok" ? "text-emerald-500" : "text-amber-500"}`} aria-hidden="true">
      {tone === "ok" ? (
        <svg className="mx-auto h-14 w-14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ) : (
        <svg className="mx-auto h-14 w-14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          />
        </svg>
      )}
    </div>
  );
}

function Details({
  request,
  guestLine,
}: {
  request: {
    guestEmail: string | null;
    ssid: string | null;
    apName: string | null;
    clientMac: string | null;
    createdAt: Date;
  };
  guestLine: string;
}) {
  return (
    <dl className="text-left rounded-lg bg-slate-50 border border-slate-200 divide-y divide-slate-200 text-sm">
      <Row label="Visitor" value={guestLine} />
      <Row label="Email" value={request.guestEmail} />
      <Row label="Network" value={request.ssid} />
      <Row label="Location" value={request.apName} />
      <Row label="Device" value={request.clientMac} />
      <Row
        label="Requested"
        value={request.createdAt.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC")}
      />
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 px-4 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-900 font-medium text-right break-all">{value}</dd>
    </div>
  );
}
