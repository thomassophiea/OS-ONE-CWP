import { log } from "@/lib/log";
import { sponsorWebhookFormat, sponsorWebhookUrl } from "@/lib/env";

/**
 * Sponsor notification over a Teams or Slack incoming webhook.
 *
 * Strictly a second bell beside the email — best-effort, never load-bearing:
 * a webhook failure is logged and audited but cannot cancel a request,
 * because the emailed review link is the channel of record.
 *
 * The Allow and Deny buttons are `OpenUrl`/link buttons onto the same review
 * page the email links to, carrying only the display hint. Nothing about the
 * decision path changes: it is still the token-guarded POST on that page, so
 * this module needs no callback endpoint, no bot registration, and no way to
 * decide anything by itself.
 *
 * One deliberate limitation: an incoming webhook posts to one fixed channel or
 * chat, not to the arbitrary sponsor — right for a single-team deployment and
 * for the demo; per-sponsor delivery needs a bot and a directory lookup and is
 * future work.
 */

export interface SponsorWebhookInput {
  guestName: string;
  guestEmail: string;
  ssid: string | null;
  requestedAt: Date;
  expiresAt: Date;
  reviewUrl: string;
}

const TIMEOUT_MS = 5_000;

function clean(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

function utc(date: Date): string {
  return date.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

export function buildSlackPayload(input: SponsorWebhookInput): Record<string, unknown> {
  const fields = [
    `*Visitor:*\n${clean(input.guestName)}`,
    `*Email:*\n${clean(input.guestEmail)}`,
    `*Network:*\n${clean(input.ssid ?? "the guest network")}`,
    `*Expires:*\n${utc(input.expiresAt)}`,
  ].map((text) => ({ type: "mrkdwn", text }));

  return {
    text: `Guest Wi-Fi access request from ${clean(input.guestName)}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "Guest Wi-Fi access request", emoji: true },
      },
      { type: "section", fields },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Allow" },
            style: "primary",
            url: `${input.reviewUrl}?intent=allow`,
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Deny" },
            style: "danger",
            url: `${input.reviewUrl}?intent=deny`,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Buttons open the review page; nothing is decided until you confirm there.",
          },
        ],
      },
    ],
  };
}

export function buildTeamsPayload(input: SponsorWebhookInput): Record<string, unknown> {
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "TextBlock",
              size: "Medium",
              weight: "Bolder",
              text: "Guest Wi-Fi access request",
            },
            {
              type: "FactSet",
              facts: [
                { title: "Visitor", value: clean(input.guestName) },
                { title: "Email", value: clean(input.guestEmail) },
                { title: "Network", value: clean(input.ssid ?? "the guest network") },
                { title: "Requested", value: utc(input.requestedAt) },
                { title: "Expires", value: utc(input.expiresAt) },
              ],
            },
            {
              type: "TextBlock",
              wrap: true,
              isSubtle: true,
              text: "Buttons open the review page; nothing is decided until you confirm there.",
            },
          ],
          actions: [
            {
              type: "Action.OpenUrl",
              title: "Allow",
              url: `${input.reviewUrl}?intent=allow`,
            },
            {
              type: "Action.OpenUrl",
              title: "Deny",
              url: `${input.reviewUrl}?intent=deny`,
            },
          ],
        },
      },
    ],
  };
}

/**
 * Post the notification. Returns whether it was attempted and how it went;
 * throws nothing — the caller records the outcome and moves on either way.
 */
export async function sendSponsorWebhook(
  input: SponsorWebhookInput
): Promise<{ attempted: boolean; ok: boolean; format?: string; status?: number }> {
  const url = sponsorWebhookUrl();
  if (!url) return { attempted: false, ok: false };

  const format = sponsorWebhookFormat();
  const payload = format === "slack" ? buildSlackPayload(input) : buildTeamsPayload(input);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      log.warn("sponsor_webhook_refused", { format, status: response.status });
      return { attempted: true, ok: false, format, status: response.status };
    }
    return { attempted: true, ok: true, format, status: response.status };
  } catch (err) {
    log.warn("sponsor_webhook_failed", { format, err });
    return { attempted: true, ok: false, format };
  } finally {
    clearTimeout(timer);
  }
}
