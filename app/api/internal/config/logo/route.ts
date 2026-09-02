import { createBrandImageRoute } from "@/lib/config/brandImageRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `PUT { data, mimeType }` stores a new logo (≤100 KB, ≤500×200px — see
 * `imageUpload.ts`). `DELETE` clears the override and reverts to the bundled
 * Extreme mark. Same internal bearer auth as `/api/internal/config`.
 */
export const { PUT, DELETE } = createBrandImageRoute("logo");
