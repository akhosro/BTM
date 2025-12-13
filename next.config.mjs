/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Fix for Vercel deployment: Don't bundle these packages
  serverComponentsExternalPackages: ['pg', 'pg-pool'],
  experimental: {
    // Instrument only on Node.js runtime (not during build)
    instrumentationHook: true,
  },
}

export default nextConfig
