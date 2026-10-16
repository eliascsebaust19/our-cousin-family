import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents is intentionally OFF: every authenticated page is
  // per-user dynamic (cookies + per-family data), so the Cache Components
  // model would only add Suspense boilerplate. Revisit if we adopt `use cache`.
  // partialPrefetching and cacheComponents relationship in this Next version - disable partialPrefetching for now
  partialPrefetching: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
