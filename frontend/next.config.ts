import type { NextConfig } from "next";

// BACKEND_URL is server-side only and powers the /api rewrite.
// Keep this separate from any client-visible env so the browser never needs
// to know the backend port or origin.
const backendUrl = (process.env.BACKEND_URL || "http://localhost:8100").replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
