import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    settings: { next: { rootDir: "apps/web/" }, react: { version: "19.2" } },
    rules: {
      // `any` is allowed only with an explanatory comment (CLAUDE.md §5).
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/out/**",
    "**/dist/**",
    "**/.venv/**",
    "**/.turbo/**",
    "**/next-env.d.ts",
    "**/src/generated/**",
    "supabase/.temp/**",
    "**/.superpowers/**",
  ]),
]);
