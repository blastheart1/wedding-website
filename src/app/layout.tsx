import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from 'sonner'

export const viewport: Viewport = {
  width:        'device-width',
  initialScale: 1,
  themeColor:   '#C96070',
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'),
  title:       'Luis & Bee — February 27, 2027',
  description: 'Join us to celebrate the wedding of Luis & Bee on February 27, 2027.',
  openGraph: {
    title:       'Luis & Bee are getting married! 🌸',
    description: 'February 27, 2027 — Join us to celebrate.',
    type:        'website',
    images: [
      {
        url:    '/flowers/garland.webp',
        width:  1200,
        height: 630,
        alt:    'Luis & Bee Wedding',
      },
    ],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  )
}
