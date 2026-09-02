import { createBrandImageRoute } from "@/lib/config/brandImageRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `PUT { data, mimeType }` stores a new background image (≤5 MB, no
 * dimension ceiling — see `imageUpload.ts`). `DELETE` clears it, reverting
 * to today's plain page background. Same internal bearer auth as
 * `/api/internal/config`.
 */
export const { PUT, DELETE } = createBrandImageRoute("background");
