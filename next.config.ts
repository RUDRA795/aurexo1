import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['lucide-react'],
  // Ensure server components can import domain packages cleanly
  serverExternalPackages: ['@turf/turf'],
};

export default nextConfig;
