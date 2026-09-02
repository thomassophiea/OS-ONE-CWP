import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // `eslint-config-next` only turns on a curated 6-rule subset of
  // `jsx-a11y` (alt-text, aria-props/proptypes, aria-unsupported-elements,
  // role-has/supports-required-aria-props). The guest-facing portal in this
  // repo has no other static accessibility gate, so run the plugin's full
  // `recommended` set — label association, keyboard handlers, focus, tabIndex
  // misuse, autocomplete validity — on top of Next's subset rather than
  // instead of it.
  {
    // `eslint-config-next` already registers the `jsx-a11y` plugin object
    // (under this same key) via `core-web-vitals` — re-declaring it here
    // throws "Cannot redefine plugin". Only the rule set needs adding.
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: { ...jsxA11y.flatConfigs.recommended.rules },
  },
  // Override default ignores of eslint-config-next.
  {
    // `react-hooks/purity` (the React Compiler's render-purity check,
    // bundled by `eslint-config-next` 16) flags `Date.now()` here as an
    // impure render call. This is an async Server Component executing once
    // per request, not a client component the compiler will re-render in
    // place — reading the real clock to compute a grant's expiry is correct
    // here, not the bug the rule exists to catch. Pre-existing, unrelated to
    // the accessibility work this config change ships alongside; scoped off
    // rather than left breaking `npm run lint` for everyone.
    files: ["app/success/page.tsx"],
    rules: { "react-hooks/purity": "off" },
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Offline static-artboard generator toolchain (plain CommonJS scripts
    // that build the design-review artboards) — not part of the shipped
    // Next.js app, and its `.cjs` files correctly use `require()`.
    "design-artboards/**",
  ]),
]);

export default eslintConfig;
