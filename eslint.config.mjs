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
      // Images deliberately use native <img> (explicit width/height, loading, decoding, fetchPriority)
      // rather than next/image: they come from admin-supplied hosts not in images.remotePatterns, and the
      // Cloudflare (OpenNext) deployment has no image-optimisation binding for /_next/image.
      "@next/next/no-img-element": "off",
    },
  },
];

export default eslintConfig;
