import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["vlab.abc.com", "localhost"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8800/api/:path*",
      },
    ];
  },
};

export default nextConfig;
