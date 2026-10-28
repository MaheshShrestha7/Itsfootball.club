import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  // Build output and generated files (plain `eslint .` otherwise reports thousands of problems in them)
  { ignores: [".next/**", ".open-next/**", ".wrangler/**", "node_modules/**", "next-env.d.ts",
    // Cloudflare Worker entry: bundled by wrangler around the generated .open-next/worker.js, not part of the Next app
    "worker.ts",
    // MediaPipe's wasm loaders, copied from node_modules by scripts/copy-mediapipe.mjs on build
    "public/vendor/**"] },
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // This codebase has a lot of pre-existing `any` usage; flag it for cleanup
      // without failing `next build`, which previously had no lint step at all.
      "@typescript-eslint/no-explicit-any": "warn",
      // Images deliberately use native <img> (explicit width/height, loading, decoding, fetchPriority)
      // rather than next/image: they come from admin-supplied hosts not in images.remotePatterns, and the
      // Cloudflare (OpenNext) deployment has no image-optimisation binding for /_next/image.
      "@next/next/no-img-element": "off",
      // New React Compiler checks that arrived with eslint-config-next 16 (react-hooks v7). The existing
      // code was written before them; flag for cleanup without failing lint, like no-explicit-any above.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/refs": "warn",
    },
  },
];

export default eslintConfig;
