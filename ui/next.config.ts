import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/leaderboard", destination: "/", permanent: true },
      { source: "/test-results", destination: "/", permanent: false },
      {
        source: "/test-results/:path*",
        destination: "/",
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
