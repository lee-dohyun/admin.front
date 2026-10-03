import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dockerfile 이 .next/standalone 산출물만 실어 node server.js 로 띄운다(gateway#247).
  output: "standalone",
  transpilePackages: ["@posselect/ui"],
};

export default nextConfig;
