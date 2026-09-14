import type { NextConfig } from "next";

const isGhPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // GitHub Pages hosts the site under /konwenty-nk; build with
  // GITHUB_PAGES=true to prefix assets and routes accordingly.
  ...(isGhPages ? { basePath: "/konwenty-nk", assetPrefix: "/konwenty-nk" } : {}),
};

export default nextConfig;