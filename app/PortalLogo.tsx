import type { EffectiveBranding } from "@/lib/config/portal";

/**
 * The mark at the top of every guest screen. Always renders something — the
 * operator's upload, or the bundled Extreme default — because
 * `branding.logoUrl` is itself always resolvable (see `portal-assets/logo`).
 * Real `alt` text, not an empty one: WCAG 1.1.1, and it is the one image on
 * this page that is not decorative — it is how a guest recognises whose
 * network they are joining.
 */
export default function PortalLogo({
  branding,
  alt,
  className = "mb-4",
}: {
  branding: Pick<EffectiveBranding, "logoUrl" | "alignment">;
  alt: string;
  className?: string;
}) {
  const justify =
    branding.alignment === "left"
      ? "justify-start"
      : branding.alignment === "right"
        ? "justify-end"
        : "justify-center";
  return (
    <div className={`flex ${justify} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a same-origin
          portal-owned asset, not something next/image's remote-loader config
          should need to know about. */}
      <img src={branding.logoUrl} alt={alt} className="h-10 max-w-[240px] object-contain" />
    </div>
  );
}
