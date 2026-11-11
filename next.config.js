/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname:  'res.cloudinary.com',
        pathname:  '/**',
      },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['@neondatabase/serverless', 'cloudinary'],
  },
  // Site artwork (3D model, photos, fonts, video) rarely changes. Let browsers keep it for
  // a week and refresh it in the background afterwards, instead of re-checking every file
  // on every visit. When replacing a file, give it a new name so guests get it at once.
  async headers() {
    return [
      {
        source: '/wedding/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=2592000' }],
      },
    ]
  },
}

module.exports = nextConfig
