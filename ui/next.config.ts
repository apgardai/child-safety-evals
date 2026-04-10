import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/results", destination: "/scenarios", permanent: true },
      {
        source: "/api/results/:path*",
        destination: "/api/scenarios/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
