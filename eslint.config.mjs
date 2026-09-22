import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // This codebase has a lot of pre-existing `any` usage; flag it for cleanup
      // without failing `next build`, which previously had no lint step at all.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

export default eslintConfig;
