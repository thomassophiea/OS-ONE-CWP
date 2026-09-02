import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { requestLocale } from "@/lib/i18n/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Default document metadata, resolved in the guest's own language.
 *
 * A page further down the tree overrides just `title` and inherits this
 * template (`%s · <portal name>`), so every screen gets a real, descriptive,
 * per-locale `<title>` instead of the Next.js scaffold default — a screen
 * reader user switching tabs, or a sighted user with a dozen captive-portal
 * tabs open, has to be able to tell them apart (WCAG 2.4.2).
 */
export async function generateMetadata(): Promise<Metadata> {
  const { messages } = await requestLocale();
  return {
    title: {
      default: messages.landing.title,
      template: `%s · ${messages.common.portalName}`,
    },
    description: messages.landing.body,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The document's own `lang`/`dir` — not just a nested `<main>`'s — is what
  // assistive tech actually reads to pick pronunciation rules (WCAG 3.1.1).
  // Every page already resolves the same way via `requestLocale()`, so this
  // stays consistent with whatever content that page renders.
  const { locale, definition } = await requestLocale();
  return (
    <html
      lang={locale}
      dir={definition.dir}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
