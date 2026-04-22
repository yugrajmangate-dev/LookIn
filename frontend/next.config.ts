import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      // Reduces intermittent ENOENT/cache corruption issues on synced folders.
      config.cache = false;
    }
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/static/**",
      },
      {
        // Render.com deployed backend  (*.onrender.com)
        protocol: "https",
        hostname: "**.onrender.com",
        pathname: "/static/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/favicon.ico",
        destination: "/icon.svg",
      },
    ];
  },
};

export default nextConfig;
