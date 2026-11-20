import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const localDevOrigins = Object.values(networkInterfaces())
  .flatMap((addresses) => addresses ?? [])
  .filter((address) => address.family === "IPv4" && !address.internal)
  .map((address) => address.address);

const nextConfig: NextConfig = {
  distDir: process.env.OMNILINK_ISOLATED_PREVIEW === "1" ? ".next-preview" : ".next",
  output: process.env.VERCEL || process.env.OMNILINK_CLOUDFLARE === "1" ? undefined : "standalone",
  experimental: {
    agentUpgrade: "security",
  },
  outputFileTracingIncludes: {
    '/api/site-builder': ['./lib/site-builder/template/**/*'],
    '/api/site-builder/preview': ['./lib/site-builder/template/**/*'],
    '/sites/**': ['./lib/site-builder/template/**/*'],
    '/api/consumer/assistant': ['./.agents/skills/personal-advisor/**/*'],
  },
  serverExternalPackages: ['pdfjs-dist'],
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    ...localDevOrigins,
    "*.run.app",
    "*.us-west2.run.app",
    "ais-dev-aypa2j3pwmytwqq5ix2o47-597406845102.us-west2.run.app",
    "ais-pre-aypa2j3pwmytwqq5ix2o47-597406845102.us-west2.run.app",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
        port: "",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
        ],
      },
    ];
  },
};

export default nextConfig;

