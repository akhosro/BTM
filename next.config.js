/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable instrumentation hook for background jobs
  experimental: {
    instrumentationHook: true,
  },
};

module.exports = nextConfig;
