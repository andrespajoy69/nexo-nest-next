/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/', destination: '/landing/index.html' }];
  },
};

export default nextConfig;
