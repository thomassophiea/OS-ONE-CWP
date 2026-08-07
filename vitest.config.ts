import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The repo lives on a volume that materialises AppleDouble sidecars; they
    // are binary and break the transform.
    exclude: ["**/node_modules/**", "**/._*"],
  },
});
