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
        source: '/app-icon/:size',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
      },
      {
        source: '/wedding/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=2592000' }],
      },
    ]
  },
  // Browsers and some apps ask for /favicon.ico without being told to. Send them to the site icon.
  async redirects() {
    return [{ source: '/favicon.ico', destination: '/app-icon/32', permanent: false }]
  },
}

module.exports = nextConfig
