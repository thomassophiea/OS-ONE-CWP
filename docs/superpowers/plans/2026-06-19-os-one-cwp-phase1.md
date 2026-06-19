# OS-ONE-CWP Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working Extreme Campus Controller External Captive Web Portal proof of concept that captures controller redirect parameters, displays Terms & Conditions, records acceptance, and safely redirects the guest.

**Architecture:** Next.js 15 App Router with server components handling session creation (using `headers()` and `searchParams`), a client-side AcceptButton component POSTing to a Route Handler, and Prisma/PostgreSQL for session and audit persistence. Railway hosts the app; the database URL is injected as an env var.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, Prisma ORM, PostgreSQL, Railway

---

## File Map

| Path | Responsibility |
|------|---------------|
| `prisma/schema.prisma` | GuestSession + AuditEvent models + SessionStatus enum |
| `lib/prisma.ts` | Prisma client singleton (dev hot-reload safe) |
| `lib/request/getRequestMetadata.ts` | Extract sourceIp, userAgent, rawHeaders from `NextRequest` |
| `lib/captive/extractSessionFields.ts` | Normalize controller query params → typed fields |
| `lib/captive/safeRedirect.ts` | Validate and sanitize redirect URLs |
| `app/layout.tsx` | Root layout with Tailwind |
| `app/page.tsx` | Root redirect to `/portal` |
| `app/portal/page.tsx` | Server component — creates session, renders T&C card |
| `app/portal/AcceptButton.tsx` | Client component — POSTs acceptance, triggers redirect |
| `app/api/accept/route.ts` | Route Handler — updates session, returns safe redirect URL |
| `app/success/page.tsx` | Connection Authorized page with optional session details |
| `app/admin/sessions/page.tsx` | Admin table of recent sessions with test URL |
| `app/admin/sessions/[id]/page.tsx` | Session detail — all fields, raw JSON, audit events |
| `.env.example` | Documented env var template |
| `README.md` | Project docs per spec |

---

## Task 1: Scaffold Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

- [ ] **Step 1: Run create-next-app in the existing repo directory**

```bash
cd /home/redq/Documents/NobaraShare/GitHub/OS-ONE-CWP
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --yes
```

Expected: Scaffolds Next.js 15 with App Router, Tailwind, ESLint, TypeScript. Will overwrite `.gitignore` (fine — new one will include `.next/`).

- [ ] **Step 2: Update root `app/page.tsx` to redirect to /portal**

Replace the default home page content:

```typescript
// app/page.tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/portal");
}
```

- [ ] **Step 3: Verify dev server starts**

```bash
npm run dev
```

Expected: Server starts on http://localhost:3000, visiting it redirects to `/portal` (which 404s — that's fine for now).

- [ ] **Step 4: Commit scaffold**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 app with Tailwind and TypeScript"
```

---

## Task 2: Prisma Schema and Database Setup

**Files:**
- Create: `prisma/schema.prisma`
- Modify: `package.json` (add scripts)

- [ ] **Step 1: Install Prisma**

```bash
npm install prisma @prisma/client
npx prisma init --datasource-provider postgresql
```

Expected: Creates `prisma/schema.prisma` and `.env` with `DATABASE_URL` placeholder.

- [ ] **Step 2: Write the Prisma schema**

Replace `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum SessionStatus {
  STARTED
  ACCEPTED
  REDIRECTED
  BLOCKED_REDIRECT
  ERROR
  EXPIRED
}

model GuestSession {
  id                  String        @id @default(cuid())
  status              SessionStatus @default(STARTED)
  clientMac           String?
  apMac               String?
  ssid                String?
  wlan                String?
  vlan                String?
  site                String?
  controller          String?
  nasId               String?
  sessionToken        String?
  controllerSessionId String?
  userIp              String?
  sourceIp            String?
  userAgent           String?
  redirectUrl         String?
  successUrl          String?
  rawQuery            Json?
  rawHeaders          Json?
  acceptedTerms       Boolean       @default(false)
  acceptedAt          DateTime?
  expiresAt           DateTime?
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt
  auditEvents         AuditEvent[]

  @@index([createdAt])
  @@index([clientMac])
  @@index([ssid])
  @@index([status])
}

model AuditEvent {
  id        String        @id @default(cuid())
  sessionId String?
  session   GuestSession? @relation(fields: [sessionId], references: [id])
  action    String
  details   Json?
  createdAt DateTime      @default(now())
}
```

- [ ] **Step 3: Update package.json scripts**

In `package.json`, update the `scripts` section:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "postinstall": "prisma generate",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy",
    "prisma:studio": "prisma studio"
  }
}
```

Note: `postinstall` ensures Prisma client is generated after `npm install` on Railway.

- [ ] **Step 4: Set DATABASE_URL in .env for local development**

Edit `.env` (the one Prisma created, not `.env.local`):

```
DATABASE_URL="postgresql://postgres:password@localhost:5432/os_one_cwp"
```

(Use your actual local Postgres credentials or a Railway dev DB URL.)

- [ ] **Step 5: Run migration**

```bash
npx prisma migrate dev --name init
```

Expected output: Migration `0001_init` created and applied. Prisma client generated.

- [ ] **Step 6: Verify Prisma Studio opens**

```bash
npm run prisma:studio
```

Expected: Browser opens at http://localhost:5555 showing GuestSession and AuditEvent tables (empty).

- [ ] **Step 7: Commit**

```bash
git add prisma/ package.json package-lock.json
git commit -m "feat: add Prisma schema with GuestSession, AuditEvent, and SessionStatus"
```

---

## Task 3: Prisma Client Singleton

**Files:**
- Create: `lib/prisma.ts`

- [ ] **Step 1: Create the singleton**

```typescript
// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 2: Commit**

```bash
git add lib/prisma.ts
git commit -m "feat: add Prisma client singleton"
```

---

## Task 4: Request Metadata Helper

**Files:**
- Create: `lib/request/getRequestMetadata.ts`

- [ ] **Step 1: Create the helper**

```typescript
// lib/request/getRequestMetadata.ts
import { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers";

export interface RequestMetadata {
  sourceIp: string | null;
  userAgent: string | null;
  rawHeaders: Record<string, string>;
}

export function getRequestMetadata(headers: ReadonlyHeaders): RequestMetadata {
  const rawHeaders: Record<string, string> = {};
  headers.forEach((value, key) => {
    rawHeaders[key] = value;
  });

  const sourceIp =
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    null;

  const userAgent = headers.get("user-agent") ?? null;

  return { sourceIp, userAgent, rawHeaders };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/request/getRequestMetadata.ts
git commit -m "feat: add request metadata extractor helper"
```

---

## Task 5: Extract Session Fields Helper

**Files:**
- Create: `lib/captive/extractSessionFields.ts`

- [ ] **Step 1: Create the helper**

```typescript
// lib/captive/extractSessionFields.ts
export interface ExtractedSessionFields {
  clientMac: string | null;
  apMac: string | null;
  ssid: string | null;
  wlan: string | null;
  vlan: string | null;
  site: string | null;
  controller: string | null;
  nasId: string | null;
  sessionToken: string | null;
  controllerSessionId: string | null;
  userIp: string | null;
  redirectUrl: string | null;
  successUrl: string | null;
}

function first(
  params: Record<string, string>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const val = params[key];
    if (val && val.trim() !== "") return val;
  }
  return null;
}

export function extractSessionFields(
  query: Record<string, string>
): ExtractedSessionFields {
  return {
    clientMac: first(
      query,
      "client_mac",
      "clientMac",
      "mac",
      "station_mac",
      "calling_station_id",
      "callingStationId"
    ),
    apMac: first(
      query,
      "ap_mac",
      "apMac",
      "bssid",
      "called_station_id",
      "calledStationId"
    ),
    ssid: first(query, "ssid"),
    wlan: first(query, "wlan"),
    vlan: first(query, "vlan"),
    site: first(query, "site"),
    controller: first(query, "controller"),
    nasId: first(query, "nas_id", "nasId"),
    sessionToken: first(query, "token"),
    controllerSessionId: first(query, "session_id", "sessionId"),
    userIp: first(query, "user_ip", "userIp", "ip"),
    redirectUrl: first(
      query,
      "redirect_url",
      "redirectUrl",
      "url",
      "target",
      "destination"
    ),
    successUrl: first(query, "success_url", "successUrl"),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/captive/extractSessionFields.ts
git commit -m "feat: add captive portal session field extractor"
```

---

## Task 6: Safe Redirect Helper

**Files:**
- Create: `lib/captive/safeRedirect.ts`

- [ ] **Step 1: Create the helper**

```typescript
// lib/captive/safeRedirect.ts
const UNSAFE_SCHEMES = [
  "javascript:",
  "data:",
  "file:",
  "vbscript:",
  "about:",
];

function isAllowedDomain(
  hostname: string,
  allowedDomains: string[]
): boolean {
  return allowedDomains.some(
    (allowed) =>
      hostname === allowed || hostname.endsWith(`.${allowed}`)
  );
}

export function getSafeRedirectUrl(
  inputUrl: string | null | undefined,
  fallbackUrl: string
): string {
  if (!inputUrl) return fallbackUrl;

  // Allow relative paths
  if (inputUrl.startsWith("/")) return inputUrl;

  const lower = inputUrl.toLowerCase();
  if (UNSAFE_SCHEMES.some((scheme) => lower.startsWith(scheme))) {
    return fallbackUrl;
  }

  let parsed: URL;
  try {
    parsed = new URL(inputUrl);
  } catch {
    return fallbackUrl;
  }

  const { protocol, hostname } = parsed;

  if (protocol !== "https:" && protocol !== "http:") return fallbackUrl;

  if (
    protocol === "http:" &&
    hostname !== "localhost" &&
    hostname !== "127.0.0.1"
  ) {
    return fallbackUrl;
  }

  const allowedDomainsEnv = process.env.ALLOWED_REDIRECT_DOMAINS;
  if (allowedDomainsEnv) {
    const allowedDomains = allowedDomainsEnv
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    if (
      allowedDomains.length > 0 &&
      !isAllowedDomain(hostname.toLowerCase(), allowedDomains)
    ) {
      return fallbackUrl;
    }
  }

  return inputUrl;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/captive/safeRedirect.ts
git commit -m "feat: add safe redirect URL validator"
```

---

## Task 7: Accept API Route Handler

**Files:**
- Create: `app/api/accept/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/accept/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSafeRedirectUrl } from "@/lib/captive/safeRedirect";

export async function POST(request: NextRequest) {
  let sessionId: string | undefined;

  try {
    const body = await request.json();
    sessionId = body.sessionId;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required" },
      { status: 400 }
    );
  }

  let session;
  try {
    session = await prisma.guestSession.findUnique({
      where: { id: sessionId },
    });
  } catch (err) {
    console.error("DB error looking up session:", err);
    return NextResponse.json(
      { error: "Session lookup failed" },
      { status: 500 }
    );
  }

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const appBaseUrl = process.env.APP_BASE_URL ?? "";
  const internalFallback =
    process.env.DEFAULT_SUCCESS_URL ??
    `${appBaseUrl}/success?session=${sessionId}`;

  const candidateUrl =
    session.redirectUrl ??
    session.successUrl ??
    null;

  const safeUrl = getSafeRedirectUrl(candidateUrl, internalFallback);
  const wasBlocked =
    candidateUrl !== null &&
    safeUrl === internalFallback &&
    candidateUrl !== internalFallback;

  try {
    await prisma.guestSession.update({
      where: { id: sessionId },
      data: {
        acceptedTerms: true,
        acceptedAt: new Date(),
        status: wasBlocked ? "BLOCKED_REDIRECT" : "ACCEPTED",
      },
    });

    await prisma.auditEvent.create({
      data: {
        sessionId,
        action: wasBlocked ? "TERMS_ACCEPTED_REDIRECT_BLOCKED" : "TERMS_ACCEPTED",
        details: {
          candidateUrl,
          safeUrl,
          wasBlocked,
        },
      },
    });
  } catch (err) {
    console.error("DB error updating session:", err);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }

  return NextResponse.json({ redirectUrl: safeUrl });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/accept/route.ts
git commit -m "feat: add POST /api/accept route with safe redirect and audit logging"
```

---

## Task 8: Portal Page (Server Component + Client Accept Button)

**Files:**
- Create: `app/portal/AcceptButton.tsx`
- Create: `app/portal/page.tsx`

- [ ] **Step 1: Create the AcceptButton client component**

```typescript
// app/portal/AcceptButton.tsx
"use client";

import { useState } from "react";

export default function AcceptButton({
  sessionId,
}: {
  sessionId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        window.location.href = `/success?session=${sessionId}`;
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to process acceptance. Please try again."
      );
      setLoading(false);
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <button
        onClick={handleAccept}
        disabled={loading}
        className="w-full rounded-xl bg-blue-600 py-3 text-white font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? "Processing…" : "I Accept — Continue to Internet"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create the portal server component**

```typescript
// app/portal/page.tsx
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { extractSessionFields } from "@/lib/captive/extractSessionFields";
import { getRequestMetadata } from "@/lib/request/getRequestMetadata";
import AcceptButton from "./AcceptButton";

export const dynamic = "force-dynamic";

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const headersList = await headers();
  const meta = getRequestMetadata(headersList);
  const fields = extractSessionFields(params);

  let sessionId: string | null = null;
  let createError: string | null = null;

  try {
    const session = await prisma.guestSession.create({
      data: {
        clientMac: fields.clientMac,
        apMac: fields.apMac,
        ssid: fields.ssid,
        wlan: fields.wlan,
        vlan: fields.vlan,
        site: fields.site,
        controller: fields.controller,
        nasId: fields.nasId,
        sessionToken: fields.sessionToken,
        controllerSessionId: fields.controllerSessionId,
        userIp: fields.userIp,
        sourceIp: meta.sourceIp,
        userAgent: meta.userAgent,
        redirectUrl: fields.redirectUrl,
        successUrl: fields.successUrl,
        rawQuery: params as Record<string, unknown>,
        rawHeaders: meta.rawHeaders as Record<string, unknown>,
      },
    });

    await prisma.auditEvent.create({
      data: {
        sessionId: session.id,
        action: "SESSION_CREATED",
        details: {
          clientMac: fields.clientMac,
          ssid: fields.ssid,
          sourceIp: meta.sourceIp,
        },
      },
    });

    sessionId = session.id;
  } catch (err) {
    console.error("Failed to create guest session:", err);
    createError = "Unable to initialize your session. Please try again.";
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome to Guest Wi-Fi
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Please review and accept the Terms and Conditions to continue.
          </p>
        </div>

        {fields.ssid && (
          <div className="mb-2 text-sm text-gray-600">
            <span className="font-medium">Network:</span> {fields.ssid}
          </div>
        )}
        {fields.clientMac && (
          <div className="mb-4 text-sm text-gray-600">
            <span className="font-medium">Device:</span> {fields.clientMac}
          </div>
        )}

        <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 mb-6 text-sm text-gray-700 max-h-40 overflow-y-auto leading-relaxed">
          By using this guest wireless network, you agree to use the service
          responsibly and comply with all applicable policies. Access may be
          monitored and logged for security and operational purposes.
        </div>

        {createError ? (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {createError}
          </div>
        ) : (
          <AcceptButton sessionId={sessionId!} />
        )}

        <p className="mt-6 text-center text-xs text-gray-400">OS-ONE-CWP</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Test portal flow locally**

Start the dev server:
```bash
npm run dev
```

Visit:
```
http://localhost:3000/portal?client_mac=AA:BB:CC:DD:EE:FF&ssid=GuestWiFi&redirect_url=https://example.com
```

Expected: T&C card renders with Network: GuestWiFi and Device: AA:BB:CC:DD:EE:FF. Click Accept → redirects to https://example.com. Check Prisma Studio for the session and audit events.

- [ ] **Step 4: Commit**

```bash
git add app/portal/
git commit -m "feat: add /portal page with session creation, T&C card, and accept flow"
```

---

## Task 9: Success Page

**Files:**
- Create: `app/success/page.tsx`

- [ ] **Step 1: Create the success page**

```typescript
// app/success/page.tsx
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session: sessionId } = await searchParams;

  let session = null;
  if (sessionId) {
    try {
      session = await prisma.guestSession.findUnique({
        where: { id: sessionId },
      });
    } catch {
      // Non-fatal — success page still renders without session details
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8 text-center">
        <div className="mb-4 text-green-500">
          <svg
            className="mx-auto h-16 w-16"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Connection Authorized
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          Your guest access request has been accepted.
        </p>

        {session && (
          <div className="text-left rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700 space-y-2">
            <div>
              <span className="font-medium">Session ID:</span>{" "}
              <span className="font-mono text-xs break-all">{session.id}</span>
            </div>
            {session.clientMac && (
              <div>
                <span className="font-medium">Device:</span> {session.clientMac}
              </div>
            )}
            {session.ssid && (
              <div>
                <span className="font-medium">Network:</span> {session.ssid}
              </div>
            )}
            {session.acceptedAt && (
              <div>
                <span className="font-medium">Accepted at:</span>{" "}
                {session.acceptedAt.toISOString()}
              </div>
            )}
          </div>
        )}

        <p className="mt-6 text-xs text-gray-400">OS-ONE-CWP</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Test the success page**

```
http://localhost:3000/success?session=<a session id from Prisma Studio>
```

Expected: Green checkmark, "Connection Authorized", session details shown.

- [ ] **Step 3: Commit**

```bash
git add app/success/page.tsx
git commit -m "feat: add /success page with session detail display"
```

---

## Task 10: Admin Sessions List Page

**Files:**
- Create: `app/admin/sessions/page.tsx`

- [ ] **Step 1: Create the admin sessions page**

```typescript
// app/admin/sessions/page.tsx
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  STARTED: "bg-yellow-100 text-yellow-800",
  ACCEPTED: "bg-green-100 text-green-800",
  REDIRECTED: "bg-blue-100 text-blue-800",
  BLOCKED_REDIRECT: "bg-orange-100 text-orange-800",
  ERROR: "bg-red-100 text-red-800",
  EXPIRED: "bg-gray-100 text-gray-600",
};

export default async function AdminSessionsPage() {
  const sessions = await prisma.guestSession.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const testUrl = `${appBaseUrl}/portal?client_mac=AA:BB:CC:DD:EE:FF&ssid=GuestWiFi&redirect_url=https://example.com`;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Guest Sessions
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          OS-ONE-CWP Admin — Phase 1 — {sessions.length} recent session
          {sessions.length !== 1 ? "s" : ""}
        </p>

        <div className="mb-6 rounded-lg bg-blue-50 border border-blue-200 p-4">
          <p className="text-xs font-semibold text-blue-700 mb-1 uppercase tracking-wide">
            Test URL
          </p>
          <code className="text-xs text-blue-900 break-all select-all">
            {testUrl}
          </code>
        </div>

        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                {[
                  "Created",
                  "Status",
                  "Client MAC",
                  "AP MAC",
                  "SSID",
                  "User IP",
                  "Redirect URL",
                  "Accepted",
                  "Accepted At",
                  "User Agent",
                  "Detail",
                ].map((h) => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sessions.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    No sessions yet. Visit the test URL above to create one.
                  </td>
                </tr>
              )}
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                    {s.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[s.status] ?? "bg-gray-100 text-gray-700"}`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {s.clientMac ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {s.apMac ?? "—"}
                  </td>
                  <td className="px-4 py-3">{s.ssid ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {s.userIp ?? s.sourceIp ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[200px] truncate">
                    {s.redirectUrl ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.acceptedTerms ? (
                      <span className="text-green-600 font-semibold">Yes</span>
                    ) : (
                      <span className="text-gray-400">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                    {s.acceptedAt
                      ? s.acceptedAt
                          .toISOString()
                          .replace("T", " ")
                          .slice(0, 19)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[150px] truncate">
                    {s.userAgent ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/sessions/${s.id}`}
                      className="text-blue-600 hover:underline text-xs whitespace-nowrap"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Test the admin page**

```
http://localhost:3000/admin/sessions
```

Expected: Table with test URL shown at top. Sessions display after creating them via /portal.

- [ ] **Step 3: Commit**

```bash
git add app/admin/sessions/page.tsx
git commit -m "feat: add /admin/sessions list page with status badges and test URL"
```

---

## Task 11: Admin Session Detail Page

**Files:**
- Create: `app/admin/sessions/[id]/page.tsx`

- [ ] **Step 1: Create the detail page**

```typescript
// app/admin/sessions/[id]/page.tsx
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await prisma.guestSession.findUnique({
    where: { id },
    include: { auditEvents: { orderBy: { createdAt: "asc" } } },
  });

  if (!session) notFound();

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <Link
            href="/admin/sessions"
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to sessions
          </Link>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">
          Session Detail
        </h1>
        <p className="font-mono text-xs text-gray-500 mb-6 break-all">
          {session.id}
        </p>

        <div className="space-y-4">
          <Section title="Parsed Fields">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status" value={session.status} />
              <Field label="Client MAC" value={session.clientMac} />
              <Field label="AP MAC" value={session.apMac} />
              <Field label="SSID" value={session.ssid} />
              <Field label="WLAN" value={session.wlan} />
              <Field label="VLAN" value={session.vlan} />
              <Field label="Site" value={session.site} />
              <Field label="Controller" value={session.controller} />
              <Field label="NAS ID" value={session.nasId} />
              <Field label="Session Token" value={session.sessionToken} />
              <Field
                label="Controller Session ID"
                value={session.controllerSessionId}
              />
              <Field label="User IP" value={session.userIp} />
              <Field label="Source IP" value={session.sourceIp} />
              <Field label="Redirect URL" value={session.redirectUrl} />
              <Field label="Success URL" value={session.successUrl} />
              <Field
                label="Accepted Terms"
                value={session.acceptedTerms ? "Yes" : "No"}
              />
              <Field
                label="Accepted At"
                value={session.acceptedAt?.toISOString() ?? null}
              />
              <Field label="Created At" value={session.createdAt.toISOString()} />
              <Field label="Updated At" value={session.updatedAt.toISOString()} />
            </div>
          </Section>

          <Section title="User Agent">
            <pre className="text-xs bg-gray-900 text-green-300 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-words">
              {session.userAgent ?? "(none)"}
            </pre>
          </Section>

          <Section title="Raw Query Parameters">
            <pre className="text-xs bg-gray-900 text-green-300 rounded-lg p-4 overflow-x-auto">
              {JSON.stringify(session.rawQuery, null, 2)}
            </pre>
          </Section>

          <Section title="Raw Headers">
            <pre className="text-xs bg-gray-900 text-green-300 rounded-lg p-4 overflow-x-auto max-h-80">
              {JSON.stringify(session.rawHeaders, null, 2)}
            </pre>
          </Section>

          <Section title={`Audit Events (${session.auditEvents.length})`}>
            {session.auditEvents.length === 0 ? (
              <p className="text-sm text-gray-400">No audit events</p>
            ) : (
              <div className="space-y-2">
                {session.auditEvents.map((e) => (
                  <div
                    key={e.id}
                    className="rounded-lg bg-gray-50 border border-gray-200 p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-semibold text-gray-800">
                        {e.action}
                      </span>
                      <span className="text-xs text-gray-400">
                        {e.createdAt.toISOString()}
                      </span>
                    </div>
                    {e.details && (
                      <pre className="text-xs text-gray-600 overflow-x-auto">
                        {JSON.stringify(e.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow p-5">
      <h2 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-mono text-gray-900 break-all">
        {value ?? "—"}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Test**

After creating a session via `/portal`, click "View →" from admin list.

Expected: All parsed fields, raw query JSON, raw headers JSON, and audit events displayed.

- [ ] **Step 3: Commit**

```bash
git add app/admin/sessions/[id]/page.tsx
git commit -m "feat: add /admin/sessions/[id] detail page with raw data and audit log"
```

---

## Task 12: Environment Config, README, .gitignore

**Files:**
- Create: `.env.example`
- Create: `README.md`
- Modify: `.gitignore` (ensure `.env` is excluded)

- [ ] **Step 1: Create .env.example**

```bash
# .env.example
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE

# Public URL of this deployment
APP_BASE_URL=https://os-one-cwp-production.up.railway.app

# Comma-separated allowed redirect domains (leave blank to allow all https)
ALLOWED_REDIRECT_DOMAINS=

# Override the default post-acceptance redirect (optional)
DEFAULT_SUCCESS_URL=

NODE_ENV=development
```

- [ ] **Step 2: Create README.md**

```markdown
# OS-ONE-CWP

A lightweight cloud-hosted Captive Web Portal proof of concept for Extreme Campus Controller External CWP/UAP workflows.

## What this is

OS-ONE-CWP is a basic external captive portal endpoint. When an Extreme Campus Controller redirects a guest device to this service, it:

1. Captures all query parameters the controller provides
2. Captures request headers and source IP
3. Creates a persisted guest session record
4. Displays Terms and Conditions to the guest
5. Records acceptance with a timestamp
6. Safely redirects the guest to the controller-specified destination URL

## What this is not

- Not Extreme Guest Essentials
- Not a marketing or loyalty platform
- Not a social login platform
- No sponsor approval workflows
- No voucher codes
- No PPSK management
- No email or SMS
- No multi-tenancy

## Phase 1 Scope

- [x] External redirect landing page (`/portal`)
- [x] Terms and Conditions acceptance
- [x] Guest session logging (all fields)
- [x] Raw query parameter capture
- [x] Raw header capture
- [x] Source IP detection (proxy-aware)
- [x] Safe redirect validation
- [x] Admin session viewer (`/admin/sessions`)
- [x] Session detail page with raw data and audit log

## Local Setup

### Prerequisites

- Node.js 18+
- PostgreSQL running locally

### Steps

```bash
npm install
cp .env.example .env
# Edit .env and set DATABASE_URL to your local Postgres connection string
npx prisma migrate dev
npm run dev
```

App runs at http://localhost:3000

## Railway Setup

1. Connect this GitHub repo to Railway
2. Add a PostgreSQL service in Railway
3. Railway automatically injects `DATABASE_URL` from the Postgres service
4. Set these environment variables in Railway:
   - `APP_BASE_URL=https://os-one-cwp-production.up.railway.app`
   - `ALLOWED_REDIRECT_DOMAINS=` (leave blank for Phase 1 or restrict as needed)
   - `NODE_ENV=production`
5. Deploy
6. After first deploy, run the database migration via Railway's terminal:
   ```bash
   npx prisma migrate deploy
   ```

## Test URLs

**Portal (simulates a controller redirect):**
```
https://os-one-cwp-production.up.railway.app/portal?client_mac=AA:BB:CC:DD:EE:FF&ssid=GuestWiFi&redirect_url=https://example.com
```

**Admin sessions list:**
```
https://os-one-cwp-production.up.railway.app/admin/sessions
```

## Extreme Campus Controller Test Plan

1. Create a test WLAN/SSID on the controller
2. Enable captive portal using **External CWP / UAP** mode
3. Set the external portal URL to:
   ```
   https://os-one-cwp-production.up.railway.app/portal
   ```
4. Connect a phone or laptop to the SSID
5. Confirm the controller redirects the browser to OS-ONE-CWP
6. Accept the Terms and Conditions
7. Confirm the redirect behavior (does the controller handle the post-auth redirect, or does the portal redirect?)
8. Check `/admin/sessions` for the session record
9. Open the session detail page
10. Copy the raw query parameters and headers — this reveals what the real controller sends

## Unknowns to Validate with Real Controller

- Exact query parameter names the XCC uses for client MAC, AP MAC, redirect URL
- Whether the controller redirects the client after portal acceptance, or the portal must redirect the controller
- Whether the controller expects a specific success URL format
- Whether the controller requires a token echoed back in the success redirect
- Whether the controller requires an API callback to authorize the session
- Whether the controller requires RADIUS accounting
- Whether authorization is based purely on the portal redirect or an external API call back to the controller

## Roadmap — Next Phases

After validating redirect behavior with a real controller:

1. Portal branding / custom themes per SSID
2. Multiple portal profiles
3. Self-registration (name + email)
4. Sponsor approval workflow
5. Voucher / one-time-code support
6. Controller-specific authorization callback (if required by XCC)
7. Local hosting / container packaging
```

- [ ] **Step 3: Ensure .gitignore excludes .env**

Verify `.gitignore` includes:
```
.env
.env.local
.env*.local
```

If not present (create-next-app usually adds them), add them manually.

- [ ] **Step 4: Commit**

```bash
git add .env.example README.md .gitignore
git commit -m "docs: add README, .env.example, and verify .gitignore"
```

---

## Task 13: Build Check and Fix

**Files:** Any files with type errors

- [ ] **Step 1: Run lint**

```bash
npm run lint
```

Fix any errors before proceeding. Common issues:
- Missing `React` import (not needed in Next.js 13+, but check if ESLint complains)
- Unused imports
- `any` type warnings

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds with no errors. Watch for:
- Type errors in `app/` files related to `params`/`searchParams` being `Promise<...>` in Next.js 15
- Missing Prisma types (run `npx prisma generate` if needed)
- Missing `ReadonlyHeaders` import from `next/dist/...` — if that path fails, change `getRequestMetadata.ts` to accept `Headers` and call it via `new Headers(Object.fromEntries(headersList.entries()))` or use `ReadonlyRequestCookies` type pattern

**If `ReadonlyHeaders` import path causes issues**, update `lib/request/getRequestMetadata.ts`:

```typescript
// lib/request/getRequestMetadata.ts
export interface RequestMetadata {
  sourceIp: string | null;
  userAgent: string | null;
  rawHeaders: Record<string, string>;
}

export function getRequestMetadata(
  headers: Iterable<[string, string]> & {
    get: (name: string) => string | null;
    forEach: (fn: (value: string, key: string) => void) => void;
  }
): RequestMetadata {
  const rawHeaders: Record<string, string> = {};
  headers.forEach((value, key) => {
    rawHeaders[key] = value;
  });

  const sourceIp =
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    null;

  const userAgent = headers.get("user-agent") ?? null;

  return { sourceIp, userAgent, rawHeaders };
}
```

- [ ] **Step 3: Fix any errors and rebuild**

```bash
npm run build
```

Expected: Clean build output. `.next/` directory created.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: resolve lint and build errors for production readiness"
```

---

## Task 14: Push and Railway Deploy

- [ ] **Step 1: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Verify Railway picks up the push**

Railway should auto-deploy from the GitHub repo. If not configured, connect the repo in Railway dashboard.

- [ ] **Step 3: Set environment variables in Railway**

In Railway → your service → Variables:
```
DATABASE_URL          (auto-injected if you added a Postgres plugin)
APP_BASE_URL          https://os-one-cwp-production.up.railway.app
ALLOWED_REDIRECT_DOMAINS   (blank for Phase 1)
DEFAULT_SUCCESS_URL   (blank — app will use /success?session=...)
NODE_ENV              production
```

- [ ] **Step 4: Run the migration on Railway**

In Railway → your service → Shell (or deploy command):
```bash
npx prisma migrate deploy
```

- [ ] **Step 5: Smoke test production**

```
https://os-one-cwp-production.up.railway.app/portal?client_mac=AA:BB:CC:DD:EE:FF&ssid=GuestWiFi&redirect_url=https://example.com
```

Expected: T&C card renders. Accept → redirects to https://example.com.

```
https://os-one-cwp-production.up.railway.app/admin/sessions
```

Expected: Session appears in the list.

---

## Self-Review Spec Coverage Checklist

- [x] `/portal` — creates GuestSession, captures all params, renders T&C
- [x] All 30+ known query param names mapped → extractSessionFields
- [x] rawQuery stored (full params object)
- [x] rawHeaders stored (via getRequestMetadata)
- [x] sourceIp extracted from proxy headers
- [x] userAgent extracted
- [x] Never fails if params missing (all fields optional)
- [x] POST `/api/accept` — finds session, marks acceptedTerms, writes AuditEvent
- [x] Redirect decision order: session.redirectUrl → session.successUrl → DEFAULT_SUCCESS_URL → /success
- [x] Safe redirect: blocks javascript:, data:, file:, vbscript:; http only for localhost; ALLOWED_REDIRECT_DOMAINS check
- [x] Blocked redirect → BLOCKED_REDIRECT status + audit event
- [x] `/success` — shows Connection Authorized + session details if sessionId provided
- [x] `/admin/sessions` — table newest first, all required columns, test URL at top
- [x] `/admin/sessions/[id]` — all parsed fields, rawQuery, rawHeaders, audit events
- [x] GuestSession model — all required fields + indexes
- [x] AuditEvent model — sessionId, action, details, createdAt
- [x] SessionStatus enum — all 6 values
- [x] package.json scripts — dev, build, start, lint, prisma:*
- [x] postinstall runs prisma generate (Railway compatibility)
- [x] .env.example — all 5 env vars
- [x] README — all 9 required sections
- [x] No auth, no multi-tenancy, no email, no vouchers, no sponsor approval
