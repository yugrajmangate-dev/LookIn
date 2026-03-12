import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
