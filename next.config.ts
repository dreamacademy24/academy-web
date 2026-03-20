import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.jparkislandresort.com",
      },
      {
        protocol: "https",
        hostname: "cubenineresort.com",
      },
    ],
  },
};

export default nextConfig;
