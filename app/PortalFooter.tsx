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
  return <p className={`${className} text-slate-400`}>{portalName}</p>;
}
