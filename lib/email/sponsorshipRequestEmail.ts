import type { OutboundEmail } from "@/lib/email/transport";

/**
 * The sponsorship request email.
 *
 * Sponsor-facing surfaces are English: the sponsor population is employees of
 * the configured domain, and the guest-facing catalogue's eight languages are
 * about guests, not staff.
 *
 * The ALLOW and DENY buttons are links to the same review page, differing only
 * in a display hint (`?intent=`). Neither link commits anything: enterprise
 * mail security products fetch every URL in a message, so a GET that approved
 * a guest would mean the scanner approves everyone. The decision itself is a
 * POST from the review page — that page is where "allow" becomes real.
 *
 * Every interpolated value is either HTML-escaped (body) or validated upstream
 * to be CR/LF-free (headers). Guest-typed values appear here transiently; this
 * module stores nothing.
 */

export interface SponsorshipEmailInput {
  sponsorEmail: string;
  /** Guest-typed, already validated. Escaped here before rendering. */
  guestName: string;
  guestEmail: string;
  ssid: string | null;
  apName: string | null;
  requestedAt: Date;
  expiresAt: Date;
  /** Absolute review URL, carrying the approval token. */
  reviewUrl: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Strip anything that could smuggle a header or break a plain-text layout. */
function inlineText(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

function utc(date: Date): string {
  return date.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

export function renderSponsorshipRequestEmail(input: SponsorshipEmailInput): OutboundEmail {
  const guestName = inlineText(input.guestName);
  const guestEmail = inlineText(input.guestEmail);
  const network = inlineText(input.ssid ?? "the guest network");
  const minutes = Math.max(
    1,
    Math.round((input.expiresAt.getTime() - input.requestedAt.getTime()) / 60_000)
  );

  const allowUrl = `${input.reviewUrl}?intent=allow`;
  const denyUrl = `${input.reviewUrl}?intent=deny`;

  const subject = `Guest Wi-Fi access request from ${guestName}`.slice(0, 180);

  const text = [
    `${guestName} is asking you to sponsor their guest Wi-Fi access.`,
    ``,
    `Visitor:    ${guestName}`,
    `Email:      ${guestEmail}`,
    `Network:    ${network}`,
    ...(input.apName ? [`Location:   ${inlineText(input.apName)}`] : []),
    `Requested:  ${utc(input.requestedAt)}`,
    `Expires:    ${utc(input.expiresAt)} (${minutes} minutes after the request)`,
    ``,
    `Review and decide:`,
    `  Allow: ${allowUrl}`,
    `  Deny:  ${denyUrl}`,
    ``,
    `Both links open the same review page; nothing is decided until you`,
    `confirm there. If you don't recognise this visitor, deny the request`,
    `or simply ignore this email — it expires on its own.`,
  ].join("\n");

  const html = `
<div style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;">
    <h1 style="margin:0 0 8px;font-size:20px;">Guest Wi-Fi access request</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;">
      ${escapeHtml(guestName)} is asking you to sponsor their guest Wi-Fi access.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
      <tr>
        <td style="padding:8px 0;color:#64748b;">Visitor</td>
        <td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(guestName)}</td>
      </tr>
      <tr style="border-top:1px solid #e2e8f0;">
        <td style="padding:8px 0;color:#64748b;">Email</td>
        <td style="padding:8px 0;text-align:right;">${escapeHtml(guestEmail)}</td>
      </tr>
      <tr style="border-top:1px solid #e2e8f0;">
        <td style="padding:8px 0;color:#64748b;">Network</td>
        <td style="padding:8px 0;text-align:right;">${escapeHtml(network)}</td>
      </tr>
      ${
        input.apName
          ? `<tr style="border-top:1px solid #e2e8f0;">
        <td style="padding:8px 0;color:#64748b;">Location</td>
        <td style="padding:8px 0;text-align:right;">${escapeHtml(inlineText(input.apName))}</td>
      </tr>`
          : ""
      }
      <tr style="border-top:1px solid #e2e8f0;">
        <td style="padding:8px 0;color:#64748b;">Requested</td>
        <td style="padding:8px 0;text-align:right;">${escapeHtml(utc(input.requestedAt))}</td>
      </tr>
    </table>
    <div style="text-align:center;margin-bottom:16px;">
      <a href="${escapeHtml(allowUrl)}"
         style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:12px;margin:0 6px 8px;">
        Allow
      </a>
      <a href="${escapeHtml(denyUrl)}"
         style="display:inline-block;background:#ffffff;color:#0f172a;border:1px solid #cbd5e1;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:12px;margin:0 6px 8px;">
        Deny
      </a>
    </div>
    <p style="margin:0 0 4px;font-size:12px;color:#64748b;text-align:center;">
      Both buttons open a review page; nothing is decided until you confirm there.
    </p>
    <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
      This request expires ${minutes} minutes after it was made.
      If you don't recognise this visitor, deny it or ignore this email.
    </p>
  </div>
</div>`.trim();

  return { to: input.sponsorEmail, subject: inlineText(subject), text, html };
}
