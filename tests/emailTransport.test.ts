import { afterEach, describe, expect, it, vi } from "vitest";
import { emailTransportKind } from "@/lib/env";
import { sendEmail, EmailDeliveryError } from "@/lib/email/transport";

const MESSAGE = {
  to: "tsophiea@extremenetworks.com",
  subject: "Guest Wi-Fi access request",
  text: "body",
  html: "<p>body</p>",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("emailTransportKind selection", () => {
  it("defaults to console outside production", () => {
    expect(emailTransportKind()).toBe("console");
  });

  it("prefers resend over smtp when both are configured — SMTP egress is blocked on the primary host", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    expect(emailTransportKind()).toBe("resend");
  });

  it("uses smtp when only smtp is configured", () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    expect(emailTransportKind()).toBe("smtp");
  });

  it("honours an explicit EMAIL_TRANSPORT and refuses one that is not usable", () => {
    vi.stubEnv("EMAIL_TRANSPORT", "console");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    expect(emailTransportKind()).toBe("console");

    vi.stubEnv("EMAIL_TRANSPORT", "resend");
    vi.stubEnv("RESEND_API_KEY", "");
    expect(emailTransportKind()).toBe(null);

    vi.stubEnv("EMAIL_TRANSPORT", "smtp");
    expect(emailTransportKind()).toBe(null);
  });

  it("is null in production with nothing configured — the feature turns itself off", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(emailTransportKind()).toBe(null);
  });
});

describe("resend transport", () => {
  function stubResend(status = 200, body = "{}") {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(body, { status });
    });
    return calls;
  }

  it("posts the message to Resend with the key in the header, never the URL", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "resend");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    const calls = stubResend();

    const result = await sendEmail(MESSAGE);
    expect(result.transport).toBe("resend");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect(calls[0].url).not.toContain("re_test_key");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(
      "Bearer re_test_key"
    );
    const payload = JSON.parse(String(calls[0].init.body));
    expect(payload.to).toEqual(["tsophiea@extremenetworks.com"]);
    expect(payload.from).toBe("onboarding@resend.dev");
    expect(payload.subject).toBe(MESSAGE.subject);
  });

  it("honours a configured RESEND_FROM", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "resend");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("RESEND_FROM", "guest-portal@verified.example");
    const calls = stubResend();
    await sendEmail(MESSAGE);
    expect(JSON.parse(String(calls[0].init.body)).from).toBe("guest-portal@verified.example");
  });

  it("surfaces a refusal as a delivery error, so the request is cancelled", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "resend");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    stubResend(403, '{"message":"recipient not allowed"}');
    await expect(sendEmail(MESSAGE)).rejects.toBeInstanceOf(EmailDeliveryError);
  });

  it("refuses a header-unsafe recipient before any network call", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "resend");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    const calls = stubResend();
    await expect(
      sendEmail({ ...MESSAGE, to: "a@b.c\r\nBcc: x@y.z" })
    ).rejects.toBeInstanceOf(EmailDeliveryError);
    expect(calls).toHaveLength(0);
  });
});
