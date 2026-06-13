import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  // Prevent Next.js from bundling server-only Node.js packages.
  // dockerode and its deps (ssh2, cpu-features, etc.) contain native binaries
  // that webpack cannot parse — they must stay as runtime require()s.
  serverExternalPackages: ["dockerode", "ssh2", "cpu-features", "nan", "nodemailer"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default withBundleAnalyzer(nextConfig);
