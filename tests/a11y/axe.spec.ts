import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Runtime accessibility gate for the guest-facing captive portal (WS-8 of
 * the accessibility product brief: "automated accessibility testing in the
 * portal CI pipeline, failing the build on new violations"). Static lint
 * (`jsx-a11y`) cannot see a lot of what actually breaks a portal for a
 * screen-reader or low-vision guest — computed contrast, real ARIA state
 * once React has rendered, whether a live region exists in the DOM at all.
 * This is that second check.
 *
 * `critical`/`serious` violations fail the build outright — those are the
 * ones with a real "guest cannot get online" failure mode (unlabeled
 * required input, contrast below the text floor, a control with no
 * accessible name). `moderate`/`minor` are asserted to a checked-in count
 * rather than a hard zero, so a real new regression still fails CI without
 * this suite going red on a first run and getting muted out of frustration.
 * Tighten `MODERATE_MINOR_BASELINE` down over time; never raise it silently.
 */
const MODERATE_MINOR_BASELINE = 0;

async function assertNoSeriousViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const bySeverity = (impact: string) =>
    results.violations.filter((v) => v.impact === impact);

  const blocking = [...bySeverity("critical"), ...bySeverity("serious")];
  const lesser = [...bySeverity("moderate"), ...bySeverity("minor")];

  const describe = (v: (typeof results.violations)[number]) =>
    `  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s)) — ${v.helpUrl}`;

  expect(
    blocking.length,
    `${label}: ${blocking.length} critical/serious WCAG violation(s):\n${blocking.map(describe).join("\n")}`
  ).toBe(0);

  expect(
    lesser.length,
    `${label}: ${lesser.length} moderate/minor violation(s), baseline is ${MODERATE_MINOR_BASELINE}:\n${lesser.map(describe).join("\n")}`
  ).toBeLessThanOrEqual(MODERATE_MINOR_BASELINE);
}

test.describe("guest portal — no session required", () => {
  test("entry page (no cookie)", async ({ page }) => {
    await page.goto("/portal/entry");
    await assertNoSeriousViolations(page, "/portal/entry");
  });

  for (const code of ["bad_request", "expired", "no_session", "revoked", "unavailable"]) {
    test(`error page — code=${code}`, async ({ page }) => {
      await page.goto(`/portal/error?code=${code}`);
      await assertNoSeriousViolations(page, `/portal/error?code=${code}`);
    });
  }
});

test.describe("guest portal — seeded session", () => {
  // Seeded by scripts/seed-a11y-fixtures.mjs; skipped rather than failed when
  // absent so `npm run test:a11y` still exercises the DB-free pages above
  // without a Postgres instance to hand — CI always provides both.
  test.skip(!process.env.A11Y_CONSENT_COOKIE, "no seeded consent session — see scripts/seed-a11y-fixtures.mjs");

  test("consent page", async ({ page, context }) => {
    await context.addCookies([
      {
        name: "cwp_session",
        value: process.env.A11Y_CONSENT_COOKIE!,
        url: test.info().project.use.baseURL as string,
      },
    ]);
    await page.goto("/portal/consent");
    await assertNoSeriousViolations(page, "/portal/consent");
  });
});

test.describe("guest portal — secure setup (degraded, no live gateway)", () => {
  test.skip(!process.env.A11Y_SECURE_COOKIE, "no seeded secure session — see scripts/seed-a11y-fixtures.mjs");

  test("secure page falls back accessibly with no gateway reachable", async ({ page, context }) => {
    await context.addCookies([
      {
        name: "cwp_session",
        value: process.env.A11Y_SECURE_COOKIE!,
        url: test.info().project.use.baseURL as string,
      },
    ]);
    await page.goto("/portal/secure");
    await assertNoSeriousViolations(page, "/portal/secure (degraded)");
  });
});
