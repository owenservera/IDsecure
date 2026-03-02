import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // CDN Configuration for optimized asset delivery
  assetPrefix: process.env.CDN_URL || undefined,
  // Enable CDN for production
  productionBrowserSourceMaps: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // Optimize images with CDN
    optimizeCss: true,
  },
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  typescript: {
    ignoreBuildErrors: false,  // Enable strict type checking
  },
  reactStrictMode: true,  // Enable React strict mode for better dev experience
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'X-DNS-Prefetch-Control', value: 'on' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
  ],
};

export default nextConfig;
