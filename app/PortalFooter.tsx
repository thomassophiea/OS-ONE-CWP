import type { EffectiveBranding } from "@/lib/config/portal";

/**
 * The one footer line every guest page shares. The operator's footer setting
 * has three states: null keeps the pre-existing portal-name line, true is the
 * branded "Powered by" line, false removes the footer entirely.
 */
export default function PortalFooter({
  branding,
  portalName,
  className = "mt-6 text-center text-xs",
}: {
  branding: EffectiveBranding;
  portalName: string;
  className?: string;
}) {
  if (branding.footer === false) return null;
  if (branding.footer === true) {
    return (
      <p className={className} style={{ color: branding.color }}>
        Powered by Extreme Platform ONE
      </p>
    );
  }
  // slate-400 on white/slate-50 measures ~2.5:1 — well under the 4.5:1 AA
  // text floor (WCAG 1.4.3). slate-600 (~7.2–7.6:1) keeps the same muted,
  // secondary look with real margin.
  return <p className={`${className} text-slate-600`}>{portalName}</p>;
}
