import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/', destination: '/landing/index.html' }];
  },
};

export default nextConfig;
