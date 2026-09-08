import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  assetPrefix: process.env.GITHUB_ACTIONS ? '/domy' : '',
};

export default nextConfig;
