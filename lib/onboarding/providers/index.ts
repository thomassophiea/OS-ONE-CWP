/**
 * Provider selection.
 *
 * One provider today. The reason this indirection exists rather than importing
 * `skynetProvider` directly everywhere is that when a PPSK provider arrives it
 * becomes a second branch *here* — every call site upstream already asks for
 * "the provider for this onboarding" instead of naming one.
 *
 * A future PPSK provider is expected to be chosen per onboarding session (some
 * guests get a per-device key, some do not), which is why the selector takes
 * the session context rather than being a bare constant.
 */

import type { CredentialProvider } from "@/lib/onboarding/credentialProvider";
import { skynetProvider } from "@/lib/onboarding/providers/skynet";

export interface ProviderSelectionContext {
  /** Station MAC, when the gateway told us one. */
  clientMac?: string | null;
  /** SSID the device is currently on. */
  sourceSsid?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function credentialProviderFor(_context: ProviderSelectionContext = {}): CredentialProvider {
  return skynetProvider;
}

/** Look a provider up by the id recorded on an existing onboarding session. */
export function credentialProviderById(id: string): CredentialProvider | null {
  return id === skynetProvider.id ? skynetProvider : null;
}

export { skynetProvider };
