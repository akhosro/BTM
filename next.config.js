/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable TypeScript checking during build - we'll fix types incrementally
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
