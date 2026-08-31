import { describe, expect, it } from "vitest";
import {
  renderSponsorshipRequestEmail,
  escapeHtml,
} from "@/lib/email/sponsorshipRequestEmail";

const BASE = {
  sponsorEmail: "tsophiea@extremenetworks.com",
  guestName: "Alex Morgan",
  guestEmail: "alex@example.com",
  ssid: "AURA-CWP",
  apName: "Lobby AP",
  requestedAt: new Date("2026-08-31T12:00:00Z"),
  expiresAt: new Date("2026-08-31T12:15:00Z"),
  reviewUrl: "https://portal.example/sponsor/abc123",
};

describe("sponsorship request email", () => {
  it("renders both decision links onto the review page, never a bare approval", () => {
    const mail = renderSponsorshipRequestEmail(BASE);
    expect(mail.text).toContain("https://portal.example/sponsor/abc123?intent=allow");
    expect(mail.text).toContain("https://portal.example/sponsor/abc123?intent=deny");
    expect(mail.html).toContain("?intent=allow");
    expect(mail.html).toContain("?intent=deny");
    // No URL in the message may carry a committing verb as a path.
    expect(mail.text).not.toMatch(/approve=true|allow=true|action=approve/);
  });

  it("carries the request context", () => {
    const mail = renderSponsorshipRequestEmail(BASE);
    expect(mail.to).toBe("tsophiea@extremenetworks.com");
    expect(mail.subject).toContain("Alex Morgan");
    for (const needle of ["Alex Morgan", "alex@example.com", "AURA-CWP", "Lobby AP"]) {
      expect(mail.text).toContain(needle);
      expect(mail.html).toContain(needle);
    }
    expect(mail.text).toContain("15 minutes");
  });

  it("escapes hostile guest input in the HTML body", () => {
    const mail = renderSponsorshipRequestEmail({
      ...BASE,
      guestName: `<script>alert(1)</script>"'&`,
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });

  it("cannot be used for header injection through any field", () => {
    const mail = renderSponsorshipRequestEmail({
      ...BASE,
      guestName: "Alex\r\nBcc: everyone@example.com",
      guestEmail: "alex@example.com\r\nX-Evil: 1",
      ssid: "SSID\nInjected",
    });
    expect(mail.subject).not.toMatch(/[\r\n]/);
    // The hostile text may survive as inert words, but never as a line of its
    // own — a header needs to start a line to be a header.
    expect(mail.text).not.toMatch(/^Bcc:/m);
    expect(mail.text).not.toMatch(/^X-Evil:/m);
    expect(mail.to).not.toMatch(/[\r\n]/);
  });

  it("keeps a hostile subject to one line even when the name is long", () => {
    const mail = renderSponsorshipRequestEmail({
      ...BASE,
      guestName: "A".repeat(500),
    });
    expect(mail.subject.length).toBeLessThanOrEqual(180);
    expect(mail.subject).not.toMatch(/[\r\n]/);
  });

  it("escapeHtml covers the five metacharacters", () => {
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });
});
