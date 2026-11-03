import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The existing QR bootstrap necessarily carries its credential in the entry path.
  // Never copy that credential into the development access log.
  logging: { incomingRequests: { ignore: [/^\/r(?:\/|\?|$)/] } },
  experimental: {
    ...(process.env.FB_LOCAL_LAB === '1' ? { serverComponentsHmrCache: false, turbopackFileSystemCacheForDev: false } : {}),
    serverActions: {
      bodySizeLimit: '3mb',
    },
  },
};

export default nextConfig;
