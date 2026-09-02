import type { CSSProperties } from "react";
import type { EffectiveBranding } from "@/lib/config/portal";

/**
 * Inline style for the page's outer container. Undefined (not an empty
 * object) when no background is set, so spreading it onto an element that
 * already has its own `style` never overwrites anything with nothing.
 */
export function portalBackgroundStyle(
  branding: Pick<EffectiveBranding, "backgroundUrl">
): CSSProperties | undefined {
  if (!branding.backgroundUrl) return undefined;
  return {
    backgroundImage: `url(${branding.backgroundUrl})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };
}
