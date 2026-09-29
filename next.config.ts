import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Ensure server components can import domain packages cleanly
  serverExternalPackages: ['@turf/turf'],
};

export default nextConfig;
