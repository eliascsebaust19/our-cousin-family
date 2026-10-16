import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // This app's data layer is entirely client-side fetch-on-effect: effects
    // intentionally (1) reset loading state synchronously when a dependency
    // changes (`set-state-in-effect`) and (2) derive time-based UI such as
    // invitation expiry from `Date.now()` during render (`purity`). Both only
    // run client-side after an async fetch (SSR renders the loading state),
    // so there is no hydration risk. Revisit if we move to RSC data fetching.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Deno runtime code for Supabase Edge Functions — deployed with
    // `supabase functions deploy`, not compiled by Next.js or tsc.
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
