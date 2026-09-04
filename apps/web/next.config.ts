import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@twin/shared", "@twin/config", "three"],
  reactStrictMode: true,
};

export default nextConfig;
