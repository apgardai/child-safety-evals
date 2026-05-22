import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/test-results", destination: "/leaderboard", permanent: false },
      {
        source: "/test-results/:path*",
        destination: "/leaderboard",
        permanent: false,
      },
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
